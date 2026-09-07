import type { PortfolioPhoto } from '../../lib/photography/server';

type Palette = { bg: string; isDark: boolean; textColor: string; subtextColor: string };
type Group = {
  id: string;
  title: string;
  category: string;
  label: string;
  cover: PortfolioPhoto;
  images: PortfolioPhoto[];
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
  document.documentElement.style.setProperty('--page-text', '#141414');
  document.documentElement.style.setProperty('--page-subtext', 'rgba(20,20,20,0.68)');
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

// Preload cache for zero-latency image transitions
const preloadedUrls = new Set<string>();

function preloadUrl(url?: string) {
  if (!url || preloadedUrls.has(url)) return;
  preloadedUrls.add(url);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
}

function preloadGroup(gIndex: number) {
  const g = groups[gIndex];
  if (!g?.images) return;
  for (const p of g.images) {
    preloadUrl(p.large);
    preloadUrl(p.small);
  }
}

function preloadAround(gIndex: number) {
  preloadGroup(gIndex);
  preloadGroup((gIndex + 1) % groups.length);
  preloadGroup((gIndex - 1 + groups.length) % groups.length);
}

// Preload project covers immediately
groups.forEach(g => {
  const url = g.cover?.small || g.cover?.large;
  if (url) preloadUrl(url);
});

// Background idle preload
if (typeof window !== 'undefined') {
  const idlePreload = () => {
    groups.forEach((_, idx) => preloadGroup(idx));
  };
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(idlePreload, { timeout: 2000 });
  } else {
    setTimeout(idlePreload, 1500);
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
  article.dataset.paletteBg = group.palette?.bg || '#fbfbf9';
  article.dataset.paletteDark = group.palette?.isDark ? 'true' : 'false';
  article.dataset.paletteText = group.palette?.textColor || '#141414';
  article.dataset.paletteSubtext = group.palette?.subtextColor || 'rgba(20,20,20,0.68)';

  const size = i % 5 === 0 ? 'wide' : i % 5 === 3 ? 'tall' : i % 7 === 0 ? 'small' : 'normal';
  article.dataset.size = size;
  article.style.setProperty('--order', String(i));

  const coverLarge = group.cover.large;
  const coverSmall = group.cover.small || coverLarge;
  const count = group.images.length;
  const title = group.title;
  const category = group.category || 'Editorial';
  const numStr = String(i + 1).padStart(2, '0');

  const widthAttr = group.cover.width ? `width="${group.cover.width}"` : '';
  const heightAttr = group.cover.height ? `height="${group.cover.height}"` : '';

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
      <div class="image-wrap">
        <img
          src="${coverLarge}"
          srcset="${coverSmall} 800w, ${coverLarge} 1600w"
          sizes="(max-width: 600px) 90vw, 42vw"
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
const CHUNK_SIZE = 6;

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
    if (entries[0].isIntersecting) {
      loadNextBatch();
    }
  }, { rootMargin: '500px 0px 500px 0px' });
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
let activeGroup = 0, activePhoto = 0;
let viewerTrigger: HTMLElement | null = null;
let inquiryTrigger: HTMLElement | null = null;
let imageFallback = false;

const currentPhoto = () => groups[activeGroup]?.images[activePhoto];
const text = (selector: string, value: string) => {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
};

function renderPhoto() {
  const photo = currentPhoto();
  if (!photo) return;
  imageFallback = false;

  text('#lightbox-title', photo.title);
  text('#lightbox-location', photo.location || photo.category);
  text('#lightbox-count', `${String(activePhoto + 1).padStart(2, '0')} / ${String(groups[activeGroup].images.length).padStart(2, '0')}`);
  text('#photo-story', photo.story || 'From the photographic archive of Abodid Sahoo.');
  text('#photo-camera', photo.camera ? `Camera / ${photo.camera}` : 'Camera details available on inquiry.');

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
  if (prevBtn) prevBtn.disabled = false;
  if (nextBtn) nextBtn.disabled = false;

  preloadAround(activeGroup);
}

photoImage.addEventListener('load', () => { photoImage.classList.remove('loading'); text('#image-load-status', 'Photograph loaded'); });
photoImage.addEventListener('error', () => {
  if (!imageFallback) {
    imageFallback = true;
    photoImage.removeAttribute('srcset');
    photoImage.src = currentPhoto().original;
  } else { photoImage.classList.remove('loading'); text('#image-load-status', 'This photograph is temporarily unavailable. Please try the next image.'); }
});

function openGroup(index: number, trigger: HTMLElement) {
  activeGroup = index; activePhoto = 0; viewerTrigger = trigger;
  details.hidden = true; detailsToggle.setAttribute('aria-expanded', 'false'); detailsToggle.textContent = 'Details +';
  preloadAround(activeGroup);
  renderPhoto(); cursor.classList.remove('visible'); lightbox.showModal();
}

