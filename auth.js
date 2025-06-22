// auth.js - Spotify Implicit Grant flow helper

const clientId = '248cd7a9e2be4cfdb3e3c56a64369ea7';
const redirectUri = window.location.origin + window.location.pathname;
const scopes = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state'
].join(' ');

function login() {
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'token'); // implicit grant
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('show_dialog', 'true');
  window.location = authUrl.toString();
}

function logout() {
  sessionStorage.removeItem('spotify_access_token');
  window.location.href = redirectUri;
}

function getAccessTokenFromUrl() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('access_token');
}

function clearUrlHash() {
  history.replaceState(null, '', window.location.pathname);
}

function getToken() {
  let token = sessionStorage.getItem('spotify_access_token');
  if (!token) {
    token = getAccessTokenFromUrl();
    if (token) {
      sessionStorage.setItem('spotify_access_token', token);
      clearUrlHash();
    }
  }
  return token;
}

// Export functions for app use
export {
  login,
  logout,
  getToken,
};
