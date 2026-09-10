import type { PortfolioPhoto } from '../../lib/photography/server';

type Palette = { bg: string; isDark: boolean; textColor: string; subtextColor: string };
type Group = {
  id: string;
  title: string;
  category: string;
  label: string;
  cover: PortfolioPhoto;
  images: PortfolioPhoto[];
  imageCount: number;
  palette: Palette;
};

const groups: Group[] = JSON.parse(document.querySelector('#portfolio-data')!.textContent!);
const gallery = document.querySelector<HTMLElement>('#gallery')!;
const toggle = document.querySelector<HTMLButtonElement>('#view-toggle')!;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const cursor = document.querySelector<HTMLElement>('.cursor-label')!;
let indexView = false;

let transition: { finished: Promise<void> } | undefined;
const transitionDocument = document as Document & { startViewTransition?: (fn: () => void) => { finished: Promise<void> } };
async function changeView(update: () => void) {
  if (transition) await transition.finished.catch(() => {});
  if (transitionDocument.startViewTransition && !reducedMotion.matches) {
    transition = transitionDocument.startViewTransition(update);
    await transition.finished.catch(() => {});
    transition = undefined;
  } else update();
}

let resetTimer: ReturnType<typeof setTimeout> | null = null;

const cancelReset = () => {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
};

const applyPalette = (bg: string, textColor: string, subtextColor: string, isDark: boolean) => {
  cancelReset();
  document.documentElement.style.setProperty('--page-bg', bg);
  document.documentElement.style.setProperty('--page-text', textColor);
  document.documentElement.style.setProperty('--page-subtext', subtextColor);
  document.documentElement.style.setProperty('--page-bg-alpha', 'rgba(255,255,255,0.92)');
};

const DEFAULT_BG = '#fbfbf9';
const DEFAULT_TEXT = '#141414';
const DEFAULT_SUBTEXT = 'rgba(20,20,20,0.68)';

const resetPalette = () => {
  document.documentElement.style.setProperty('--page-bg', DEFAULT_BG);
  document.documentElement.style.setProperty('--page-text', DEFAULT_TEXT);
  document.documentElement.style.setProperty('--page-subtext', DEFAULT_SUBTEXT);
  document.documentElement.style.setProperty('--page-bg-alpha', 'rgba(251,251,249,0.92)');
};

const scheduleReset = () => {
  cancelReset();
  resetTimer = setTimeout(() => {
    resetPalette();
    resetTimer = null;
  }, 150);
};

// ── Reveal Animation Observer ──
let revealObserver: IntersectionObserver | null = null;
if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.remove('reveal-pending');
      revealObserver?.unobserve(entry.target);
    }
  }), { rootMargin: '0px 0px 100px', threshold: 0.03 });
}

// ── Organic Parallax Scroll System ──
const visibleLinks = new Set<HTMLElement>();
const PARALLAX_FACTORS = [0.045, -0.035, -0.03, 0.05, 0.035, -0.04, 0.04, -0.035];
let parallaxTicking = false;

function updateParallax() {
  parallaxTicking = false;
  if (indexView || window.innerWidth <= 900 || reducedMotion.matches) return;

  const vCenter = window.innerHeight * 0.5;

  visibleLinks.forEach(link => {
    if (!link.offsetParent) return;
    const rect = link.getBoundingClientRect();
    const linkCenter = rect.top + rect.height * 0.5;
    const diff = vCenter - linkCenter;
    const groupIdx = Number(link.dataset.group ?? 0);
    const factor = PARALLAX_FACTORS[groupIdx % PARALLAX_FACTORS.length];
    const offset = Math.max(-30, Math.min(30, diff * factor));
    const rounded = Math.round(offset * 10) / 10;
    link.style.setProperty('--parallax-y', `${rounded}px`);
  });
}

function scheduleParallax() {
  if (parallaxTicking || indexView || window.innerWidth <= 900 || reducedMotion.matches) return;
  parallaxTicking = true;
  requestAnimationFrame(updateParallax);
}

