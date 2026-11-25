import React, { useRef, useState } from "react";
import { pages, sections } from "../../lib/siteNavigation.js";
import VisualSection, { PageList } from "../navigation/VisualSection.jsx";

export function QueryFields({ selection, footerConcept, omit }) {
  const fields = { header: selection.header, menu: selection.menu, open: selection.open ? "1" : "", concept: footerConcept };
  return Object.entries(fields).map(([key, value]) => key !== omit && value
    ? <input key={key} type="hidden" name={key} value={value} />
    : null);
}

export function Directory({ enhanced }) {
  const [expanded, setExpanded] = useState(["work"]);
  function toggle(id) {
    setExpanded(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }
  return <nav className="nh-directory" aria-label="Site directory" data-enhanced={enhanced || undefined}>
    {sections.map(section => <div key={section.id} className="nh-directory__group" data-expanded={expanded.includes(section.id)}>
      <h3>
        <span className="nh-directory__title">{section.name}</span>
        <button type="button" className="nh-disclosure" aria-expanded={expanded.includes(section.id)}
          aria-controls={`nh-group-${section.id}`} onClick={() => toggle(section.id)}>
          {section.name}<span aria-hidden="true">{expanded.includes(section.id) ? "−" : "+"}</span>
        </button>
      </h3>
      <div id={`nh-group-${section.id}`}><PageList section={section} /></div>
    </div>)}
  </nav>;
}

// The section links also have ordinary URLs so the same view works before hydration.
function sectionHref(context, section) {
  const params = new URLSearchParams({ header: context.selection.header, menu: context.selection.menu, open: "1" });
  if (context.footerConcept) params.set("concept", context.footerConcept);
  if (section) params.set("section", section);
  return `${context.path}?${params}`;
}
function chooseSection(event, callback) {
  if (event.button !== 0 || event.metaKey || event.altKey || event.shiftKey || event.ctrlKey) return;
  event.preventDefault();
  history.replaceState(history.state, "", event.currentTarget.href);
  callback();
}

export function SectionDrawer({ context, initialSection }) {
  const [selected, setSelected] = useState(initialSection);
  const group = sections.find(section => section.id === selected);
  const nav = useRef(null);
  function choose(event, id) {
    chooseSection(event, () => {
      setSelected(id);
      requestAnimationFrame(() => {
        const target = id ? "[data-up]" : `[data-group="${selected}"]`;
        nav.current?.querySelector(target)?.focus();
      });
    });
  }
  return <nav className="nh-drawer" ref={nav} aria-label="Browse site sections">
    {group ? <>
      <a className="nh-up" data-up href={sectionHref(context)} onClick={e => choose(e, null)}><span aria-hidden="true">←</span> All sections</a>
      <h3>{group.name}</h3><PageList section={group} />
    </> : <ul>{sections.map(section => <li key={section.id}>
      <a className="nh-drawer__row" href={sectionHref(context, section.id)} data-group={section.id} onClick={e => choose(e, section.id)}>
        <span><strong>{section.name}</strong><small>{section.examples.map(key => pages[key].label).join(" · ")}</small></span>
        <span aria-hidden="true">→</span>
      </a>
    </li>)}</ul>}
  </nav>;
}

const fold = text => text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const catalogue = sections.flatMap(section => section.links.map(key => ({
  ...pages[key], section: section.name,
  search: fold(`${pages[key].label} ${section.name} ${pages[key].terms}`),
})));
const shortcuts = ["work", "research", "writing", "workshops", "contact"].map(key => catalogue.find(page => page.href === pages[key].href));

export function PageFinder({ context, initialQuery }) {
  const [query, setQuery] = useState(initialQuery);
  const input = useRef(null);
  const list = useRef(null);
  const terms = fold(query.trim()).split(/\s+/).filter(Boolean);
  const matches = terms.length ? catalogue.filter(page => terms.every(term => page.search.includes(term)))
    .sort((a, b) => Number(terms.every(term => fold(b.label).includes(term))) - Number(terms.every(term => fold(a.label).includes(term)))) : shortcuts;
  return <div className="nh-finder">
    <form role="search" aria-label="Find a site page" method="get" action={context.path} data-astro-reload
      onSubmit={event => { event.preventDefault(); list.current?.querySelector("a")?.focus(); }}>
      <QueryFields {...context} />
      <label htmlFor="nh-page-search">Search site pages</label>
      <div className="nh-finder__field">
        <span className="nh-lens" aria-hidden="true"></span>
        <input id="nh-page-search" name="q" type="search" autoComplete="off" value={query} ref={input}
          placeholder="Try photography, papers or CV" onChange={e => setQuery(e.target.value)} />
        <noscript><button type="submit">Search</button></noscript>
      </div>
    </form>
    <p className="nh-eyebrow" role="status">{terms.length ? `${matches.length} matching ${matches.length === 1 ? "page" : "pages"}` : "Shortcuts"}</p>
    {matches.length ? <nav aria-label="Page finder results" ref={list}><ul>
      {matches.map(page => <li key={page.href}><a href={page.href}><strong>{page.label}</strong><span>{page.section}</span></a></li>)}
    </ul></nav> : <div className="nh-finder__empty"><p>Try a section name or a broader word.</p>
      <form method="get" action={context.path} data-astro-reload onSubmit={event => {
        event.preventDefault();
        setQuery("");
        input.current?.focus();
      }}>
        <QueryFields {...context} /><button type="submit">Clear search</button>
      </form></div>}
  </div>;
}

export function VisualIndex({ context, initialSection }) {
  const [selected, setSelected] = useState(initialSection);
  const section = sections.find(item => item.id === selected) || sections[0];
  return <div className="nh-visual">
    <nav className="nh-visual__sections" aria-label="Visual index sections">
      {sections.map(item => <a key={item.id} href={sectionHref(context, item.id)}
        aria-current={item === section ? "true" : undefined}
        onMouseEnter={() => setSelected(item.id)}
        onFocus={() => setSelected(item.id)}
        onClick={event => chooseSection(event, () => setSelected(item.id))}>{item.short}</a>)}
    </nav>
    <VisualSection key={section.id} section={section} />
  </div>;
}
