/** Bounded memory cache. Failed or invalidated requests can never repopulate it. */
export function createLibraryCache<T>(ttl: number, maxEntries = 24) {
    const entries = new Map<string, { expires: number; value?: T; promise: Promise<T> }>();
    return {
        peek(key: string) {
            const entry = entries.get(key);
            return entry?.value === undefined ? undefined : { value: entry.value, fresh: entry.expires > Date.now() };
        },
        read(key: string, loader: () => Promise<T>): Promise<T> {
            const existing = entries.get(key);
            if (existing && existing.expires > Date.now()) return existing.promise;
            // Infinity coalesces in-flight requests even when they take longer than the TTL.
            const entry = { expires: Infinity, value: existing?.value, promise: undefined as unknown as Promise<T> };
            entry.promise = Promise.resolve().then(loader).then((value) => {
                entry.value = value;
                entry.expires = Date.now() + ttl;
                return value;
            }).catch((error) => {
                if (entries.get(key) === entry) entries.delete(key);
                throw error;
            });
            entries.delete(key);
            entries.set(key, entry);
            while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
            return entry.promise;
        },
        clear() { entries.clear(); },
    };
}
