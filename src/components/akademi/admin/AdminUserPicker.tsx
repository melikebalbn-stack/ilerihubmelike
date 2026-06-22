"use client";

import { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, X, User as UserIcon } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface UserOption {
  id: string;
  name: string;
  email: string;
  department: string | null;
}

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
}

interface RawUser {
  id: string;
  name?: string | null;
  email?: string | null;
  department?: string | null;
}

function normalizeUser(u: RawUser): UserOption {
  return {
    id: u.id,
    name: u.name ?? u.email?.split("@")[0] ?? "Kullanıcı",
    email: u.email ?? "",
    department: u.department ?? null,
  };
}

export function AdminUserPicker({
  value,
  onChange,
  label = "Kullanıcılar",
  placeholder = "Kullanıcı ara ve seç",
}: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedDetails, setSelectedDetails] = useState<UserOption[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      const url = `/api/users?source=db${
        query ? `&search=${encodeURIComponent(query)}` : ""
      }`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          const list: UserOption[] = Array.isArray(data)
            ? (data as RawUser[]).map(normalizeUser)
            : [];
          setOptions(list);
        })
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const removeOne = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  useEffect(() => {
    const combined: UserOption[] = [];
    value.forEach((id) => {
      const fromOptions = options.find((o) => o.id === id);
      const fromSelected = selectedDetails.find((s) => s.id === id);
      if (fromOptions) combined.push(fromOptions);
      else if (fromSelected) combined.push(fromSelected);
    });

    const missing = value.filter(
      (id) => !combined.some((c) => c.id === id)
    );

    if (missing.length === 0) {
      if (combined.length !== selectedDetails.length) {
        setSelectedDetails(combined);
      }
      return;
    }

    Promise.all(
      missing.map((id) =>
        fetch(`/api/users?source=db&search=${encodeURIComponent(id)}`)
          .then((r) => (r.ok ? r.json() : []))
          .then((data) => {
            const arr = Array.isArray(data) ? (data as RawUser[]) : [];
            const u = arr.find((x) => x.id === id);
            return u ? normalizeUser(u) : null;
          })
          .catch(() => null)
      )
    ).then((results) => {
      const valid = results.filter((r): r is UserOption => r !== null);
      setSelectedDetails((prev) => {
        const next = [...prev, ...valid].filter((s) =>
          value.includes(s.id)
        );
        const unique: UserOption[] = [];
        const seen = new Set<string>();
        next.forEach((n) => {
          if (!seen.has(n.id)) {
            seen.add(n.id);
            unique.push(n);
          }
        });
        return unique;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options]);

  return (
    <div className="space-y-2">
      <Label>
        {label} <span className="text-red-500">*</span>
      </Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md bg-white hover:bg-gray-50"
          >
            <span
              className={
                value.length === 0 ? "text-gray-500" : "text-gray-900"
              }
            >
              {value.length === 0
                ? placeholder
                : `${value.length} kullanıcı seçildi`}
            </span>
            <ChevronsUpDown className="w-4 h-4 text-gray-500" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="İsim, email veya departman..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {loading && (
                <div className="p-3 text-xs text-gray-500 text-center">
                  Aranıyor...
                </div>
              )}
              {!loading && options.length === 0 && (
                <CommandEmpty>Kullanıcı bulunamadı</CommandEmpty>
              )}
              {!loading && options.length > 0 && (
                <CommandGroup>
                  {options.map((u) => (
                    <CommandItem
                      key={u.id}
                      value={u.id}
                      onSelect={() => toggle(u.id)}
                      className="flex items-center gap-2"
                    >
                      <div className="w-4 flex justify-center">
                        {value.includes(u.id) && (
                          <Check className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {u.name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {u.email}
                          {u.department && ` · ${u.department}`}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedDetails.map((u) => (
            <div
              key={u.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
              style={{
                background: "var(--ak-accent-glow)",
                color: "var(--ak-accent)",
              }}
            >
              <UserIcon className="w-3 h-3" />
              <span className="font-medium">{u.name}</span>
              <button
                type="button"
                onClick={() => removeOne(u.id)}
                className="hover:opacity-70"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
