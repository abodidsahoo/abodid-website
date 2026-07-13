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
