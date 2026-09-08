// Deliberately memory-only: opening/reloading the app must show Login.
// Never restore an old account or guest identity from browser storage.
let accessToken: string | null = null;

export function clearLegacyAuth() {
  try {
    globalThis.localStorage?.removeItem('fotosnaps_auth');
  } catch {
    // Login must still work when browser storage is disabled.
  }
}

clearLegacyAuth();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token || null;
}

export function clearAuthSession() {
  accessToken = null;
  clearLegacyAuth();
}
