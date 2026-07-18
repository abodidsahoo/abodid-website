import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isExternalPortfolioHref, normalizePortfolioHref, serializeFilters } from "../../lib/portfolio/schema";
import { getOptimizedImageSrcSet, getOptimizedImageUrl } from "../../lib/imageOptimization.js";
import { computeFloatingLayout, getFloatingImageSizePreset, getFloatingStageSize, hashString } from "../../lib/moodboardLayout.js";
import "../../styles/portfolio.css";
import "../../styles/layout-preview.css";

function safeHref(value) {
  return normalizePortfolioHref(value);
}

const externalLinkProps = (href) => isExternalPortfolioHref(href)
  ? { target: "_blank", rel: "noopener noreferrer" }
  : {};

function OptimizedImage({ src, widths = [480, 800, 1200, 1600], quality = 76, sizes = "100vw", ...props }) {
  const fallbackWidth = Math.max(...widths);
  return (
    <img
      {...props}
      src={getOptimizedImageUrl(src, { width: fallbackWidth, quality })}
      srcSet={getOptimizedImageSrcSet(src, { widths, quality })}
      sizes={sizes}
    />
  );
}

function ResponsiveMediaImage({ media, src = media?.url, widths = [480, 800, 1200, 1600], quality = 76, sizes = "100vw", ...props }) {
  const variants = Object.values(media?.variants || {})
    .filter((variant) => variant?.url && Number(variant.width) > 0)
    .sort((first, second) => Number(first.width) - Number(second.width));
  if (!variants.length) return <OptimizedImage src={src} widths={widths} quality={quality} sizes={sizes} {...props} />;
  return (
    <img
      {...props}
      src={variants.at(-1)?.url || src}
      srcSet={variants.map((variant) => `${variant.url} ${variant.width}w`).join(", ")}
      sizes={sizes}
    />
  );
}

function PortfolioFloatingGallery({ mediaList, blockId, spacing = "default", imageSize = "medium" }) {
  const stageRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 960, height: 900, viewportHeight: 900 });
  const [imageRatios, setImageRatios] = useState({});
  const spacingMultiplier = spacing === "compact" ? .76 : spacing === "spacious" ? 1.24 : 1;
  const { sizeMultiplier, minScale } = getFloatingImageSizePreset(imageSize);

  const items = useMemo(() => mediaList.map((media, index) => {
    const sourceId = String(media.id || media.storagePath || media.url || `image-${index + 1}`);
    const id = `${sourceId}:${index}`;
    const variantWithDimensions = Object.values(media.variants || {}).find((variant) => Number(variant?.width) > 0 && Number(variant?.height) > 0);
    const metadataRatio = Number(media.aspectRatio)
      || Number(media.aspect_ratio)
      || (Number(media.width) > 0 && Number(media.height) > 0 ? Number(media.width) / Number(media.height) : 0)
      || (variantWithDimensions ? Number(variantWithDimensions.width) / Number(variantWithDimensions.height) : 0);
    return {
      id,
      media,
      aspectRatio: metadataRatio > 0 ? metadataRatio : imageRatios[id] || 1,
    };
  }), [imageRatios, mediaList]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof window === "undefined") return undefined;
    const updateSize = () => setStageSize(getFloatingStageSize({
      width: stage.clientWidth || 960,
      viewportHeight: window.innerHeight || 900,
      itemCount: items.length,
      sizeMultiplier,
      spacingMultiplier,
    }));
    updateSize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateSize);
    observer?.observe(stage);
    window.addEventListener("resize", updateSize, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [items.length, sizeMultiplier, spacingMultiplier]);

  const layoutMap = useMemo(() => computeFloatingLayout(
    items,
    stageSize.width,
    stageSize.height,
    hashString(String(blockId)),
    sizeMultiplier,
    spacingMultiplier,
    minScale,
  ), [blockId, items, minScale, sizeMultiplier, spacingMultiplier, stageSize.height, stageSize.width]);

  const stageContentBottom = useMemo(() => items.reduce((maxBottom, item) => {
    const layout = layoutMap.get(item.id);
    return layout ? Math.max(maxBottom, layout.top + layout.height) : maxBottom;
  }, 12), [items, layoutMap]);

  const stageRenderHeight = useMemo(() => {
    const tailBuffer = Math.max(56, Math.min(108, stageSize.width * .05));
    const viewportFloor = Math.max(420, stageSize.viewportHeight * .72);
    return Math.max(viewportFloor, stageContentBottom + tailBuffer);
  }, [stageContentBottom, stageSize.viewportHeight, stageSize.width]);

  const recordImageRatio = (id, event) => {
    const image = event.currentTarget;
    if (!image?.naturalWidth || !image?.naturalHeight) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    setImageRatios((current) => Math.abs((current[id] || 0) - ratio) < .001 ? current : { ...current, [id]: ratio });
  };

  if (!mediaList.length) return null;
  return <div ref={stageRef} className="portfolio-floating-gallery" style={{ minHeight: `${stageRenderHeight}px` }}>
    {items.map((item) => {
      const layout = layoutMap.get(item.id);
      if (!layout) return null;
      return <div className="portfolio-floating-item" key={item.id} style={{
        left: `${layout.left}px`,
        top: `${layout.top}px`,
        width: `${layout.width}px`,
        height: `${layout.height}px`,
        zIndex: layout.zIndex,
        "--portfolio-float-y": `${(layout.driftY * (layout.breathDirection || 1)).toFixed(2)}px`,
        "--portfolio-float-scale": layout.breathScale.toFixed(3),
        "--portfolio-float-duration": `${layout.duration.toFixed(2)}s`,
        "--portfolio-float-delay": `${layout.motionDelay.toFixed(2)}s`,
      }}>
        <div className="portfolio-floating-motion"><ImageFigure media={item.media} fit="contain" onImageLoad={(event) => recordImageRatio(item.id, event)} /></div>
      </div>;
    })}
  </div>;
}

