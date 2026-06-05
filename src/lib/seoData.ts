const SITE_URL = "https://abodid.com";
const PERSON_ID = `${SITE_URL}/#abodid-sahoo`;

export const externalProfiles = {
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
        "Abodid Sahoo is a creative technologist, photographer, filmmaker, researcher, and tutor working across creative technology, AI-assisted research workflows, Obsidian systems, visual storytelling, and digital media.",
    sameAs: [
        "https://uk.linkedin.com/in/abodidsahoo",
        "https://www.instagram.com/abodid.sahoo",
        "https://github.com/abodidsahoo",
        "https://vimeo.com/abodidsahoo",
        "https://twitter.com/abodidsahoo",
        externalProfiles.superprof,
    ].filter(Boolean),
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
    knowsAbout: [
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
    "@id": `${seoIdentity.siteUrl}${path}#profile`,
    url: `${seoIdentity.siteUrl}${path}`,
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
    "@id": `${seoIdentity.siteUrl}${path}#service`,
    url: `${seoIdentity.siteUrl}${path}`,
    name,
    description,
    serviceType,
    provider: {
        "@id": seoIdentity.personId,
    },
    areaServed: ["India", "United Kingdom", "Remote"],
    availableChannel: {
        "@type": "ServiceChannel",
        serviceUrl: `${seoIdentity.siteUrl}/contact/`,
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
    "@id": `${seoIdentity.siteUrl}${path}#course`,
    url: `${seoIdentity.siteUrl}${path}`,
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
        url: `${seoIdentity.siteUrl}${path}`,
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
        item: `${seoIdentity.siteUrl}${item.path}`,
    })),
});
