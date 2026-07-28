import React, { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Check,
  ExternalLink,
  LoaderCircle,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "relationship", label: "Relationship" },
  { id: "public", label: "Public work" },
  { id: "source", label: "Source data" },
];

const DISCOVERY_GROUPS = [
  { id: "current_role", label: "Current role and company" },
  { id: "portfolio", label: "Portfolio and personal work" },
  { id: "recent_work", label: "Recent work" },
  { id: "recognition", label: "Awards and recognition" },
  { id: "press", label: "Press and publications" },
  { id: "other", label: "Other cited sources" },
];

const identityPresentation = (candidate) => {
  const strength = candidate.identityStrength
    || (candidate.confidence === "verified"
      ? "strong"
      : candidate.confidence === "probable" ? "possible" : "weak");
  if (strength === "strong") return { label: "Strong identity match", tone: "verified" };
  if (strength === "possible") return { label: "Possible identity match", tone: "probable" };
  return { label: "Weak identity match", tone: "ambiguous" };
};

const emptyDraft = {
  email: "",
  company: "",
  position: "",
  city: "",
  region: "",
  country: "",
  personal_website: "",
  work_categories: [],
  expertise_keywords: [],
  outreach_goals: [],
  relationship_tier: "unrated",
  tags: [],
  notes: "",
  relationship_context: "",
  public_summary: "",
  newsletter_status: "not_subscribed",
  newsletter_consent_source: "",
  do_not_contact: false,
  starred: false,
  archived: false,
  verification_state: "source_only",
  enrichment_status: "unenriched",
  custom_fields: {},
};

const toDraft = (contact) => ({
  ...emptyDraft,
  ...Object.fromEntries(
    Object.keys(emptyDraft).map((key) => [key, contact?.[key] ?? emptyDraft[key]]),
  ),
  work_categories: contact?.work_categories || [],
  expertise_keywords: contact?.expertise_keywords || [],
  outreach_goals: contact?.outreach_goals || [],
  tags: contact?.tags || [],
  custom_fields: contact?.custom_fields || {},
});

const formatDateTime = (value) => {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
};

