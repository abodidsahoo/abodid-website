type Drag = {
  pointer: number;
  x: number;
  y: number;
  left: number;
  origin: number;
  lastX: number;
  lastTime: number;
  velocity: number;
  moved: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
const modulo = (value: number, size: number) => ((value % size) + size) % size;

export function mountTestimonialCarousel(root: HTMLElement) {
  const rail = root.querySelector<HTMLElement>("[data-testimonial-rail]");
  const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-testimonial-slide]"));
  if (!rail || !slides.length) return;

  const tape = rail.querySelector<HTMLElement>("[data-testimonial-tape]");
  const anchors = Array.from(tape?.children ?? []);
  const count = slides.length;
  const lastSlot = Math.max(0, anchors.length - 1);
  const middleSlot = Math.floor(lastSlot / (2 * count)) * count;
  const controls = root.querySelector<HTMLElement>("[data-testimonial-controls]");
  const status = root.querySelector<HTMLElement>("[data-testimonial-status]");
  const motion = matchMedia("(prefers-reduced-motion: no-preference)");
  const events = new AbortController();
  const options = { signal: events.signal };
  const readers = Array.from(root.querySelectorAll<HTMLElement>("[data-testimonial-reader]"));
  let stride = 1;
  let active = 0;
  let paintedSlot = middleSlot;
  let paintFrame = 0;
  let coastFrame = 0;
  let settleTimer = 0;
  let requested: { slot: number; from: number } | undefined;
  let drag: Drag | undefined;
  let suppressClick = false;
  let measuredWidth = 0;
  let measuredSlide = 0;

  const layoutChanged = () => measuredWidth !== rail.clientWidth || measuredSlide !== slides[0].offsetWidth;

  const measure = () => {
    measuredWidth = rail.clientWidth;
    measuredSlide = slides[0].offsetWidth;
    if (tape && lastSlot) {
      rail.style.setProperty("--testimonial-port", `${measuredWidth}px`);
      const first = anchors[0].getBoundingClientRect();
      stride = Math.max(1, (anchors[lastSlot].getBoundingClientRect().left - first.left) / lastSlot);
    }
  };

  // Each snap point starts one card width and gap after the previous point.
  const leftFor = (slot: number) => slot * stride;
  const slotAt = (left = rail.scrollLeft) => left / stride;
  const nearest = (left = rail.scrollLeft) => clamp(Math.round(slotAt(left)), 0, lastSlot);
  const indexFor = (slot: number) => modulo(slot, count);
  const offsetFor = (index: number, position: number) => {
    // Snap at the left edge, but wrap around the viewport's midpoint so
    // neither end of a wrapping card can appear inside the visible row.
    const midpoint = (measuredWidth - measuredSlide) / (2 * stride);
    return modulo(index - position - midpoint + count / 2, count) - count / 2 + midpoint;
  };
  const needsRoom = (slot: number) => lastSlot > 0 &&
    (slot < middleSlot - 2 * count || slot > middleSlot + 2 * count);
  const leftInMiddle = (slot: number) => leftFor(middleSlot + indexFor(slot));

  const paint = () => {
    paintFrame = 0;
    if (!lastSlot || layoutChanged()) return;
    const position = slotAt();
    paintedSlot = Math.round(position);
    slides.forEach((slide, index) => {
      slide.style.setProperty("--slot-x", `${offsetFor(index, position) * stride}px`);
    });
  };

  const stopCoast = () => {
    if (!coastFrame) return;
    cancelAnimationFrame(coastFrame);
    coastFrame = 0;
    rail.removeAttribute("data-coasting");
  };

  const settle = () => {
    if (drag || coastFrame || layoutChanged()) return;
    const slot = nearest();
    if (requested && Math.abs(requested.from - rail.scrollLeft) < 1 && slot !== requested.slot) return;
    requested = undefined;
    const index = indexFor(slot);
    if (index !== active) {
      active = index;
      if (status) status.textContent = `${slides[index].dataset.testimonialName}, testimonial ${index + 1} of ${slides.length}`;
    }
    // Moving a whole number of turns keeps every card in the same visual position.
    if (needsRoom(slot)) rail.scrollTo({ left: leftInMiddle(slot), behavior: "instant" });
    paint();
  };

  const fitRail = () => {
    if (!layoutChanged()) return;
    const index = indexFor(requested?.slot ?? paintedSlot);
    stopCoast();
    drag = undefined;
    rail.removeAttribute("data-dragging");
    requested = undefined;
    measure();
    rail.scrollTo({ left: leftFor(middleSlot + index), behavior: "instant" });
    settle();
  };

  const move = (destination: number) => {
    stopCoast();
    const slot = clamp(destination, 0, lastSlot);
    const left = leftFor(slot);
    requested = { slot, from: rail.scrollLeft };
    if (Math.abs(left - rail.scrollLeft) < 1) {
      settle();
    } else {
      rail.scrollTo({ left, behavior: motion.matches ? "smooth" : "instant" });
    }
  };

  const step = (direction: number) => {
    fitRail();
    move((requested?.slot ?? nearest()) + direction);
  };
  const show = (index: number) => {
    if (!lastSlot) return;
    fitRail();
    const position = slotAt();
    move(Math.round(position + offsetFor(index, position)));
  };

  const nativeScrollEnd = "onscrollend" in rail;
  rail.addEventListener("scroll", () => {
    if (!coastFrame && !paintFrame) paintFrame = requestAnimationFrame(paint);
    if (!nativeScrollEnd) {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(settle, 150);
    }
  }, { passive: true, ...options });
  if (nativeScrollEnd) rail.addEventListener("scrollend", settle, options);

  root.querySelectorAll<HTMLButtonElement>("[data-testimonial-step]").forEach(button => {
    button.addEventListener("click", () => step(Number(button.dataset.testimonialStep)), options);
  });
  rail.addEventListener("keydown", event => {
    if (event.target !== rail || !["ArrowLeft", "ArrowRight"].includes(event.key) || slides.length < 2) return;
    event.preventDefault();
    step(event.key === "ArrowLeft" ? -1 : 1);
  }, options);

  const slideFor = (target: EventTarget | null) =>
    target instanceof Element ? slides.findIndex(slide => slide.contains(target)) : -1;

  rail.addEventListener("focusin", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches(":focus-visible")) return;
    const index = slideFor(target);
    if (index < 0) return;
    const control = target.getBoundingClientRect();
    const viewport = rail.getBoundingClientRect();
    if (control.left < viewport.left || control.right > viewport.right) show(index);
  }, options);
  rail.addEventListener("click", event => {
    const wasDragged = suppressClick;
    suppressClick = false;
    if (wasDragged && event.detail > 0) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.target instanceof Element && event.target.closest("summary, [data-testimonial-reader]")) return;
    const index = slideFor(event.target);
    if (index >= 0 && index !== indexFor(nearest())) show(index);
  }, { capture: true, ...options });
  const cancelRequest = () => {
    stopCoast();
    requested = undefined;
  };
  rail.addEventListener("wheel", event => {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey) cancelRequest();
  }, { passive: true, ...options });
  rail.addEventListener("pointerdown", event => {
    suppressClick = false;
    if (event.pointerType !== "mouse") {
      cancelRequest();
      return;
    }
    if (event.button !== 0 || slides.length < 2 || !(event.target instanceof Element) ||
        event.target.closest("summary, button, a, [data-testimonial-reader]")) return;
    if (coastFrame) rail.setAttribute("data-dragging", "");
    cancelRequest();
    drag = {
      pointer: event.pointerId, x: event.clientX, y: event.clientY, left: rail.scrollLeft,
      origin: nearest(), lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, moved: false,
    };
  }, options);
  rail.addEventListener("pointermove", event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const delta = event.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(delta) < 4) return;
      if (Math.abs(event.clientY - drag.y) > Math.abs(delta)) {
        finishDrag(event);
        return;
      }
      rail.setPointerCapture(event.pointerId);
      rail.setAttribute("data-dragging", "");
      drag.moved = true;
    }
    const elapsed = Math.max(4, event.timeStamp - drag.lastTime);
    const speed = (drag.lastX - event.clientX) * 1000 / elapsed;
    drag.velocity += (speed - drag.velocity) * (1 - Math.exp(-elapsed / 26));
    drag.lastX = event.clientX;
    drag.lastTime = event.timeStamp;
    let left = drag.left - delta;
    const slot = slotAt(left);
    if (needsRoom(slot)) {
      const shift = leftInMiddle(slot) - left;
      drag.left += shift;
      drag.origin += Math.round(shift / stride);
      left += shift;
    }
    rail.scrollLeft = left;
    event.preventDefault();
  }, options);

  const coastTo = (slot: number, velocity: number, rate: number) => {
    const from = rail.scrollLeft;
    const target = leftFor(slot);
    const distance = target - from;
    if (!motion.matches || Math.abs(distance) < 1) {
      rail.removeAttribute("data-dragging");
      move(slot);
      return;
    }
    rail.setAttribute("data-coasting", "");
    rail.removeAttribute("data-dragging");
    requested = { slot, from };

    const direction = Math.sign(distance);
    const initialSpeed = direction * clamp(velocity * direction, -180, Math.abs(distance) * rate);
    const coefficient = initialSpeed - rate * distance;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.max(0, (now - start) / 1000);
      // A critically damped spring continues from the release speed and
      // decelerates into the selected snap point without bouncing past it.
      const remaining = (-distance + coefficient * elapsed) * Math.exp(-rate * elapsed);
      if (Math.abs(remaining) < .65 || elapsed > 1.3) {
        rail.scrollLeft = target;
        stopCoast();
        settle();
        return;
      }
      rail.scrollLeft = target + remaining;
      paint();
      coastFrame = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(paintFrame);
    paintFrame = 0;
    coastFrame = requestAnimationFrame(tick);
  };

  const finishDrag = (event: PointerEvent) => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const finished = drag;
    drag = undefined;
    if (!finished.moved) {
      if (rail.hasAttribute("data-dragging")) {
        rail.removeAttribute("data-dragging");
        move(nearest());
      }
      return;
    }
    suppressClick = event.type === "pointerup";
    const releaseAge = Math.max(0, event.timeStamp - finished.lastTime);
    const speed = motion.matches && event.type === "pointerup" && releaseAge < 125
      ? finished.velocity * Math.exp(-releaseAge / 75)
      : 0;
    const shortPull = Math.abs(finished.lastX - finished.x) < clamp(stride * .16, 36, 72) &&
      Math.abs(finished.left - leftFor(finished.origin)) < stride * .18;
    const flick = !shortPull && Math.abs(speed) >= 520;
    const projection = flick ? clamp(speed * .235, -stride * 1.25, stride * 1.25) : 0;
    const target = shortPull ? finished.origin : nearest(rail.scrollLeft + projection);
    coastTo(target, shortPull ? clamp(speed, -180, 180) : speed, flick ? 8.4 : 12);
  };
  rail.addEventListener("pointerup", finishDrag, options);
  rail.addEventListener("pointercancel", finishDrag, options);
  rail.addEventListener("lostpointercapture", finishDrag, options);
  rail.addEventListener("pointerleave", event => { if (!drag?.moved) finishDrag(event); }, options);

  const syncFade = (reader: HTMLElement) => {
    const overflowBelow = reader.scrollHeight - reader.clientHeight - reader.scrollTop > 2;
    reader.parentElement?.toggleAttribute("data-more-below", overflowBelow && reader.clientHeight > 0);
  };
  readers.forEach(reader => {
    reader.addEventListener("scroll", () => syncFade(reader), { passive: true, ...options });
    reader.closest("details")?.addEventListener("toggle", () => syncFade(reader), options);
  });

  rail.setAttribute("data-enhanced", "");
  if (tape && lastSlot) {
    rail.setAttribute("data-loop", "");
    rail.style.setProperty("--testimonial-count", String(count));
    tape.hidden = false;
  }
  if (controls) controls.hidden = false;
  measure();
  rail.scrollTo({ left: leftFor(middleSlot), behavior: "instant" });
  paint();

  const observer = new ResizeObserver(() => {
    fitRail();
    readers.forEach(syncFade);
  });
  observer.observe(rail);
  observer.observe(slides[0]);
  readers.forEach(reader => observer.observe(reader));
  motion.addEventListener("change", () => {
    if (!motion.matches && requested) {
      move(requested.slot);
    }
  }, options);

  return () => {
    events.abort();
    observer.disconnect();
    cancelAnimationFrame(paintFrame);
    stopCoast();
    window.clearTimeout(settleTimer);
    rail.removeAttribute("data-dragging");
    rail.removeAttribute("data-loop");
    if (tape) tape.hidden = true;
  };
}
