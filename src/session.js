const COOKIE = 'resumis_session';
const REPO_COOKIE = 'resumis_repo';
const MAX_AGE = 31 * 24 * 60 * 60;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function unbase64url(value) {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
}

async function key(secret) {
  if (!secret || secret.length < 32) {
    throw new Error('Configure SESSION_SECRET with at least 32 random characters');
  }
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// Encrypt as well as authenticate: the GitHub access token stays opaque in the cookie.
export async function sealSession(data, secret, now = Date.now(), purpose = COOKIE) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(purpose) },
    await key(secret), encoder.encode(JSON.stringify({ data, expires: now + MAX_AGE * 1000 })),
  );
  return `${base64url(iv)}.${base64url(new Uint8Array(encrypted))}`;
}

export async function openSession(value, secret, now = Date.now(), purpose = COOKIE) {
  if (!value || !secret || secret.length < 32 || value.length > 4096) return {};
  try {
    const parts = value.split('.');
    if (parts.length !== 2) return {};
    const clear = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unbase64url(parts[0]), additionalData: encoder.encode(purpose) },
      await key(secret), unbase64url(parts[1]),
    );
    const payload = JSON.parse(decoder.decode(clear));
    return payload.expires > now && payload.data && typeof payload.data === 'object' ? payload.data : {};
  } catch {
    return {};
  }
}

function cookieValue(request, name) {
  return (request.headers.get('Cookie') || '').split(';')
    .map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function cookieAttributes(request) {
  return `Path=/; HttpOnly; SameSite=Lax${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}

export async function loadSession(request, env) {
  return openSession(cookieValue(request, COOKIE), env.SESSION_SECRET);
}

export async function loadRepoPreference(request, env, userId) {
  const preference = await openSession(cookieValue(request, REPO_COOKIE), env.SESSION_SECRET, Date.now(), REPO_COOKIE);
  if (preference.userId !== userId || typeof preference.repo?.full_name !== 'string'
    || !/^[^/\s]+\/[^/\s]+$/.test(preference.repo.full_name)
    || typeof preference.repo.branch !== 'string' || !preference.repo.branch.trim()) return null;
  return preference.repo;
}

export async function rememberRepo(response, request, env, userId, repo) {
  // Persist only an account-scoped preference, never GitHub credentials.
  const value = await sealSession({ userId, repo }, env.SESSION_SECRET, Date.now(), REPO_COOKIE);
  if (value.length > 3800) throw new Error('Repository preference exceeds cookie size limit');
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', `${REPO_COOKIE}=${value}; ${cookieAttributes(request)}; Max-Age=${MAX_AGE}`);
  return new Response(response.body, { status: response.status, headers });
}

export async function saveSession(response, data, request, env) {
  const headers = new Headers(response.headers);
  const attributes = cookieAttributes(request);
  if (Object.keys(data).length === 0) {
    headers.append('Set-Cookie', `${COOKIE}=; ${attributes}; Max-Age=0`);
  } else {
    const value = await sealSession(data, env.SESSION_SECRET);
    if (value.length > 3800) throw new Error('Session exceeds cookie size limit');
    // Like Flask's default session, this is a browser-session cookie.
    headers.append('Set-Cookie', `${COOKIE}=${value}; ${attributes}`);
  }
  return new Response(response.body, { status: response.status, headers });
}
