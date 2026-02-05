
export interface BaseEntity {
    id?: string;
    created_at?: string;
}

export interface Project extends BaseEntity {
    title: string;
    description: string;
    slug: string;
    href: string;
    image: string; // cover_image from DB
    tags: string[];
    published: boolean;
    visible?: boolean;
    sort_order?: number;
    link?: string;
    repo_link?: string;
}

export interface PhotographyProject extends BaseEntity {
    title: string;
    slug: string;
    href: string;
    category: string[];
    image: string; // cover_image
    published: boolean;
    sort_order?: number;
    tags?: string[];
    images?: string[]; // gallery_images URLs
    gallery_images?: { url: string }[] | string[]; // DB might return object or strings
}

export interface BlogPost extends BaseEntity {
    title: string;
    slug: string;
    href: string;
    date: string; // formatted date
    pubDate: Date; // Date object
    description: string; // excerpt
    tags: string[];
    image: string; // cover_image
    category: string[];
    published: boolean;
    published_at: string;
    sort_order?: number;
}

export interface MediaMention extends BaseEntity {
    title: string;
    publication: string;
    url: string;
    date: string; // formatted
    published_at?: string;
    categories: string[];
    image: string; // image_url
    published: boolean;
}

export interface Award extends BaseEntity {
    title: string;
    category: string;
    value: string;
    date: string;
    url: string;
    description: string;
}

export interface Education extends BaseEntity {
    institution: string;
    location: string;
    degree: string;
    course: string;
    start_year: string;
    end_year: string;
    details: string;
    specialization?: string | null;
    link_text?: string | null;
    link_url?: string | null;
    sort_order?: number;
}

export interface Film extends BaseEntity {
    title: string;
    description: string;
    year: string;
    image: string; // thumbnail_url
    videoUrl: string; // video_url
    roles: string[];
    categories: string[];
    published: boolean;
    sort_order?: number;
}

export interface TimelineCard extends BaseEntity {
    year: string;
    title: string;
    description: string;
    sort_index?: number;
}

export interface ResearchPaper extends BaseEntity {
    title: string;
    formatted_title?: string;
    description: string;
    explanation?: string;
    tags: string[];
    pdf_url: string;
    published_at: string;
    published?: boolean;
}

export interface PageMetadata extends BaseEntity {
    page_path: string;
    title?: string;
    description?: string;
    image?: string;
    is_active: boolean;
}
