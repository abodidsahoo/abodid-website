export interface CareerRoleSummary {
    slug: string;
    title: string;
    shortTitle: string;
    status: "Open" | "Closed";
    location: string;
    engagement: string;
    commitment: string;
    stipend: string;
    commission: string;
    duration: string;
    startDate: string;
    summary: string;
}

export const careerRoles: CareerRoleSummary[] = [
    {
        slug: "growth-and-partnership-internship-2026",
        title: "Growth & Partnerships Fellow",
        shortTitle: "Growth & Partnerships",
        status: "Open",
        location: "Fully remote",
        engagement: "Paid, part-time internship",
        commitment: "15–20 hours / week",
        stipend: "₹10,000 / month",
        commission: "30% on eligible sales",
        duration: "Initial 12 weeks",
        startDate: "Flexible",
        summary:
            "Build the outreach, partnerships, and opportunity-intelligence function of an independent international creative and research practice.",
    },
];

export const growthPartnershipsRole = careerRoles[0];

