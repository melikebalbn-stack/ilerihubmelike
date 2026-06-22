"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AdminUsersTable } from "@/components/akademi/admin/AdminUsersTable";
import { AdminUserDetailModal } from "@/components/akademi/admin/AdminUserDetailModal";
import type { AdminUserListItem } from "@/types/akademi-admin";

export default function AkademiAdminUsersPage() {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const loadUsers = useCallback((q: string) => {
    setLoading(true);
    const url = q
      ? `/api/akademi/admin/users?search=${encodeURIComponent(q)}`
      : "/api/akademi/admin/users";
    fetch(url)
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((data) => setUsers(data.users ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadUsers(search.trim());
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, loadUsers]);

  return (
    <div className="ak-animate-in">
      <div className="mb-5">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim, email veya departman ara..."
            className="pl-10 pr-10"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div
          className="ak-card-static p-8 text-center text-sm"
          style={{ color: "var(--ak-text-tertiary)" }}
        >
          Yükleniyor...
        </div>
      ) : (
        <AdminUsersTable
          users={users}
          onSelect={(u) => setSelectedUserId(u.id)}
        />
      )}

      <AdminUserDetailModal
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    </div>
  );
}
