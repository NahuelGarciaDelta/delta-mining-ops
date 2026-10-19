// Refresh only datasets whose Supabase version differs from the usable local snapshot.
// Unknown versions deliberately fall back to a fetch rather than hiding new records.
export function planVersionedRefresh(sources, cachedSources, serverVersions, serverRowCounts) {
  const requested = [...new Set((sources || []).filter(Boolean))];
  if (!serverVersions || typeof serverVersions !== "object") return requested;

  return requested.filter(key => {
    const cached = cachedSources?.[key];
    if (!cached?.ok || !Array.isArray(cached.data)) return true;

    const localVersion = Number(cached.meta?.serverVersion);
    const remoteVersion = Number(serverVersions[key]);
    const rowCount = Number(serverRowCounts?.[key]);
    const hasRemoteCount = serverRowCounts?.[key] !== undefined && Number.isSafeInteger(rowCount) && rowCount >= 0;
    // La versión 0 es válida únicamente cuando el manifiesto confirma 0 filas.
    // Así no descargamos continuamente una fuente nueva pero aún vacía.
    const verifiedEmpty=hasRemoteCount&&rowCount===0&&cached.data.length===0&&localVersion===0&&remoteVersion===0;
    if(verifiedEmpty)return false;
    return !Number.isFinite(localVersion) || localVersion <= 0 ||
      !Number.isFinite(remoteVersion) || remoteVersion <= 0 ||
      localVersion !== remoteVersion ||
      (hasRemoteCount && cached.data.length !== rowCount);
  });
}
