// Only captures the Pinterest VIDEO directly under the right-click pointer.
// Does not interfere with the user's separate image-downloader extension.
(() => {
  const PIN_PATTERN = /\/pin\/(?:[^/]*--)?(\d+)(?:[/?#]|$)/i;
  let last = null;

  function pinFromLink(href) {
    try {
      const url = new URL(href, location.href);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      if (!/(^|\.)pinterest\.(?:com|co\.uk|co\.in|ca)$/i.test(url.hostname)) return null;
      const pinId = url.pathname.match(PIN_PATTERN)?.[1];
      if (!pinId) return null;
      return {pinId, sourceUrl: `https://${url.hostname.toLowerCase()}/pin/${pinId}/`};
    } catch { return null; }
  }

  function pointInside(rect, x, y) {
    return rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right
      && y >= rect.top && y <= rect.bottom;
  }

  function activeVideoUnderPointer(event) {
    const x = event.clientX, y = event.clientY;
    const nodes = [...event.composedPath(), ...document.elementsFromPoint(x, y)]
      .filter(node => node instanceof Element);
    for (const node of nodes) {
      const video = node.matches('video') ? node : node.closest('video');
      if (video && pointInside(video.getBoundingClientRect(), x, y)) return video;
      // Modern Pinterest overlays a play/control layer over the actual video.
      const card = node.closest('[data-test-id="pin"], [data-test-id="pinWrapper"], [data-test-id="closeup-container"]');
      if (card) {
        const candidates = [...card.querySelectorAll('video')].filter(v =>
          pointInside(v.getBoundingClientRect(), x, y));
        if (candidates.length === 1) return candidates[0];
      }
    }
    return null;
  }

  function pinForVideo(video) {
    // Find the video owner's Pin, not another Pin elsewhere on the page.
    let current = video;
    for (let depth = 0; current && depth < 10; depth++, current = current.parentElement) {
      if (current.matches('a[href*="/pin/"]')) {
        const own = pinFromLink(current.href);
        if (own) return own;
      }
      const anchor = current.closest('a[href*="/pin/"]');
      if (anchor) {
        const own = pinFromLink(anchor.href);
        if (own) return own;
      }
      const candidates = [...current.querySelectorAll('a[href*="/pin/"]')].slice(0, 24)
        .map(a => pinFromLink(a.href)).filter(Boolean);
      const distinct = new Map(candidates.map(pin => [pin.pinId, pin]));
      if (distinct.size === 1) return [...distinct.values()][0];
      if (distinct.size > 1) return null; // Never guess among adjacent Pins.
    }
    // Individual Pin pages have one unambiguous Pin in their URL.
    return pinFromLink(location.href);
  }

  document.addEventListener('contextmenu', event => {
    const video = activeVideoUnderPointer(event);
    last = {at: Date.now(), pin: video ? pinForVideo(video) : null};
    // Do not cancel the user's existing menu, images or other extensions.
  }, true);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'MOODBOARD_RESOLVE_PIN') return;
    sendResponse({pin: last && Date.now() - last.at < 30000 ? last.pin : null});
  });
})();
