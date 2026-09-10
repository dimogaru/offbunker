const CACHE_KEY_PREFIX = "travelhub-cache-v2";

export function persistedQueryCacheKey(ownerId: string): string {
  return `${CACHE_KEY_PREFIX}:${ownerId}`;
}

export function clearPersistedQueryCacheForUser(ownerId: string): void {
  localStorage.removeItem(persistedQueryCacheKey(ownerId));
}