"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail } from "lucide-react"
import type { EmailTestData } from "@/types/settings"

interface EmailSettingsPanelProps {
  emailTest: EmailTestData
  setEmailTest: (data: EmailTestData) => void
  onSendTestEmail: () => void
}

export function EmailSettingsPanel({
  emailTest,
  setEmailTest,
  onSendTestEmail
}: EmailSettingsPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* SMTP Yapılandırması */}
      <div className="space-y-3">
        <h3 className="font-semibold">SMTP Yapılandırması</h3>
        <div className="rounded-lg border bg-muted/50 p-4">
          <pre className="text-xs overflow-x-auto">
{`SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="ilerihub@ilerigroup.com"
SMTP_PASSWORD="********"
SMTP_FROM="ILERIHub <ilerihub@ilerigroup.com>"`}
          </pre>
          <p className="text-xs text-muted-foreground mt-3">
            💡 Yapılandırma .env dosyasından okunur
          </p>
        </div>
      </div>

      {/* Test E-postası */}
      <div className="space-y-3">
        <h3 className="font-semibold">Test E-postası Gönder</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="test-email" className="text-sm">E-posta Adresi *</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="test@example.com"
              value={emailTest.email}
              onChange={(e) => setEmailTest({ ...emailTest, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="test-name" className="text-sm">İsim (Opsiyonel)</Label>
            <Input
              id="test-name"
              placeholder="Test Kullanıcı"
              value={emailTest.name}
              onChange={(e) => setEmailTest({ ...emailTest, name: e.target.value })}
            />
          </div>
          <Button
            onClick={onSendTestEmail}
            disabled={emailTest.sending}
            className="w-full"
          >
            <Mail className="mr-2 h-4 w-4" />
            {emailTest.sending ? 'Gönderiliyor...' : 'Test E-postası Gönder'}
          </Button>
        </div>
      </div>
    </div>
  )
}
