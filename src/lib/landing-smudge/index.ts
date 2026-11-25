import { smudgeMotionQuery } from "./media";

type Smudge = ReturnType<typeof import("./renderer").createLandingSmudge>;

export function initialiseLandingSmudge() {
  let disposePage: (() => void) | undefined;
  const motion = matchMedia(smudgeMotionQuery);

  function unmount() {
    disposePage?.();
    disposePage = undefined;
  }

  function mount() {
    unmount();
    const root = document.querySelector<HTMLElement>("[data-landing-smudge]");
    if (!root || !motion.matches) return;

    const listeners = new AbortController();
    const options = { passive: true, signal: listeners.signal };
    let effect: Smudge | undefined;
    let loading = false;
    let active: { host: HTMLElement; event: PointerEvent } | undefined;

    function leave() {
      active = undefined;
      effect?.settle();
    }

    for (const host of root.querySelectorAll<HTMLElement>("[data-smudge]")) {
      host.addEventListener("pointermove", (event) => {
        if (event.pointerType !== "mouse" || document.hidden) return;
        const previous = active?.host === host ? active.event : undefined;
        active = { host, event };
        if (effect) {
          effect.move(host, event, previous);
        } else if (!loading) {
          loading = true;
          import("./renderer").then(({ createLandingSmudge }) => {
            if (listeners.signal.aborted) return;
            effect = createLandingSmudge();
          }).catch(() => {
            // A graphics failure leaves the original media as the fallback.
          });
        }
      }, options);
      host.addEventListener("pointerleave", leave, options);
      host.addEventListener("pointercancel", leave, options);
    }

    function reset() {
      active = undefined;
      effect?.clear();
    }

    window.addEventListener("blur", reset, options);
    document.addEventListener("visibilitychange", reset, options);
    disposePage = () => {
      listeners.abort();
      effect?.dispose();
    };
  }

  motion.addEventListener("change", mount);
  document.addEventListener("astro:before-swap", unmount);
  document.addEventListener("astro:page-load", mount);
  mount();
}
