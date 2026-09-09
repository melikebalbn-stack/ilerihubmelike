// Kalıcı yönlendirme: IFS eğitim yönetimi /ifs/degerlendirme altına taşındı.
// (Önce /ifs/egitimler'e taşınmıştı; o rota artık kursiyer dokümanı kataloğu.)
import { redirect } from "next/navigation";

export default function IfsTrainingRedirect() {
  redirect("/ifs/degerlendirme");
}
