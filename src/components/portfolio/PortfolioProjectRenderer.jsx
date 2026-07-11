import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../styles/portfolio.css";
import "../../styles/layout-preview.css";

function safeHref(value) {
  if (!value) return "";
  try {
    const url = new URL(value, "https://abodid.com");
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return value;
  } catch {
    return "";
  }
}

function inlineMarkup(text = "") {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  return String(text).split(pattern).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = safeHref(link[2]);
      return href ? <a key={index} href={href}>{link[1]}</a> : link[1];
    }
    return part;
  });
}

function RichText({ text = "" }) {
  return String(text).split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => (
    <p key={index}>{inlineMarkup(paragraph.replace(/\n/g, " "))}</p>
  ));
}

function parseVideo(value) {
  const href = safeHref(value);
  if (!href) return null;
  try {
    const url = new URL(href);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.slice(1).split("?")[0];
      return { provider: "youtube", id, embedSrc: `https://www.youtube-nocookie.com/embed/${id}?origin=${typeof location !== "undefined" ? location.origin : ""}&iv_load_policy=3&modestbranding=1&playsinline=1&showinfo=0&rel=0&enablejsapi=1`, poster: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` };
    }
    if (url.hostname.includes("youtube.com")) {
      const id = url.searchParams.get("v") || url.pathname.split("/").pop();
      if (!id) return null;
      return { provider: "youtube", id, embedSrc: `https://www.youtube-nocookie.com/embed/${id}?origin=${typeof location !== "undefined" ? location.origin : ""}&iv_load_policy=3&modestbranding=1&playsinline=1&showinfo=0&rel=0&enablejsapi=1`, poster: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` };
    }
    if (url.hostname.includes("vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean).pop();
      if (!id) return null;
      return { provider: "vimeo", id, embedSrc: `https://player.vimeo.com/video/${id}?loop=false&byline=false&portrait=false&title=false&speed=true&transparent=0&gesture=media`, poster: null };
    }
  } catch {
    return null;
  }
  return null;
}

function VideoModal({ video, onClose }) {
  const playerRef = useRef(null);
  const plyrRef = useRef(null);
  const iframeRef = useRef(null);

  const destroy = useCallback(() => {
    if (plyrRef.current) {
      try { plyrRef.current.stop(); } catch {}
      try { plyrRef.current.destroy(); } catch {}
      plyrRef.current = null;
    }
    if (iframeRef.current) iframeRef.current.src = "";
  }, []);

  const handleClose = useCallback(() => {
    destroy();
    document.body.style.overflow = "";
    onClose();
  }, [destroy, onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const initPlyr = () => {
      if (!playerRef.current || plyrRef.current) return;
      /* global Plyr */
      plyrRef.current = new Plyr(playerRef.current, {
        controls: ["play-large", "play", "progress", "current-time", "mute", "volume", "fullscreen"],
        hideControls: true,
        resetOnEnd: true,
        youtube: { noCookie: true, rel: 0, showinfo: 0, iv_load_policy: 3, modestbranding: 1 },
        vimeo: { byline: false, portrait: false, title: false, speed: true, transparent: false },
      });
      plyrRef.current.on("ready", () => { try { plyrRef.current.play(); } catch {} });
    };

    if (typeof Plyr !== "undefined") {
      initPlyr();
    } else {
      // Load Plyr CSS if not already present
      if (!document.querySelector("link[href*='plyr']")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://cdn.plyr.io/3.7.8/plyr.css";
        document.head.appendChild(link);
      }
      // Load Plyr JS
      if (!document.querySelector("script[src*='plyr']")) {
        const script = document.createElement("script");
        script.src = "https://cdn.plyr.io/3.7.8/plyr.polyfilled.js";
        script.onload = initPlyr;
        document.head.appendChild(script);
      } else {
        // Script tag exists but Plyr not yet defined — wait
        const poll = setInterval(() => {
          if (typeof Plyr !== "undefined") { clearInterval(poll); initPlyr(); }
        }, 80);
      }
    }

    const onKey = (event) => { if (event.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      destroy();
      document.body.style.overflow = "";
    };
  }, [destroy, handleClose]);

  return (
    <div className="pf-video-modal" role="dialog" aria-modal="true" aria-label="Video player" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="pf-video-wrapper">
        <div className="pf-video-topbar">
          <button type="button" className="pf-video-close" onClick={handleClose} aria-label="Close video">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="pf-video-container">
          <div className="plyr__video-embed" ref={playerRef}>
            <iframe ref={iframeRef} src={video.embedSrc} allowFullScreen allow="autoplay; fullscreen; picture-in-picture" title="Project video" />
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoEmbed({ content }) {
  const [open, setOpen] = useState(false);
  const [vimeoPoster, setVimeoPoster] = useState(null);
  const video = useMemo(() => parseVideo(content.url), [content.url]);

  // Fetch Vimeo thumbnail via oEmbed
  useEffect(() => {
    if (video?.provider !== "vimeo" || !video.id) return;
    fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${video.id}&width=1280`)
      .then((res) => res.json())
      .then((data) => { if (data.thumbnail_url) setVimeoPoster(data.thumbnail_url); })
      .catch(() => {});
  }, [video]);

  if (!video) return null;
  const poster = video.provider === "vimeo" ? vimeoPoster : video.poster;

  return (
    <>
      <figure className="pf-video-figure">
        <button type="button" className="pf-video-thumb" onClick={() => setOpen(true)} aria-label={`Play video${content.caption ? `: ${content.caption}` : ""}`}>
          {poster && <img src={poster} alt="" className="pf-video-poster" loading="lazy" />}
          {!poster && <div className="pf-video-poster pf-video-poster--empty" />}
          <span className="pf-play-btn" aria-hidden="true">
            <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="29" stroke="white" strokeOpacity="0.5" strokeWidth="1"/><path d="M24 20.5L42 30L24 39.5V20.5Z" fill="white"/></svg>
          </span>
        </button>
        {content.caption && <figcaption className="pf-video-caption">{content.caption}</figcaption>}
      </figure>
      {open && <VideoModal video={video} onClose={() => setOpen(false)} />}
    </>
  );
}

function yearLabel(project) {
  if (!project.yearStart) return "";
  return project.yearEnd && project.yearEnd !== project.yearStart
    ? `${project.yearStart}-${project.yearEnd}`
    : String(project.yearStart);
}

function ImageFigure({ media, fit = "cover", onOpen, index }) {
  if (!media?.url) return null;
  const style = { objectPosition: `${media.focalX ?? 50}% ${media.focalY ?? 50}%`, objectFit: fit };
  const image = (
    <img
      src={media.url}
      alt={media.decorative ? "" : media.alt || ""}
      loading="lazy"
      width={media.width || undefined}
      height={media.height || undefined}
      style={style}
    />
  );
  return (
    <figure className="portfolio-media-figure">
      {onOpen ? (
        <button type="button" className="portfolio-media-button" onClick={() => onOpen(index)} aria-label={`Open ${media.alt || "image"} in gallery`}>
          {image}
        </button>
      ) : image}
      {(media.caption || media.credit) && (
        <figcaption>
          {media.caption}{media.caption && media.credit ? " " : ""}{media.credit && <span>Credit: {media.credit}</span>}
        </figcaption>
      )}
    </figure>
  );
}

function Lightbox({ media, index, onIndex, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const startX = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onIndex((index + 1) % media.length);
      if (event.key === "ArrowLeft") onIndex((index - 1 + media.length) % media.length);
      if (event.key === "Tab") {
        const focusable = [...dialogRef.current.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])")];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, media.length, onClose, onIndex]);

  const current = media[index];
  const hasSiblings = media.length > 1;
  return (
    <div
      className="portfolio-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
      ref={dialogRef}
      onClick={(e) => { if (e.target === e.currentTarget || e.target.closest(".lightbox-backdrop")) onClose(); }}
      onPointerDown={(event) => { startX.current = event.clientX; }}
      onPointerUp={(event) => {
        if (startX.current == null) return;
        const distance = event.clientX - startX.current;
        if (Math.abs(distance) > 50) onIndex(distance < 0 ? (index + 1) % media.length : (index - 1 + media.length) % media.length);
        startX.current = null;
      }}
    >
      <div className="lightbox-wrapper">
        <div className="lightbox-topbar">
          <span className="lightbox-counter">{index + 1} / {media.length}</span>
          <button ref={closeRef} type="button" className="lightbox-close" onClick={onClose} aria-label="Close image gallery">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="lightbox-stage">
          {hasSiblings && (
            <button type="button" className="lightbox-nav lightbox-prev" onClick={() => onIndex((index - 1 + media.length) % media.length)} aria-label="Previous image">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
          )}
          <figure className="lightbox-figure">
            <img src={current.url} alt={current.decorative ? "" : current.alt || ""} />
            {(current.caption || current.alt) && (
              <figcaption>{current.caption || current.alt}</figcaption>
            )}
          </figure>
          {hasSiblings && (
            <button type="button" className="lightbox-nav lightbox-next" onClick={() => onIndex((index + 1) % media.length)} aria-label="Next image">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GalleryCover({ mediaList, fit, onOpen, coverRef }) {
  const count = mediaList.length;
  const cover = mediaList[0];
  if (!cover?.url || count === 0) return null;

  const objectPos = (m) => `${m.focalX ?? 50}% ${m.focalY ?? 50}%`;
  return (
    <figure className="gallery-cover" ref={(node) => { if (coverRef) coverRef.current = node; }}>
      {/* Stack layer 2 — third image, furthest back */}
      {count >= 3 && (
        <div className="gallery-stack gallery-stack-2" aria-hidden="true">
          <img src={mediaList[2].url} alt="" loading="lazy"
            style={{ objectFit: fit || "cover", objectPosition: objectPos(mediaList[2]) }} />
        </div>
      )}
      {/* Stack layer 1 — second image, middle */}
      {count >= 2 && (
        <div className="gallery-stack gallery-stack-1" aria-hidden="true">
          <img src={mediaList[1].url} alt="" loading="lazy"
            style={{ objectFit: fit || "cover", objectPosition: objectPos(mediaList[1]) }} />
        </div>
      )}

      <button
        type="button"
        className="gallery-cover-trigger"
        onClick={() => onOpen(0)}
        aria-label={`Open gallery with ${count} image${count === 1 ? "" : "s"}`}
      >
        <img
          src={cover.url}
          alt={cover.decorative ? "" : cover.alt || ""}
          loading="lazy"
          className="gallery-cover-img"
          style={{ objectFit: fit || "cover", objectPosition: objectPos(cover) }}
        />

        {/* Badge: image count top-right */}
        <span className="gallery-badge" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          {count} image{count === 1 ? "" : "s"}
        </span>

        {/* Hover: View Gallery label (desktop only) */}
        <span className="gallery-hover-label" aria-hidden="true">View Gallery →</span>

        {/* Mobile: persistent label */}
        <span className="gallery-mobile-label" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          View {count} images
        </span>
      </button>

      {cover.caption && <figcaption className="gallery-cover-caption">{cover.caption}</figcaption>}
    </figure>
  );
}

function Block({ block }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const triggerRefs = useRef([]);
  const coverRef = useRef(null);
  const { content = {}, settings = {} } = block;
  const width = settings.width || "wide";
  const spacing = settings.spacing || "default";
  const className = `portfolio-block portfolio-block-${block.blockType} width-${width} spacing-${spacing} align-${settings.alignment || "left"}`;
  const mediaList = Array.isArray(content.media) ? content.media : content.media ? [content.media] : [];
  const openLightbox = (index) => { setLightboxIndex(index); };
  const closeLightbox = () => {
    const prior = lightboxIndex;
    setLightboxIndex(null);
    window.requestAnimationFrame(() => {
      if (prior === 0 && coverRef.current) coverRef.current.querySelector("button")?.focus();
      else triggerRefs.current[prior]?.focus?.();
    });
  };

  if (block.visible === false) return null;
  let body = null;
  switch (block.blockType) {
    case "body_text": body = <div className="portfolio-rich-text"><RichText text={content.text} /></div>; break;
    case "heading": {
      const Tag = Number(content.level) === 3 ? "h3" : "h2";
      body = <Tag>{content.text}</Tag>;
      break;
    }
    case "quotation": body = <blockquote><p>{content.quote}</p>{content.attribution && <cite>{content.attribution}</cite>}</blockquote>; break;
    case "highlight": body = <aside className="portfolio-highlight">{content.text}</aside>; break;
    case "testimonial": body = <blockquote className="portfolio-testimonial"><p>{content.quote}</p><cite>{content.name}{content.role ? `, ${content.role}` : ""}</cite></blockquote>; break;
    case "single_image": body = <ImageFigure media={mediaList[0]} fit={settings.mediaFit} />; break;
    case "image_gallery": body = (
      <GalleryCover mediaList={mediaList} fit={settings.mediaFit} onOpen={openLightbox} coverRef={coverRef} />
    ); break;
    case "image_grid": body = (
      <div className={`portfolio-image-grid columns-${Math.min(3, Math.max(1, Number(settings.columns) || 2))}`}>
        {mediaList.map((media, index) => (
          <div key={media.id || media.url || index} ref={(node) => { triggerRefs.current[index] = node?.querySelector?.("button") || node; }}>
            <ImageFigure media={media} fit={settings.mediaFit} onOpen={settings.lightbox ? openLightbox : null} index={index} />
          </div>
        ))}
      </div>
    ); break;
    case "video_embed": body = <VideoEmbed content={content} />; break;
    case "media_text": body = (
      <div className={`portfolio-media-text media-${content.mediaPosition || "left"}`}>
        <ImageFigure media={mediaList[0]} fit={settings.mediaFit} />
        <div className="portfolio-rich-text"><RichText text={content.text} /></div>
      </div>
    ); break;
    case "external_link": {
      const href = safeHref(content.url);
      body = href ? <a className="portfolio-cta" href={href}>{content.label || "Open link"}<span aria-hidden="true">↗</span></a> : null;
      break;
    }
    case "divider": body = <hr />; break;
    default: body = null;
  }
  return (
    <section className={className}>
      {body}
      {lightboxIndex !== null && mediaList.length > 0 && <Lightbox media={mediaList} index={lightboxIndex} onIndex={setLightboxIndex} onClose={closeLightbox} />}
    </section>
  );
}

export default function PortfolioProjectRenderer({ project, preview = false }) {
  const layoutStyleId = project.layoutStyle || 1;
  const layout = LAYOUTS.find(l => l.id === layoutStyleId) || LAYOUTS[0];
  const Component = layout.Component;
  return <Component p={project} />;
}


export function ProjectBlocks({ project }) {
  const limited = project.workInProgress && project.limitedPublic;
  return (
    <div className="portfolio-project-body">
      {(project.blocks || []).length > 0 && (
        <div className="portfolio-blocks">
          {project.blocks.map(block => <Block block={block} key={block.id} />)}
        </div>
      )}
      {!limited && project.outcomeText && (
        <section className="portfolio-outcome">
          <h2>{project.outcomeHeading || "Outcome"}</h2>
          <RichText text={project.outcomeText} />
        </section>
      )}
      {!limited && project.collaborators?.length > 0 && (
        <section className="portfolio-collaborators">
          <h2>Collaborators</h2>
          <ul>{project.collaborators.map((person, index) => {
            const href = safeHref(person.primaryUrl);
            return <li key={person.id || `${person.name}-${index}`}><div>{href ? <a href={href}>{person.name}</a> : <span>{person.name}</span>}<small>{[person.roleLabel, person.organisation].filter(Boolean).join(" · ")}</small></div></li>;
          })}</ul>
        </section>
      )}
      {project.links?.length > 0 && (
        <nav className="portfolio-project-links" aria-label="Related links">
          {project.links.map((link, index) => {
            const href = safeHref(link.url);
            return href ? <a key={link.id || index} href={href}>{link.label || "View related work"}<span aria-hidden="true">↗</span></a> : null;
          })}
        </nav>
      )}
    </div>
  );
}

/* ─── Shared helpers ──────────────────────────────────────── */
function yr(p) {
  if (!p.yearStart) return "";
  return p.yearEnd && p.yearEnd !== p.yearStart ? `${p.yearStart}–${p.yearEnd}` : String(p.yearStart);
}
const p_roles  = p => (p.taxonomies || []).filter(t => (t.groupType || t.group_type) === "role");
const p_genres = p => (p.taxonomies || []).filter(t => (t.groupType || t.group_type) === "genre");
const p_types  = p => (p.taxonomies || []).filter(t => (t.groupType || t.group_type) === "project_type");
const p_orgs   = p => (p.organisations || []).map(o => o.name).join(", ");

/* Shared prose + blocks wrapper used by every layout */
export function Body({ p, className = "", skipContext = false }) {
  return (
    <div className={`lp-body ${className}`}>
      {!skipContext && p.context && <p className="lp-context">{p.context}</p>}
      {p.specificContribution && <p className="lp-contribution">{p.specificContribution}</p>}
      <ProjectBlocks project={p} />
    </div>
  );
}

/* ─── 1. Typographic Grid (Context as Hero) ─────────────── */
function L1({ p }) {
  return (
    <article className="lp-article l1-article">
      <header className="l1-header">
        <div className="l1-meta-col">
          <h1 className="l1-title">{p.title}</h1>
          {yr(p) && <div className="l1-row"><span>Year</span><strong>{yr(p)}</strong></div>}
          {p_orgs(p) && <div className="l1-row"><span>Organisation</span><strong>{p_orgs(p)}</strong></div>}
          {p_roles(p).length > 0 && <div className="l1-row"><span>Role</span><strong>{p_roles(p).map(r => r.label).join(", ")}</strong></div>}
          {p_genres(p).length > 0 && <div className="l1-row"><span>Genre</span><strong>{p_genres(p).map(r => r.label).join(", ")}</strong></div>}
          {p_types(p).length > 0 && <div className="l1-row"><span>Project Type</span><strong>{p_types(p).map(r => r.label).join(", ")}</strong></div>}
        </div>
        <div className="l1-context-col">
          {p.context ? (
            <h2 className="l1-hero-context">{p.context}</h2>
          ) : (
            <h2 className="l1-hero-context">{p.oneLineDescription}</h2>
          )}
        </div>
      </header>
      {p.coverUrl && (
        <figure className="l1-cover">
          <img src={p.coverUrl} alt={p.coverAlt || ""} style={{ objectPosition: `${p.coverFocalX ?? 50}% ${p.coverFocalY ?? 50}%` }} />
        </figure>
      )}
      <Body p={p} className="l1-body" skipContext={true} />
    </article>
  );
}

/* ─── 3. Columnar Narrative ──────────────────────────────── */
function L3({ p }) {
  return (
    <article className="lp-article">
      <header className="l3-header">
        <h1 className="l3-title">{p.title}</h1>
      </header>
      {p.coverUrl && (
        <figure className="l3-cover-wide">
          <img src={p.coverUrl} alt={p.coverAlt || ""} style={{ objectPosition: `${p.coverFocalX ?? 50}% ${p.coverFocalY ?? 50}%` }} />
        </figure>
      )}
      <div className="l3-columns">
        <aside className="l3-sidebar">
          {p.oneLineDescription && <p className="l3-prop">{p.oneLineDescription}</p>}
          <dl className="l3-dl">
            {yr(p)             && <><dt>Year</dt><dd>{yr(p)}</dd></>}
            {p_orgs(p)         && <><dt>Organisation</dt><dd>{p_orgs(p)}</dd></>}
            {p_roles(p).length > 0 && <><dt>Role</dt><dd>{p_roles(p).map(r => r.label).join(", ")}</dd></>}
            {p_genres(p).length > 0 && <><dt>Genre</dt><dd>{p_genres(p).map(r => r.label).join(", ")}</dd></>}
            {p.location        && <><dt>Location</dt><dd>{p.location}</dd></>}
            {p.duration        && <><dt>Duration</dt><dd>{p.duration}</dd></>}
            {p_types(p).length > 0 && <><dt>Project Type</dt><dd>{p_types(p).map(r => r.label).join(", ")}</dd></>}
          </dl>
        </aside>
        <div className="l3-main">
          {p.context && <p className="l3-prose">{p.context}</p>}
          {p.specificContribution && <blockquote className="l3-contrib"><p>{p.specificContribution}</p></blockquote>}
          <ProjectBlocks project={p} />
        </div>
      </div>
    </article>
  );
}

/* ─── 4. Manifesto Block (Split screen text heavy) ──────── */
function L4({ p }) {
  return (
    <article className="lp-article l4-article">
      <div className="l4-split">
        <div className="l4-text-side">
          <h1 className="l4-title">{p.title}</h1>
          {p.context ? (
            <p className="l4-hero-context">{p.context}</p>
          ) : (
            <p className="l4-hero-context">{p.oneLineDescription}</p>
          )}
          <div className="l4-meta">
            {p_roles(p).length > 0 && <span>{p_roles(p).map(r => r.label).join(", ")}</span>}
            {p_genres(p).length > 0 && <span>{p_genres(p).map(r => r.label).join(", ")}</span>}
            {p_orgs(p) && <span>{p_orgs(p)}</span>}
            {yr(p) && <span>{yr(p)}</span>}
            {p_types(p).length > 0 && <span>{p_types(p).map(r => r.label).join(", ")}</span>}
          </div>
        </div>
        <div className="l4-image-side">
          {p.coverUrl && <img src={p.coverUrl} alt={p.coverAlt || ""} style={{ objectPosition: `${p.coverFocalX ?? 50}% ${p.coverFocalY ?? 50}%` }} />}
        </div>
      </div>
      <Body p={p} className="l4-body" skipContext={true} />
    </article>
  );
}

/* ─── 6. Centered Statement (Massive width) ─────────────── */
function L6({ p }) {
  return (
    <article className="lp-article l6-article">
      <header className="l6-header">
        <h1 className="l6-title">{p.title}</h1>
        <div className="l6-meta">
          {p_roles(p).length > 0 && <span>{p_roles(p).map(r => r.label).join(", ")}</span>}
          {p_genres(p).length > 0 && <span>{p_genres(p).map(r => r.label).join(", ")}</span>}
          {p_orgs(p) && <span>{p_orgs(p)}</span>}
          {yr(p) && <span>{yr(p)}</span>}
          {p_types(p).length > 0 && <span>{p_types(p).map(r => r.label).join(", ")}</span>}
        </div>
      </header>
      {p.coverUrl && (
        <figure className="l6-cover">
          <img src={p.coverUrl} alt={p.coverAlt || ""} style={{ objectPosition: `${p.coverFocalX ?? 50}% ${p.coverFocalY ?? 50}%` }} />
        </figure>
      )}
      <div className="l6-statement-wrap">
        <Body p={p} className="l6-body" />
      </div>
    </article>
  );
}

/* ─── 7. Swiss Hairline Grid ─────────────────────────────── */
function L7({ p }) {
  return (
    <article className="lp-article l7-article">
      <div className="l7-hero">
        <div className="l7-grid-lines" aria-hidden="true" />
        <div className="l7-content">
          <div className="l7-left">
            <h1 className="l7-title">{p.title}</h1>
            {p.oneLineDescription && <p className="l7-sub">{p.oneLineDescription}</p>}
          </div>
          <aside className="l7-right">
            {yr(p)   && <div className="l7-row"><span>Year</span><strong>{yr(p)}</strong></div>}
            {p_orgs(p) && <div className="l7-row"><span>Organisation</span><strong>{p_orgs(p)}</strong></div>}
            {p_roles(p).length > 0 && <div className="l7-row"><span>Role</span><strong>{p_roles(p).map(r => r.label).join(", ")}</strong></div>}
            {p_genres(p).length > 0 && <div className="l7-row"><span>Genre</span><strong>{p_genres(p).map(r => r.label).join(", ")}</strong></div>}
            {p.location && <div className="l7-row"><span>Location</span><strong>{p.location}</strong></div>}
            {p.duration && <div className="l7-row"><span>Duration</span><strong>{p.duration}</strong></div>}
            {p_types(p).length > 0 && <div className="l7-row"><span>Project Type</span><strong>{p_types(p).map(r => r.label).join(", ")}</strong></div>}
          </aside>
        </div>
      </div>
      {p.coverUrl && (
        <figure className="l7-cover">
          <img src={p.coverUrl} alt={p.coverAlt || ""} style={{ objectPosition: `${p.coverFocalX ?? 50}% ${p.coverFocalY ?? 50}%` }} />
        </figure>
      )}
      <Body p={p} className="l7-body" />
    </article>
  );
}

export const LAYOUTS = [
  { id: 1,  label: "Typographic", Component: L1  },
  { id: 2,  label: "Columnar",    Component: L3  },
  { id: 3,  label: "Manifesto",   Component: L4  },
  { id: 4,  label: "Centered",    Component: L6  },
  { id: 5,  label: "Swiss Grid",  Component: L7  },
];
