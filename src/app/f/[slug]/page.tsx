import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FormRenderer, { type Field } from "./FormRenderer";

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: form } = await supabase
    .from("forms")
    .select("id, slug, title, fields")
    .eq("slug", slug)
    .maybeSingle();

  if (!form) notFound();

  // `fields` is jsonb — never trust it to be an array at render time.
  const fields: Field[] = Array.isArray(form.fields) ? (form.fields as Field[]) : [];

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card animate-fade-in w-full max-w-md p-6">
        <h1 className="text-xl font-semibold">{form.title}</h1>

        <div className="mt-5">
          <FormRenderer formId={form.id} fields={fields} />
        </div>
      </div>
    </div>
  );
}
