export type ResourceStatus = 'pending' | 'approved' | 'rejected';
export type ResourceAudience = 'Designer' | 'Artist' | 'Filmmaker' | 'Creative Technologist' | 'Researcher' | 'General Audience' | 'Other';


export interface Profile {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    website?: string | null;
    bio?: string | null;
    social_links?: string[] | any; // JSONB
    role: 'user' | 'curator' | 'admin';
    updated_at?: string;
}

export interface HubTag {
    id: string;
    name: string;
}

export interface HubResource {
    id: string;
    created_at: string;
    updated_at: string;

    title: string;
    description: string | null;
    url: string;

    submitted_by: string | null; // UUID
    submitter_profile?: Profile; // Joined data

    status: ResourceStatus;

    audience: ResourceAudience | null;

    thumbnail_url: string | null;
    credit_text: string | null;

    upvotes_count?: number; // New field

    admin_notes?: string | null;
    reviewed_at?: string | null;
    reviewed_by?: string | null;

    tags?: HubTag[]; // Joined data
}

export interface CreateResourcePayload {
    title: string;
    url: string;
    description?: string;
    audience: ResourceAudience;
    thumbnail_url?: string;
    credit_text?: string;
    tag_ids?: string[]; // IDs of tags to associate
}

export interface CuratorApprovalPayload {
    curator_note?: string;
    thumbnail_url?: string | null;
    tag_ids?: string[];
    audience?: ResourceAudience;
}