let parallaxObserver: IntersectionObserver | null = null;
if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  parallaxObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const el = entry.target as HTMLElement;
      if (entry.isIntersecting) {
        visibleLinks.add(el);
      } else {
        visibleLinks.delete(el);
      }
    });
    scheduleParallax();
  }, { rootMargin: '120px 0px 120px 0px' });
}

window.addEventListener('scroll', scheduleParallax, { passive: true });
window.addEventListener('resize', scheduleParallax, { passive: true });

const floatingPreview = document.querySelector<HTMLElement>('#index-floating-preview');
const floatingImg = document.querySelector<HTMLImageElement>('#index-floating-img');
let currentCoverUrl = '';

// Preload cache for zero-latency image transitions & pre-decoding
const preloadedUrls = new Set<string>();

function preloadUrl(url?: string) {
  if (!url || preloadedUrls.has(url)) return;
  preloadedUrls.add(url);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  if (img.decode) {
    img.decode().catch(() => {});
  }
}

function preloadAround(gIndex: number) {
  const g = groups[gIndex];
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (!g || connection?.saveData) return;
  if (lightbox?.open && gIndex === activeGroup) {
    const len = g.images.length;
    if (len > 1) {
      const nextIdx = (activePhoto + 1) % len;
      const prevIdx = (activePhoto - 1 + len) % len;
      preloadUrl(g.images[nextIdx]?.large);
      preloadUrl(g.images[prevIdx]?.large);
    }
  } else {
    preloadUrl(g.images[0]?.large);
  }
}

// Hover cursor listener on gallery container
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  gallery.addEventListener('pointermove', event => {
    cursor.style.transform = `translate3d(${event.clientX + 16}px,${event.clientY + 18}px,0)`;
    cursor.classList.toggle('visible', !!(event.target as Element).closest('.project-link') && !indexView);

    if (indexView && floatingPreview) {
      const targetY = Math.max(90, Math.min(window.innerHeight - 200, event.clientY - 80));
      floatingPreview.style.setProperty('--preview-y', `${targetY}px`);
    }
  });

  gallery.addEventListener('pointerleave', () => {
    cursor.classList.remove('visible');
    if (floatingPreview) floatingPreview.classList.remove('visible');
  });
}

// Helper function to bind behavior to a project card (SSR or dynamically created)
function bindProjectCard(project: HTMLElement) {
  const link = project.querySelector<HTMLAnchorElement>('.project-link');
  if (link && parallaxObserver) {
    parallaxObserver.observe(link);
  }

  const groupIndex = Number(link?.dataset.group ?? project.dataset.index);
  if (!isNaN(groupIndex) && groupIndex >= 2 && revealObserver) {
    project.classList.add('reveal-pending');
    revealObserver.observe(project);
  }

  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const bg = project.dataset.paletteBg;
    const text = project.dataset.paletteText || '#141414';
    const subtext = project.dataset.paletteSubtext || '#666666';
    const isDark = project.dataset.paletteDark === 'true';
    const coverUrl = link?.dataset.cover || '';

    project.addEventListener('pointerenter', () => {
      if (bg) applyPalette(bg, text, subtext, isDark);
      if (!isNaN(groupIndex)) preloadAround(groupIndex);
      if (indexView && floatingPreview && floatingImg && coverUrl) {
        if (currentCoverUrl !== coverUrl) {
          floatingImg.src = coverUrl;
          currentCoverUrl = coverUrl;
        }
        floatingPreview.classList.add('visible');
      }
    });

    project.addEventListener('pointerleave', () => {
      scheduleReset();
      if (indexView && floatingPreview) {
        floatingPreview.classList.remove('visible');
      }
    });
  }
}

