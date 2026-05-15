'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Loader2,
  Search,
  Link2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

interface UnlinkedUser {
  id: string
  email: string
  name: string | null
  department: string | null
  jobTitle: string | null
}
interface UnlinkedPersonnel {
  id: string
  sicilNo: string
  adSoyad: string
  bolum: string
  gorev: string
  mailAdresi: string | null
  azureAdEmail: string | null
}
interface BluecollarSuggestion {
  userId: string
  userEmail: string
  userName: string | null
  personnelId: string
  personnelSicilNo: string | null
  personnelName: string
}
interface WhitecollarSuggestion {
  userId: string
  userEmail: string
  userName: string | null
  personnelId: string
  personnelSicilNo: string | null
  personnelName: string
  similarity: number
}
interface ReconcileData {
  unlinkedUsers: UnlinkedUser[]
  unlinkedPersonnel: UnlinkedPersonnel[]
  bluecollarSuggestions: BluecollarSuggestion[]
  whitecollarSuggestions: WhitecollarSuggestion[]
  counts: {
    unlinkedUsers: number
    unlinkedPersonnel: number
    bluecollarSuggestions: number
    whitecollarSuggestions: number
  }
}

export function ReconcileClient() {
  const [data, setData] = useState<ReconcileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionPending, setActionPending] = useState(false)
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(
    null
  )
  const [bindTarget, setBindTarget] = useState<UnlinkedUser | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/personnel-ad-reconcile', {
        cache: 'no-store',
      })
      if (!res.ok) {
        setFlash({ kind: 'err', msg: 'Rapor yüklenemedi' })
        setData(null)
      } else {
        setData(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 4000)
    return () => clearTimeout(t)
  }, [flash])

  async function bindOne(userId: string, personnelId: string) {
    setActionPending(true)
    try {
      const res = await fetch('/api/admin/personnel-ad-reconcile/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, personnelId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setFlash({ kind: 'err', msg: json.error ?? 'Bağlama hatası' })
      } else {
        setFlash({
          kind: 'ok',
          msg: `Bağlandı: ${json.sicilNo} → ${json.personnelName}`,
        })
        await load()
        setBindTarget(null)
      }
    } finally {
      setActionPending(false)
    }
  }

  async function autoBindBluecollar() {
    if (
      !confirm('Otomatik bluecollar bind çalıştırılsın mı?')
    )
      return
    setActionPending(true)
    try {
      const res = await fetch(
        '/api/admin/personnel-ad-reconcile/auto-bind-bluecollar',
        { method: 'POST' }
      )
      const json = await res.json()
      if (!res.ok) {
        setFlash({ kind: 'err', msg: json.error ?? 'Auto-bind hatası' })
      } else {
        setFlash({
          kind: 'ok',
          msg: `${json.bound} bind, ${json.skipped} atlandı`,
        })
        await load()
      }
    } finally {
      setActionPending(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!data) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-800">
          Veri yüklenemedi.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {flash && (
        <Card
          className={
            flash.kind === 'ok'
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-red-300 bg-red-50'
          }
        >
          <CardContent className="p-3 text-sm flex items-center gap-2">
            {flash.kind === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-700" />
            )}
            <span
              className={
                flash.kind === 'ok' ? 'text-emerald-900' : 'text-red-900'
              }
            >
              {flash.msg}
            </span>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="unlinked-users" className="space-y-4">
        <TabsList className="grid grid-cols-4 max-w-3xl">
          <TabsTrigger value="unlinked-users">
            Bağlanmamış User ({data.counts.unlinkedUsers})
          </TabsTrigger>
          <TabsTrigger value="unlinked-personnel">
            User'sız Personnel ({data.counts.unlinkedPersonnel})
          </TabsTrigger>
          <TabsTrigger value="bluecollar">
            Mavi Yaka Önerileri ({data.counts.bluecollarSuggestions})
          </TabsTrigger>
          <TabsTrigger value="whitecollar">
            Beyaz Yaka Fuzzy ({data.counts.whitecollarSuggestions})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unlinked-users">
          <UnlinkedUsersTable
            users={data.unlinkedUsers}
            onBind={(u) => setBindTarget(u)}
            actionPending={actionPending}
          />
        </TabsContent>

        <TabsContent value="unlinked-personnel">
          <UnlinkedPersonnelTable personnel={data.unlinkedPersonnel} />
        </TabsContent>

        <TabsContent value="bluecollar">
          <BluecollarSuggestionsView
            suggestions={data.bluecollarSuggestions}
            onAutoBindAll={autoBindBluecollar}
            onBindOne={(s) => bindOne(s.userId, s.personnelId)}
            actionPending={actionPending}
          />
        </TabsContent>

        <TabsContent value="whitecollar">
          <WhitecollarSuggestionsView
            suggestions={data.whitecollarSuggestions}
            onBindOne={(s) => bindOne(s.userId, s.personnelId)}
            actionPending={actionPending}
          />
        </TabsContent>
      </Tabs>

      {bindTarget && (
        <BindDialog
          target={bindTarget}
          onClose={() => setBindTarget(null)}
          onPick={(personnelId) => bindOne(bindTarget.id, personnelId)}
          actionPending={actionPending}
        />
      )}
    </div>
  )
}

/* ===================== Sub-components ===================== */

function UnlinkedUsersTable({
  users,
  onBind,
  actionPending,
}: {
  users: UnlinkedUser[]
  onBind: (u: UnlinkedUser) => void
  actionPending: boolean
}) {
  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Bağlanmamış kullanıcı yok ✅
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>İsim</TableHead>
              <TableHead>Departman / Unvan</TableHead>
              <TableHead className="text-right">Aksiyon</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs">{u.email}</TableCell>
                <TableCell>{u.name ?? '—'}</TableCell>
                <TableCell>
                  <div className="text-sm">{u.department ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">
                    {u.jobTitle ?? '—'}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionPending}
                    onClick={() => onBind(u)}
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1" />
                    Personnel Ara
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function UnlinkedPersonnelTable({
  personnel,
}: {
  personnel: UnlinkedPersonnel[]
}) {
  if (personnel.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          User'sız Personnel yok ✅
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sicil No</TableHead>
              <TableHead>Ad Soyad</TableHead>
              <TableHead>Bölüm / Görev</TableHead>
              <TableHead>Kayıtlı Mail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {personnel.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.sicilNo}</TableCell>
                <TableCell>{p.adSoyad}</TableCell>
                <TableCell>
                  <div className="text-sm">{p.bolum}</div>
                  <div className="text-xs text-muted-foreground">{p.gorev}</div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {p.azureAdEmail ?? p.mailAdresi ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function BluecollarSuggestionsView({
  suggestions,
  onAutoBindAll,
  onBindOne,
  actionPending,
}: {
  suggestions: BluecollarSuggestion[]
  onAutoBindAll: () => void
  onBindOne: (s: BluecollarSuggestion) => void
  actionPending: boolean
}) {
  if (suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Bluecollar email lokali ↔ Personnel sicilNo (ILR-XXXXX) eşleşmesi
            yok.
          </div>
          <div className="text-xs">
            Bluecollar user'lar (`@bluecollar.ilerigroup.com`) ve mevcut Personnel
            sicilNo'ları otomatik eşleşmiyor — manuel arama ile bind edilmeli.
          </div>
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Email lokali → <code>ILR-&lt;lokali&gt;</code> exact eşleşmesi.
        </p>
        <Button
          size="sm"
          disabled={actionPending}
          onClick={onAutoBindAll}
          className="bg-teal-600 hover:bg-teal-700"
        >
          {actionPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1" />
          )}
          Tümünü Bind Et ({suggestions.length})
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Email</TableHead>
                <TableHead>User İsim</TableHead>
                <TableHead>Personnel SicilNo</TableHead>
                <TableHead>Personnel İsim</TableHead>
                <TableHead className="text-right">Aksiyon</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.map((s) => (
                <TableRow key={s.userId}>
                  <TableCell className="font-mono text-xs">
                    {s.userEmail}
                  </TableCell>
                  <TableCell>{s.userName ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.personnelSicilNo}
                  </TableCell>
                  <TableCell>{s.personnelName}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionPending}
                      onClick={() => onBindOne(s)}
                    >
                      Bind
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function WhitecollarSuggestionsView({
  suggestions,
  onBindOne,
  actionPending,
}: {
  suggestions: WhitecollarSuggestion[]
  onBindOne: (s: WhitecollarSuggestion) => void
  actionPending: boolean
}) {
  if (suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Fuzzy isim eşleşmesi (similarity &gt; 0.4) yok.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Personnel</TableHead>
              <TableHead>Skor</TableHead>
              <TableHead className="text-right">Aksiyon</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suggestions.map((s) => (
              <TableRow key={`${s.userId}-${s.personnelId}`}>
                <TableCell>
                  <div className="font-medium text-sm">
                    {s.userName ?? '—'}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {s.userEmail}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{s.personnelName}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {s.personnelSicilNo}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      s.similarity >= 0.7
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : s.similarity >= 0.55
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-orange-50 text-orange-800 border-orange-200'
                    }
                  >
                    {(s.similarity * 100).toFixed(0)}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionPending}
                    onClick={() => onBindOne(s)}
                  >
                    Bind
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function BindDialog({
  target,
  onClose,
  onPick,
  actionPending,
}: {
  target: UnlinkedUser
  onClose: () => void
  onPick: (personnelId: string) => void
  actionPending: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UnlinkedPersonnel[]>([])
  const [searching, setSearching] = useState(false)

  // İlk açılışta "tüm user'sız personeller" çekilir; query ile client-side filtre
  useEffect(() => {
    let aborted = false
    setSearching(true)
    fetch('/api/admin/personnel-ad-reconcile', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        if (!aborted) setResults(j.unlinkedPersonnel ?? [])
      })
      .catch(() => {
        if (!aborted) setResults([])
      })
      .finally(() => {
        if (!aborted) setSearching(false)
      })
    return () => {
      aborted = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return results.slice(0, 50)
    const q = query.toLocaleLowerCase('tr')
    return results
      .filter(
        (p) =>
          p.adSoyad.toLocaleLowerCase('tr').includes(q) ||
          p.sicilNo.toLowerCase().includes(q.toLowerCase()) ||
          (p.bolum?.toLocaleLowerCase('tr').includes(q) ?? false)
      )
      .slice(0, 50)
  }, [query, results])

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Personnel ara — {target.name ?? target.email}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ad, sicilNo veya bölüm ara..."
              className="pl-9"
            />
          </div>
          <div className="max-h-96 overflow-auto border rounded-md">
            {searching ? (
              <div className="p-6 text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Eşleşme yok
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SicilNo</TableHead>
                    <TableHead>Ad Soyad</TableHead>
                    <TableHead>Bölüm</TableHead>
                    <TableHead className="text-right">Bind</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">
                        {p.sicilNo}
                      </TableCell>
                      <TableCell>{p.adSoyad}</TableCell>
                      <TableCell className="text-xs">{p.bolum}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionPending}
                          onClick={() => onPick(p.id)}
                        >
                          Bind
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
