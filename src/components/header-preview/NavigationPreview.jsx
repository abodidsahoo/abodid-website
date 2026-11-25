import React, { useEffect, useRef, useState } from "react";
import { headers, menus } from "./navigation.js";
import { pages, thumbnails } from "../../lib/siteNavigation.js";
import { Directory, PageFinder, QueryFields, SectionDrawer, VisualIndex } from "./NavigationMenus.jsx";

function DesignChooser({ kind, context, update }) {
  const choices = kind === "header" ? headers : menus;
  const index = choices.findIndex(choice => choice.id === context.selection[kind]);
  const title = kind === "header" ? "Header" : "Menu";
  const previous = choices.at(index - 1);
  const next = choices[(index + 1) % choices.length];
  function handleKey(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const choice = { ArrowLeft: previous, ArrowRight: next }[event.key];
    if (choice) {
      event.preventDefault();
      update({ [kind]: choice.id });
    }
  }
  return <div className={`nh-chooser nh-chooser--${kind}`}>
    <div className="nh-chooser__inner">
      <p role="status" aria-atomic="true"><span>{title} {index + 1} of {choices.length}</span><strong>{choices[index].name}</strong></p>
      <form method="get" action={context.path} aria-label={`Choose ${kind} design`} data-astro-reload
        onKeyDown={handleKey} onSubmit={event => {
          const value = event.nativeEvent.submitter?.value;
          if (value) { event.preventDefault(); update({ [kind]: value }); }
        }}>
        <QueryFields {...context} omit={kind} />
        <button name={kind} value={previous.id} aria-label={`Previous ${kind} design`}>←</button>
        <button name={kind} value={next.id} aria-label={`Next ${kind} design`}>→</button>
      </form>
    </div>
  </div>;
}