// Create project DOM element dynamically for lazy loading
function createProjectElement(group: Group, i: number): HTMLElement {
  const article = document.createElement('article');
  article.className = 'project';
  article.dataset.category = group.category || '';
  article.dataset.index = String(i);
  const bgColor = group.palette?.bg || '#fbfbf9';
  article.dataset.paletteBg = bgColor;
  article.dataset.paletteDark = group.palette?.isDark ? 'true' : 'false';
  article.dataset.paletteText = group.palette?.textColor || '#141414';
  article.dataset.paletteSubtext = group.palette?.subtextColor || 'rgba(20,20,20,0.68)';

  const size = i % 5 === 0 ? 'wide' : i % 5 === 3 ? 'tall' : i % 7 === 0 ? 'small' : 'normal';
  article.dataset.size = size;
  article.style.setProperty('--order', String(i));

  const coverLarge = group.cover.large;
  const coverSmall = group.cover.small || coverLarge;
  const count = group.imageCount;
  const title = group.title;
  const category = group.category || 'Editorial';
  const numStr = String(i + 1).padStart(2, '0');

  const widthAttr = group.cover.width ? `width="${group.cover.width}"` : '';
  const heightAttr = group.cover.height ? `height="${group.cover.height}"` : '';
  const wrapStyle = group.cover.width && group.cover.height
    ? `style="aspect-ratio:${group.cover.width}/${group.cover.height};background-color:${bgColor};"`
    : `style="background-color:${bgColor};"`;

  article.innerHTML = `
    <a
      href="${coverLarge}"
      class="project-link"
      data-group="${i}"
      data-cover="${coverSmall}"
      data-title="${title}"
      data-category-name="${category}"
      data-count="${count}"
      aria-label="View ${title}, ${count} photographs"
    >
      <div class="image-wrap" ${wrapStyle}>
        <img
          src="${coverSmall}"
          srcset="${coverSmall} 800w, ${coverLarge} 1600w"
          sizes="(max-width: 600px) 90vw, (max-width: 1200px) 45vw, 42vw"
          ${widthAttr}
          ${heightAttr}
          loading="lazy"
          decoding="async"
          alt="${group.cover.alt || title}"
        />
        <div class="project-hover-overlay" aria-hidden="true">
          <div class="hover-content">
            <h2 class="hover-title">
              ${title}
              <span class="hover-count">(${count})</span>
            </h2>
            <span class="hover-category">${category}</span>
          </div>
        </div>
      </div>
      <div class="mobile-caption"><span>${title}</span><small>(${count})</small></div>
      <div class="index-row">
        <span class="index-num">${numStr}</span>
        <div class="index-info">
          <h2 class="index-title">${title}</h2>
          <span class="index-category-mobile">${category} · ${count} photos</span>
        </div>
        <span class="index-category">${category}</span>
        <span class="index-count">${count} photos</span>
        <span class="index-arrow" aria-hidden="true">↗</span>
      </div>
    </a>
  `;

  return article;
}

// Bind initial SSR projects
const initialProjects = [...gallery.querySelectorAll<HTMLElement>('.project')];
initialProjects.forEach(bindProjectCard);

let loadedCount = initialProjects.length;
const CHUNK_SIZE = 4;

function loadNextBatch() {
  if (loadedCount >= groups.length) return;
  const nextBatch = groups.slice(loadedCount, loadedCount + CHUNK_SIZE);
  const sentinel = document.querySelector('#scroll-sentinel');

  nextBatch.forEach((group, idx) => {
    const i = loadedCount + idx;
    const card = createProjectElement(group, i);
    if (sentinel) {
      gallery.insertBefore(card, sentinel);
    } else {
      gallery.appendChild(card);
    }
    bindProjectCard(card);
  });

  loadedCount += nextBatch.length;
  scheduleParallax();

  if (loadedCount >= groups.length && sentinelObserver && sentinel) {
    sentinelObserver.unobserve(sentinel);
  }
}

// Set up infinite scroll observer on sentinel
const sentinel = document.querySelector('#scroll-sentinel');
let sentinelObserver: IntersectionObserver | null = null;
if (sentinel && 'IntersectionObserver' in window) {
  sentinelObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !document.querySelector('dialog[open]')) {
      loadNextBatch();
    }
  }, { rootMargin: '180px 0px 180px 0px' });
  sentinelObserver.observe(sentinel);
}

