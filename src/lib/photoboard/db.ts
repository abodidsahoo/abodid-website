import { supabase } from '../supabaseClient';

export type PhotoBoardItem = {
    id: string;
    assetId?: string;
    title?: string;
    image: string;
    x: number;
    y: number;
    rotation: number;
    scale: number;
    zIndex: number;
};

export type PhotoBoardRecord = {
    id: string;
    userId: string;
    name: string;
    logicalWidth: number;
    logicalHeight: number;
    sharingEnabled: boolean;
    shareToken?: string | null;
    createdAt?: string;
    updatedAt?: string;
    items: PhotoBoardItem[];
};

const requireClient = () => {
    if (!supabase) throw new Error('Photo Board is not configured.');
    return supabase;
};

const mapItem = (row: Record<string, any>): PhotoBoardItem | null => {
    const relation = Array.isArray(row.user_photo_assets)
        ? row.user_photo_assets[0]
        : row.user_photo_assets;
    const image = relation?.working_url || row.image || '';
    if (!image) return null;
    return {
        id: row.id,
        assetId: row.asset_id || relation?.id,
        title: row.title || 'Photograph',
        image,
        x: Number(row.x || 0),
        y: Number(row.y || 0),
        rotation: Number(row.rotation || 0),
        scale: Number(row.scale || 1),
        zIndex: Number(row.z_index ?? row.zIndex ?? 1),
    };
};

const mapBoard = (row: Record<string, any>): PhotoBoardRecord => ({
    id: row.id,
    userId: row.user_id,
    name: row.name || 'Untitled Board',
    logicalWidth: Number(row.logical_width || 1440),
    logicalHeight: Number(row.logical_height || 1600),
    sharingEnabled: Boolean(row.sharing_enabled),
    shareToken: row.share_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.photo_board_items || []).map(mapItem).filter(Boolean),
});

export async function fetchUserBoards(): Promise<PhotoBoardRecord[]> {
    const client = requireClient();
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) return [];

    const { data, error } = await client
        .from('photo_boards')
        .select('id,user_id,name,logical_width,logical_height,sharing_enabled,share_token,created_at,updated_at,photo_board_items(id,asset_id,x,y,rotation,scale,z_index,user_photo_assets(id,working_url))')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapBoard);
}

export async function createBoard(name = 'Untitled Board'): Promise<PhotoBoardRecord> {
    const client = requireClient();
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) throw new Error('Sign in required.');

    const { data, error } = await client
        .from('photo_boards')
        .insert({ user_id: user.id, name: name.trim().slice(0, 80) || 'Untitled Board' })
        .select('*')
        .single();
    if (error) throw error;
    return mapBoard(data);
}

export async function duplicateBoard(boardId: string): Promise<PhotoBoardRecord> {
    const client = requireClient();
    const { data, error } = await client.rpc('duplicate_photo_board', { source_board_id: boardId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) throw new Error('Board could not be duplicated.');
    const boards = await fetchUserBoards();
    const copied = boards.find((board) => board.id === row.id);
    if (!copied) throw new Error('Duplicated board could not be loaded.');
    return copied;
}

export async function deleteBoard(boardId: string): Promise<void> {
    await apiRequest('/api/photo-board/delete-board', {
        method: 'POST',
        body: JSON.stringify({ boardId }),
    });
}

export async function saveBoardLayout(
    boardId: string,
    items: PhotoBoardItem[],
    details: { name?: string; logicalHeight?: number } = {},
): Promise<void> {
    const client = requireClient();
    const boardUpdates: Record<string, unknown> = {};
    if (details.name !== undefined) boardUpdates.name = details.name.trim().slice(0, 80) || 'Untitled Board';
    if (details.logicalHeight !== undefined) boardUpdates.logical_height = Math.round(details.logicalHeight);

    if (Object.keys(boardUpdates).length) {
        const { error } = await client.from('photo_boards').update(boardUpdates).eq('id', boardId);
        if (error) throw error;
    }

    const persistentItems = items.filter((item) => item.assetId);
    if (!persistentItems.length) return;
    const { error } = await client.from('photo_board_items').upsert(
        persistentItems.map((item) => ({
            id: item.id,
            board_id: boardId,
            asset_id: item.assetId,
            x: item.x,
            y: item.y,
            rotation: item.rotation,
            scale: item.scale || 1,
            z_index: item.zIndex || 1,
        })),
        { onConflict: 'id' },
    );
    if (error) throw error;
}

const accessToken = async () => {
    const client = requireClient();
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session?.access_token) throw new Error('Sign in required.');
    return session.access_token;
};

const apiRequest = async (path: string, init: RequestInit = {}) => {
    const token = await accessToken();
    const response = await fetch(path, {
        ...init,
        headers: {
            ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...(init.headers || {}),
            Authorization: `Bearer ${token}`,
        },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || 'Photo Board request failed.');
        Object.assign(error, { code: data.code, status: response.status });
        throw error;
    }
    return data;
};

export async function uploadWorkingPhoto(
    boardId: string,
    file: Blob,
    metadata: { filename: string; width: number; height: number; x: number; y: number; rotation: number; zIndex: number },
): Promise<PhotoBoardItem> {
    const form = new FormData();
    form.append('boardId', boardId);
    form.append('file', file, metadata.filename);
    Object.entries(metadata).forEach(([key, value]) => {
        if (key !== 'filename') form.append(key, String(value));
    });
    const data = await apiRequest('/api/photo-board/upload', { method: 'POST', body: form });
    return data.item;
}

export async function deleteBoardItems(boardId: string, itemIds: string[]): Promise<string[]> {
    const data = await apiRequest('/api/photo-board/delete-items', {
        method: 'POST',
        body: JSON.stringify({ boardId, itemIds }),
    });
    return data.deleted || [];
}

export async function setBoardSharing(boardId: string, enabled: boolean) {
    return apiRequest('/api/photo-board/share', {
        method: 'POST',
        body: JSON.stringify({ boardId, enabled }),
    });
}

// Temporary compatibility for the retired corner-control prototype. The live
// Photo Board route uses the V1 functions above, but Vite scans every component
// during development and the old prototype still imports these names.
export async function saveBoardToCloud(board: Record<string, any>) {
    const record = board.id ? board : await createBoard(board.title || 'Untitled Board');
    await saveBoardLayout(record.id, board.items || [], {
        name: board.title || record.name || 'Untitled Board',
    });
    return { ...record, title: board.title || record.name || 'Untitled Board' };
}

export async function deleteBoardFromCloud(boardId: string) {
    try {
        await deleteBoard(boardId);
        return true;
    } catch {
        return false;
    }
}
