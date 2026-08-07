import {
  addFeedback,
  addSource,
  addTopic,
  deleteSource,
  deleteTopic,
  runDigestNow,
  signOut,
  toggleSavedReading,
  toggleSource,
  toggleTopic,
  updateSettings,
} from "./actions";
import { requireAdmin } from "@/lib/auth";

type Topic = {
  id: string;
  name: string;
  description: string;
  weight: number;
  active: boolean;
};

type Source = {
  id: string;
  domain: string;
  name: string;
  notes: string;
  disposition: "trusted" | "blocked";
  active: boolean;
};

type Reading = {
  id: string;
  title: string;
  url: string;
  source_name: string;
  source_domain: string;
  publication_date: string;
  estimated_reading_minutes: number;
  why_it_matters: string;
  topic_names: string[];
  rank_score: number;
  status: string;
  verification_status: string;
  is_foundational: boolean;
  first_discovered_at: string;
};

const displayDate = (value?: string | null, includeTime = false) => {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" } : {}),
  }).format(new Date(value));
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { supabase, user } = await requireAdmin();
  const [
    settingsResult,
    topicsResult,
    sourcesResult,
    readingsResult,
    savesResult,
    feedbackResult,
    deliveriesResult,
    runsResult,
  ] = await Promise.all([
    supabase.from("reading_digest_settings").select("*").eq("id", true).single(),
    supabase.from("reading_digest_topics").select("*").order("weight", { ascending: false }),
    supabase.from("reading_digest_sources").select("*").order("disposition").order("domain"),
    supabase
      .from("reading_digest_readings")
      .select("*")
      .order("first_discovered_at", { ascending: false })
      .limit(50),
    supabase.from("reading_digest_saves").select("reading_id").eq("user_id", user.id),
    supabase
      .from("reading_digest_feedback")
      .select("reading_id, signal, created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("reading_digest_deliveries")
      .select("id, delivery_date, status, subject, resend_email_id, sent_at, error_message")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("reading_digest_runs")
      .select("id, status, trigger_source, started_at, discovered_count, verified_count, selected_count, error_message")
      .order("started_at", { ascending: false })
      .limit(12),
  ]);

  const fatal = [settingsResult, topicsResult, sourcesResult, readingsResult].find((result) => result.error)?.error;
  if (fatal) throw new Error(fatal.message);

  const settings = settingsResult.data;
  const topics = (topicsResult.data ?? []) as Topic[];
  const sources = (sourcesResult.data ?? []) as Source[];
  const readings = (readingsResult.data ?? []) as Reading[];
  const savedIds = new Set((savesResult.data ?? []).map((save) => save.reading_id));
  const feedbackByReading = new Map<string, string[]>();
  for (const item of feedbackResult.data ?? []) {
    feedbackByReading.set(item.reading_id, [...(feedbackByReading.get(item.reading_id) ?? []), item.signal]);
  }
  const trusted = sources.filter((source) => source.disposition === "trusted");
  const blocked = sources.filter((source) => source.disposition === "blocked");
  const sentCount = readings.filter((reading) => reading.status === "sent").length;
  const verifiedCount = readings.filter((reading) => reading.verification_status === "verified").length;
  const latestRun = runsResult.data?.[0];
  const { notice, error } = await searchParams;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Reading desk home">
          <span className="brand-mark">A</span>
          <span>Reading desk</span>
        </a>
        <nav aria-label="Dashboard sections">
          <a href="#overview">Overview</a>
          <a href="#topics">Topics</a>
          <a href="#sources">Sources</a>
          <a href="#readings">Readings</a>
          <a href="#settings">Delivery</a>
          <a href="#activity">Activity</a>
        </nav>
        <div className="sidebar-foot">
          <span>{user.email}</span>
          <form action={signOut}><button className="text-button" type="submit">Sign out</button></form>
        </div>
      </aside>

      <main className="dashboard" id="top">
        <header className="topbar">
          <div>
            <div className="eyebrow">Scheduled for 08:00 · Asia/Kolkata</div>
            <h1>Good reading starts here.</h1>
          </div>
          <form action={runDigestNow}>
            <button className="button button-dark" type="submit">Run digest now ↗</button>
          </form>
        </header>

        {notice ? <div className="notice notice-good" role="status">{notice}</div> : null}
        {error ? <div className="notice notice-error" role="alert">{error}</div> : null}

        <section className="section" id="overview">
          <div className="section-heading">
            <div><div className="eyebrow">Overview</div><h2>The next edition</h2></div>
            <span className={`status-pill ${settings?.enabled && settings.frequency !== "paused" ? "status-live" : "status-muted"}`}>
              {settings?.enabled && settings.frequency !== "paused" ? "Scheduled" : "Paused"}
            </span>
          </div>
          <div className="metric-grid">
            <article className="metric-card hero-metric">
              <span>Next delivery</span>
              <strong>08:00</strong>
              <p>{settings?.frequency === "daily" ? "Every day" : settings?.frequency === "weekdays" ? "Weekdays" : settings?.frequency === "weekly" ? `Every ${dayNames[settings.weekly_delivery_day]}` : "Delivery paused"} · IST</p>
            </article>
            <article className="metric-card"><span>Active topics</span><strong>{topics.filter((topic) => topic.active).length}</strong><p>Weighted research interests</p></article>
            <article className="metric-card"><span>Verified here</span><strong>{verifiedCount}</strong><p>{sentCount} recently sent</p></article>
            <article className="metric-card"><span>Last delivery</span><strong className="metric-date">{displayDate(settings?.last_sent_at)}</strong><p>Exactly five, never repeated</p></article>
          </div>
          <div className="latest-run">
            <span className="pulse" />
            <div>
              <strong>Latest run: {latestRun?.status ?? "not run yet"}</strong>
              <p>{latestRun ? `${latestRun.discovered_count} discovered · ${latestRun.verified_count} verified · ${latestRun.selected_count} selected` : "The first run will search, verify, rank and send."}</p>
            </div>
          </div>
        </section>

        <section className="section" id="topics">
          <div className="section-heading">
            <div><div className="eyebrow">01 · Interests</div><h2>Topics and emphasis</h2></div>
            <p className="section-note">Higher weights pull a subject closer to tomorrow’s five.</p>
          </div>
          <div className="topic-cloud">
            {topics.map((topic) => (
              <article className={`topic-chip ${topic.active ? "" : "is-muted"}`} key={topic.id}>
                <div><strong>{topic.name}</strong><span>×{Number(topic.weight).toFixed(1)}</span></div>
                {topic.description ? <p>{topic.description}</p> : null}
                <div className="inline-actions">
                  <form action={toggleTopic}>
                    <input name="id" type="hidden" value={topic.id} />
                    <input name="active" type="hidden" value={String(!topic.active)} />
                    <button className="text-button" type="submit">{topic.active ? "Pause" : "Enable"}</button>
                  </form>
                  <form action={deleteTopic}>
                    <input name="id" type="hidden" value={topic.id} />
                    <button className="text-button danger" type="submit">Remove</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
          <form action={addTopic} className="editor-row">
            <label><span>New topic</span><input name="name" placeholder="e.g. Sonic ethnography" required /></label>
            <label className="grow"><span>Focus note</span><input name="description" placeholder="What should count as relevant?" /></label>
            <label className="small-field"><span>Weight</span><input name="weight" type="number" min="0.1" max="5" step="0.1" defaultValue="1" /></label>
            <button className="button" type="submit">Add topic</button>
          </form>
        </section>

        <section className="section" id="sources">
          <div className="section-heading">
            <div><div className="eyebrow">02 · Boundaries</div><h2>Source confidence</h2></div>
            <p className="section-note">Rules apply to the domain and every subdomain.</p>
          </div>
          <div className="source-columns">
            <div className="source-column">
              <h3><span className="source-dot trusted-dot" /> Trusted <small>{trusted.length}</small></h3>
              {trusted.map((source) => <SourceRow key={source.id} source={source} />)}
              <SourceForm disposition="trusted" />
            </div>
            <div className="source-column">
              <h3><span className="source-dot blocked-dot" /> Blocked <small>{blocked.length}</small></h3>
              {blocked.map((source) => <SourceRow key={source.id} source={source} />)}
              <SourceForm disposition="blocked" />
            </div>
          </div>
        </section>

        <section className="section" id="readings">
          <div className="section-heading">
            <div><div className="eyebrow">03 · Library</div><h2>Discovered and sent</h2></div>
            <p className="section-note">Save the useful; feedback changes future source ranking.</p>
          </div>
          <div className="reading-list">
            {readings.length ? readings.map((reading) => {
              const saved = savedIds.has(reading.id);
              const signals = feedbackByReading.get(reading.id) ?? [];
              return (
                <article className="reading-row" key={reading.id}>
                  <div className="reading-index">{String(readings.indexOf(reading) + 1).padStart(2, "0")}</div>
                  <div className="reading-copy">
                    <div className="reading-meta">
                      <span>{reading.source_name}</span><span>{displayDate(reading.publication_date)}</span><span>{reading.estimated_reading_minutes} min</span>
                      {reading.is_foundational ? <span className="mini-tag">Foundational</span> : null}
                    </div>
                    <h3><a href={reading.url} target="_blank" rel="noreferrer">{reading.title}</a></h3>
                    <p>{reading.why_it_matters}</p>
                    <div className="topic-line">{reading.topic_names?.join(" · ")}</div>
                  </div>
                  <div className="reading-controls">
                    <span className={`status-pill ${reading.verification_status === "verified" ? "status-live" : "status-muted"}`}>{reading.status}</span>
                    <form action={toggleSavedReading}>
                      <input name="reading_id" type="hidden" value={reading.id} />
                      <input name="saved" type="hidden" value={String(!saved)} />
                      <button className={`save-button ${saved ? "is-saved" : ""}`} aria-label={saved ? "Remove saved reading" : "Save reading"} type="submit">{saved ? "◆" : "◇"}</button>
                    </form>
                    <div className="feedback-buttons">
                      <FeedbackButton readingId={reading.id} signal="helpful" label="Useful" active={signals.includes("helpful")} />
                      <FeedbackButton readingId={reading.id} signal="not_for_me" label="Not for me" active={signals.includes("not_for_me")} />
                      <FeedbackButton readingId={reading.id} signal="read" label="Read" active={signals.includes("read")} />
                    </div>
                  </div>
                </article>
              );
            }) : <div className="empty-state">No readings yet. Run the first digest to build the library.</div>}
          </div>
        </section>

        <section className="section" id="settings">
          <div className="section-heading">
            <div><div className="eyebrow">04 · Delivery</div><h2>Rhythm and recipient</h2></div>
            <p className="section-note">The cron fires at 08:00 IST; frequency decides whether today sends.</p>
          </div>
          <form action={updateSettings} className="settings-form">
            <label><span>Recipient name</span><input name="recipient_name" defaultValue={settings?.recipient_name ?? "Abodid"} required /></label>
            <label><span>Recipient email</span><input name="recipient_email" type="email" defaultValue={settings?.recipient_email ?? ""} placeholder="you@example.com" required /></label>
            <label><span>Frequency</span><select name="frequency" defaultValue={settings?.frequency ?? "daily"}><option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option><option value="paused">Paused</option></select></label>
            <label><span>Weekly day</span><select name="weekly_delivery_day" defaultValue={String(settings?.weekly_delivery_day ?? 1)}>{dayNames.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label>
            <label><span>Recent window</span><div className="input-suffix"><input name="recent_lookback_days" type="number" min="7" max="365" defaultValue={settings?.recent_lookback_days ?? 45} /><span>days</span></div></label>
            <label><span>Sender name</span><input name="sender_name" defaultValue={settings?.sender_name ?? "Abodid's Intern"} required /></label>
            <label><span>Verified sender email</span><input name="sender_email" type="email" defaultValue={settings?.sender_email ?? "hello@abodid.com"} required /></label>
            <label><span>Reply-to</span><input name="reply_to_email" type="email" defaultValue={settings?.reply_to_email ?? ""} /></label>
            <label className="toggle-label"><input name="enabled" type="checkbox" defaultChecked={settings?.enabled ?? true} /><span>Automation enabled</span></label>
            <button className="button button-dark" type="submit">Save delivery settings</button>
          </form>
        </section>

        <section className="section" id="activity">
          <div className="section-heading">
            <div><div className="eyebrow">05 · System</div><h2>Delivery activity</h2></div>
          </div>
          <div className="activity-grid">
            <div>
              <h3>Deliveries</h3>
              <div className="activity-list">
                {(deliveriesResult.data ?? []).map((delivery) => (
                  <article key={delivery.id}><span className={`status-dot status-${delivery.status}`} /><div><strong>{delivery.subject}</strong><p>{displayDate(delivery.sent_at ?? delivery.delivery_date, true)}{delivery.resend_email_id ? ` · ${delivery.resend_email_id}` : ""}</p>{delivery.error_message ? <p className="error-copy">{delivery.error_message}</p> : null}</div></article>
                ))}
                {!deliveriesResult.data?.length ? <div className="empty-state small">No deliveries yet.</div> : null}
              </div>
            </div>
            <div>
              <h3>Runs</h3>
              <div className="activity-list">
                {(runsResult.data ?? []).map((run) => (
                  <article key={run.id}><span className={`status-dot status-${run.status}`} /><div><strong>{run.trigger_source} · {run.status}</strong><p>{displayDate(run.started_at, true)} · {run.discovered_count}/{run.verified_count}/{run.selected_count}</p>{run.error_message ? <p className="error-copy">{run.error_message}</p> : null}</div></article>
                ))}
                {!runsResult.data?.length ? <div className="empty-state small">No runs yet.</div> : null}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function SourceRow({ source }: { source: Source }) {
  return (
    <article className={`source-row ${source.active ? "" : "is-muted"}`}>
      <div><strong>{source.name || source.domain}</strong><span>{source.domain}</span>{source.notes ? <p>{source.notes}</p> : null}</div>
      <div className="inline-actions">
        <form action={toggleSource}><input name="id" type="hidden" value={source.id} /><input name="active" type="hidden" value={String(!source.active)} /><button className="text-button" type="submit">{source.active ? "Pause" : "Enable"}</button></form>
        <form action={deleteSource}><input name="id" type="hidden" value={source.id} /><button className="text-button danger" type="submit">Remove</button></form>
      </div>
    </article>
  );
}

function SourceForm({ disposition }: { disposition: "trusted" | "blocked" }) {
  return (
    <form action={addSource} className="source-form">
      <input name="disposition" type="hidden" value={disposition} />
      <input name="domain" placeholder="domain.org" aria-label={`${disposition} source domain`} required />
      <input name="name" placeholder="Source name" aria-label={`${disposition} source name`} />
      <input name="notes" placeholder="Why this rule?" aria-label={`${disposition} source notes`} />
      <button className="button" type="submit">{disposition === "trusted" ? "Trust source" : "Block source"}</button>
    </form>
  );
}

function FeedbackButton({ readingId, signal, label, active }: { readingId: string; signal: string; label: string; active: boolean }) {
  return (
    <form action={addFeedback}>
      <input name="reading_id" type="hidden" value={readingId} />
      <input name="signal" type="hidden" value={signal} />
      <button className={active ? "active" : ""} type="submit">{label}</button>
    </form>
  );
}
