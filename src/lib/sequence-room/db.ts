import { supabase } from '../supabaseClient';

export type SequenceRoomItem = {
    id: string;
    assetId?: string;
    title?: string;
    image: string;
    x: number;
    y: number;
    rotation: number;
    scale: number;
    zIndex: number;
    rejected?: boolean;
    annotation?: Record<string, unknown>;
    libraryAsset?: boolean;
};

export type SequenceRoomRecord = {
    id: string;
    userId: string;
    name: string;
    logicalWidth: number;
    logicalHeight: number;
    backgroundColor: string;
    sharingEnabled: boolean;
    shareToken?: string | null;
    createdAt?: string;
    updatedAt?: string;
    items: SequenceRoomItem[];
};

const requireClient = () => {
    if (!supabase) throw new Error('Sequence Room is not configured.');
    return supabase;
};

const fetchOwnedPhotoUrl = async (assetId: string) => {
    const client = requireClient();
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session?.access_token) throw new Error('Sign in required.');
    const response = await fetch(`/api/sequence-room/photo/${encodeURIComponent(assetId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) throw new Error('A photograph could not be restored.');
    return URL.createObjectURL(await response.blob());
};

const mapItem = (row: Record<string, any>): SequenceRoomItem | null => {
    const relation = Array.isArray(row.user_photo_assets)
        ? row.user_photo_assets[0]
        : row.user_photo_assets;
    const libraryAsset = Boolean(relation?.is_library_asset);
    const image = libraryAsset ? relation?.working_url : row.image || '';
    if (!relation?.id && !image) return null;
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
        rejected: Boolean(row.is_rejected ?? row.rejected),
        annotation: row.annotation && typeof row.annotation === 'object' ? row.annotation : {},
        libraryAsset,
    };
};

const mapBoard = (row: Record<string, any>): SequenceRoomRecord => ({
    id: row.id,
    userId: row.user_id,
    name: row.name || 'Untitled Board',
    logicalWidth: Number(row.logical_width || 1440),
    logicalHeight: Number(row.logical_height || 1600),
    backgroundColor: row.background_color || '#fff8e8',
    sharingEnabled: Boolean(row.sharing_enabled),
    shareToken: row.share_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.sequence_room_items || []).map(mapItem).filter(Boolean),
});

export async function fetchUserBoards(): Promise<SequenceRoomRecord[]> {
    const client = requireClient();
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) return [];

    const { data, error } = await client
        .from('sequence_room_boards')
        .select('id,user_id,name,logical_width,logical_height,background_color,last_opened_at,sharing_enabled,share_token,created_at,updated_at,sequence_room_items(id,asset_id,x,y,rotation,scale,z_index,is_rejected,annotation,user_photo_assets(id,working_url,is_library_asset))')
        .eq('user_id', user.id)
        .order('last_opened_at', { ascending: false })
        .order('updated_at', { ascending: false });
    if (error) throw error;
    const boards = (data || []).map(mapBoard);
    await Promise.all(boards.flatMap((board) => board.items.map(async (item) => {
        if (item.libraryAsset || !item.assetId) return;
        item.image = await fetchOwnedPhotoUrl(item.assetId);
    })));
    return boards;
}

export async function createStarterBoard(): Promise<SequenceRoomRecord> {
    const client = requireClient();
    const { data, error } = await client.rpc('create_sequence_room_starter_board');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) throw new Error('Your starter board could not be created.');
    const boards = await fetchUserBoards();
    const board = boards.find((candidate) => candidate.id === row.id);
    if (!board) throw new Error('Your starter board could not be loaded.');
    return board;
}

export async function markBoardOpened(boardId: string): Promise<void> {
    const client = requireClient();
    const { error } = await client
        .from('sequence_room_boards')
        .update({ last_opened_at: new Date().toISOString() })
        .eq('id', boardId);
    if (error) throw error;
}

export async function createBoard(name = 'Untitled Board'): Promise<SequenceRoomRecord> {
    const client = requireClient();
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) throw new Error('Sign in required.');

    const { data, error } = await client
        .from('sequence_room_boards')
        .insert({ user_id: user.id, name: name.trim().slice(0, 80) || 'Untitled Board', logical_height: 3600 })
        .select('*')
        .single();
    if (error) throw error;
    return mapBoard(data);
}

export async function duplicateBoard(boardId: string): Promise<SequenceRoomRecord> {
    const client = requireClient();
    const { data, error } = await client.rpc('duplicate_sequence_room', { source_board_id: boardId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) throw new Error('Board could not be duplicated.');
    const boards = await fetchUserBoards();
    const copied = boards.find((board) => board.id === row.id);
    if (!copied) throw new Error('Duplicated board could not be loaded.');
    return copied;
}

export async function deleteBoard(boardId: string): Promise<void> {
    await apiRequest('/api/sequence-room/delete-board', {
        method: 'POST',
        body: JSON.stringify({ boardId }),
    });
}

export async function saveBoardLayout(
    boardId: string,
    items: SequenceRoomItem[],
    details: { name?: string; logicalHeight?: number; backgroundColor?: string } = {},
): Promise<void> {
    const client = requireClient();
    const boardUpdates: Record<string, unknown> = {};
    if (details.name !== undefined) boardUpdates.name = details.name.trim().slice(0, 80) || 'Untitled Board';
    if (details.logicalHeight !== undefined) boardUpdates.logical_height = Math.round(details.logicalHeight);
    if (details.backgroundColor !== undefined) boardUpdates.background_color = details.backgroundColor;

    if (Object.keys(boardUpdates).length) {
        const { error } = await client.from('sequence_room_boards').update(boardUpdates).eq('id', boardId);
        if (error) throw error;
    }

    const persistentItems = items.filter((item) => item.assetId);
    if (!persistentItems.length) return;
    const { error } = await client.from('sequence_room_items').upsert(
        persistentItems.map((item) => ({
            id: item.id,
            board_id: boardId,
            asset_id: item.assetId,
            x: item.x,
            y: item.y,
            rotation: item.rotation,
            scale: item.scale || 1,
            z_index: item.zIndex || 1,
            is_rejected: Boolean(item.rejected),
            annotation: item.annotation || {},
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
        const error = new Error(data.error || 'Sequence Room request failed.');
        Object.assign(error, { code: data.code, status: response.status });
        throw error;
    }
    return data;
};

export async function uploadWorkingPhoto(
    boardId: string,
    file: Blob,
    metadata: { filename: string; width: number; height: number; x: number; y: number; rotation: number; zIndex: number },
): Promise<SequenceRoomItem> {
    const form = new FormData();
    form.append('boardId', boardId);
    form.append('file', file, metadata.filename);
    Object.entries(metadata).forEach(([key, value]) => {
        if (key !== 'filename') form.append(key, String(value));
    });
    const data = await apiRequest('/api/sequence-room/upload', { method: 'POST', body: form });
    data.item.image = await fetchOwnedPhotoUrl(data.item.assetId);
    data.item.libraryAsset = false;
    return data.item;
}

export async function deleteBoardItems(boardId: string, itemIds: string[]): Promise<string[]> {
    const data = await apiRequest('/api/sequence-room/delete-items', {
        method: 'POST',
        body: JSON.stringify({ boardId, itemIds }),
    });
    return data.deleted || [];
}

export async function setBoardSharing(boardId: string, enabled: boolean) {
    return apiRequest('/api/sequence-room/share', {
        method: 'POST',
        body: JSON.stringify({ boardId, enabled }),
    });
}

// Temporary compatibility for the retired corner-control prototype. The live
// Sequence Room route uses the V1 functions above, but Vite scans every component
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
