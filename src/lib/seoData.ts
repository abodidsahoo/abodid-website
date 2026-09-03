import { getCanonicalPageUrl } from "./urlNormalization.js";

const SITE_URL = "https://abodid.com";
const PERSON_ID = `${SITE_URL}/#abodid-sahoo`;
const siteUrlForPath = (path: string) => getCanonicalPageUrl(SITE_URL, path);

export const externalProfiles = {
    rca2023: "https://2023.rca.ac.uk/students/abodid-sahoo/",
    imdb: "https://www.imdb.com/name/nm12156894/",
    superprof:
        "https://www.superprof.co.uk/highly-experienced-video-production-professional-teaching-video-editing-and-colour-grading-all-levels-across-all-age-groups.html",
};

export const seoIdentity = {
    siteUrl: SITE_URL,
    personId: PERSON_ID,
    name: "Abodid Sahoo",
    email: "hello@abodid.com",
    indiaPhone: "+919439094370",
    ukPhone: "+447522258768",
    description:
        "Abodid Sahoo is a Royal College of Art (RCA), London alumnus, creative technologist, photographer, filmmaker, researcher, and tutor working across creative technology, AI-assisted research workflows, Obsidian systems, visual storytelling, and digital media.",
    sameAs: [
        "https://uk.linkedin.com/in/abodidsahoo",
        "https://www.instagram.com/abodid.sahoo",
        "https://github.com/abodidsahoo",
        "https://vimeo.com/abodidsahoo",
        "https://twitter.com/abodidsahoo",
        externalProfiles.rca2023,
        externalProfiles.imdb,
        externalProfiles.superprof,
    ].filter(Boolean),
};

export const royalCollegeOfArtJsonLd = {
    "@type": "CollegeOrUniversity",
    name: "Royal College of Art",
    alternateName: ["RCA", "Royal College of Art London"],
    url: "https://www.rca.ac.uk/",
    location: {
        "@type": "Place",
        name: "London, United Kingdom",
    },
};

export const personJsonLd = () => ({
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": seoIdentity.personId,
    name: seoIdentity.name,
    url: seoIdentity.siteUrl,
    email: `mailto:${seoIdentity.email}`,
    telephone: [seoIdentity.indiaPhone, seoIdentity.ukPhone],
    description: seoIdentity.description,
    jobTitle:
        "Creative technologist, photographer, filmmaker, researcher, and tutor",
    alumniOf: royalCollegeOfArtJsonLd,
    award: [
        "Apple Scholarship recipient at the Royal College of Art",
        "Royal College of Art MA Digital Direction alumnus",
    ],
    knowsAbout: [
        "Royal College of Art",
        "RCA",
        "Royal College of Art London",
        "Creative technology",
        "AI-assisted research workflows",
        "Obsidian",
        "Second brain systems",
        "Photography",
        "Filmmaking",
        "Video editing",
        "Digital media strategy",
        "Interactive media",
        "Research communication",
    ],
    sameAs: seoIdentity.sameAs,
});

export const websiteJsonLd = () => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${seoIdentity.siteUrl}/#website`,
    url: seoIdentity.siteUrl,
    name: "Abodid Sahoo",
    publisher: {
        "@id": seoIdentity.personId,
    },
});

export const profilePageJsonLd = (path: string, description: string) => ({
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${siteUrlForPath(path)}#profile`,
    url: siteUrlForPath(path),
    name: `${seoIdentity.name} - Profile`,
    description,
    mainEntity: {
        "@id": seoIdentity.personId,
    },
});

export const serviceJsonLd = ({
    path,
    name,
    description,
    serviceType,
}: {
    path: string;
    name: string;
    description: string;
    serviceType: string;
}) => ({
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${siteUrlForPath(path)}#service`,
    url: siteUrlForPath(path),
    name,
    description,
    serviceType,
    provider: {
        "@id": seoIdentity.personId,
    },
    areaServed: ["India", "United Kingdom", "Remote"],
    availableChannel: {
        "@type": "ServiceChannel",
        serviceUrl: siteUrlForPath("/contact"),
        servicePhone: [seoIdentity.indiaPhone, seoIdentity.ukPhone],
        serviceSmsNumber: seoIdentity.indiaPhone,
    },
});

