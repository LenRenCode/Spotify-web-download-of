/**
 * services/coverService.js
 * Mengunduh gambar cover dari URL dan menyimpannya secara lokal.
 * Mengembalikan path relatif untuk disimpan di database.
 */

import fetch from 'node-fetch';
import { createWriteStream, existsSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { COVERS_DIR } from '../db/database.js';

/**
 * Unduh cover image ke folder ./data/covers/.
 * Jika file sudah ada (berdasarkan spotify_id), tidak diunduh ulang.
 *
 * @param {string} spotifyId - ID Spotify (digunakan sebagai nama file)
 * @param {string|null} coverUrl - URL gambar cover dari Spotify API
 * @returns {string} Path relatif file cover (misal: "/covers/ABC123.jpg")
 *                   atau string kosong jika URL tidak tersedia
 */
async function downloadCover(spotifyId, coverUrl) {
  // Tidak ada URL cover (bisa terjadi pada track lokal atau preview terbatas)
  if (!coverUrl) {
    console.warn(`[Cover] Tidak ada URL cover untuk spotify_id: ${spotifyId}`);
    return '';
  }

  const namaFile = `${spotifyId}.jpg`;
  const pathLokal = join(COVERS_DIR, namaFile);

  // Jika cover sudah ada, gunakan yang ada (hemat bandwidth)
  if (existsSync(pathLokal)) {
    console.log(`[Cover] Sudah ada, dilewati: ${namaFile}`);
    return `/covers/${namaFile}`;
  }

  try {
    const response = await fetch(coverUrl, {
      // Timeout 15 detik agar tidak menggantung selamanya
      signal: AbortSignal.timeout(15_000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} saat mengunduh cover`);
    }

    // Stream langsung ke file
    await pipeline(response.body, createWriteStream(pathLokal));
    console.log(`[Cover] Berhasil disimpan: ${namaFile}`);
    return `/covers/${namaFile}`;

  } catch (err) {
    // Jangan gagalkan proses utama hanya karena cover gagal diunduh
    console.error(`[Cover] Gagal mengunduh cover untuk ${spotifyId}:`, err.message);
    return '';
  }
}

export { downloadCover };
