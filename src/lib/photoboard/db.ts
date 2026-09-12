import { supabase } from '../supabaseClient';

export interface PhotoBoardItem {
    id: string;
    title?: string;
    image: string;
    fileBlob?: Blob; // Local temporary blob if not yet uploaded
    x: number;
    y: number;
    rotation: number;
    scale?: number;
    zIndex?: number;
    isCover?: boolean;
}

export interface PhotoBoardRecord {
    id: string;
    user_id?: string;
    title: string;
    backdrop_color: string;
    items: PhotoBoardItem[];
    created_at?: string;
    updated_at?: string;
}

/**
 * Fetch all boards belonging to the logged-in user
 */
export async function fetchUserBoards(): Promise<PhotoBoardRecord[]> {
    if (!supabase) return [];
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('user_photo_boards')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) {
            console.warn('Could not fetch user_photo_boards:', error.message);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('Error fetching boards:', e);
        return [];
    }
}

/**
 * Upload a single local image blob to Supabase Storage
 */
export async function uploadBoardImage(
    userId: string,
    boardId: string,
    file: Blob | File,
    filename: string
): Promise<string | null> {
    if (!supabase) return null;
    try {
        const ext = filename.split('.').pop() || 'jpg';
        const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
        const path = `${userId}/${boardId}/${uniqueName}`;

        const { error: uploadError } = await supabase.storage
            .from('photoboard-uploads')
            .upload(path, file, {
                cacheControl: '3600',
                upsert: true,
            });

        if (uploadError) {
            console.error('Image upload failed:', uploadError);
            return null;
        }

        const { data } = supabase.storage
            .from('photoboard-uploads')
            .getPublicUrl(path);

        return data?.publicUrl || null;
    } catch (e) {
        console.error('Error uploading board image:', e);
        return null;
    }
}

/**
 * Create or save a new board to Supabase Postgres
 */
export async function saveBoardToCloud(
    board: {
        id?: string;
        title: string;
        backdrop_color: string;
        items: PhotoBoardItem[];
    }
): Promise<PhotoBoardRecord | null> {
    if (!supabase) return null;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const boardId = board.id || crypto.randomUUID();

        // 1. Process items: upload any local blob/data URLs to cloud storage
        const processedItems: PhotoBoardItem[] = [];
        for (const item of board.items) {
            let remoteUrl = item.image;
            if (item.fileBlob || item.image.startsWith('blob:') || item.image.startsWith('data:')) {
                const blob = item.fileBlob || (await (await fetch(item.image)).blob());
                const uploadedUrl = await uploadBoardImage(user.id, boardId, blob, `${item.id}.jpg`);
                if (uploadedUrl) {
                    remoteUrl = uploadedUrl;
                }
            }

            processedItems.push({
                id: item.id,
                title: item.title || 'Portrait',
                image: remoteUrl,
                x: item.x,
                y: item.y,
                rotation: item.rotation,
                scale: item.scale || 1,
                zIndex: item.zIndex || 10,
                isCover: item.isCover || false,
            });
        }

        // 2. Upsert into user_photo_boards table
        const payload = {
            id: boardId,
            user_id: user.id,
            title: board.title || 'Untitled Board',
            backdrop_color: board.backdrop_color || '#14225d',
            items: processedItems,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('user_photo_boards')
            .upsert(payload)
            .select()
            .single();

        if (error) {
            console.error('Failed to save board record:', error);
            // Fallback: Return locally formatted record so user can continue seamlessly
            return {
                id: boardId,
                user_id: user.id,
                title: payload.title,
                backdrop_color: payload.backdrop_color,
                items: processedItems,
            };
        }

        return data;
    } catch (e) {
        console.error('Error saving board to cloud:', e);
        return null;
    }
}

/**
 * Delete a board
 */
export async function deleteBoardFromCloud(boardId: string): Promise<boolean> {
    if (!supabase) return false;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase
            .from('user_photo_boards')
            .delete()
            .eq('id', boardId)
            .eq('user_id', user.id);

        return !error;
    } catch (e) {
        console.error('Error deleting board:', e);
        return false;
    }
}
