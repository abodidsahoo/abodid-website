import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Save, Send } from "lucide-react";
import NativeSelect from "../NativeSelect";
import { supabase } from "../../lib/supabaseClient";
import { contrastRatio, MINIMUM_TEXT_CONTRAST, SITE_CORNER_FIELDS } from "../../lib/designTokens.js";
import {
  DESIGN_TOKEN_CACHE_KEY,
  normaliseHeaderFooterStyle,
  normaliseThemeCorners,
  ORIGINAL_SITE_THEME,
  sameSiteTheme,
  SITE_THEME_FIELDS,
  SITE_THEME_PREVIEW_EVENT,
  SITE_THEME_PUBLISHED_EVENT,
} from "../../lib/siteThemes.js";

const SETTINGS_FIELDS = "published_theme,published_tokens,published_version,updated_at";
const PREVIEW_ROUTES = [
  ["/", "Home"], ["/about", "About"], ["/work", "Work"], ["/services", "Services"],
  ["/blog", "Blog"], ["/photography", "Photography"], ["/contact", "Contact"],
];
const isHex = (colour) => /^#[0-9a-f]{6}$/i.test(colour || "");
const hasColours = (theme) => isHex(theme?.background) && isHex(theme?.foreground);
const readSettings = () => supabase.from("design_system_settings").select(SETTINGS_FIELDS).eq("id", "global").single();

