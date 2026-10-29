/**
 * services/spotifyService.js
 * Mengelola autentikasi Client Credentials Spotify dan pengambilan metadata.
 * Token di-cache secara in-memory dan di-refresh otomatis saat kadaluarsa.
 */

import fetch from 'node-fetch';

// ── Cache token in-memory ──────────────────────────────────────────────────
let tokenCache = {
  access_token: null,
  expires_at: 0   // Timestamp Unix (ms) saat token kadaluarsa
};

/**
 * Ambil access token via Client Credentials flow.
 * Gunakan cache jika token masih valid (sisa > 60 detik).
 */
async function getAccessToken() {
  const sekarang = Date.now();
  const sisaWaktu = tokenCache.expires_at - sekarang;

  // Gunakan token yang masih valid (buffer 60 detik)
  if (tokenCache.access_token && sisaWaktu > 60_000) {
    return tokenCache.access_token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID dan SPOTIFY_CLIENT_SECRET belum diisi di file .env');
  }

  // Encode kredensial ke Base64
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gagal mendapatkan token Spotify (${response.status}): ${errBody}`);
  }

  const data = await response.json();

  // Simpan token ke cache
  tokenCache = {
    access_token: data.access_token,
    expires_at: sekarang + data.expires_in * 1000
  };

  console.log('[Spotify] Token baru berhasil diambil, berlaku selama', data.expires_in, 'detik');
  return tokenCache.access_token;
}

/**
 * Parsing Spotify URL / URI menjadi { type, id }.
 * Format yang didukung:
 *   - https://open.spotify.com/track/ID
 *   - https://open.spotify.com/playlist/ID
 *   - spotify:track:ID
 *   - spotify:playlist:ID
 *
 * @param {string} input - URL atau URI Spotify
 * @returns {{ type: 'track'|'playlist', id: string }}
 */
function parseSpotifyLink(input) {
  const trimmed = input.trim();

  // Format URI: spotify:track:ID atau spotify:playlist:ID
  const uriMatch = trimmed.match(/^spotify:(track|playlist):([A-Za-z0-9]+)$/);
  if (uriMatch) {
    return { type: uriMatch[1], id: uriMatch[2] };
  }

  // Format URL: https://open.spotify.com/track/ID atau /playlist/ID
  const urlMatch = trimmed.match(/open\.spotify\.com\/(track|playlist)\/([A-Za-z0-9]+)/);
  if (urlMatch) {
    return { type: urlMatch[1], id: urlMatch[2] };
  }

  throw new Error(
    'Format link tidak valid. Gunakan link Spotify seperti:\n' +
    '  https://open.spotify.com/track/ID\n' +
    '  https://open.spotify.com/playlist/ID'
  );
}

/**
 * Format durasi dari milidetik ke string MM:SS.
 * @param {number} ms
 * @returns {string}
 */
function formatDurasi(ms) {
  const totalDetik = Math.floor(ms / 1000);
  const menit = Math.floor(totalDetik / 60);
  const detik = totalDetik % 60;
  return `${menit}:${detik.toString().padStart(2, '0')}`;
}

/**
 * Ambil metadata satu track dari Spotify API.
 * @param {string} trackId
 * @param {string} token
 * @returns {Object} metadata lagu
 */
async function fetchTrackMetadata(trackId, token) {
  const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || '60';
    throw new Error(`Rate limit Spotify. Coba lagi dalam ${retryAfter} detik.`);
  }
  if (response.status === 404) {
    throw new Error(`Track dengan ID "${trackId}" tidak ditemukan di Spotify.`);
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Akses ditolak Spotify (${response.status}). Periksa Client ID dan Secret.`);
  }
  if (!response.ok) {
    throw new Error(`Spotify API error (${response.status}): ${await response.text()}`);
  }

  const track = await response.json();

  // Pilih gambar cover (ukuran 300px jika tersedia, fallback ke yang pertama)
  const images = track.album?.images || [];
  const coverUrl = images.find(img => img.width <= 300)?.url || images[0]?.url || null;

  return {
    spotify_id: track.id,
    type: 'track',
    title: track.name,
    artist: track.artists.map(a => a.name).join(', '),
    album: track.album?.name || '',
    duration_ms: track.duration_ms,
    cover_url: coverUrl,
    spotify_url: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`
  };
}

/**
 * Ambil semua track dari sebuah playlist Spotify.
 * Menangani pagination (playlist > 100 lagu).
 * @param {string} playlistId
 * @param {string} token
 * @returns {Array<Object>} array metadata per lagu
 */
async function fetchPlaylistTracks(playlistId, token) {
  // Ambil info playlist terlebih dahulu
  const playlistRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name,external_urls`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (playlistRes.status === 429) {
    const retryAfter = playlistRes.headers.get('Retry-After') || '60';
    throw new Error(`Rate limit Spotify. Coba lagi dalam ${retryAfter} detik.`);
  }
  if (playlistRes.status === 404) {
    throw new Error(`Playlist dengan ID "${playlistId}" tidak ditemukan.`);
  }
  if (playlistRes.status === 401 || playlistRes.status === 403) {
    throw new Error(`Akses ditolak Spotify (${playlistRes.status}). Playlist mungkin bersifat privat.`);
  }
  if (!playlistRes.ok) {
    throw new Error(`Spotify API error (${playlistRes.status}): ${await playlistRes.text()}`);
  }

  const playlist = await playlistRes.json();
  const tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(id,name,artists,album,duration_ms,external_urls))`;

  // Loop pagination
  while (url) {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      throw new Error(`Gagal mengambil track playlist (${res.status})`);
    }

    const page = await res.json();

    for (const item of page.items) {
      const track = item.track;
      // Lewati track lokal atau yang null (bisa terjadi di playlist)
      if (!track || !track.id) continue;

      const images = track.album?.images || [];
      const coverUrl = images.find(img => img.width <= 300)?.url || images[0]?.url || null;

      tracks.push({
        spotify_id: track.id,
        type: 'track',
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album?.name || '',
        duration_ms: track.duration_ms,
        cover_url: coverUrl,
        spotify_url: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`
      });
    }

    url = page.next; // null jika tidak ada halaman berikutnya
  }

  console.log(`[Spotify] Playlist "${playlist.name}" berisi ${tracks.length} track.`);
  return tracks;
}

export {
  getAccessToken,
  parseSpotifyLink,
  fetchTrackMetadata,
  fetchPlaylistTracks,
  formatDurasi
};