// View toggle (Gallery vs Index)
toggle.addEventListener('click', () => void changeView(() => {
  indexView = !indexView;
  if (indexView && loadedCount < groups.length) {
    while (loadedCount < groups.length) {
      loadNextBatch();
    }
  }
  gallery.classList.toggle('index-view', indexView);
  toggle.textContent = indexView ? 'Gallery' : 'Index';
  toggle.setAttribute('aria-pressed', String(indexView));
  gallery.querySelectorAll('.project').forEach(project => project.classList.remove('reveal-pending'));
  resetPalette();
  if (indexView) {
    gallery.querySelectorAll<HTMLElement>('.project-link').forEach(link => link.style.setProperty('--parallax-y', '0px'));
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (!indexView) {
    scheduleParallax();
  }
}));

// Lightbox Modal System
const lightbox = document.querySelector<HTMLDialogElement>('#lightbox')!;
const inquiry = document.querySelector<HTMLDialogElement>('#inquiry')!;
const photoImage = document.querySelector<HTMLImageElement>('#lightbox-image')!;
const details = document.querySelector<HTMLElement>('#photo-details')!;
const detailsToggle = document.querySelector<HTMLButtonElement>('#details-toggle')!;
const lightboxStage = document.querySelector<HTMLElement>('.lightbox-stage')!;
let activeGroup = 0, activePhoto = 0;
let viewerTrigger: HTMLElement | null = null;
let inquiryTrigger: HTMLElement | null = null;
let imageFallback = false;

// Zoom and gesture state
let currentScale = 1;
let currentPanX = 0;
let currentPanY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let initialPanX = 0;
let initialPanY = 0;
let pinchStartDistance = 0;
let pinchStartScale = 1;
let lastTapTime = 0;
let touchStartX = 0;
let touchStartY = 0;
let isDismissing = false;

function applyTransform(scale: number, panX: number, panY: number) {
  currentScale = Math.max(1, Math.min(3.5, scale));
  if (currentScale <= 1.02) {
    currentScale = 1;
    currentPanX = 0;
    currentPanY = 0;
    photoImage.style.transform = '';
    lightboxStage?.classList.remove('is-zoomed', 'is-panning');
  } else {
    currentPanX = panX;
    currentPanY = panY;
    photoImage.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${currentScale})`;
    lightboxStage?.classList.add('is-zoomed');
  }
}

function resetZoom() {
  applyTransform(1, 0, 0);
}

function dismissLightbox() {
  if (isDismissing) return;
  isDismissing = true;
  lightbox.classList.add('is-dismissing');
  setTimeout(() => {
    if (lightbox.open) lightbox.close();
    lightbox.classList.remove('is-dismissing');
    isDismissing = false;
  }, 220);
}

const currentPhoto = () => groups[activeGroup]?.images[activePhoto];
const text = (selector: string, value: string) => {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
};

function renderPhoto() {
  const photo = currentPhoto();
  if (!photo) return;
  imageFallback = false;
  resetZoom();

  text('#lightbox-title', photo.title);
  text('#lightbox-location', photo.location || photo.category);
  text('#lightbox-count', `${String(activePhoto + 1).padStart(2, '0')} / ${String(groups[activeGroup].imageCount).padStart(2, '0')}`);
  text('#photo-story', photo.story || `${photo.title} — ${photo.category.toLowerCase()} photography by Abodid Sahoo.`);
  text('#photo-camera', photo.camera ? `Camera / ${photo.camera}` : '');

  photoImage.alt = photo.alt;
  photoImage.srcset = `${photo.small} 800w, ${photo.large} 1600w`;
  photoImage.src = photo.large;

  if (photoImage.complete && photoImage.naturalWidth > 0) {
    photoImage.classList.remove('loading');
    text('#image-load-status', 'Photograph loaded');
  } else {
    photoImage.classList.add('loading');
    text('#image-load-status', 'Loading photograph');
  }

  const prevBtn = document.querySelector<HTMLButtonElement>('#previous-photo');
  const nextBtn = document.querySelector<HTMLButtonElement>('#next-photo');
  if (prevBtn) prevBtn.disabled = groups[activeGroup].images.length < groups[activeGroup].imageCount;
  if (nextBtn) nextBtn.disabled = groups[activeGroup].images.length < groups[activeGroup].imageCount;

  preloadAround(activeGroup);
  syncDirectMail();
}

photoImage.addEventListener('load', () => {
  photoImage.classList.remove('loading');
  text('#image-load-status', 'Photograph loaded');
});

photoImage.addEventListener('error', () => {
  if (!imageFallback) {
    imageFallback = true;
    photoImage.removeAttribute('srcset');
    photoImage.src = currentPhoto().small;
  } else {
    photoImage.classList.remove('loading');
    text('#image-load-status', 'This photograph is temporarily unavailable. Please try the next image.');
  }
});

const seriesRequests = new Map<number, Promise<void>>();
function loadSeries(index: number) {
  const group = groups[index];
  if (group.images.length >= group.imageCount) return Promise.resolve();
  if (!seriesRequests.has(index)) {
    const endpoint = `/photography-portfolio/series.json?id=${encodeURIComponent(group.id)}`;
    const request = fetch(endpoint).then(async response => {
      if (!response.ok) throw new Error('Could not load this series. Close and reopen to retry.');
      const result = await response.json();
      group.images = result.images;
      group.imageCount = result.images.length;
    }).finally(() => seriesRequests.delete(index));
    seriesRequests.set(index, request);
  }
  return seriesRequests.get(index)!;
}

function openGroup(index: number, trigger: HTMLElement) {
  activeGroup = index;
  activePhoto = 0;
  viewerTrigger = trigger;
  details.hidden = true;
  detailsToggle.setAttribute('aria-expanded', 'false');
  detailsToggle.textContent = 'Details +';
  resetZoom();
  preloadAround(activeGroup);
  renderPhoto();
  cursor.classList.remove('visible');
  lightbox.showModal();
  const url = new URL(location.href);
  url.hash = '';
  url.searchParams.set('series', groups[index].id);
  url.searchParams.delete('image');
  history.pushState({ portfolioViewer: true }, '', url);
  void loadSeries(index).then(() => {
    if (lightbox.open && activeGroup === index) renderPhoto();
  }).catch(error => text('#image-load-status', error.message));
}

// Event Delegation for Lightbox Trigger Clicks across all cards
gallery.addEventListener('click', event => {
  const link = (event.target as Element).closest<HTMLAnchorElement>('[data-group]');
  if (!link) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const groupIndex = Number(link.dataset.group);
  preloadAround(groupIndex);
  openGroup(groupIndex, link);
});

function movePhoto(direction: number) {
  const group = groups[activeGroup];
  if (group.images.length < group.imageCount) return;
  resetZoom();
  activePhoto = (activePhoto + direction + group.images.length) % group.images.length;
  const url = new URL(location.href);
  url.searchParams.set('image', currentPhoto().id);
  history.replaceState(history.state, '', url);
  renderPhoto();
}

const prevArrow = document.querySelector<HTMLButtonElement>('#previous-photo');
const nextArrow = document.querySelector<HTMLButtonElement>('#next-photo');
prevArrow?.addEventListener('mousedown', e => e.preventDefault());
prevArrow?.addEventListener('click', e => {
  e.stopPropagation();
  movePhoto(-1);
});
nextArrow?.addEventListener('mousedown', e => e.preventDefault());
nextArrow?.addEventListener('click', e => {
  e.stopPropagation();
  movePhoto(1);
});

// Touch Gesture System: Multi-touch pinch zoom, pan, double-tap, and swipe-down dismiss
photoImage.addEventListener('touchstart', (event: TouchEvent) => {
  if (event.touches.length === 2) {
    pinchStartDistance = Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY
    );
    pinchStartScale = currentScale;
  } else if (event.touches.length === 1) {
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    if (currentScale > 1.05) {
      isPanning = true;
      panStartX = touch.clientX;
      panStartY = touch.clientY;
      initialPanX = currentPanX;
      initialPanY = currentPanY;
      lightboxStage?.classList.add('is-panning');
    }
  }
}, { passive: true });

photoImage.addEventListener('touchmove', (event: TouchEvent) => {
  if (event.touches.length === 2 && pinchStartDistance > 0) {
    event.preventDefault();
    const dist = Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY
    );
    const newScale = pinchStartScale * (dist / pinchStartDistance);
    applyTransform(newScale, currentPanX, currentPanY);
  } else if (event.touches.length === 1 && currentScale > 1.05 && isPanning) {
    event.preventDefault();
    const dx = event.touches[0].clientX - panStartX;
    const dy = event.touches[0].clientY - panStartY;
    const maxPanX = (window.innerWidth * (currentScale - 1)) / 2;
    const maxPanY = (window.innerHeight * (currentScale - 1)) / 2;
    const targetPanX = Math.max(-maxPanX, Math.min(maxPanX, initialPanX + dx));
    const targetPanY = Math.max(-maxPanY, Math.min(maxPanY, initialPanY + dy));
    applyTransform(currentScale, targetPanX, targetPanY);
  }
}, { passive: false });

photoImage.addEventListener('touchend', (event: TouchEvent) => {
  const now = Date.now();
  if (event.touches.length === 0 && event.changedTouches.length === 1) {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    // Double tap toggle (zoom in / reset)
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15 && now - lastTapTime < 300) {
      lastTapTime = 0;
      if (currentScale > 1.2) {
        resetZoom();
      } else {
        applyTransform(2.2, 0, 0);
      }
      return;
    }
    lastTapTime = now;

    if (currentScale > 1.05) {
      isPanning = false;
      lightboxStage?.classList.remove('is-panning');
      return;
    }

    // Swipe gestures when not zoomed
    if (dy > 70 && dy > Math.abs(dx) * 1.3) {
      dismissLightbox();
    } else if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      movePhoto(dx < 0 ? 1 : -1);
    }
  }

  if (event.touches.length === 0) {
    isPanning = false;
    lightboxStage?.classList.remove('is-panning');
  }
}, { passive: true });

photoImage.addEventListener('dblclick', () => {
  if (currentScale > 1.1) resetZoom();
  else applyTransform(2.2, 0, 0);
});

photoImage.addEventListener('click', event => {
  if (currentScale > 1.05) return;
  const rect = photoImage.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  if (clickX > rect.width / 2) {
    movePhoto(1);
  } else {
    movePhoto(-1);
  }
});

lightbox.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    movePhoto(event.key === 'ArrowLeft' ? -1 : 1);
  }
  if (event.key === 'Escape') resetZoom();
});

detailsToggle.addEventListener('click', () => {
  details.hidden = !details.hidden;
  detailsToggle.setAttribute('aria-expanded', String(!details.hidden));
  detailsToggle.textContent = details.hidden ? 'Details +' : 'Details −';
});

let lastModalCloseTime = 0;

for (const dialog of [lightbox, inquiry]) {
  const closeBtn = dialog.querySelector<HTMLButtonElement>('[data-close]');
  if (closeBtn) {
    const handleClose = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (dialog.open) dialog.close();
    };
    closeBtn.addEventListener('click', handleClose);
  }
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
        if (dialog.open) dialog.close();
      }
    }
  });
}

lightbox.addEventListener('close', () => {
  lastModalCloseTime = Date.now();
  resetZoom();
  if (history.state?.portfolioViewer) history.back();
  if (!inquiry.open) {
    viewerTrigger?.focus({ preventScroll: true });
    resetPalette();
  }
});

inquiry.addEventListener('close', () => {
  lastModalCloseTime = Date.now();
  inquiryTrigger?.focus({ preventScroll: true });
  resetPalette();
});

// Guard against mobile tap click bleed-through on header buttons right after modal dismissal
document.querySelector('.site-header')?.addEventListener('click', (e) => {
  if (Date.now() - lastModalCloseTime < 450) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

// Conversion & Inquiry System
const form = document.querySelector<HTMLFormElement>('#inquiry-form')!;
const intentChips = document.querySelectorAll<HTMLButtonElement>('.intent-chip');
const typeSelect = form.elements.namedItem('type') as HTMLSelectElement;
const briefTextarea = form.elements.namedItem('brief') as HTMLTextAreaElement;
const directMailLink = document.querySelector<HTMLAnchorElement>('#inquiry-direct-mail');

function syncDirectMail() {
  if (!directMailLink) return;
  const photo = currentPhoto();
  const type = typeSelect?.value || 'Commission inquiry';
  const subject = photo ? `Photography inquiry: ${photo.title} (${type})` : `Photography inquiry: ${type} — Abodid Sahoo`;
  const body = briefTextarea?.value || 'Hello Abodid,\n\nI’d like to discuss a photography commission or image licensing:\n';
  directMailLink.href = `mailto:hello@abodid.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function setInquiryType(typeName: string) {
  if (typeSelect) typeSelect.value = typeName;
  intentChips.forEach(chip => {
    chip.classList.toggle('is-active', chip.dataset.intent === typeName);
  });
  if (typeName === 'Image licensing') {
    const photo = currentPhoto();
    if (photo && briefTextarea && !briefTextarea.value.includes(photo.title)) {
      briefTextarea.value = `I'd like to license the photograph "${photo.title}" (${photo.original}).\n\nUsage type (Editorial / Commercial / Print):\nTerritory / Medium:\nDuration: `;
    }
  }
  syncDirectMail();
}

intentChips.forEach(chip => {
  chip.addEventListener('click', () => {
    const intent = chip.dataset.intent;
    if (intent) setInquiryType(intent);
  });
});

typeSelect?.addEventListener('change', () => {
  setInquiryType(typeSelect.value);
});

briefTextarea?.addEventListener('input', () => {
  syncDirectMail();
});

function openInquiry(trigger?: HTMLElement, photo?: PortfolioPhoto) {
  inquiryTrigger = lightbox.open ? viewerTrigger : trigger || null;
  if (lightbox.open) lightbox.close();
  if (photo) {
    setInquiryType('Image licensing');
    if (briefTextarea) {
      briefTextarea.value = `I'd like to discuss licensing this photograph:\n${photo.title}\n${photo.original}\n\nIntended use, territory and duration: `;
    }
  }
  syncDirectMail();
  const about = document.querySelector<HTMLDialogElement>('#about');
  if (about?.open) about.close();
  inquiry.showModal();
}

document.querySelectorAll<HTMLElement>('[data-open-inquiry]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  openInquiry(link);
}));

