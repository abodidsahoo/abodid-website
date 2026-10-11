import { webext } from './browser';

export const extractPageText = async (tabId: number) => {
    try {
        const [result] = await webext.scripting.executeScript({
            target: { tabId },
            func: () => {
                const clone = document.body?.cloneNode(true) as HTMLElement | null;
                clone?.querySelectorAll('script, style, noscript, svg, nav, footer, header, iframe, .cookie-banner')
                    .forEach((element) => element.remove());

                const structured = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
                    .slice(0, 8)
                    .map((element) => element.textContent || '')
                    .filter(Boolean)
                    .join('\n')
                    .slice(0, 5000);

                const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
                    .map((link) => {
                        const label = (link.textContent || '').replace(/\s+/g, ' ').trim();
                        if (!label) return '';
                        return `${label}: ${link.href}`;
                    })
                    .filter(Boolean)
                    .slice(0, 80)
                    .join('\n');

                return [
                    `CURRENT PAGE: ${document.title}`,
                    `CURRENT URL: ${location.href}`,
                    structured ? `STRUCTURED PAGE DATA:\n${structured}` : '',
                    `VISIBLE PAGE CONTENT:\n${(clone?.innerText || '').slice(0, 80_000)}`,
                    links ? `LINK TARGETS:\n${links}` : '',
                ].filter(Boolean).join('\n\n');
            },
        });
        return typeof result?.result === 'string' ? result.result : '';
    } catch {
        return '';
    }
};
