const tileStep = 42;
// A negative Y rotation lifts the right edge toward the viewer while the left
// edge recedes; settle around that same axis without twisting the lettering.
const keyframes: Keyframe[] = [
  { opacity: 0, transform: "perspective(480px) translateY(-9px) rotateY(-24deg)" },
  { opacity: 1, transform: "perspective(480px) translateY(1px) rotateY(.6deg)", offset: .82 },
  { opacity: 1, transform: "perspective(480px) translateY(0px) rotateY(0deg)" },
];

export function initialiseLogoDomino() {
  if (typeof IntersectionObserver !== "function" || typeof Element.prototype.animate !== "function") return;

  const motion = matchMedia("(prefers-reduced-motion: no-preference)");
  const played = new WeakSet<HTMLElement>();
  let dispose: (() => void) | undefined;
  let mountedGrid: HTMLElement | undefined;

  function unmount() {
    dispose?.();
    dispose = undefined;
    mountedGrid = undefined;
  }

  function mount() {
    const grid = document.querySelector<HTMLElement>("[data-logo-domino]");
    if (grid && grid === mountedGrid && motion.matches) return;
    unmount();
    if (!grid || !motion.matches) return;
    mountedGrid = grid;

    const tiles = new Map<HTMLElement, HTMLElement>();
    const animations = new Set<Animation>();
    let nextStart = 0;

    const observer = new IntersectionObserver(entries => {
      if (!grid.isConnected || !motion.matches) return;
      const visibleRows = new Set(entries.filter(entry => entry.isIntersecting)
        .map(entry => (entry.target as HTMLElement).offsetTop));
      if (!visibleRows.size) return;

      // Read the current grid positions before animating. Breakpoints and logo
      // order can change without changing which tile starts each row.
      const direction = getComputedStyle(grid).direction === "rtl" ? -1 : 1;
      const rowTiles = Array.from(tiles, ([cell, tile]) => ({
        cell, tile, top: cell.offsetTop, left: cell.offsetLeft,
      })).filter(({ top }) => visibleRows.has(top))
        .sort((first, second) => first.top - second.top || direction * (first.left - second.left));

      const now = performance.now();
      nextStart = Math.max(now, nextStart);
      for (const { cell, tile } of rowTiles) {
        const animation = tile.animate(keyframes, {
          delay: nextStart - now,
          duration: 480,
          easing: "cubic-bezier(.3,.5,.3,1)",
          fill: "backwards",
        });
        nextStart += tileStep;
        animations.add(animation);
        animation.addEventListener("finish", () => animations.delete(animation), { once: true });
        played.add(tile);
        tile.removeAttribute("data-logo-pending");
        observer.unobserve(cell);
        tiles.delete(cell);
      }
    }, { threshold: .06 });

    for (const cell of grid.querySelectorAll<HTMLElement>(":scope > li")) {
      const tile = cell.querySelector<HTMLElement>("[data-logo-tile]");
      if (!tile || played.has(tile)) continue;
      tiles.set(cell, tile);
      tile.setAttribute("data-logo-pending", "");
      observer.observe(cell);
    }

    dispose = () => {
      observer.disconnect();
      for (const tile of tiles.values()) tile.removeAttribute("data-logo-pending");
      for (const animation of animations) animation.cancel();
    };
  }

  motion.addEventListener("change", mount);
  document.addEventListener("astro:before-swap", unmount);
  document.addEventListener("astro:page-load", mount);
  mount();
}
