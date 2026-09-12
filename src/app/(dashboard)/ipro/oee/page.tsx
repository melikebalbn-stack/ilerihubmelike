import { redirect } from 'next/navigation'

// OEE Pano, İzleme Ekranı'na birleşti. Eski adres → /ipro/izleme?g=oee (kalıcı yönlendirme).
export default function IproOeeRedirect() {
  redirect('/ipro/izleme?g=oee')
}
