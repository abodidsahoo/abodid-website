import { offers, equipment, navItems } from './site-data.js';

const prefix = document.documentElement.dataset.root || '';
const href = (path) => `${prefix}${path}`;

class StudioHeader extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header class="site-header">
        <a class="brand" href="${href('/')}" aria-label="Podcast Abodid home"><span class="brand-mark">A</span><span>Podcast / Abodid</span></a>
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span>Menu</span><span aria-hidden="true">＋</span></button>
        <nav id="site-nav" class="site-nav" aria-label="Primary navigation">
          ${navItems.map(([label, url]) => `<a href="${href(url)}"><span>${label}</span></a>`).join('')}
        </nav>
        <a class="header-cta" href="${href('/enquire/')}"><span>Book / enquire</span><span aria-hidden="true">↗</span></a>
      </header>`;
    const button = this.querySelector('.menu-toggle');
    const nav = this.querySelector('.site-nav');
    button?.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      nav?.classList.toggle('is-open', !open);
      document.body.classList.toggle('menu-open', !open);
    });
  }
}

class StudioFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer class="site-footer">
        <a class="footer-wordmark" href="${href('/')}">Podcast / Abodid</a>
        <p>Ebbsfleet Valley, Kent<br><span>Exact address shared after confirmation.</span></p>
        <div class="footer-links"><a href="mailto:hello@abodid.com">hello@abodid.com</a><a href="${href('/policies/')}">Policies</a></div>
        <p class="copyright">© ${new Date().getFullYear()} Abodid Sahoo</p>
      </footer>`;
  }
}

customElements.define('studio-header', StudioHeader);
customElements.define('studio-footer', StudioFooter);

document.querySelectorAll('[data-offers]').forEach((container) => {
  const compact = container.hasAttribute('data-compact');
  container.innerHTML = offers.map((offer, index) => `
    <article class="offer ${offer.featured ? 'offer-featured' : ''}">
      <div class="offer-index">0${index + 1}</div>
      <div><p class="eyebrow">${offer.meta}</p><h3>${offer.name}</h3></div>
      <div class="offer-price"><strong>${offer.price}</strong><span>Launch rate</span></div>
      ${compact ? '' : `<ul>${offer.includes.map(item => `<li>${item}</li>`).join('')}</ul>`}
      <a class="text-link" href="${href(`/enquire/?offer=${offer.id}`)}"><span>${offer.cta}</span><i aria-hidden="true">↗</i></a>
    </article>`).join('');
});

document.querySelectorAll('[data-equipment]').forEach((container) => {
  container.innerHTML = equipment.map(([title, copy], index) => `
    <details class="accordion" ${index === 0 ? 'open' : ''}>
      <summary><span>0${index + 1}</span><strong>${title}</strong><i aria-hidden="true">＋</i></summary>
      <p>${copy}</p>
    </details>`).join('');
});

document.querySelectorAll('[data-mail-form]').forEach((form) => {
  const status = form.querySelector('[role="status"]');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const lines = [];
    for (const [key, value] of data.entries()) if (String(value).trim()) lines.push(`${key}: ${value}`);
    const subject = encodeURIComponent(`Podcast studio enquiry — ${data.get('project') || data.get('offer') || 'new project'}`);
    const body = encodeURIComponent(lines.join('\n'));
    if (status) status.textContent = 'Your email app is opening with the brief ready to send.';
    window.location.href = `mailto:hello@abodid.com?subject=${subject}&body=${body}`;
  });
});

const params = new URLSearchParams(location.search);
const offerField = document.querySelector('[name="offer"]');
if (offerField && params.get('offer')) offerField.value = params.get('offer');
const projectField = document.querySelector('[name="project"]');
if (projectField && params.get('project')) projectField.value = params.get('project');

const reveal = new IntersectionObserver((entries) => {
  entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('revealed'); });
}, { threshold: 0.08 });
document.querySelectorAll('[data-reveal]').forEach((el) => reveal.observe(el));
