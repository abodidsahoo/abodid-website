import { next, rewrite } from '@vercel/functions';

function isSharedRequest(pathname: string) {
    return (
        pathname.startsWith('/_astro/') ||
        pathname.startsWith('/_image') ||
        pathname.startsWith('/_vercel/') ||
        pathname.startsWith('/api/') ||
        pathname === '/api' ||
        pathname === '/favicon.ico' ||
        pathname === '/favicon.svg'
    );
}

export default function middleware(request: Request) {
    const url = new URL(request.url);

    const host = (
        request.headers.get('host') ||
        url.hostname
    )
        .split(':')[0]
        .toLowerCase();

    const pathname = url.pathname;

    /*
     * CURATION
     * curation.abodid.com/* → /resources/*
     */
    if (host === 'curation.abodid.com') {
        if (isSharedRequest(pathname)) {
            return next();
        }

        const target = new URL(request.url);

        if (pathname === '/robots.txt') {
            target.pathname = '/curation-robots.txt';
            return rewrite(target);
        }

        if (pathname === '/sitemap.xml') {
            target.pathname = '/curation-sitemap.xml';
            return rewrite(target);
        }

        if (
            pathname === '/resources' ||
            pathname.startsWith('/resources/')
        ) {
            return next();
        }

        if (pathname.startsWith('/resource/')) {
            target.pathname =
                '/resources' + pathname.slice('/resource'.length);

            return rewrite(target);
        }

        target.pathname =
            pathname === '/'
                ? '/resources'
                : `/resources${pathname}`;

        return rewrite(target);
    }

    /*
     * LAB
     * lab.abodid.com/* → /lab/*
     */
    if (host === 'lab.abodid.com') {
        if (isSharedRequest(pathname)) {
            return next();
        }

        if (
            pathname === '/lab' ||
            pathname.startsWith('/lab/')
        ) {
            return next();
        }

        const target = new URL(request.url);

        target.pathname =
            pathname === '/'
                ? '/lab'
                : `/lab${pathname}`;

        return rewrite(target);
    }

    return next();
}