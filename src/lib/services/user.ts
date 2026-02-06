import { supabase } from '../supabaseClient';
import { isSupabaseConfigured } from './utils';
import type { MediaMention, Award, Education, TimelineCard, CV, PageMetadata } from './types';

export async function getMediaMentions(): Promise<MediaMention[]> {
    if (!isSupabaseConfigured() || !supabase) {
        // Mock Data
        return [
            {
                title: 'When Creative Minds Collide: XY’s "Show Me The Way" Music Video Is Visual Pleasure',
                publication: 'Homegrown',
                url: 'https://homegrown.co.in/homegrown-explore/when-creative-minds-collide-xys-show-me-the-way-music-video-is-visual-pleasure',
                date: '10/01/2021',
                categories: ['Press', 'Music Video'],
                image: 'https://homegrown.co.in/public/uploads/articles/featured_image/5ff5a6873b2d6.jpg',
                published: true
            },
            {
                title: 'XY - Show Me The Way (Official Music Video) - Rolling Stone India',
                publication: 'Rolling Stone',
                url: 'https://rollingstoneindia.com/xy-show-me-the-way-music-video/',
                date: '08/01/2021',
                categories: ['Press', 'Music Video'],
                image: 'https://rollingstoneindia.com/wp-content/uploads/2021/01/XY-Show-Me-The-Way.jpg',
                published: true
            }
        ];
    }

    const { data, error } = await supabase
        .from('media_mentions')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false });

    if (error) {
        console.error('Error fetching media mentions:', error);
        return [];
    }

    return data.map((item: any) => ({
        title: item.title,
        publication: item.publication,
        url: item.url,
        date: new Date(item.published_at).toLocaleDateString(),
        categories: item.categories || [],
        image: item.image_url,
        published: item.published
    } as MediaMention));
}

export async function getAwards(): Promise<Award[]> {
    if (!isSupabaseConfigured() || !supabase) {
        // Mock Data
        return [
            {
                title: 'Apple Scholarship',
                organization: 'Apple / Royal College of Art',
                year: '2019 - 2021',
                description: 'A prestigious full scholarship covering the entire tuition fees and a £28,000 stipend for the Master’s degree in Digital Direction at the Royal College of Art, London.',
                published: true
            },
            {
                title: 'Winner - Best Cinematography',
                organization: 'National Film Festival',
                year: '2023',
                description: 'Awarded for exceptional visual storytelling in the short film "Echoes".',
                published: true
            }
        ];
    }

    const { data, error } = await supabase
        .from('awards')
        .select('*')
        .eq('published', true)
        .order('year', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching awards:', error);
        return [];
    }

    return data.map((item: any) => ({
        id: item.id,
        title: item.title,
        organization: item.organization,
        year: item.year,
        category: item.category,
        value: item.value,
        date: item.date,
        url: item.url,
        description: item.description,
        published: item.published
    } as Award));
}

export async function getEducation(): Promise<Education[]> {
    if (!isSupabaseConfigured() || !supabase) {
        // Mock Data
        return [
            {
                degree: "Master of Design",
                institution: "National Institute of Design",
                location: "India",
                course: "New Media Design",
                start_year: "2019",
                end_year: "2021",
                details: "Focus on New Media Design",
                published: true
            },
            {
                degree: "Bachelor of Arts",
                institution: "University of Creative Arts",
                location: "United Kingdom",
                course: "Film Making",
                start_year: "2015",
                end_year: "2018",
                details: "Major in Film Making",
                published: true
            }
        ] as Education[];
    }

    const { data, error } = await supabase
        .from('education')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .order('end_year', { ascending: false });

    if (error) {
        console.error('Error fetching education:', error);
        return [];
    }

    return data as Education[];
}

export async function getTimelineCards(): Promise<TimelineCard[]> {
    if (!isSupabaseConfigured() || !supabase) {
        // Mock Data
        return [
            {
                id: '1',
                year: '2024',
                title: 'Founded Design Studio',
                description: 'Started my own design practice focusing on digital experiences.',
                image: 'https://via.placeholder.com/400x300',
                published: true
            },
            {
                id: '2',
                year: '2022',
                title: 'Senior Product Designer',
                description: 'Led design team at Tech Corp.',
                image: 'https://via.placeholder.com/400x300',
                published: true
            }
        ];
    }

    const { data, error } = await supabase
        .from('timeline_cards')
        .select('*')
        .eq('published', true)
        .order('year', { ascending: false });

    if (error) {
        console.error('Error fetching timeline:', error);
        return [];
    }

    return data.map((item: any) => ({
        id: item.id,
        year: item.year,
        title: item.title,
        description: item.description,
        image: item.image_url,
        published: item.published
    } as TimelineCard));
}

// --- CV ---
export async function getCVs(): Promise<{ artistCV: CV | null, professionalCVs: CV[] }> {
    if (!isSupabaseConfigured() || !supabase) {
        return { artistCV: null, professionalCVs: [] };
    }

    const { data, error } = await supabase
        .from('cv_uploads')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching CVs:', error);
        return { artistCV: null, professionalCVs: [] };
    }

    const cvs = data.map((cv: any) => ({
        id: cv.id,
        title: cv.title || 'Resume',
        url: cv.pdf_url,
        created_at: cv.created_at
    }));

    return {
        artistCV: cvs.find(cv => cv.title.toLowerCase().includes('artist')) || cvs[0] || null,
        professionalCVs: cvs.filter(cv => !cv.title.toLowerCase().includes('artist'))
    };
}

// --- Page Metadata ---
export async function getPageMetadata(pagePath: string): Promise<PageMetadata | null> {
    if (!isSupabaseConfigured() || !supabase) {
        return null;
    }

    const { data, error } = await supabase
        .from('page_metadata')
        .select('*')
        .eq('page_path', pagePath)
        .single();

    if (error) {
        // It's common to not find metadata for every page, so silent fail or debug log
        // console.debug(`No metadata found for ${pagePath}`);
        return null;
    }

    return data as PageMetadata;
}

export async function getAllPageMetadata(): Promise<PageMetadata[]> {
    if (!isSupabaseConfigured() || !supabase) return [];

    const { data, error } = await supabase
        .from('page_metadata')
        .select('*')
        .order('page_path');

    if (error) {
        console.error('Error fetching all page metadata:', error);
        return [];
    }
    return data as PageMetadata[];
}

export async function updatePageMetadata(pagePath: string, updates: Partial<PageMetadata>): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;

    const { error } = await supabase
        .from('page_metadata')
        .update(updates)
        .eq('page_path', pagePath);

    if (error) {
        console.error(`Error updating metadata for ${pagePath}:`, error);
        return false;
    }
    return true;
}

export async function createPageMetadata(metadata: PageMetadata): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;

    const { error } = await supabase
        .from('page_metadata')
        .insert([metadata]);

    if (error) {
        console.error(`Error creating metadata for ${metadata.page_path}:`, error);
        return false;
    }
    return true;
}

export async function deletePageMetadata(id: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;

    const { error } = await supabase
        .from('page_metadata')
        .delete()
        .eq('id', id);

    if (error) {
        console.error(`Error deleting metadata ${id}:`, error);
        return false;
    }
    return true;
}