function HeaderBar({ design, context, compact, opened = false, update, toggleRef }) {
  const isJournal = design.id === "journal";
  const isGallery = design.id === "gallery";
  const menu = <form className="nh-toggle-form" method="get" action={context.path} data-astro-reload
    onSubmit={event => { event.preventDefault(); update({ open: !opened }); }}>
    <QueryFields {...context} selection={{ ...context.selection, open: !opened }} />
    <button className="nh-toggle" type="submit" ref={toggleRef} aria-expanded={opened}
      aria-controls="nh-navigation-dialog" aria-haspopup="dialog" aria-label={opened ? "Close site menu" : "Open site menu"}>
      <span className={`nh-menu-icon${opened ? " is-close" : ""}`} aria-hidden="true"></span>{opened ? "Close" : "Menu"}
    </button>
  </form>;
  let actionHref = design.action.href;
  if (opened && actionHref.startsWith("#")) {
    const query = new URLSearchParams({ header: design.id, menu: context.selection.menu });
    if (context.footerConcept) query.set("concept", context.footerConcept);
    actionHref = `${context.path}?${query}${design.action.href}`;
  }
  const action = <a className="nh-action" href={actionHref}
    onClick={event => {
      if (!opened || !design.action.href.startsWith("#") || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      update({ open: false });
      requestAnimationFrame(() => {
        window.location.hash = design.action.href;
        const target = document.querySelector(design.action.href);
        target?.scrollIntoView();
        if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
      });
    }}>
    {design.action.label}<span aria-hidden="true">{design.action.href.startsWith("#") ? "↓" : "→"}</span>
  </a>;
  const brand = <a className="nh-brand" href="/" aria-label={isGallery ? "abodid.com homepage" : "Abodid Sahoo homepage"}>
    {design.id === "studio" && <span className="nh-studio-mark" aria-hidden="true"></span>}
    {isGallery ? <span>abodid.com</span>
      : <span>Abodid <span className="nh-surname">Sahoo</span></span>}
  </a>;
  const links = <nav key="links" className="nh-mainlinks" aria-label="Primary navigation">
    {design.links.map(key => <a href={pages[key].href} key={key}>
      {isGallery && <img src={thumbnails[key]} width="66" height="44" alt="" decoding="async" />}
      <span>{pages[key].label}</span>
    </a>)}
  </nav>;
  const actions = <div key="actions" className="nh-actions">{action}{menu}</div>;
  return <header className="nh-bar" data-header={design.id}>
    <div className="nh-bar__inner">
      {isJournal ? <><div className="nh-journal__top">{menu}{brand}{action}</div>{links}</>
        : <>{brand}{compact ? [actions, links] : [links, actions]}</>}
    </div>
  </header>;
}

export default function NavigationPreview({ initial, path, footerConcept, initialSection, initialQuery, children }) {
  const [selection, setSelection] = useState(initial);
  const [enhanced, setEnhanced] = useState(false);
  const [compact, setCompact] = useState(false);
  const [selectedFooter, setSelectedFooter] = useState(footerConcept);
  const [deepLink, setDeepLink] = useState({ section: initialSection, query: initialQuery });
  const dialog = useRef(null);
  const opener = useRef(null);
  const scrollArea = useRef(null);
  const menuSettings = useRef(null);
  const design = headers.find(item => item.id === selection.header);
  const menu = menus.find(item => item.id === selection.menu);
  const context = { path, selection, footerConcept: selectedFooter };

  useEffect(() => {
    const viewport = window.matchMedia("(max-width: 48rem)");
    const sync = () => setCompact(viewport.matches);
    sync();
    setEnhanced(true);
    viewport.addEventListener("change", sync);
    return () => viewport.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!enhanced) return;
    const element = dialog.current;
    if (selection.open && !element.matches(":modal")) {
      if (element.open) element.close();
      element.showModal();
      const target = element.querySelector("#nh-page-search") || element.querySelector("#nh-panel-title");
      target?.focus();
    } else if (!selection.open && element.open) {
      element.close();
      opener.current?.focus({ preventScroll: true });
    }
  }, [enhanced, selection.open]);
  useEffect(() => {
    if (scrollArea.current) scrollArea.current.scrollTop = 0;
    if (menuSettings.current) menuSettings.current.open = false;
  }, [selection.menu, selection.open]);

  function update(patch) {
    const next = { ...selection, ...patch };
    const url = new URL(window.location.href);
    url.searchParams.set("header", next.header);
    url.searchParams.set("menu", next.menu);
    if (next.open) url.searchParams.set("open", "1");
    else url.searchParams.delete("open");
    if (next.menu !== selection.menu || !next.open) {
      url.searchParams.delete("section");
      url.searchParams.delete("q");
      setDeepLink({ section: null, query: "" });
    }
    url.hash = "";
    history.replaceState(history.state, "", url);
    setSelectedFooter(url.searchParams.get("concept"));
    setSelection(next);
  }

  return <div className="nav-study" data-ready={enhanced || undefined}>
    <HeaderBar design={design} context={context} compact={compact} update={update} toggleRef={opener} />
    <DesignChooser kind="header" context={context} update={update} />
    <dialog id="nh-navigation-dialog" className="nh-overlay" ref={dialog} aria-labelledby="nh-panel-title"
      open={!enhanced && selection.open ? true : undefined}
      onCancel={event => { event.preventDefault(); update({ open: false }); }}>
      {selection.open && <>
        <HeaderBar design={design} context={context} compact={compact} opened update={update} />
        <DesignChooser kind="header" context={context} update={update} />
      </>}
      <div className="nh-overlay__space" data-menu={menu.id}
        onClick={event => { if (event.target === event.currentTarget) update({ open: false }); }}>
        <div className="nh-panel" data-menu={menu.id}>
          <div className="nh-panel__scroll" ref={scrollArea}>
            <div className="nh-panel__content">
              <div className="nh-panel__top">
                <h2 id="nh-panel-title" tabIndex={-1}>{menu.title}</h2>
                <a href="/sitemap">Sitemap<span aria-hidden="true">→</span></a>
              </div>
              {selection.open && <>
                {menu.id === "directory" && <Directory enhanced={enhanced} />}
                {menu.id === "drawer" && <SectionDrawer context={context} initialSection={deepLink.section} />}
                {menu.id === "finder" && <PageFinder context={context} initialQuery={deepLink.query} />}
                {menu.id === "visual" && <VisualIndex context={context} initialSection={deepLink.section} />}
              </>}
              <details className="nh-settings" ref={menuSettings}>
                <summary>Language &amp; app settings</summary>
                <div>{children}</div>
              </details>
            </div>
          </div>
          <DesignChooser kind="menu" context={context} update={update} />
        </div>
      </div>
    </dialog>
  </div>;
}