// Event Delegation for Lightbox Trigger Clicks across all cards
gallery.addEventListener('click', event => {
  const link = (event.target as Element).closest<HTMLAnchorElement>('[data-group]');
  if (!link) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  link.blur();
  const groupIndex = Number(link.dataset.group);
  preloadAround(groupIndex);
  openGroup(groupIndex, link);
});

function movePhoto(direction: number) {
  const currentImages = groups[activeGroup]?.images || [];
  if (direction > 0) {
    if (activePhoto + 1 < currentImages.length) {
      activePhoto++;
    } else {
      activeGroup = (activeGroup + 1) % groups.length;
      activePhoto = 0;
    }
  } else {
    if (activePhoto - 1 >= 0) {
      activePhoto--;
    } else {
      activeGroup = (activeGroup - 1 + groups.length) % groups.length;
      activePhoto = Math.max(0, (groups[activeGroup]?.images.length || 1) - 1);
    }
  }
  preloadAround(activeGroup);
  renderPhoto();
}

const prevArrow = document.querySelector<HTMLButtonElement>('#previous-photo');
const nextArrow = document.querySelector<HTMLButtonElement>('#next-photo');
prevArrow?.addEventListener('mousedown', (e) => e.preventDefault());
prevArrow?.addEventListener('click', (e) => {
  e.stopPropagation();
  prevArrow.blur();
  movePhoto(-1);
});
nextArrow?.addEventListener('mousedown', (e) => e.preventDefault());
nextArrow?.addEventListener('click', (e) => {
  e.stopPropagation();
  nextArrow.blur();
  movePhoto(1);
});

photoImage.addEventListener('click', (event) => {
  const rect = photoImage.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  if (clickX > rect.width / 2) {
    movePhoto(1);
  } else {
    movePhoto(-1);
  }
});

lightbox.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); movePhoto(event.key === 'ArrowLeft' ? -1 : 1); }
});

let touchStart: { x: number; y: number } | undefined;
photoImage.addEventListener('touchstart', event => { if (event.touches.length === 1) touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }, { passive: true });
photoImage.addEventListener('touchend', event => {
  if (!touchStart) return;
  const dx = event.changedTouches[0].clientX - touchStart.x;
  const dy = event.changedTouches[0].clientY - touchStart.y;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) movePhoto(dx < 0 ? 1 : -1);
  touchStart = undefined;
}, { passive: true });

detailsToggle.addEventListener('click', () => {
  details.hidden = !details.hidden;
  detailsToggle.setAttribute('aria-expanded', String(!details.hidden));
  detailsToggle.textContent = details.hidden ? 'Details +' : 'Details −';
});

for (const dialog of [lightbox, inquiry]) {
  const closeBtn = dialog.querySelector<HTMLButtonElement>('[data-close]');
  if (closeBtn) {
    const handleClose = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (dialog.open) dialog.close();
    };
    closeBtn.addEventListener('click', handleClose);
    closeBtn.addEventListener('pointerdown', handleClose);
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
  if (!inquiry.open) {
    if (viewerTrigger) viewerTrigger.blur();
    resetPalette();
  }
});

inquiry.addEventListener('close', () => {
  if (inquiryTrigger) inquiryTrigger.blur();
  resetPalette();
});

const form = document.querySelector<HTMLFormElement>('#inquiry-form')!;
function openInquiry(trigger?: HTMLElement, photo?: PortfolioPhoto) {
  inquiryTrigger = lightbox.open ? viewerTrigger : trigger || null;
  if (lightbox.open) lightbox.close();
  if (photo) {
    (form.elements.namedItem('type') as HTMLSelectElement).value = 'Image licensing';
    (form.elements.namedItem('brief') as HTMLTextAreaElement).value = `I'd like to discuss licensing this photograph:\n${photo.title}\n${photo.original}\n\nIntended use, territory and duration: `;
  }
  inquiry.showModal();
}

document.querySelectorAll<HTMLElement>('[data-open-inquiry]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); openInquiry(link); }));
document.querySelector<HTMLButtonElement>('#license-photo')!.addEventListener('click', event => openInquiry(event.currentTarget as HTMLElement, currentPhoto()));

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const body = `Name: ${data.get('name')}\nEmail: ${data.get('email')}\nLocation / dates: ${data.get('location')}\n\n${data.get('brief')}`;
  const url = `mailto:hello@abodid.com?subject=${encodeURIComponent(`${data.get('type')} — ${data.get('name')}`)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
  text('#inquiry-note', 'Your email draft is ready. Send it from your email app. If no app opened, copy your brief and email hello@abodid.com.');
});

if (window.location.hash === '#inquiry') openInquiry();
window.addEventListener('hashchange', () => { if (window.location.hash === '#inquiry' && !inquiry.open) openInquiry(); });
