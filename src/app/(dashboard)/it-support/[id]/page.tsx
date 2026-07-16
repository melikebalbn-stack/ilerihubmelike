"use client"

import { useParams } from "next/navigation"
import { TicketDetail } from "../_components/ticket-detail"

// Tam sayfa detay (deep-link / doğrudan URL). Liste normalde modal kullanır;
// bu route derin bağlantı + geriye-uyum için TicketDetail'i tam sayfada gösterir.
export default function TicketDetailPage() {
  const params = useParams()
  return (
    <div className="max-w-4xl mx-auto py-2">
      <TicketDetail ticketId={params.id as string} />
    </div>
  )
}