function Field({ label, hint, children, wide = false }) {
  return (
    <label className={`ni-drawer-field ${wide ? "is-wide" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function TokenEditor({ label, values, suggestions = [], onChange, hint }) {
  const [input, setInput] = useState("");
  const add = (value) => {
    const nextValue = value.trim();
    if (!nextValue) return;
    onChange([...new Set([...(values || []), nextValue])]);
    setInput("");
  };
  return (
    <Field label={label} hint={hint} wide>
      <div className="ni-token-editor">
        <div className="ni-token-list">
          {(values || []).map((value) => (
            <span key={value}>
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => onChange(values.filter((item) => item !== value))}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(input);
            }
          }}
          onBlur={() => add(input)}
          placeholder="Type and press Enter"
          list={`token-${label.replace(/\W+/g, "-").toLowerCase()}`}
        />
        <datalist id={`token-${label.replace(/\W+/g, "-").toLowerCase()}`}>
          {suggestions.map((suggestion) => <option value={suggestion} key={suggestion} />)}
        </datalist>
      </div>
    </Field>
  );
}

export default function NetworkContactDrawer({
  contactId,
  accessToken,
  customDefinitions = [],
  initialDiscovery,
  onClose,
  onChanged,
}) {
  const [contact, setContact] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [discovery, setDiscovery] = useState(null);
  const [discovering, setDiscovering] = useState(false);
  const [reviewingUrl, setReviewingUrl] = useState("");
  const [showAllDiscovery, setShowAllDiscovery] = useState(false);

  const authenticatedFetch = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed with ${response.status}.`);
    return payload;
  };

  useEffect(() => {
    if (!contactId || !accessToken) {
      setContact(null);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setActiveTab(initialDiscovery ? "public" : "profile");
    setDiscovery(initialDiscovery || null);
    setShowAllDiscovery(false);
    authenticatedFetch(`/api/admin/network/contacts/${contactId}`, {
      signal: controller.signal,
    })
      .then((payload) => {
        setContact(payload.contact);
        setDraft(toDraft(payload.contact));
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [contactId, accessToken]);

  useEffect(() => {
    if (contactId && initialDiscovery) {
      setDiscovery(initialDiscovery);
      setActiveTab("public");
      setShowAllDiscovery(false);
    }
  }, [contactId, initialDiscovery]);

  useEffect(() => {
    if (!contactId) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [contactId, onClose]);

  const dirty = useMemo(() => (
    contact ? JSON.stringify(toDraft(contact)) !== JSON.stringify(draft) : false
  ), [contact, draft]);

  const discoveryGroups = useMemo(() => {
    const candidates = Array.isArray(discovery?.candidates) ? discovery.candidates : [];
    const preview = [];
    for (const group of DISCOVERY_GROUPS) {
      const representative = candidates.find((candidate) => (
        (candidate.category || "other") === group.id
      ));
      if (representative) preview.push(representative);
      if (preview.length === 3) break;
    }
    if (preview.length < 3) {
      preview.push(...candidates
        .filter((candidate) => !preview.includes(candidate))
        .slice(0, 3 - preview.length));
    }
    const visible = showAllDiscovery ? candidates : preview;
    return DISCOVERY_GROUPS
      .map((group) => ({
        ...group,
        candidates: visible.filter((candidate) => (
          (candidate.category || "other") === group.id
        )),
      }))
      .filter((group) => group.candidates.length);
  }, [discovery, showAllDiscovery]);

  const setField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const save = async () => {
    if (!contactId || !dirty) return;
    setSaving(true);
    setError("");
    try {
      const payload = await authenticatedFetch(`/api/admin/network/contacts/${contactId}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      let savedContact = payload.contact;
      setContact(savedContact);
      setDraft(toDraft(savedContact));

      if (savedContact.embedding_refresh_needed) {
        setIndexing(true);
        try {
          await authenticatedFetch("/api/admin/network/reembed", {
            method: "POST",
            body: JSON.stringify({ contactId }),
          });
          const refreshed = await authenticatedFetch(`/api/admin/network/contacts/${contactId}`);
          savedContact = refreshed.contact;
          setContact(savedContact);
          setDraft(toDraft(savedContact));
        } catch (indexError) {
          setError(`Contact saved. Semantic indexing is still pending: ${indexError.message}`);
        } finally {
          setIndexing(false);
        }
      }
      onChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const quickToggle = async (field) => {
    const nextValue = !draft[field];
    setField(field, nextValue);
    try {
      const payload = await authenticatedFetch(`/api/admin/network/contacts/${contactId}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: nextValue }),
      });
      setContact(payload.contact);
      setDraft(toDraft(payload.contact));
      onChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const removeContact = async () => {
    if (
      !contactId
      || !window.confirm(
        `Permanently delete ${contact?.full_name || "this contact"} and its private notes, evidence and history?`,
      )
    ) return;
    setDeleting(true);
    setError("");
    try {
      await authenticatedFetch(`/api/admin/network/contacts/${contactId}`, {
        method: "DELETE",
      });
      onClose();
      onChanged?.();
    } catch (requestError) {
      setError(requestError.message);
      setDeleting(false);
    }
  };

  const findPublicWork = async () => {
    setDiscovering(true);
    setError("");
    setShowAllDiscovery(false);
    try {
      const payload = await authenticatedFetch("/api/admin/network/discover", {
        method: "POST",
        body: JSON.stringify({ contactId }),
      });
      setDiscovery(payload);
      onChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDiscovering(false);
    }
  };

  const reviewEvidence = async (candidate, state) => {
    setReviewingUrl(candidate.url);
    setError("");
    try {
      await authenticatedFetch(`/api/admin/network/contacts/${contactId}/evidence`, {
        method: "POST",
        body: JSON.stringify({ candidate, state }),
      });
      setDiscovery((current) => ({
        ...current,
        candidates: (current?.candidates || []).map((item) => (
          item.url === candidate.url ? { ...item, state } : item
        )),
      }));
      const payload = await authenticatedFetch(`/api/admin/network/contacts/${contactId}`);
      setContact(payload.contact);
      setDraft(toDraft(payload.contact));
      onChanged?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setReviewingUrl("");
    }
  };

  if (!contactId) return null;

  return (
    <div className="ni-drawer-layer">
      <button type="button" className="ni-drawer-backdrop" aria-label="Close contact drawer" onClick={onClose} />
      <aside className="ni-contact-drawer" aria-label="Contact details">
        <header className="ni-drawer-header">
          <div>
            <span>Contact record</span>
            <h3>{contact?.full_name || "Loading contact…"}</h3>
            <p>{[
              contact?.position || contact?.source_position,
              contact?.company || contact?.source_company,
            ].filter(Boolean).join(" at ") || "No current work recorded"}</p>
          </div>
          <div className="ni-drawer-header-actions">
            <button
              type="button"
              className={draft.starred ? "is-active" : ""}
              aria-label={draft.starred ? "Remove star" : "Star contact"}
              onClick={() => quickToggle("starred")}
            >
              <Star size={17} fill={draft.starred ? "currentColor" : "none"} />
            </button>
            {contact?.linkedin_url && (
              <a href={contact.linkedin_url} target="_blank" rel="noreferrer" aria-label="Open LinkedIn profile">
                <ExternalLink size={17} />
              </a>
            )}
            <button type="button" aria-label="Close drawer" onClick={onClose}><X size={19} /></button>
          </div>
        </header>

        <nav className="ni-drawer-tabs">
          {TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={activeTab === tab.id ? "is-active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="ni-drawer-body">
          {loading ? (
            <div className="ni-drawer-state"><LoaderCircle className="ni-spin" /> Loading private record…</div>
          ) : error && !contact ? (
            <div className="ni-alert ni-alert-error">{error}</div>
          ) : contact ? (
            <>
              {error && <div className="ni-alert ni-alert-error">{error}</div>}

              {activeTab === "profile" && (
                <div className="ni-drawer-section">
                  <div className="ni-section-heading">
                    <UserRound size={16} />
                    <div><strong>Current profile</strong><span>Manual values stay intact on future CSV syncs.</span></div>
                  </div>
                  <div className="ni-drawer-fields">
                    <Field label="Email">
                      <input type="email" value={draft.email || ""} onChange={(event) => setField("email", event.target.value)} />
                    </Field>
                    <Field label="Personal website">
                      <input type="url" value={draft.personal_website || ""} onChange={(event) => setField("personal_website", event.target.value)} />
                    </Field>
                    <Field label="Position">
                      <input value={draft.position || ""} onChange={(event) => setField("position", event.target.value)} />
                    </Field>
                    <Field label="Company">
                      <input value={draft.company || ""} onChange={(event) => setField("company", event.target.value)} />
                    </Field>
                    <Field label="City">
                      <input value={draft.city || ""} onChange={(event) => setField("city", event.target.value)} />
                    </Field>
                    <Field label="Region">
                      <input value={draft.region || ""} onChange={(event) => setField("region", event.target.value)} />
                    </Field>
                    <Field label="Country">
                      <input value={draft.country || ""} onChange={(event) => setField("country", event.target.value)} />
                    </Field>
                    <Field label="Verification">
                      <select value={draft.verification_state} onChange={(event) => setField("verification_state", event.target.value)}>
                        <option value="source_only">Source only</option>
                        <option value="verified">Verified</option>
                        <option value="probable">Probable</option>
                        <option value="ambiguous">Ambiguous</option>
                        <option value="stale">Stale</option>
                      </select>
                    </Field>
                    <TokenEditor
                      label="Work categories"
                      values={draft.work_categories}
                      suggestions={["Education", "Culture", "Technology", "SEO", "Film & Media", "Research", "Design", "Marketing"]}
                      onChange={(value) => setField("work_categories", value)}
                    />
                    <TokenEditor
                      label="Expertise keywords"
                      values={draft.expertise_keywords}
                      onChange={(value) => setField("expertise_keywords", value)}
                    />
                  </div>
                </div>
              )}

              {activeTab === "relationship" && (
                <div className="ni-drawer-section">
                  <div className="ni-section-heading">
                    <Mail size={16} />
                    <div><strong>Relationship and outreach</strong><span>Context for thoughtful, consent-aware follow-up.</span></div>
                  </div>
                  <div className="ni-drawer-fields">
                    <Field label="Relationship tier">
                      <select value={draft.relationship_tier} onChange={(event) => setField("relationship_tier", event.target.value)}>
                        <option value="unrated">Unrated</option>
                        <option value="weak">Weak</option>
                        <option value="familiar">Familiar</option>
                        <option value="strong">Strong</option>
                      </select>
                    </Field>
                    <Field label="Newsletter status" hint="Email availability is not consent.">
                      <select value={draft.newsletter_status} onChange={(event) => setField("newsletter_status", event.target.value)}>
                        <option value="not_subscribed">Not subscribed</option>
                        <option value="subscribed">Subscribed</option>
                        <option value="unsubscribed">Unsubscribed</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </Field>
                    <Field label="Consent source" hint="Record where explicit permission came from.">
                      <input value={draft.newsletter_consent_source || ""} onChange={(event) => setField("newsletter_consent_source", event.target.value)} />
                    </Field>
                    <label className="ni-drawer-check">
                      <input type="checkbox" checked={draft.do_not_contact} onChange={(event) => setField("do_not_contact", event.target.checked)} />
                      <span><strong>Do not contact</strong><small>Excluded when this hard filter is applied.</small></span>
                    </label>
                    <label className="ni-drawer-check">
                      <input type="checkbox" checked={draft.archived} onChange={(event) => setField("archived", event.target.checked)} />
                      <span><strong>Archive contact</strong><small>Hide from the default table without deleting private history.</small></span>
                    </label>
                    <TokenEditor
                      label="Outreach goals"
                      values={draft.outreach_goals}
                      suggestions={["Podcast", "Jobs", "SEO", "Research", "Collaboration"]}
                      onChange={(value) => setField("outreach_goals", value)}
                    />
                    <TokenEditor label="Tags" values={draft.tags} onChange={(value) => setField("tags", value)} />
                    <Field label="Relationship context" wide>
                      <textarea rows={5} value={draft.relationship_context || ""} onChange={(event) => setField("relationship_context", event.target.value)} />
                    </Field>
                    <Field label="Notes" wide>
                      <textarea rows={7} value={draft.notes || ""} onChange={(event) => setField("notes", event.target.value)} />
                    </Field>
                  </div>
                </div>
              )}

              {activeTab === "public" && (
                <div className="ni-drawer-section">
                  <div className="ni-public-heading">
                    <div className="ni-section-heading">
                      <Search size={16} />
                      <div><strong>Latest public work</strong><span>Explicit web search with citations and identity review.</span></div>
                    </div>
                    <button type="button" className="ni-button ni-button-primary" onClick={findPublicWork} disabled={discovering}>
                      {discovering ? <LoaderCircle size={14} className="ni-spin" /> : <Sparkles size={14} />}
                      {discovering ? "Searching…" : "Find latest public work"}
                    </button>
                  </div>

                  {discovery?.note && <div className="ni-discovery-note"><ShieldCheck size={14} /> {discovery.note}</div>}
                  {discovery?.model && (
                    <div className="ni-discovery-usage">
                      <span>{Number(discovery.resultCount || 0).toLocaleString()} cited results</span>
                      <span>{discovery.structuredModel ? "Two-stage AI synthesis" : discovery.model}</span>
                      {Number(discovery.usage?.total_tokens || 0) > 0 && (
                        <span>{Number(discovery.usage.total_tokens).toLocaleString()} tokens</span>
                      )}
                    </div>
                  )}
                  {discovery?.synthesisWarning && (
                    <div className="ni-discovery-warning">
                      The sources were found, but concise AI summaries were unavailable. Raw evidence remains accessible.
                    </div>
                  )}

                  {discovery?.synthesis && (
                    <article className="ni-public-brief">
                      <div className="ni-public-brief-heading">
                        <div><Sparkles size={14} /><strong>At a glance</strong></div>
                        <span>AI synthesis · grounded in the cited sources below</span>
                      </div>
                      {discovery.synthesis.summary && <p>{discovery.synthesis.summary}</p>}
                      {(discovery.synthesis.currentRole || discovery.synthesis.currentCompany) && (
                        <dl className="ni-public-brief-facts">
                          {discovery.synthesis.currentRole && (
                            <div><dt>Current role</dt><dd>{discovery.synthesis.currentRole}</dd></div>
                          )}
                          {discovery.synthesis.currentCompany && (
                            <div><dt>Company</dt><dd>{discovery.synthesis.currentCompany}</dd></div>
                          )}
                          <div>
                            <dt>Evidence</dt>
                            <dd>{Number(discovery.resultCount || 0).toLocaleString()} cited sources</dd>
                          </div>
                        </dl>
                      )}
                      {discovery.synthesis.specialties?.length > 0 && (
                        <div className="ni-public-specialties">
                          {discovery.synthesis.specialties.map((specialty) => (
                            <span key={specialty}>{specialty}</span>
                          ))}
                        </div>
                      )}
                      {discovery.synthesis.highlights?.length > 0 && (
                        <ul className="ni-public-highlights">
                          {discovery.synthesis.highlights.map((highlight) => (
                            <li key={highlight}>{highlight}</li>
                          ))}
                        </ul>
                      )}
                      {discovery.synthesis.caveat && (
                        <div className="ni-public-caveat">{discovery.synthesis.caveat}</div>
                      )}
                    </article>
                  )}

                  {discovery?.candidates?.length ? (
                    <div className="ni-evidence-results">
                      {discoveryGroups.map((group) => (
                        <section className="ni-evidence-group" key={group.id}>
                          <div className="ni-evidence-group-heading">
                            <strong>{group.label}</strong>
                            <span>{group.candidates.length}</span>
                          </div>
                          <div className="ni-evidence-list">
                            {group.candidates.map((candidate) => {
                              const identity = identityPresentation(candidate);
                              return (
                                <article className={`ni-evidence-card is-${candidate.state || "pending"}`} key={candidate.url}>
                                  <div className="ni-evidence-topline">
                                    <span className={`ni-status ni-status-${identity.tone}`}>{identity.label}</span>
                                    <span>{candidate.sourceType}</span>
                                    <span>{candidate.apparentDate || `Found ${formatDateTime(candidate.discoveredAt)}`}</span>
                                  </div>
                                  <h4>
                                    <a href={candidate.url} target="_blank" rel="noreferrer">
                                      {candidate.title}<ExternalLink size={13} />
                                    </a>
                                  </h4>
                                  <p className="ni-evidence-summary">
                                    {candidate.summary || "A concise source summary was not available."}
                                  </p>
                                  {candidate.keyFacts?.length > 0 && (
                                    <ul className="ni-evidence-facts">
                                      {candidate.keyFacts.map((fact) => <li key={fact}>{fact}</li>)}
                                    </ul>
                                  )}
                                  {candidate.relevanceReason && (
                                    <div className="ni-evidence-relevance">
                                      <strong>Why this result</strong>
                                      <span>{candidate.relevanceReason}</span>
                                    </div>
                                  )}
                                  <div className="ni-evidence-signals">
                                    {(candidate.identitySignals || []).length
                                      ? `Matched identity details: ${candidate.identitySignals.join(", ")}`
                                      : "No strong identity detail detected; treat this result cautiously."}
                                  </div>
                                  <details className="ni-raw-evidence">
                                    <summary>Show raw evidence</summary>
                                    <p>{candidate.excerpt || "No raw excerpt was supplied by the cited source."}</p>
                                  </details>
                                  <div className="ni-evidence-actions">
                                    <a href={candidate.url} target="_blank" rel="noreferrer">Open source</a>
                                    <button type="button" disabled={reviewingUrl === candidate.url} onClick={() => reviewEvidence(candidate, "accepted")}>
                                      <Check size={13} /> Accept
                                    </button>
                                    <button type="button" disabled={reviewingUrl === candidate.url} onClick={() => reviewEvidence(candidate, "uncertain")}>Uncertain</button>
                                    <button type="button" disabled={reviewingUrl === candidate.url} onClick={() => reviewEvidence(candidate, "rejected")}>Reject</button>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                      {discovery.candidates.length > 3 && (
                        <button
                          type="button"
                          className="ni-evidence-more"
                          onClick={() => setShowAllDiscovery((current) => !current)}
                        >
                          {showAllDiscovery
                            ? "Show the strongest three sources"
                            : `Show ${discovery.candidates.length - 3} more cited sources`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="ni-drawer-empty">
                      <Search size={20} />
                      <strong>No pending discovery results</strong>
                      <span>Web discovery only runs when you request it for this person.</span>
                    </div>
                  )}

                  {contact.public_links?.length > 0 && (
                    <div className="ni-accepted-links">
                      <h4>Accepted evidence</h4>
                      {contact.public_links.map((link) => (
                        <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                          <span>{link.title || link.url}</span>
                          <small>{link.sourceType || "public web"} · {link.confidence || "reviewed"}</small>
                          <ExternalLink size={13} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "source" && (
                <div className="ni-drawer-section">
                  <div className="ni-section-heading">
                    <Archive size={16} />
                    <div><strong>Recoverable source data</strong><span>Original CSV values remain separate from current corrections.</span></div>
                  </div>
                  <dl className="ni-source-list">
                    <div><dt>First name</dt><dd>{contact.import_snapshot?.["First Name"] || "Blank"}</dd></div>
                    <div><dt>Last name</dt><dd>{contact.import_snapshot?.["Last Name"] || "Blank"}</dd></div>
                    <div><dt>Email</dt><dd>{contact.source_email || "Blank"}</dd></div>
                    <div><dt>Company</dt><dd>{contact.source_company || "Blank"}</dd></div>
                    <div><dt>Position</dt><dd>{contact.source_position || "Blank"}</dd></div>
                    <div><dt>Connected on</dt><dd>{contact.connected_on || "Blank"}</dd></div>
                    <div><dt>LinkedIn URL</dt><dd>{contact.linkedin_url ? <a href={contact.linkedin_url} target="_blank" rel="noreferrer">Open source profile</a> : "Blank"}</dd></div>
                    <div><dt>Imported</dt><dd>{formatDateTime(contact.imported_at)}</dd></div>
                    <div><dt>Last seen in export</dt><dd>{formatDateTime(contact.last_seen_in_export)}</dd></div>
                    <div><dt>Semantic index</dt><dd>{contact.embedding_refresh_needed ? "Refresh pending" : `Indexed ${formatDateTime(contact.embedded_at)}`}</dd></div>
                  </dl>
                  {Object.keys(contact.incoming_conflicts || {}).length > 0 && (
                    <div className="ni-source-conflicts">
                      <strong>Incoming CSV differences need review</strong>
                      {Object.entries(contact.incoming_conflicts).map(([field, conflict]) => (
                        <div key={field}>
                          <span>{field.replace(/^source_/, "").replaceAll("_", " ")}</span>
                          <small>Current: {conflict.current || "Blank"}</small>
                          <small>Incoming source: {conflict.incoming || "Blank"}</small>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="ni-delete-contact">
                    <div>
                      <strong>Permanent deletion</strong>
                      <span>Use Archive for a reversible removal from the default table.</span>
                    </div>
                    <button
                      type="button"
                      className="ni-button ni-button-danger"
                      disabled={deleting}
                      onClick={removeContact}
                    >
                      {deleting ? <LoaderCircle size={14} className="ni-spin" /> : <Trash2 size={14} />}
                      {deleting ? "Deleting…" : "Delete contact"}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "profile" && customDefinitions.length > 0 && (
                <div className="ni-drawer-section ni-custom-fields-section">
                  <div className="ni-section-heading">
                    <Sparkles size={16} />
                    <div><strong>Custom fields</strong><span>Flexible columns stored on this contact record.</span></div>
                  </div>
                  <div className="ni-drawer-fields">
                    {customDefinitions.map((definition) => (
                      <Field label={definition.label} key={definition.key}>
                        <input
                          value={draft.custom_fields?.[definition.key] ?? ""}
                          onChange={(event) => setField("custom_fields", {
                            ...draft.custom_fields,
                            [definition.key]: event.target.value,
                          })}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {contact && activeTab !== "public" && activeTab !== "source" && (
          <footer className="ni-drawer-footer">
            <span>
              {indexing
                ? "Updating semantic search…"
                : dirty ? "Unsaved changes" : `Updated ${formatDateTime(contact.updated_at)}`}
            </span>
            <button type="button" className="ni-button ni-button-primary" onClick={save} disabled={!dirty || saving}>
              {saving ? <LoaderCircle size={14} className="ni-spin" /> : <Check size={14} />}
              {indexing ? "Updating search…" : saving ? "Saving…" : "Save contact"}
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
