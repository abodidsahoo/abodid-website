import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { clearResourcePageData, getResourceViewer, type ResourceViewer } from "../../lib/resources/pageData";
import type { AdminUser } from "../../lib/resources/admin";
import type { ActivityItem, SystemStats, TopResource } from "../../lib/resources/analytics";
import AdminReviewList from "./AdminReviewList";
import AnalyticsDashboard from "./AnalyticsDashboard";
import CuratorDashboard from "./CuratorDashboard";
import ResourceLoading from "./ResourceLoading";
import UserManagementTable from "./UserManagementTable";

type AdminView = "dashboard" | "review" | "analytics" | "users";
type AnalyticsPayload = {
  stats: SystemStats;
  topBookmarked: TopResource[];
  topUpvoted: TopResource[];
  activity: ActivityItem[];
};

const ADMIN_ONLY_VIEWS = new Set<AdminView>(["analytics", "users"]);
const viewTitle: Record<AdminView, string> = {
  dashboard: "Curation desk",
  review: "Review queue",
  analytics: "Analytics",
  users: "People & roles",
};

async function authorizedJson<T>(path: string): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Unable to load this admin view.");
  return payload as T;
}

export default function ResourceAdminPanel({ view = "dashboard" }: { view?: AdminView }) {
  const [viewer, setViewer] = useState<ResourceViewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const currentViewer = await getResourceViewer();
        if (!active) return;
        const returnTo = `/admin${view === "dashboard" ? "" : `/${view}`}`;
        if (!currentViewer) {
          window.location.replace(`/login?redirect=${encodeURIComponent(returnTo)}`);
          return;
        }
        if (currentViewer.role !== "admin" && currentViewer.role !== "curator") {
          window.location.replace("/dashboard");
          return;
        }
        if (ADMIN_ONLY_VIEWS.has(view) && currentViewer.role !== "admin") {
          window.location.replace("/admin");
          return;
        }

        setViewer(currentViewer);
        if (view === "analytics") {
          setAnalytics(await authorizedJson<AnalyticsPayload>("/api/resources/admin/analytics"));
        } else if (view === "users") {
          const payload = await authorizedJson<{ users: AdminUser[] }>("/api/resources/admin/users");
          setUsers(payload.users);
        }
      } catch (loadError: any) {
        if (active) setError(loadError?.message || "Unable to open the admin area.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearResourcePageData();
        window.location.replace("/login?redirect=%2Fadmin");
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [view]);

  if (loading || !viewer) {
    if (error) {
      return (
        <div className="curation-admin-state" role="alert">
          <h1>Admin access interrupted</h1>
          <p>{error}</p>
          <a href="/login?redirect=%2Fresources%2Fadmin">Sign in again</a>
        </div>
      );
    }
    return <ResourceLoading reconnecting={false} />;
  }

  return (
    <div className="curation-admin-shell">
      <header className="curation-admin-nav">
        <div>
          <a className="curation-admin-brand" href="/resources">Curation by Abodid</a>
          <p>{viewTitle[view]}</p>
        </div>
        <nav aria-label="Curation administration">
          <a href="/resources/admin" aria-current={view === "dashboard" ? "page" : undefined}>Desk</a>
          <a href="/resources/admin/review" aria-current={view === "review" ? "page" : undefined}>Queue</a>
          {viewer.role === "admin" && <>
            <a href="/resources/admin/analytics" aria-current={view === "analytics" ? "page" : undefined}>Analytics</a>
            <a href="/resources/admin/users" aria-current={view === "users" ? "page" : undefined}>People</a>
          </>}
        </nav>
      </header>

      {error && <p className="curation-admin-error" role="alert">{error}</p>}
      {view === "dashboard" && <CuratorDashboard user={viewer.user} role={viewer.role} />}
      {view === "review" && <AdminReviewList />}
      {view === "analytics" && analytics && <AnalyticsDashboard {...analytics} />}
      {view === "users" && users && <UserManagementTable initialUsers={users} currentUserId={viewer.user.id} />}

      <style>{`
        .curation-admin-shell { width: min(1480px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 72px; }
        .curation-admin-nav { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 18px 20px; margin-bottom: 28px; border: 1px solid var(--border-subtle); border-radius: 18px; background: var(--bg-surface); }
        .curation-admin-brand { color: var(--text-primary); font-size: 1.25rem; font-weight: 800; text-decoration: none; }
        .curation-admin-nav p { margin: 4px 0 0; color: var(--text-secondary); font-size: .9rem; }
        .curation-admin-nav nav { display: flex; flex-wrap: wrap; gap: 8px; }
        .curation-admin-nav nav a { color: var(--text-primary); padding: 10px 14px; border: 1px solid var(--border-subtle); border-radius: 999px; font-size: .88rem; font-weight: 700; text-decoration: none; }
        .curation-admin-nav nav a[aria-current="page"] { color: var(--btn-primary-text); background: var(--btn-primary-bg); border-color: var(--btn-primary-border); }
        .curation-admin-error, .curation-admin-state { margin: 32px auto; max-width: 680px; padding: 24px; border: 1px solid #ef4444; border-radius: 16px; background: var(--bg-surface); }
        .curation-admin-state a { color: inherit; font-weight: 750; }
        @media (max-width: 720px) { .curation-admin-nav { align-items: flex-start; flex-direction: column; } }
      `}</style>
    </div>
  );
}