export const courseJsonLd = ({
    path,
    name,
    description,
    price,
    currency = "INR",
}: {
    path: string;
    name: string;
    description: string;
    price: string;
    currency?: string;
}) => ({
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": `${siteUrlForPath(path)}#course`,
    url: siteUrlForPath(path),
    name,
    description,
    provider: {
        "@id": seoIdentity.personId,
    },
    offers: {
        "@type": "Offer",
        price,
        priceCurrency: currency,
        availability: "https://schema.org/InStock",
        url: siteUrlForPath(path),
    },
    educationalLevel: [
        "Masters students",
        "PhD applicants",
        "Researchers",
        "Writers",
        "Working professionals",
    ],
    teaches: [
        "Obsidian vault setup",
        "Atomic note-taking",
        "Research workflows",
        "Tags, backlinks, graph view, and templates",
        "Writing from notes",
    ],
});

export const breadcrumbJsonLd = (
    items: Array<{ name: string; path: string }>,
) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: siteUrlForPath(item.path),
    })),
});

export const videoObjectJsonLd = ({
    title,
    description,
    url,
    thumbnailUrl,
    embedUrl,
    contentUrl,
    uploadDate,
    categories,
    roles,
}: {
    title: string;
    description: string;
    url: string;
    thumbnailUrl?: string;
    embedUrl?: string;
    contentUrl?: string;
    uploadDate?: string;
    categories?: string[];
    roles?: string[];
}) => ({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "@id": `${url}#video`,
    name: title,
    description: description || title,
    url,
    thumbnailUrl: thumbnailUrl ? [thumbnailUrl] : undefined,
    uploadDate: uploadDate || undefined,
    contentUrl: contentUrl || undefined,
    embedUrl: embedUrl || undefined,
    author: {
        "@id": seoIdentity.personId,
    },
    creator: {
        "@id": seoIdentity.personId,
    },
    genre: categories && categories.length > 0 ? categories : undefined,
    keywords: roles && roles.length > 0 ? roles : undefined,
});

export const curatedResearchPaperJsonLd = ({
    title,
    description,
    url,
    pdfUrl,
    publishedDate,
    authors,
    tags,
}: {
    title: string;
    description: string;
    url: string;
    pdfUrl?: string;
    publishedDate?: string;
    authors?: string[];
    tags?: string[];
}) => ({
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    "@id": `${url}#article`,
    headline: title,
    name: title,
    description: description || title,
    url,
    sameAs: pdfUrl || undefined,
    datePublished: publishedDate || undefined,
    author:
        authors && authors.length > 0
            ? authors.map((authorName) => ({
                  "@type": "Person",
                  name: authorName,
              }))
            : undefined,
    editor: {
        "@id": seoIdentity.personId,
    },
    maintainer: {
        "@id": seoIdentity.personId,
    },
    keywords: tags && tags.length > 0 ? tags : undefined,
    isPartOf: {
        "@type": "Collection",
        name: "Curated Research Papers",
        url: siteUrlForPath("/research-papers"),
        curator: {
            "@id": seoIdentity.personId,
        },
    },
});

export const vaultNoteJsonLd = ({
    title,
    description,
    url,
    dateModified,
}: {
    title: string;
    description: string;
    url: string;
    dateModified?: string;
}) => ({
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: title,
    description,
    mainEntityOfPage: url,
    author: {
        "@id": seoIdentity.personId,
    },
    dateModified: dateModified || undefined,
    isPartOf: {
        "@type": "Collection",
        name: "Obsidian Vault",
        url: siteUrlForPath("/research/obsidian-vault"),
    },
});

export const creativeWorkJsonLd = ({
    title,
    description,
    url,
    image,
    dateCreated,
    dateModified,
    keywords,
}: {
    title: string;
    description: string;
    url: string;
    image?: string;
    dateCreated?: string;
    dateModified?: string;
    keywords?: string[];
}) => ({
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${url}#work`,
    name: title,
    description,
    url,
    image: image ? [image] : undefined,
    dateCreated: dateCreated || undefined,
    dateModified: dateModified || undefined,
    creator: {
        "@id": seoIdentity.personId,
    },
    keywords: keywords && keywords.length > 0 ? keywords : undefined,
});
