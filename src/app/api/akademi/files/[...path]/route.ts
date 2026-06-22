import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "fs";
import { join, normalize } from "path";
import { Readable } from "stream";

const UPLOADS_ROOT = join(process.cwd(), "public", "uploads", "akademi");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: pathParts } = await params;
  const rel = pathParts.join("/");
  const full = normalize(join(UPLOADS_ROOT, rel));

  if (!full.startsWith(UPLOADS_ROOT)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  let stat;
  try {
    stat = statSync(full);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!stat.isFile()) {
    return NextResponse.json({ error: "Not a file" }, { status: 400 });
  }

  const contentType = guessContentType(full);
  const etag = `"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`;
  const lastModified = stat.mtime.toUTCString();

  const ifNoneMatch = req.headers.get("if-none-match");
  const ifModifiedSince = req.headers.get("if-modified-since");
  const range = req.headers.get("range");

  if (!range && (ifNoneMatch === etag || (ifModifiedSince && new Date(ifModifiedSince).getTime() >= Math.floor(stat.mtimeMs)))) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Last-Modified": lastModified,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;

      if (start >= stat.size || end >= stat.size) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${stat.size}` },
        });
      }

      const chunkSize = end - start + 1;
      const nodeStream = createReadStream(full, { start, end });
      req.signal.addEventListener("abort", () => nodeStream.destroy());

      const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": contentType,
          ETag: etag,
          "Last-Modified": lastModified,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  }

  const nodeStream = createReadStream(full);
  req.signal.addEventListener("abort", () => nodeStream.destroy());
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    headers: {
      "Content-Length": String(stat.size),
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      ETag: etag,
      "Last-Modified": lastModified,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

function guessContentType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}
