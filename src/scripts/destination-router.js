import { navigate } from "astro:transitions/client";

// Astro owns the history index, persisted islands, redirects and final DOM swap.
// Its first, local swap commits the destination URL while the original loader
// fetches the document. The second swap consumes that response in the same entry.
const destination = window.siteDestination;
let active;

document.addEventListener("astro:before-preparation", event => {
  if (active && event.info === active) {
    const prepared = active.request;
    active.stage = "content";
    event.to = prepared.to;
    event.loader = () => { event.newDocument = prepared.newDocument; };
    return;
  }

  active = undefined;
  if (!destination.isPage(event.from, event.to) || event.formData) {
    destination.clear();
    return;
  }
  const view = destination.show(event.to, event.sourceElement);
  event.signal.addEventListener("abort", () => {
    if (active?.view === view && active.stage !== "installing") {
      active = undefined;
      destination.clear();
    }
  }, { once: true });
  if (event.navigationType === "traverse") {
    // Back and Forward have already committed the selected history entry.
    active = { stage: "content", view };
    return;
  }
  const request = event;
  const load = event.loader;
  const route = { stage: "shell", request, view };
  active = route;
  event.loader = () => {
    route.ready = load().then(() => !request.defaultPrevented, () => false);
  };
});

document.addEventListener("astro:before-swap", event => {
  if (!active) return;
  event.viewTransition.skipTransition();
  if (active.stage !== "shell" || event.signal !== active.request.signal) return;

  const { view } = active;
  event.swap = () => { document.title = view.title; };
  event.stopImmediatePropagation();
}, true);

document.addEventListener("astro:after-swap", event => {
  if (active?.stage === "shell") {
    active.stage = "committed";
    event.stopImmediatePropagation();
    return;
  }
  active = undefined;
  destination.arrived();
}, true);

document.addEventListener("astro:page-load", async event => {
  const route = active;
  if (!route || !["shell", "committed", "waiting"].includes(route.stage)) return;
  // Header initialisers and page-view analytics run once, on the populated page.
  event.stopImmediatePropagation();
  if (route.stage !== "committed") return;
  route.stage = "waiting";
  const prepared = await route.ready;
  if (active !== route || route.request.signal.aborted) return;
  const target = route.request.to;
  if (!prepared) {
    // Standalone documents, non-HTML responses and failed fetches use native navigation.
    destination.carry(target, route.view.title);
    if (location.href === target.href) location.reload();
    else location.replace(target.href);
    return;
  }
  // An identical URL with a fragment takes Astro's scroll-only shortcut. Restore
  // the original fragment from the prepared request in before-preparation above.
  const path = new URL(target);
  path.hash = "";
  route.stage = "installing";
  await navigate(path.href, { history: "replace", info: route });
}, true);
