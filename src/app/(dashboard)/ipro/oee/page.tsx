import { redirect } from 'next/navigation'

// OEE Pano, İzleme Ekranı'na birleşti (tek görünüm, hep OEE hesaplı). Eski adres → /ipro/izleme.
export default function IproOeeRedirect() {
  redirect('/ipro/izleme')
}
