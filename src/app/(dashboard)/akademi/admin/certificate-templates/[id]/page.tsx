import { TemplateForm } from "../_components/template-form";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TemplateForm templateId={id} />;
}