export default function SiteThemeStudio({ originalTokens }) {
  const [presets, setPresets] = useState([]);
  const [liveTheme, setLiveTheme] = useState(null);
  const [selectedId, setSelectedId] = useState(ORIGINAL_SITE_THEME.id);
  const [drafts, setDrafts] = useState({});
  const [route, setRoute] = useState("/");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const frame = useRef(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      readSettings(),
      supabase.from("design_system_themes").select(SITE_THEME_FIELDS).order("name"),
    ]).then(([settings, themes]) => {
      if (!mounted) return;
      if (settings.error || themes.error) {
        setNotice({ error: true, text: "Saved themes could not be loaded. Check the Design Studio themes migration and your admin access." });
      } else {
        const live = settings.data.published_theme;
        setPresets(themes.data);
        setLiveTheme(live);
        setSelectedId(live?.id || ORIGINAL_SITE_THEME.id);
        setReady(true);
      }
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const original = selectedId === ORIGINAL_SITE_THEME.id;
  const saved = presets.find((preset) => preset.id === selectedId);
  const draft = drafts[selectedId] || saved;
  const corners = normaliseThemeCorners(draft?.corners);
  const validColours = original || hasColours(draft);
  const contrast = !original && validColours ? contrastRatio(draft.background, draft.foreground) : 0;
  const passes = contrast >= MINIMUM_TEXT_CONTRAST;
  const changed = !sameSiteTheme(saved, draft);
  const canSave = ready && draft && changed && validColours && draft.name.trim();
  const canPublish = ready && saved && !changed && (original || passes) && !sameSiteTheme(liveTheme, saved);
  const preview = validColours ? draft : saved;

  const sendPreview = useCallback(() => {
    if (preview === undefined) return;
    frame.current?.contentWindow?.postMessage({
      type: SITE_THEME_PREVIEW_EVENT,
      theme: { ...preview, corners: normaliseThemeCorners(preview.corners) },
    }, window.location.origin);
  }, [preview]);

  useEffect(sendPreview, [sendPreview]);

  function newTheme() {
    setDrafts((current) => ({
      ...current,
      new: current.new || {
        name: "",
        background: draft?.background || originalTokens["--color-primary"],
        foreground: draft?.foreground || originalTokens["--color-primary-text"],
        corners: normaliseThemeCorners(draft?.corners),
        header_footer_style: normaliseHeaderFooterStyle(draft?.header_footer_style),
      },
    }));
    setSelectedId("new");
    setNotice(null);
  }

  function updateDraft(field, value) {
    setDrafts((current) => ({ ...current, [selectedId]: { ...draft, [field]: value } }));
    setNotice(null);
  }

  async function saveTheme() {
    if (busy || !canSave) return;
    setBusy(true);
    setNotice(null);
    const appearance = {
      name: draft.name.trim(),
      background: original ? null : draft.background.toLowerCase(),
      foreground: original ? null : draft.foreground.toLowerCase(),
      corners,
      header_footer_style: normaliseHeaderFooterStyle(draft.header_footer_style),
    };
    try {
      let query = saved
        ? supabase.from("design_system_themes").update(appearance)
          .eq("id", saved.id).eq("name", saved.name).eq("corners", JSON.stringify(saved.corners))
          .eq("header_footer_style", saved.header_footer_style)
        : supabase.from("design_system_themes").insert(appearance);
      if (saved && !original) query = query.eq("background", saved.background).eq("foreground", saved.foreground);
      const { data, error } = await query.select(SITE_THEME_FIELDS).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("This theme changed in another session. Reopen Themes before saving.");
      setPresets((current) => [...current.filter((preset) => preset.id !== data.id), data].sort((a, b) => a.name.localeCompare(b.name)));
      setDrafts((current) => {
        const next = { ...current };
        delete next[selectedId];
        return next;
      });
      setSelectedId(data.id);
      setNotice({ text: `${data.name} saved.` });
    } catch (error) {
      setNotice({ error: true, text: error.message || "Could not save the theme." });
    } finally {
      setBusy(false);
    }
  }

  async function publishTheme() {
    if (busy || !canPublish) return;
    setBusy(true);
    setNotice(null);
    try {
      const { data: latest, error: readError } = await readSettings();
      if (readError) throw readError;
      if (!sameSiteTheme(liveTheme, latest.published_theme)) {
        setLiveTheme(latest.published_theme);
        throw new Error("The live theme changed in another session. Review it before publishing again.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("design_system_settings")
        .update({ published_theme: saved, updated_by: user?.id || null })
        .eq("id", "global").eq("updated_at", latest.updated_at)
        .select(SETTINGS_FIELDS).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Site settings changed during publication. Review your theme and try again.");

      setLiveTheme(data.published_theme);
      const publication = {
        tokens: data.published_tokens,
        theme: data.published_theme,
        version: data.published_version,
        updatedAt: data.updated_at,
      };
      try {
        localStorage.setItem(DESIGN_TOKEN_CACHE_KEY, JSON.stringify(publication));
      } catch (_error) {
        // A successful publication does not depend on local storage.
      }
      window.dispatchEvent(new CustomEvent(SITE_THEME_PUBLISHED_EVENT, { detail: publication }));
      setNotice({ text: `${data.published_theme?.name || ORIGINAL_SITE_THEME.name} is live.` });
    } catch (error) {
      setNotice({ error: true, text: error.message || "Could not publish the theme." });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div id="design-theme-panel" role="tabpanel" aria-labelledby="design-tab-themes">
        <p className="design-studio-loading" role="status">Loading themes…</p>
      </div>
    );
  }

  return (
    <div id="design-theme-panel" role="tabpanel" aria-labelledby="design-tab-themes" className="site-theme-studio">
      <section className="design-controls site-theme-studio__controls" data-pop-surface="cream" aria-labelledby="site-themes-title">
        <div>
          <h2 id="site-themes-title">Themes</h2>
          <p>Live theme <strong>{liveTheme?.name || ORIGINAL_SITE_THEME.name}</strong> · {liveTheme?.corners?.style === "sharp" ? "Sharp" : "Rounded"}</p>
        </div>
        {notice && (
          <p className="site-theme-studio__notice" role={notice.error ? "alert" : "status"} data-pop-surface={notice.error ? "orange" : "lime"}>
            {notice.text}
          </p>
        )}
        {ready && (
          <>
            <div className="site-theme-studio__picker">
              <label htmlFor="site-theme-selection">Select a theme</label>
              <NativeSelect id="site-theme-selection" value={selectedId} disabled={busy} onChange={(event) => {
                setSelectedId(event.target.value);
                setNotice(null);
              }}>
                <option value={ORIGINAL_SITE_THEME.id}>Original</option>
                {presets.filter((preset) => preset.id !== ORIGINAL_SITE_THEME.id)
                  .map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                {drafts.new && <option value="new">New theme</option>}
              </NativeSelect>
              <button type="button" data-pop-surface="pink" onClick={newTheme} disabled={busy}><Plus size={16} /> New theme</button>
            </div>
            {draft && !original && (
              <>
                <fieldset className="site-theme-studio__fields" disabled={busy}>
                  <legend>Theme palette</legend>
                  <label>
                    Theme name
                    <input type="text" maxLength={80} value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} />
                  </label>
                  {[["background", "Background"], ["foreground", "Text"]].map(([field, label]) => (
                    <div key={field} className="site-theme-studio__colour">
                      <label htmlFor={`site-theme-${field}`}>{label}</label>
                      <input
                        type="color" aria-label={`${label} colour picker`}
                        value={isHex(draft[field]) ? draft[field] : originalTokens[field === "background" ? "--color-primary" : "--color-primary-text"]}
                        onChange={(event) => updateDraft(field, event.target.value)}
                      />
                      <input
                        id={`site-theme-${field}`} type="text" maxLength={7} pattern="#[0-9a-fA-F]{6}"
                        spellCheck="false" value={draft[field]} onChange={(event) => updateDraft(field, event.target.value)}
                      />
                    </div>
                  ))}
                </fieldset>
                <p className="site-theme-studio__contrast" aria-live="polite">
                  {validColours ? `${contrast.toFixed(2)}:1 contrast.${passes ? "" : " Publishing requires at least 4.5:1."}` : "Enter two six-digit hex colours."}
                </p>
              </>
            )}
            {draft && (
              <fieldset className="site-theme-studio__fields" disabled={busy}>
                <legend>Corners</legend>
                <label>
                  Corner style
                  <NativeSelect value={corners.style} onChange={(event) => updateDraft("corners", { ...corners, style: event.target.value })}>
                    <option value="sharp">Sharp</option>
                    <option value="rounded">Rounded</option>
                  </NativeSelect>
                </label>
                {corners.style === "rounded" && (
                  <>
                    <div className="site-theme-studio__radii">
                      {SITE_CORNER_FIELDS.map(({ name, label, min, max, step }) => (
                        <label key={name}>
                          {label} (px)
                          <input
                            type="number" min={min} max={max} step={step}
                            value={draft.corners?.radii?.[name] ?? ""} placeholder={originalTokens[name]}
                            onChange={(event) => updateDraft("corners", {
                              ...corners,
                              radii: { ...corners.radii, [name]: event.target.value },
                            })}
                          />
                        </label>
                      ))}
                    </div>
                    <p>Blank fields use the site's original radii.</p>
                    {Object.keys(corners.radii).length > 0 && (
                      <button type="button" data-pop-surface="white" onClick={() => updateDraft("corners", { ...corners, radii: {} })}>
                        Use original radii
                      </button>
                    )}
                  </>
                )}
              </fieldset>
            )}
            {draft && (
              <fieldset className="site-theme-studio__fields" disabled={busy}>
                <legend>Header and footer</legend>
                <label>
                  Layout
                  <NativeSelect
                    value={normaliseHeaderFooterStyle(draft.header_footer_style)}
                    onChange={(event) => updateDraft("header_footer_style", event.target.value)}
                  >
                    <option value="boxed">Boxed</option>
                    <option value="lines">Divider lines</option>
                  </NativeSelect>
                </label>
              </fieldset>
            )}
            <div className="site-theme-studio__actions">
              {draft && (
                <button type="button" data-pop-surface="pink" onClick={saveTheme} disabled={busy || !canSave}>
                  <Save size={16} /> Save theme
                </button>
              )}
              <button
                type="button" data-pop-surface="blue" onClick={publishTheme}
                disabled={busy || !canPublish}
              >
                <Send size={16} /> Publish theme
              </button>
            </div>
          </>
        )}
      </section>
      {ready && (
        <section className="site-theme-studio__preview" data-pop-surface="cream" aria-labelledby="site-theme-preview-title">
          <div>
            <h2 id="site-theme-preview-title">Private site preview</h2>
            <label htmlFor="site-theme-route">Page</label>
            <NativeSelect id="site-theme-route" value={route} onChange={(event) => setRoute(event.target.value)}>
              {PREVIEW_ROUTES.map(([path, label]) => <option key={path} value={path}>{label}</option>)}
            </NativeSelect>
          </div>
          <iframe ref={frame} title="Site theme preview" src={route} onLoad={sendPreview} />
        </section>
      )}
    </div>
  );
}
