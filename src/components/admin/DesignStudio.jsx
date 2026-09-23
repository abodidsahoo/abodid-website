import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Eye, RotateCcw, Save, Send, Undo2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import {
  DEFAULT_DESIGN_TOKENS,
  DESIGN_TOKEN_FIELDS,
  DESIGN_TOKEN_GROUPS,
  evaluateSurfaceContracts,
  normaliseDesignTokens,
} from "../../lib/designTokens.js";
import { getDesignTokenUsage } from "../../lib/designTokenUsage.js";
import "../../styles/design-studio.css";
import AdminPageHeader from "./AdminPageHeader";

const CACHE_KEY = "abodid-published-design-tokens-v1";

function isAdvancedToken(groupId, name) {
  if (groupId === "typography") return /-(min|fluid|line|track)$/.test(name);
  if (groupId === "layout") return /-(min|fluid)$/.test(name);
  return false;
}

function firstEverydayToken(group) {
  const tokens = group.sections.flatMap((section) => section.tokens);
  return tokens.find((token) => !isAdvancedToken(group.id, token.name))?.name || tokens[0]?.name;
}

function TokenField({ token, value, selected, onSelect, onChange, onNormalise }) {
  return (
    <div
      className={`design-token-field design-token-field--${token.type}${selected ? " is-selected" : ""}`}
      onFocusCapture={onSelect}
      onPointerDown={onSelect}
    >
      <div className="design-token-field__heading">
        <label htmlFor={`design-token-${token.name}`}>{token.label}</label>
        {selected && <span>Previewing</span>}
      </div>
      {token.type === "color" ? (
        <div className="design-token-field__colour-control">
          <input
            id={`design-token-${token.name}`}
            type="color"
            aria-label={`${token.label} colour picker`}
            value={/^#[0-9a-f]{6}$/i.test(value || "") ? value : token.defaultValue}
            onChange={(event) => onChange(token.name, event.target.value)}
          />
          <input
            type="text"
            aria-label={`${token.label} hexadecimal value`}
            value={value}
            pattern="#[0-9a-fA-F]{6}"
            onChange={(event) => onChange(token.name, event.target.value)}
            onBlur={onNormalise}
          />
        </div>
      ) : (
        <div className="design-token-field__number-control">
          <input
            id={`design-token-${token.name}`}
            type="range"
            aria-label={`${token.label} slider`}
            min={token.min}
            max={token.max}
            step={token.step}
            value={value}
            onChange={(event) => onChange(token.name, event.target.value)}
          />
          <span>
            <input
              type="number"
              aria-label={`${token.label} value`}
              min={token.min}
              max={token.max}
              step={token.step}
              value={value}
              onChange={(event) => onChange(token.name, event.target.value)}
            />
            {token.unit && <small>{token.unit}</small>}
          </span>
        </div>
      )}
    </div>
  );
}

function typePreviewStyle(token, value) {
  if (token.name.endsWith("-weight")) return { fontWeight: value };
  if (token.name.endsWith("-line")) return { lineHeight: value };
  if (token.name.endsWith("-track")) return { letterSpacing: `${value}em` };
  if (token.name.endsWith("-fluid")) return { fontSize: `${value}vw` };
  if (token.name.endsWith("-min") || token.name.endsWith("-max") || token.name.endsWith("-size")) {
    return { fontSize: `${value}rem` };
  }
  return undefined;
}

function TypeSpecimen({ usage, token, value }) {
  const Tag = usage.tag || "p";
  return (
    <div className="design-specimen__type" data-pop-surface="cream">
      <span className="design-kicker">Real text hierarchy</span>
      <Tag
        className={`design-specimen__type-role design-specimen__type-role--${usage.role}`}
        style={typePreviewStyle(token, value)}
      >
        {usage.sample}
      </Tag>
    </div>
  );
}

function LayoutSpecimen({ kind, token, value }) {
  if (kind === "grid-gap") {
    return (
      <div className="design-specimen__grid" style={{ gap: `${value}px` }} aria-label="Two cards separated by the current grid seam">
        <article data-pop-surface="pink"><span>Card 01</span><strong>Research</strong></article>
        <span className="design-measure design-measure--gap">Grid seam</span>
        <article data-pop-surface="yellow"><span>Card 02</span><strong>Writing</strong></article>
      </div>
    );
  }

  if (kind === "gutter") {
    const gutterValue = token.name.endsWith("-fluid") ? `${value}vw` : `${value}px`;
    return (
      <div className="design-specimen__viewport" style={{ paddingInline: gutterValue }} data-pop-surface="blue">
        <span className="design-measure design-measure--left">Gutter</span>
        <div className="design-specimen__gutter-content" data-pop-surface="cream">
          <span className="design-kicker">Page content</span>
          <strong>Aligned to the safe reading edge.</strong>
        </div>
        <span className="design-measure design-measure--right">Gutter</span>
      </div>
    );
  }

  const sectionValue = token.name.endsWith("-fluid") ? `${value}vw` : `${value}px`;
  return (
    <div className="design-specimen__section-space" style={{ paddingBlock: sectionValue }} data-pop-surface="pink">
      <div><span className="design-kicker">Section start</span><strong>Editorial breathing room</strong></div>
      <span className="design-measure design-measure--vertical">Section space</span>
      <div><span className="design-kicker">Next element</span></div>
    </div>
  );
}

function ComponentSpecimen({ kind, value }) {
  const previewVariable = {
    "panel-radius": "--design-radius-panel",
    "card-radius": "--design-radius-card",
    "control-radius": "--design-radius-control",
    "media-radius": "--design-radius-media",
    "card-inset": "--design-card-inset",
  }[kind];
  const previewStyle = previewVariable ? { [previewVariable]: `${value}px` } : undefined;

  if (kind === "control-radius") {
    return (
      <div className="design-specimen__control" style={previewStyle} data-pop-surface="cream">
        <button type="button" data-pop-surface="yellow">Primary action →</button>
        <span className="design-measure">Control corner</span>
      </div>
    );
  }

  return (
    <div className={`design-specimen__component design-specimen__component--${kind}`} style={previewStyle} data-pop-surface="pink">
      <article data-pop-surface="cream">
        <div className="design-specimen__media" data-pop-surface="blue"><span>Inset media</span></div>
        <div className="design-specimen__component-copy">
          <span className="design-kicker">Research card</span>
          <strong>One card shows the full shape relationship.</strong>
        </div>
      </article>
      <span className="design-measure">
        {kind === "panel-radius" ? "Outer panel corner" : kind === "media-radius" ? "Media corner" : kind === "card-inset" ? "Media inset" : "Card corner"}
      </span>
    </div>
  );
}

function PreviewSpecimen({ token, tokenValue, usage }) {
  const rawValue = tokenValue.replace(token.unit || "", "");
  if (usage.previewKind === "type") return <TypeSpecimen usage={usage} token={token} value={rawValue} />;
  if (["grid-gap", "gutter", "section-space"].includes(usage.previewKind)) {
    return <LayoutSpecimen kind={usage.previewKind} token={token} value={rawValue} />;
  }
  if (["panel-radius", "card-radius", "control-radius", "media-radius", "card-inset"].includes(usage.previewKind)) {
    return <ComponentSpecimen kind={usage.previewKind} value={rawValue} />;
  }
  if (usage.previewKind === "theme") {
    return (
      <div className={`design-specimen__theme is-${usage.theme}`}>
        <div className="design-specimen__theme-panel">
          <span className="design-kicker">{usage.theme} theme</span>
          <strong>Creator Studio panel</strong>
          <button type="button">Interface control</button>
        </div>
      </div>
    );
  }
  return (
    <div className="design-specimen__surface" data-pop-surface={usage.surface || "cream"}>
      <span className="design-specimen__swatch" style={{ background: `var(${token.name})` }} aria-hidden="true" />
      <div>
        <span className="design-kicker">Production surface</span>
        <h3>Color carries structure.</h3>
      </div>
      <strong className="design-specimen__value">{tokenValue}</strong>
    </div>
  );
}

function Inspector({ token, tokens, contracts }) {
  const usage = getDesignTokenUsage(token.name);
  const affectedContracts = contracts.filter((contract) => (
    contract.surfaceToken === token.name || contract.foregroundToken === token.name
  ));
  const weakestContract = affectedContracts.length
    ? affectedContracts.reduce((weakest, contract) => contract.ratio < weakest.ratio ? contract : weakest)
    : null;
  const displayValue = `${tokens[token.name]}${token.unit || ""}`;

  return (
    <aside className="design-inspector" style={tokens} aria-label="Live token example">
      <div className="design-inspector__viewport">
        <header className="design-inspector__header" data-pop-surface="blue">
          <div>
            <span className="design-kicker"><Eye size={13} aria-hidden="true" /> Live example</span>
            <h2>{usage.title}</h2>
          </div>
          <span className="design-inspector__current" data-pop-surface="yellow">
            <small>{token.label}</small>
            <strong>{displayValue}</strong>
          </span>
        </header>

        <section className="design-inspector__stage" aria-label={`${usage.title} specimen`} aria-live="polite">
          <PreviewSpecimen token={token} tokenValue={displayValue} usage={usage} />
        </section>

        <section className="design-inspector__usage" data-pop-surface="cream">
          <details className="design-inspector__reference">
            <summary>
              <span>Where used &amp; code</span>
              {weakestContract && (
                <span className={`design-contrast-result ${weakestContract.passes ? "is-passing" : "is-failing"}`}>
                  {weakestContract.passes ? <Check size={14} /> : <AlertTriangle size={14} />}
                  {weakestContract.ratio.toFixed(1)}:1
                </span>
              )}
            </summary>
            <div className="design-inspector__reference-content">
              <div className="design-inspector__routes">
                {usage.routes.map((route) => (
                  <a key={`${route.href}-${route.label}`} href={route.href} target="_blank" rel="noreferrer">
                    <span>{route.label}</span><ExternalLink size={13} aria-hidden="true" />
                  </a>
                ))}
              </div>
              <p className="design-inspector__selector"><span>Element</span><code>{usage.selector}</code></p>
              <details className="design-inspector__details">
                <summary>HTML &amp; CSS details</summary>
                <div className="design-code-grid">
                  <div><span>HTML</span><pre><code>{usage.html}</code></pre></div>
                  <div><span>CSS</span><pre><code>{usage.css}</code></pre></div>
                </div>
              </details>
            </div>
          </details>
        </section>
      </div>
    </aside>
  );
}

export default function DesignStudio() {
  const [activeGroup, setActiveGroup] = useState("colour");
  const [selectedTokenName, setSelectedTokenName] = useState(() => firstEverydayToken(DESIGN_TOKEN_GROUPS[0]));
  const [tokens, setTokens] = useState(DEFAULT_DESIGN_TOKENS);
  const [publishedTokens, setPublishedTokens] = useState(DEFAULT_DESIGN_TOKENS);
  const [version, setVersion] = useState(1);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [databaseReady, setDatabaseReady] = useState(true);

  const normalisedTokens = useMemo(() => normaliseDesignTokens(tokens), [tokens]);
  const contracts = useMemo(() => evaluateSurfaceContracts(normalisedTokens), [normalisedTokens]);
  const failingContracts = contracts.filter((contract) => !contract.passes);
  const group = DESIGN_TOKEN_GROUPS.find((item) => item.id === activeGroup) || DESIGN_TOKEN_GROUPS[0];
  const selectedToken = DESIGN_TOKEN_FIELDS.find((token) => token.name === selectedTokenName) || group.sections[0].tokens[0];
  const dirty = JSON.stringify(normalisedTokens) !== JSON.stringify(publishedTokens);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [settingsResult, historyResult] = await Promise.all([
        supabase.from("design_system_settings").select("*").eq("id", "global").maybeSingle(),
        supabase.from("design_system_versions").select("version,tokens,published_at").order("version", { ascending: false }).limit(8),
      ]);

      if (!mounted) return;
      if (settingsResult.error) {
        setDatabaseReady(false);
        setNotice({ type: "error", text: "Design Studio needs its Supabase migration before drafts can be saved or published." });
      } else if (settingsResult.data) {
        const published = normaliseDesignTokens(settingsResult.data.published_tokens);
        setPublishedTokens(published);
        setTokens(normaliseDesignTokens(settingsResult.data.draft_tokens || published));
        setVersion(settingsResult.data.published_version || 1);
      }
      setHistory(historyResult.data || []);
      setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const updateToken = (name, value) => {
    setTokens((current) => ({ ...current, [name]: String(value) }));
    setSelectedTokenName(name);
    setNotice(null);
  };

  const changeGroup = (nextGroup) => {
    setActiveGroup(nextGroup.id);
    setSelectedTokenName(firstEverydayToken(nextGroup));
  };

  const persist = async (publish = false) => {
    if (!databaseReady) return;
    if (publish && failingContracts.length > 0) {
      setNotice({
        type: "error",
        text: `Publishing is blocked until ${failingContracts.map((item) => item.label).join(", ")} reaches at least 4.5:1 contrast.`,
      });
      return;
    }

    setSaving(true);
    setNotice(null);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      draft_tokens: normalisedTokens,
      updated_by: user?.id || null,
      ...(publish ? {
        published_tokens: normalisedTokens,
        published_version: version + 1,
        published_at: new Date().toISOString(),
      } : {}),
    };
    const { data, error } = await supabase
      .from("design_system_settings")
      .update(payload)
      .eq("id", "global")
      .select("*")
      .single();

    if (error) {
      setNotice({ type: "error", text: error.message });
    } else if (publish) {
      setPublishedTokens(normalisedTokens);
      setVersion(data.published_version);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ tokens: normalisedTokens, version: data.published_version, updatedAt: data.updated_at }));
      } catch (_error) {
        // Publishing still succeeds when browser storage is unavailable.
      }
      window.dispatchEvent(new CustomEvent("design-tokens:published", { detail: { tokens: normalisedTokens } }));
      setNotice({ type: "success", text: `Version ${data.published_version} is live. No deployment is required.` });
      const historyResult = await supabase.from("design_system_versions").select("version,tokens,published_at").order("version", { ascending: false }).limit(8);
      setHistory(historyResult.data || []);
    } else {
      setTokens(normalisedTokens);
      setNotice({ type: "success", text: "Draft saved. The public site has not changed." });
    }
    setSaving(false);
  };

  if (loading) return <div className="design-studio-loading">Loading the design system…</div>;

  return (
    <div className="design-studio" data-pop-page="true">
      <section className="design-studio__hero admin-page-intro" data-pop-surface="pink">
        <div className="design-studio__hero-copy">
          <span className="design-kicker">Creator Studio · Visual system</span>
          <AdminPageHeader
            title="Design Studio"
            description="Change the shared style once, inspect it on real interface patterns, then publish it across the ecosystem."
          />
        </div>
        <div className="design-studio__status" aria-live="polite">
          <span>Version {version}</span><strong>{dirty ? "Unpublished changes" : "Published"}</strong>
        </div>
      </section>

      <div className="design-studio__toolbar" data-pop-surface="cream">
        <div className="design-studio__tabs" role="tablist" aria-label="Design token groups">
          {DESIGN_TOKEN_GROUPS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={activeGroup === item.id}
              aria-controls="design-token-panel"
              className={activeGroup === item.id ? "is-active" : ""}
              data-pop-surface={activeGroup === item.id ? "yellow" : undefined}
              onClick={() => changeGroup(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="design-studio__actions" aria-label="Design Studio actions">
          {history.length > 0 && (
            <details className="design-history-menu">
              <summary><Undo2 size={15} /> History</summary>
              <div className="design-history-menu__popover" data-pop-surface="cream">
                <span className="design-kicker">Load as draft</span>
                {history.map((entry) => (
                  <button key={entry.version} type="button" data-pop-surface="yellow" onClick={() => {
                    setTokens(normaliseDesignTokens(entry.tokens));
                    setNotice({ type: "success", text: `Version ${entry.version} loaded as an unpublished draft.` });
                  }}>
                    Version {entry.version}
                  </button>
                ))}
              </div>
            </details>
          )}
          <button type="button" className="design-action design-action--default" data-pop-surface="cream" onClick={() => setTokens(DEFAULT_DESIGN_TOKENS)}>
            <RotateCcw size={16} /> Defaults
          </button>
          <button type="button" className="design-action design-action--save" data-pop-surface="pink" disabled={saving || !databaseReady} onClick={() => persist(false)}>
            <Save size={16} /> Save draft
          </button>
          <button
            type="button"
            className="design-action design-action--publish"
            data-pop-surface="blue"
            disabled={saving || !databaseReady || !dirty || failingContracts.length > 0}
            title={failingContracts.length > 0 ? "Resolve contrast failures before publishing" : undefined}
            onClick={() => persist(true)}
          >
            <Send size={16} /> Publish across site
          </button>
        </div>
      </div>

      {notice && (
        <div className={`design-studio__notice is-${notice.type}`} data-pop-surface={notice.type === "error" ? "orange" : "lime"} role="status">
          {notice.type === "error" ? <AlertTriangle size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="design-studio__workspace">
        <section className="design-controls" data-pop-surface="cream" aria-labelledby="design-group-title">
          <div className="design-controls__intro">
            <span className="design-kicker">Choose what to change</span>
            <h2 id="design-group-title">{group.label}</h2>
            <p>{group.description}</p>
          </div>
          <div id="design-token-panel" role="tabpanel">
            {group.sections.map((section, sectionIndex) => {
              const everydayTokens = section.tokens.filter((token) => !isAdvancedToken(group.id, token.name));
              const advancedTokens = section.tokens.filter((token) => isAdvancedToken(group.id, token.name));
              const renderField = (token) => (
                <TokenField
                  key={token.name}
                  token={token}
                  value={tokens[token.name]}
                  selected={selectedTokenName === token.name}
                  onSelect={() => setSelectedTokenName(token.name)}
                  onChange={updateToken}
                  onNormalise={() => setTokens((current) => normaliseDesignTokens(current))}
                />
              );
              return (
                <fieldset key={section.label} className="design-token-section">
                  <legend><span>{String(sectionIndex + 1).padStart(2, "0")}</span>{section.label}</legend>
                  <div className="design-token-grid">{everydayTokens.map(renderField)}</div>
                  {advancedTokens.length > 0 && (
                    <details className="design-token-advanced">
                      <summary><span>Advanced controls</span><small>{advancedTokens.length} values</small></summary>
                      <p>Fine-tune responsive scaling, line rhythm and tracking only when the main setting needs more control.</p>
                      <div className="design-token-grid">{advancedTokens.map(renderField)}</div>
                    </details>
                  )}
                </fieldset>
              );
            })}
          </div>
        </section>
        <div className="design-studio__preview-rail">
          <Inspector token={selectedToken} tokens={normalisedTokens} contracts={contracts} />
        </div>
      </div>
    </div>
  );
}
