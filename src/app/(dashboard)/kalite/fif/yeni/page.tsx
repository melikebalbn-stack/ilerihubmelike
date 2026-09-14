import { redirect } from 'next/navigation'

/** Eski "Yeni FİF" formu kaldırıldı — artık liste sayfasındaki buton doğrudan
 *  TASLAK oluşturup detaya gider. Bu yol geriye dönük uyum için listeye yönlendirir. */
export default function FifYeniRedirect() {
  redirect('/kalite/fif')
}
