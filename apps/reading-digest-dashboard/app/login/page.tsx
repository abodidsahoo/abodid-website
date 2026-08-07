import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role === "admin") redirect("/");
  }
  const { error } = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="eyebrow">Private · Abodid</div>
        <h1>Your reading desk.</h1>
        <p>Shape tomorrow’s five readings, keep what matters, and teach the digest what to leave behind.</p>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <LoginForm />
      </section>
    </main>
  );
}
