type Listing = {
    Contents?: Array<{ Key?: string; Size?: number; ETag?: string; LastModified?: Date }>;
    CommonPrefixes?: Array<{ Prefix?: string }>;
    IsTruncated?: boolean;
    NextContinuationToken?: string;
};
type List = (input: { Prefix: string; Delimiter?: string; MaxKeys: number; ContinuationToken?: string }) => Promise<Listing>;

/** Partition originals by root, excluding generated trees before downloading their listings. */
export async function scanLibraryOriginals(list: List, limit: number) {
    const files: Array<{ objectKey: string; fileSize: number; etag: string | null; lastModified: string | null }> = [];
    const roots = new Set<string>();
    const queue: string[] = [];
    let scanned = 0;
    let truncated = false;
    const scan = async (prefix: string, delimiter?: string) => {
        let token: string | undefined;
        do {
            if (scanned >= limit) { truncated = true; return; }
            const response = await list({ Prefix: prefix, Delimiter: delimiter, MaxKeys: 1000, ContinuationToken: token });
            for (const { Prefix: child } of response.CommonPrefixes || []) {
                if (!child) continue;
                if (!prefix) roots.add(child.slice(0, -1));
                if (!/^(?:photos\/)?variants\/$/.test(child)) queue.push(child);
            }
            for (const object of response.Contents || []) {
                const key = object.Key || '';
                if (!key || key.endsWith('/')) continue;
                if (scanned >= limit) { truncated = true; break; }
                scanned += 1;
                files.push({ objectKey: key, fileSize: Number(object.Size || 0), etag: object.ETag?.replace(/^"|"$/g, '') || null, lastModified: object.LastModified?.toISOString() || null });
            }
            token = response.IsTruncated ? response.NextContinuationToken : undefined;
        } while (token);
    };
    await scan('', '/');
    await Promise.all(Array.from({ length: 4 }, async () => {
        while (queue.length) {
            const prefix = queue.shift()!;
            // photos/variants/ is the other generated branch. Other descendants
            // need no delimiter and keep efficient 1,000-object pagination.
            await scan(prefix, prefix === 'photos/' ? '/' : undefined);
        }
    }));
    return { files: files.sort((a, b) => a.objectKey.localeCompare(b.objectKey)), roots: [...roots].sort(), truncated };
}
