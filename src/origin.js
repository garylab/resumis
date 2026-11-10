// Local reverse proxies can terminate HTTPS before forwarding HTTP to Wrangler.
// Use an explicitly configured origin instead of trusting client-supplied headers.
export function publicRequest(request, env) {
  if (!env.PUBLIC_ORIGIN) return request;
  const origin = new URL(env.PUBLIC_ORIGIN);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password
    || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Invalid PUBLIC_ORIGIN');
  }
  const url = new URL(request.url);
  // Preserve direct localhost/LAN development access on its own origin.
  if (url.hostname !== origin.hostname) return request;
  const transportOrigin = url.origin;
  url.protocol = origin.protocol;
  url.host = origin.host;
  const normalized = new Request(url, request);
  // Wrangler rewrites matching URL headers to the internal HTTP origin too.
  // Restore only exact transport-origin matches, never arbitrary origins.
  if (normalized.headers.get('Origin') === transportOrigin) {
    normalized.headers.set('Origin', origin.origin);
  }
  const referer = normalized.headers.get('Referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.origin === transportOrigin) {
        refererUrl.protocol = origin.protocol;
        refererUrl.host = origin.host;
        normalized.headers.set('Referer', refererUrl.href);
      }
    } catch { /* Ignore malformed Referer values; they are not authorization. */ }
  }
  return normalized;
}
