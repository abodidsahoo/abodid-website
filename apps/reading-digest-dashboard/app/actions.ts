"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const destination = (kind: "notice" | "error", message: string, hash = "") =>
  `/?${kind}=${encodeURIComponent(message)}${hash}`;

const normalizeDomain = (input: string) => {
  const raw = input.trim().toLowerCase();
  if (!raw) return "";
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export async function addTopic(formData: FormData) {
  const { supabase } = await requireAdmin();
  const name = value(formData, "name");
  const description = value(formData, "description");
  const weight = Number(value(formData, "weight") || 1);
  if (!name || !Number.isFinite(weight) || weight < 0.1 || weight > 5) {
    redirect(destination("error", "Enter a topic and a weight from 0.1 to 5.", "#topics"));
  }
  const { error } = await supabase.from("reading_digest_topics").insert({ name, description, weight });
  if (error) redirect(destination("error", error.message, "#topics"));
  revalidatePath("/");
  redirect(destination("notice", "Topic added.", "#topics"));
}

export async function toggleTopic(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = value(formData, "id");
  const active = value(formData, "active") === "true";
  const { error } = await supabase.from("reading_digest_topics").update({ active }).eq("id", id);
  if (error) redirect(destination("error", error.message, "#topics"));
  revalidatePath("/");
  redirect(destination("notice", active ? "Topic enabled." : "Topic paused.", "#topics"));
}

export async function deleteTopic(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("reading_digest_topics").delete().eq("id", value(formData, "id"));
  if (error) redirect(destination("error", error.message, "#topics"));
  revalidatePath("/");
  redirect(destination("notice", "Topic removed.", "#topics"));
}

export async function addSource(formData: FormData) {
  const { supabase } = await requireAdmin();
  const domain = normalizeDomain(value(formData, "domain"));
  const disposition = value(formData, "disposition");
  if (!domain || !["trusted", "blocked"].includes(disposition)) {
    redirect(destination("error", "Enter a valid domain and source type.", "#sources"));
  }
  const { error } = await supabase.from("reading_digest_sources").upsert(
    {
      domain,
      name: value(formData, "name"),
      notes: value(formData, "notes"),
      disposition,
      active: true,
    },
    { onConflict: "domain" },
  );
  if (error) redirect(destination("error", error.message, "#sources"));
  revalidatePath("/");
  redirect(destination("notice", disposition === "trusted" ? "Trusted source saved." : "Source blocked.", "#sources"));
}

export async function toggleSource(formData: FormData) {
  const { supabase } = await requireAdmin();
  const active = value(formData, "active") === "true";
  const { error } = await supabase
    .from("reading_digest_sources")
    .update({ active })
    .eq("id", value(formData, "id"));
  if (error) redirect(destination("error", error.message, "#sources"));
  revalidatePath("/");
  redirect(destination("notice", active ? "Source rule enabled." : "Source rule paused.", "#sources"));
}

export async function deleteSource(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("reading_digest_sources").delete().eq("id", value(formData, "id"));
  if (error) redirect(destination("error", error.message, "#sources"));
  revalidatePath("/");
  redirect(destination("notice", "Source rule removed.", "#sources"));
}

export async function updateSettings(formData: FormData) {
  const { supabase } = await requireAdmin();
  const frequency = value(formData, "frequency");
  const weeklyDeliveryDay = Number(value(formData, "weekly_delivery_day") || 1);
  const lookback = Number(value(formData, "recent_lookback_days") || 45);
  if (!["daily", "weekdays", "weekly", "paused"].includes(frequency)) {
    redirect(destination("error", "Choose a valid delivery frequency.", "#settings"));
  }
  const { error } = await supabase
    .from("reading_digest_settings")
    .update({
      recipient_name: value(formData, "recipient_name") || "Abodid",
      recipient_email: value(formData, "recipient_email") || null,
      sender_name: value(formData, "sender_name") || "Abodid's Intern",
      sender_email: value(formData, "sender_email"),
      reply_to_email: value(formData, "reply_to_email") || null,
      frequency,
      weekly_delivery_day: Math.max(0, Math.min(6, weeklyDeliveryDay)),
      recent_lookback_days: Math.max(7, Math.min(365, lookback)),
      enabled: formData.get("enabled") === "on",
    })
    .eq("id", true);
  if (error) redirect(destination("error", error.message, "#settings"));
  revalidatePath("/");
  redirect(destination("notice", "Delivery settings updated.", "#settings"));
}

export async function toggleSavedReading(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const readingId = value(formData, "reading_id");
  const saved = value(formData, "saved") === "true";
  const query = saved
    ? supabase.from("reading_digest_saves").insert({ reading_id: readingId, user_id: user.id })
    : supabase.from("reading_digest_saves").delete().eq("reading_id", readingId).eq("user_id", user.id);
  const { error } = await query;
  if (error && error.code !== "23505") redirect(destination("error", error.message, "#readings"));
  revalidatePath("/");
  redirect(destination("notice", saved ? "Reading saved." : "Reading removed from saved.", "#readings"));
}

export async function addFeedback(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const signal = value(formData, "signal");
  if (!["helpful", "not_for_me", "read", "dismissed"].includes(signal)) {
    redirect(destination("error", "Choose a valid feedback signal.", "#readings"));
  }
  const { error } = await supabase.from("reading_digest_feedback").insert({
    reading_id: value(formData, "reading_id"),
    user_id: user.id,
    signal,
    note: value(formData, "note"),
  });
  if (error) redirect(destination("error", error.message, "#readings"));
  revalidatePath("/");
  redirect(destination("notice", "Feedback recorded for future ranking.", "#readings"));
}

export async function runDigestNow() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.functions.invoke("daily-reading-digest", {
    body: { trigger: "dashboard", force: true },
  });
  if (error) redirect(destination("error", error.message, "#activity"));
  if (data?.error) redirect(destination("error", String(data.error), "#activity"));
  revalidatePath("/");
  redirect(destination("notice", "Digest sent with exactly five readings.", "#activity"));
}

export async function signOut() {
  const { supabase } = await requireAdmin();
  await supabase.auth.signOut();
  redirect("/login");
}