function PortfolioLightboxCover({ mediaList, onOpen, triggerRef }) {
  const cover = mediaList[0];
  if (!cover?.url) return null;
  return <figure className="portfolio-lightbox-cover">
    <button type="button" ref={triggerRef} onClick={() => onOpen(0)} aria-label={`Open lightbox with ${mediaList.length} image${mediaList.length === 1 ? "" : "s"}`}>
      <ResponsiveMediaImage media={cover} src={cover.url} widths={[480, 800, 1200, 1600]} quality={76} sizes="(max-width: 760px) 100vw, 1200px" alt={cover.decorative ? "" : cover.alt || ""} loading="lazy" decoding="async" />
      <span className="portfolio-lightbox-count">{mediaList.length} image{mediaList.length === 1 ? "" : "s"}</span>
      <span className="portfolio-lightbox-open">Open lightbox <b aria-hidden="true">+</b></span>
    </button>
    {(cover.caption || cover.credit) && <figcaption>{cover.caption}{cover.caption && cover.credit ? " " : ""}{cover.credit && <span>Credit: {cover.credit}</span>}</figcaption>}
  </figure>;
}

function ProjectCoverImage({ project }) {
  return (
    <ResponsiveMediaImage
      media={project.coverMedia}
      src={project.coverMedia?.url || project.coverUrl}
      widths={[480, 800, 1200, 1600]}
      quality={74}
      sizes="(max-width: 760px) 100vw, 1200px"
      alt={project.coverAlt || ""}
      loading="lazy"
      decoding="async"
      width="1600"
      height="900"
      style={{ objectPosition: `${project.coverFocalX ?? 50}% ${project.coverFocalY ?? 50}%` }}
    />
  );
}

function inlineMarkup(text = "") {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  return String(text).split(pattern).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = safeHref(link[2]);
      return href ? <a key={index} href={href} {...externalLinkProps(href)}>{link[1]}</a> : link[1];
    }
    return part;
  });
}

function RichText({ text = "" }) {
  return String(text).split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => (
    <p key={index}>{inlineMarkup(paragraph.replace(/\n/g, " "))}</p>
  ));
}

