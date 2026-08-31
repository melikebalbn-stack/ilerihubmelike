// Kalıcı yönlendirme: IFS eğitim yönetimi /ifs/egitimler altına taşındı.
import { redirect } from "next/navigation";

export default function IfsTrainingRedirect() {
  redirect("/ifs/egitimler");
}
