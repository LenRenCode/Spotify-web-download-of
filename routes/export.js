/**
 * routes/export.js
 * Endpoint ekspor koleksi lagu ke format CSV atau JSON.
 *   GET /api/export?format=csv|json
 */

import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// ── GET /api/export ────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const format = req.query.format?.toLowerCase() || 'json';

  if (!['csv', 'json'].includes(format)) {
    return res.status(400).json({ error: 'Format tidak valid. Gunakan: csv atau json.' });
  }

  let songs;
  try {
    songs = db.prepare('SELECT * FROM songs ORDER BY created_at DESC').all();
  } catch (err) {
    console.error('[Export] Error:', err.message);
    return res.status(500).json({ error: 'Gagal mengambil data untuk ekspor.' });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  if (format === 'json') {
    // Export JSON
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="musiklokal-${timestamp}.json"`);
    return res.json({
      diekspor_pada: new Date().toISOString(),
      total_lagu: songs.length,
      koleksi: songs.map(s => ({
        id: s.id,
        spotify_id: s.spotify_id,
        judul: s.title,
        artis: s.artist,
        album: s.album,
        durasi_ms: s.duration_ms,
        sudah_didownload: s.is_downloaded === 1,
        url_spotify: s.spotify_url,
        ditambahkan: s.created_at
      }))
    });
  }

  // Export CSV (dibuat manual, tanpa library tambahan)
  const kolomHeader = ['id', 'spotify_id', 'judul', 'artis', 'album', 'durasi_ms', 'sudah_didownload', 'url_spotify', 'ditambahkan'];

  // Escape nilai CSV: bungkus dengan kutip ganda jika ada koma/kutip/newline
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const baris = songs.map(s => [
    s.id,
    s.spotify_id,
    s.title,
    s.artist,
    s.album,
    s.duration_ms,
    s.is_downloaded === 1 ? 'Ya' : 'Tidak',
    s.spotify_url,
    s.created_at
  ].map(escapeCSV).join(','));

  const csvContent = [kolomHeader.join(','), ...baris].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="musiklokal-${timestamp}.csv"`);
  // BOM untuk kompatibilitas Excel
  return res.send('\uFEFF' + csvContent);
});

export default router;