document.querySelector<HTMLButtonElement>('#license-photo')!.addEventListener('click', event => openInquiry(event.currentTarget as HTMLElement, currentPhoto()));

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const submit = form.querySelector<HTMLButtonElement>('[type=submit]')!;
  if (submit.disabled) return;
  const data = new FormData(form);
  submit.disabled = true;
  submit.textContent = 'Sending…';
  text('#inquiry-note', 'Sending your inquiry…');
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'),
        email: data.get('email'),
        message: `${data.get('type')}\nLocation / dates: ${data.get('location')}\n\n${data.get('brief')}`,
        tracking: {
          enquiryPath: location.pathname,
          sourceName: 'Photography portfolio',
          cta: String(data.get('type')),
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Your inquiry could not be sent.');
    form.reset();
    text('#inquiry-note', 'Thank you. Your inquiry has been received.');
  } catch (error) {
    text('#inquiry-note', `${error instanceof Error ? error.message : 'Your inquiry could not be sent.'} Your brief is still here. You can also email hello@abodid.com.`);
  } finally {
    submit.disabled = false;
    submit.textContent = 'Send inquiry ↗';
  }
});

if (window.location.hash === '#inquiry') openInquiry();
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#inquiry' && !inquiry.open) openInquiry();
});

window.addEventListener('popstate', () => {
  if (!new URL(location.href).searchParams.has('series') && lightbox.open) lightbox.close();
});

const sharedUrl = new URL(location.href);
const sharedSeries = groups.findIndex(g => g.id === sharedUrl.searchParams.get('series'));
if (sharedSeries >= 0) {
  activeGroup = sharedSeries;
  lightbox.showModal();
  renderPhoto();
  void loadSeries(sharedSeries).then(() => {
    const image = groups[sharedSeries].images.findIndex(p => p.id === sharedUrl.searchParams.get('image'));
    activePhoto = Math.max(0, image);
    renderPhoto();
  }).catch(error => text('#image-load-status', error.message));
}