function ExternalProjectLink({ href, label, className = "" }) {
  if (!href) return null;
  return <a className={`portfolio-external-link ${className}`.trim()} href={href} {...externalLinkProps(href)}>
    <span>{label || "Open link"}</span><b aria-hidden="true">↗</b>
  </a>;
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
          {poster && <OptimizedImage
            src={poster}
            widths={[480, 800, 1200]}
            quality={74}
            sizes="(max-width: 760px) 100vw, 960px"
            alt=""
            className="pf-video-poster"
            loading="lazy"
            decoding="async"
            width="1280"
            height="720"
          />}
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

function ImageFigure({ media, fit = "cover", onOpen, index, onImageLoad }) {
  if (!media?.url) return null;
  const style = { objectPosition: `${media.focalX ?? 50}% ${media.focalY ?? 50}%`, objectFit: fit };
  const image = (
    <ResponsiveMediaImage
      media={media}
      src={media.url}
      widths={[480, 800, 1200, 1600]}
      quality={76}
      sizes="(max-width: 760px) 100vw, 1200px"
      alt={media.decorative ? "" : media.alt || ""}
      loading="lazy"
      decoding="async"
      onLoad={onImageLoad}
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
            <ResponsiveMediaImage
              media={current}
              src={current.url}
              widths={[800, 1200, 1600, 2000]}
              quality={84}
              sizes="100vw"
              alt={current.decorative ? "" : current.alt || ""}
              decoding="async"
            />
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

function Block({ block }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const triggerRefs = useRef([]);
  const { content = {}, settings = {} } = block;
  const width = settings.width || "wide";
  const spacing = settings.spacing || "default";
  const className = `portfolio-block portfolio-block-${block.blockType} width-${width} spacing-${spacing} align-${settings.alignment || "left"}`;
  const mediaList = (Array.isArray(content.media) ? content.media : content.media ? [content.media] : [])
    .filter((item) => item && typeof item === "object");
  const openLightbox = (index) => { setLightboxIndex(index); };
  const closeLightbox = () => {
    const prior = lightboxIndex;
    setLightboxIndex(null);
    window.requestAnimationFrame(() => {
      (triggerRefs.current[prior] || triggerRefs.current[0])?.focus?.();
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
    case "two_columns": {
      const columns = Array.isArray(content.columns) ? content.columns.slice(0, 2) : [];
      const gap = Math.min(96, Math.max(0, Number(settings.columnGap) || 32));
      body = <div className="portfolio-two-columns" style={{ "--portfolio-column-gap": `${gap}px` }}>
        {Array.from({ length: 2 }, (_, index) => {
          const column = columns[index] || {};
          const legacyItems = [
            column.heading ? { type: "heading", text: column.heading } : null,
            column.text ? { type: "text", text: column.text } : null,
            column.linkText || column.linkUrl ? { type: "link", text: column.linkText, url: column.linkUrl } : null,
          ].filter(Boolean);
          const items = Array.isArray(column.items) ? column.items : legacyItems;
          return <article className="portfolio-two-column" key={column.id || index}>
            {items.map((item, itemIndex) => {
              const href = safeHref(item.url || item.linkUrl);
              if (item.type === "heading") return item.text ? <h3 key={item.id || itemIndex}>{item.text}</h3> : null;
              if (item.type === "text") return item.text ? <div className="portfolio-rich-text" key={item.id || itemIndex}><RichText text={item.text} /></div> : null;
              if (item.type === "image") return href ? <ImageFigure key={item.id || itemIndex} media={{ url: href, alt: item.alt, caption: item.caption }} fit="cover" /> : null;
              if (item.type === "button") return href ? <a className="portfolio-cta portfolio-column-button" key={item.id || itemIndex} href={href} {...externalLinkProps(href)}>{item.label || "Open link"}<span aria-hidden="true">↗</span></a> : null;
              if (["link", "external_link"].includes(item.type)) return href && item.text ? <ExternalProjectLink className="is-column-link" key={item.id || itemIndex} href={href} label={item.text} /> : null;
              return null;
            })}
          </article>;
        })}
      </div>;
      break;
    }
    case "quotation": body = <blockquote><p>{content.quote}</p>{content.attribution && <cite>{content.attribution}</cite>}</blockquote>; break;
    case "highlight": body = <aside className="portfolio-highlight">{content.text}</aside>; break;
    case "testimonial": body = <blockquote className="portfolio-testimonial"><p>{content.quote}</p><cite>{content.name}{content.role ? `, ${content.role}` : ""}</cite></blockquote>; break;
    case "outcome": body = <div className="portfolio-outcome-block">{content.heading && <h2>{content.heading}</h2>}<div className="portfolio-rich-text"><RichText text={content.text} /></div></div>; break;
    case "collaborator": {
      const href = safeHref(content.url);
      body = <div className="portfolio-profile-block"><div>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{content.name || "Collaborator"}</a> : <span>{content.name}</span>}{content.role && <small>{content.role}</small>}</div></div>;
      break;
    }
    case "organisation": {
      const href = safeHref(content.url);
      body = <div className="portfolio-profile-block"><div>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{content.name || "Organisation"}</a> : <span>{content.name}</span>}{content.location && <small>{content.location}</small>}</div></div>;
      break;
    }
    case "single_image": body = <ImageFigure media={mediaList[0]} fit={settings.mediaFit} />; break;
    case "image_gallery":
    case "image_grid": {
      const displayMode = settings.displayMode || (block.blockType === "image_gallery" || settings.lightbox === true ? "lightbox" : "grid");
      if (displayMode === "floating") {
        body = <PortfolioFloatingGallery mediaList={mediaList} blockId={block.id || "multi-image"} spacing={spacing} imageSize={settings.imageSize || "medium"} />;
      } else if (displayMode === "lightbox") {
        body = <PortfolioLightboxCover mediaList={mediaList} onOpen={openLightbox} triggerRef={(node) => { triggerRefs.current[0] = node; }} />;
      } else {
        body = (
          <div className={`portfolio-image-grid columns-${Math.min(3, Math.max(1, Number(settings.columns) || 2))}`}>
            {mediaList.map((media, index) => <div key={media.id || media.url || index}><ImageFigure media={media} fit={settings.mediaFit} /></div>)}
          </div>
        );
      }
      break;
    }
    case "video_embed": body = <VideoEmbed content={content} />; break;
    case "media_text": body = (
      <div className={`portfolio-media-text media-${content.mediaPosition || "left"}`}>
        <ImageFigure media={mediaList[0]} fit={settings.mediaFit} />
        <div className="portfolio-rich-text"><RichText text={content.text} /></div>
      </div>
    ); break;
    case "external_link": {
      const href = safeHref(content.url);
      body = href ? <div className="portfolio-external-link-block"><ExternalProjectLink href={href} label={content.label} /></div> : null;
      break;
    }
    case "link": {
      const href = safeHref(content.url);
      body = href && content.text ? <a className="portfolio-text-link" href={href} {...externalLinkProps(href)}>{content.text}<span aria-hidden="true">↗</span></a> : null;
      break;
    }
    case "divider": body = <hr />; break;
    case "spacer": body = <div className="portfolio-spacer" style={{ height: `${Math.min(480, Math.max(0, Number(content.height) || 0))}px` }} aria-hidden="true" />; break;
    default: body = null;
  }
  return (
    <section className={className}>
      {body}
      {lightboxIndex !== null && mediaList.length > 0 && <Lightbox media={mediaList} index={lightboxIndex} onIndex={setLightboxIndex} onClose={closeLightbox} />}
    </section>
  );
}

export default function PortfolioProjectRenderer({ project }) {
  const layoutStyleId = project.layoutStyle || 1;
  const layout = LAYOUTS.find(l => l.id === layoutStyleId) || LAYOUTS[0];
  const Component = layout.Component;
  return <Component p={project} />;
}


export function ProjectBlocks({ project }) {
  return (
    <div className="portfolio-project-body">
      {(project.blocks || []).length > 0 && (
        <div className="portfolio-blocks">
          {project.blocks.map(block => <Block block={block} key={block.id} />)}
        </div>
      )}
    </div>
  );
}

/* ─── Shared helpers ──────────────────────────────────────── */
function yr(p) {
  if (!p.yearStart) return "";
  return String(p.yearStart);
}
const p_roles  = p => (p.taxonomies || []).filter(t => (t.groupType || t.group_type) === "role");
const p_genres = p => (p.taxonomies || []).filter(t => (t.groupType || t.group_type) === "genre");
const p_types  = p => (p.taxonomies || []).filter(t => (t.groupType || t.group_type) === "project_type");

function TaxonomyTags({ terms, groupType }) {
  return <span className="lp-taxonomy-tags">{terms.map((term) => {
    const slug = term.slug || "";
    const href = `/work?${serializeFilters({ [groupType]: [slug] })}`;
    return <a className="lp-taxonomy-tag" href={href} key={`${groupType}-${slug}`}>{term.label}</a>;
  })}</span>;
}

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
          {p_roles(p).length > 0 && <div className="l1-row"><span>Role</span><strong><TaxonomyTags terms={p_roles(p)} groupType="role" /></strong></div>}
          {p_genres(p).length > 0 && <div className="l1-row"><span>Genre</span><strong><TaxonomyTags terms={p_genres(p)} groupType="genre" /></strong></div>}
          {p_types(p).length > 0 && <div className="l1-row"><span>Project Type</span><strong><TaxonomyTags terms={p_types(p)} groupType="project_type" /></strong></div>}
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
          <ProjectCoverImage project={p} />
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
          <ProjectCoverImage project={p} />
        </figure>
      )}
      <div className="l3-columns">
        <aside className="l3-sidebar">
          {p.oneLineDescription && <p className="l3-prop">{p.oneLineDescription}</p>}
          <dl className="l3-dl">
            {yr(p)             && <><dt>Year</dt><dd>{yr(p)}</dd></>}
            {p_roles(p).length > 0 && <><dt>Role</dt><dd><TaxonomyTags terms={p_roles(p)} groupType="role" /></dd></>}
            {p_genres(p).length > 0 && <><dt>Genre</dt><dd><TaxonomyTags terms={p_genres(p)} groupType="genre" /></dd></>}
            {p_types(p).length > 0 && <><dt>Project Type</dt><dd><TaxonomyTags terms={p_types(p)} groupType="project_type" /></dd></>}
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
            {p_roles(p).length > 0 && <span className="lp-taxonomy-meta"><b>Role</b><TaxonomyTags terms={p_roles(p)} groupType="role" /></span>}
            {p_genres(p).length > 0 && <span className="lp-taxonomy-meta"><b>Genre</b><TaxonomyTags terms={p_genres(p)} groupType="genre" /></span>}
            {yr(p) && <span className="lp-meta-year">{yr(p)}</span>}
            {p_types(p).length > 0 && <span className="lp-taxonomy-meta"><b>Project type</b><TaxonomyTags terms={p_types(p)} groupType="project_type" /></span>}
          </div>
        </div>
        <div className="l4-image-side">
          {p.coverUrl && <ProjectCoverImage project={p} />}
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
          {p_roles(p).length > 0 && <span className="lp-taxonomy-meta"><b>Role</b><TaxonomyTags terms={p_roles(p)} groupType="role" /></span>}
          {p_genres(p).length > 0 && <span className="lp-taxonomy-meta"><b>Genre</b><TaxonomyTags terms={p_genres(p)} groupType="genre" /></span>}
          {yr(p) && <span className="lp-meta-year">{yr(p)}</span>}
          {p_types(p).length > 0 && <span className="lp-taxonomy-meta"><b>Project type</b><TaxonomyTags terms={p_types(p)} groupType="project_type" /></span>}
        </div>
      </header>
      {p.coverUrl && (
        <figure className="l6-cover">
          <ProjectCoverImage project={p} />
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
            {p_roles(p).length > 0 && <div className="l7-row"><span>Role</span><strong><TaxonomyTags terms={p_roles(p)} groupType="role" /></strong></div>}
            {p_genres(p).length > 0 && <div className="l7-row"><span>Genre</span><strong><TaxonomyTags terms={p_genres(p)} groupType="genre" /></strong></div>}
            {p_types(p).length > 0 && <div className="l7-row"><span>Project Type</span><strong><TaxonomyTags terms={p_types(p)} groupType="project_type" /></strong></div>}
          </aside>
        </div>
      </div>
      {p.coverUrl && (
        <figure className="l7-cover">
          <ProjectCoverImage project={p} />
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
