import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const requireAdmin = async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/login?error=Admin%20access%20is%20required");

  return { supabase, user };
};
