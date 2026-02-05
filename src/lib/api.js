// --- ADAPTER LAYER ---
// This file connects the old unsorted API application logic to the new structured Service Layer.
// It ensures backward compatibility while migrating to a cleaner architecture.

import { supabase } from './supabaseClient'; // Exporting supabase for legacy access if needed

// Helper (Re-exported from Utils)
import { isSupabaseConfigured } from './services/utils';

// Content Service
import {
    getResearchProjects,
    getProjects,
    getProjectBySlug,
    getFeaturedPhotography,
    getAllPhotography,
    getPhotographyBySlug,
    getRecentPosts,
    getAllPosts,
    getPostBySlug,
    getNextPost,
    getRelatedPost,
    getFilms,
    getResearchPapers
} from './services/content';

// User Service
import {
    getMediaMentions,
    getAwards,
    getEducation,
    getTimelineCards,
    getCVs,
    getPageMetadata,
    getAllPageMetadata,
    updatePageMetadata,
    createPageMetadata,
    deletePageMetadata
} from './services/user';

// Re-export everything to match original API contract
export {
    isSupabaseConfigured,
    // Content
    getResearchProjects,
    getProjects,
    getProjectBySlug,
    getFeaturedPhotography,
    getAllPhotography,
    getPhotographyBySlug,
    getRecentPosts,
    getAllPosts,
    getPostBySlug,
    getNextPost,
    getRelatedPost,
    getFilms,
    getResearchPapers,
    // User
    getMediaMentions,
    getAwards,
    getEducation,
    getTimelineCards,
    getCVs,
    getPageMetadata,
    getAllPageMetadata,
    updatePageMetadata,
    createPageMetadata,
    deletePageMetadata,
    supabase
};


