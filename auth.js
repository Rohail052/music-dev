// auth.js - Spotify PKCE Authentication Helper

const clientId = '248cd7a9e2be4cfdb3e3c56a64369ea7';
const redirectUri = 'https://ch-music-dev.netlify.app/'; // Your deployed URL
const scopes = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
];

// Helpers for PKCE
async function generateCodeVerifier() {
  const array = new Uint32Array(56);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getUrlParams() {
  return new URLSearchParams(window.location.search);
}

async function login() {
  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem('spotify_code_verifier', verifier);

  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', challenge);
  window.location = url.toString();
}

async function fetchAccessToken(code) {
  const verifier = localStorage.getItem('spotify_code_verifier');
  if (!verifier) throw new Error('No code verifier found');

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await response.json();
  if (data.access_token) {
    localStorage.setItem('spotify_access_token', data.access_token);
    localStorage.setItem('spotify_refresh_token', data.refresh_token);
    return data.access_token;
  } else {
    throw new Error('Failed to get access token');
  }
}

function logout() {
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_code_verifier');
  window.location.href = redirectUri;
}

async function handleRedirect() {
  const params = getUrlParams();
  if (params.has('code')) {
    const code = params.get('code');
    try {
      await fetchAccessToken(code);
      window.history.replaceState({}, document.title, redirectUri);
      return true;
    } catch (e) {
      console.error('Auth error', e);
      return false;
    }
  }
  return false;
}

export {
  login,
  logout,
  handleRedirect,
};
