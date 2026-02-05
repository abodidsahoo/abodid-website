import { z } from 'zod';

export const BaseEntitySchema = z.object({
    id: z.string().optional(),
    created_at: z.string().optional(),
});

export const ProjectSchema = BaseEntitySchema.extend({
    title: z.string(),
    description: z.string(),
    slug: z.string(),
    href: z.string(),
    // DB uses cover_image, frontend uses image. We might need a transform in the fetcher.
    // For schema purely representing "Frontend Data", we stick to the output type.
    image: z.string().nullable().or(z.string()),
    tags: z.array(z.string()),
    published: z.boolean(),
    visible: z.boolean().optional(),
    sort_order: z.number().optional(),
    link: z.string().optional().nullable(),
    repo_link: z.string().optional().nullable(),
});

export const PhotographyProjectSchema = BaseEntitySchema.extend({
    title: z.string(),
    slug: z.string(),
    href: z.string(),
    category: z.array(z.string()),
    image: z.string().nullable().or(z.string()),
    published: z.boolean(),
    sort_order: z.number().optional(),
    tags: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
});

export const BlogPostSchema = BaseEntitySchema.extend({
    title: z.string(),
    slug: z.string(),
    href: z.string(),
    date: z.string(),
    pubDate: z.date(),
    description: z.string(),
    tags: z.array(z.string()),
    image: z.string().nullable().or(z.string()),
    category: z.array(z.string()),
    published: z.boolean(),
    published_at: z.string(),
    sort_order: z.number().optional(),
});

export const MediaMentionSchema = BaseEntitySchema.extend({
    title: z.string(),
    publication: z.string(),
    url: z.string(),
    date: z.string(),
    published_at: z.string().optional(),
    categories: z.array(z.string()),
    image: z.string().nullable().or(z.string()),
    published: z.boolean(),
});

export const AwardSchema = BaseEntitySchema.extend({
    title: z.string(),
    category: z.string(),
    value: z.string(),
    date: z.string(),
    url: z.string(),
    description: z.string(),
});

export const EducationSchema = BaseEntitySchema.extend({
    institution: z.string(),
    location: z.string(),
    degree: z.string(),
    course: z.string(),
    start_year: z.string(),
    end_year: z.string(),
    details: z.string(),
    specialization: z.string().nullable().optional(),
    link_text: z.string().nullable().optional(),
    link_url: z.string().nullable().optional(),
    sort_order: z.number().optional(),
});

export const FilmSchema = BaseEntitySchema.extend({
    title: z.string(),
    description: z.string(),
    year: z.string(),
    image: z.string().nullable().or(z.string()),
    videoUrl: z.string(),
    roles: z.array(z.string()),
    categories: z.array(z.string()),
    published: z.boolean(),
    sort_order: z.number().optional(),
});

export const ResearchPaperSchema = BaseEntitySchema.extend({
    title: z.string(),
    formatted_title: z.string().optional(),
    description: z.string(),
    explanation: z.string().optional(),
    tags: z.array(z.string()),
    pdf_url: z.string(),
    published_at: z.string(),
    published: z.boolean().optional(),
});

export const TimelineCardSchema = BaseEntitySchema.extend({
    year: z.string(),
    title: z.string(),
    description: z.string(),
    sort_index: z.number().optional(),
});
