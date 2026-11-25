import React, { useEffect, useRef, useState } from "react";
import { pages, pageImages } from "../../lib/siteNavigation.js";

export function PageList({ section, onPreview }) {
  return <ul className="nh-links">{section.links.map(key => (
    <li key={key}><a href={pages[key].href}
      onMouseEnter={onPreview ? () => onPreview(key) : undefined}
      onFocus={onPreview ? () => onPreview(key) : undefined}>{pages[key].label}</a></li>
  ))}</ul>;
}

export default function VisualSection({ section }) {
  const [previewKey, setPreviewKey] = useState(null);
  const spread = useRef(null);
  const page = section.links.includes(previewKey) ? pages[previewKey] : null;
  const feature = page
    ? { image: pageImages[previewKey], title: page.label, href: page.href }
    : section.feature;

  useEffect(() => {
    // Warm only the visible section so a brief hover can display its previews.
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      for (const key of section.links) {
        const image = new Image();
        image.src = pageImages[key];
      }
      observer.disconnect();
    });
    observer.observe(spread.current);
    return () => observer.disconnect();
  }, [section]);

  return (
    <div className="nh-visual__spread" ref={spread}>
      <a className="nh-visual__feature" href={feature.href}>
        <img src={feature.image} alt="" width="480" height="270" decoding="async" loading="lazy" />
        <span>{feature.title}<span aria-hidden="true">→</span></span>
      </a>
      <nav aria-label={section.name}><h3>{section.name}</h3><PageList section={section} onPreview={setPreviewKey} /></nav>
    </div>
  );
}
