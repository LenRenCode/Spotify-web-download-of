/**
 * routes/songs.js
 * Endpoint CRUD untuk koleksi lagu:
 *   POST   /api/songs            - Tambah lagu/playlist dari link Spotify
 *   GET    /api/songs            - Ambil semua lagu (dengan search & filter)
 *   PATCH  /api/songs/:id/downloaded - Toggle status downloaded
 *   DELETE /api/songs/:id        - Hapus lagu + file cover
 */

import { Router } from 'express';
import { unlink, existsSync } from 'fs';
import { join } from 'path';
import db, { COVERS_DIR } from '../db/database.js';
import { getAccessToken, parseSpotifyLink, fetchTrackMetadata, fetchPlaylistTracks } from '../services/spotifyService.js';
import { downloadCover } from '../services/coverService.js';

const router = Router();

// ── Prepared statements (aman dari SQL Injection) ─────────────────────────
const stmtInsert = db.prepare(`
  INSERT OR IGNORE INTO songs
    (spotify_id, type, title, artist, album, duration_ms, cover_path, spotify_url)
  VALUES
    (@spotify_id, @type, @title, @artist, @album, @duration_ms, @cover_path, @spotify_url)
`);

const stmtGetById = db.prepare(`SELECT * FROM songs WHERE spotify_id = ?`);

// ── POST /api/songs ────────────────────────────────────────────────────────
// Terima link Spotify (track/playlist), ambil metadata, simpan ke DB.
router.post('/', async (req, res) => {
  const { link } = req.body;

  if (!link || typeof link !== 'string' || link.trim() === '') {
    return res.status(400).json({ error: 'Field "link" wajib diisi.' });
  }

  try {
    // 1. Parse & validasi format link
    const { type, id } = parseSpotifyLink(link);

    // 2. Ambil token Spotify
    const token = await getAccessToken();

    let tracksToSave = [];

    if (type === 'track') {
      const metadata = await fetchTrackMetadata(id, token);
      tracksToSave = [metadata];
    } else if (type === 'playlist') {
      tracksToSave = await fetchPlaylistTracks(id, token);
    }

    if (tracksToSave.length === 0) {
      return res.status(422).json({ error: 'Playlist tidak memiliki track yang bisa disimpan.' });
    }

    // 3. Simpan setiap track secara sequential (cover download bersifat async)
    const results = { ditambahkan: 0, duplikat: 0, total: tracksToSave.length };

    for (const track of tracksToSave) {
      // Unduh cover terlebih dahulu (gagal cover tidak membatalkan penyimpanan)
      const coverPath = await downloadCover(track.spotify_id, track.cover_url);

      const info = stmtInsert.run({
        spotify_id: track.spotify_id,
        type: track.type,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration_ms: track.duration_ms,
        cover_path: coverPath,
        spotify_url: track.spotify_url
      });

      if (info.changes > 0) results.ditambahkan++;
      else results.duplikat++;
    }

    console.log(`[Songs] Ditambahkan: ${results.ditambahkan}, Duplikat: ${results.duplikat}`);

    return res.status(201).json({
      message: `Berhasil menambahkan ${results.ditambahkan} lagu${results.duplikat > 0 ? `, ${results.duplikat} sudah ada` : ''}.`,
      ...results
    });

  } catch (err) {
    console.error('[Songs POST] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/songs ─────────────────────────────────────────────────────────
// Query params: search (string), filter (all|downloaded|pending)
router.get('/', (req, res) => {
  const { search = '', filter = 'all' } = req.query;

  let query = 'SELECT * FROM songs WHERE 1=1';
  const params = [];

  // Filter berdasarkan status download
  if (filter === 'downloaded') {
    query += ' AND is_downloaded = 1';
  } else if (filter === 'pending') {
    query += ' AND is_downloaded = 0';
  }

  // Pencarian judul atau artis (case-insensitive, menggunakan LIKE dengan param aman)
  if (search.trim()) {
    query += ' AND (title LIKE ? OR artist LIKE ?)';
    const kata = `%${search.trim()}%`;
    params.push(kata, kata);
  }

  query += ' ORDER BY created_at DESC';

  try {
    const songs = db.prepare(query).all(...params);
    return res.json({
      total: songs.length,
      songs
    });
  } catch (err) {
    console.error('[Songs GET] Error:', err.message);
    return res.status(500).json({ error: 'Gagal mengambil data koleksi.' });
  }
});

// ── PATCH /api/songs/:id/downloaded ───────────────────────────────────────
// Toggle status is_downloaded (0 → 1 → 0)
router.patch('/:id/downloaded', (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID tidak valid.' });
  }

  const song = db.prepare('SELECT id, is_downloaded FROM songs WHERE id = ?').get(id);

  if (!song) {
    return res.status(404).json({ error: `Lagu dengan ID ${id} tidak ditemukan.` });
  }

  const statusBaru = song.is_downloaded === 1 ? 0 : 1;
  db.prepare('UPDATE songs SET is_downloaded = ? WHERE id = ?').run(statusBaru, id);

  return res.json({
    message: `Status diperbarui: ${statusBaru === 1 ? 'Sudah didownload' : 'Belum didownload'}.`,
    id,
    is_downloaded: statusBaru
  });
});

// ── DELETE /api/songs/:id ──────────────────────────────────────────────────
// Hapus lagu dari DB dan file cover-nya
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID tidak valid.' });
  }

  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);

  if (!song) {
    return res.status(404).json({ error: `Lagu dengan ID ${id} tidak ditemukan.` });
  }

  // Hapus dari database
  db.prepare('DELETE FROM songs WHERE id = ?').run(id);

  // Hapus file cover jika ada (async, tidak perlu ditunggu)
  if (song.cover_path) {
    // cover_path berformat "/covers/FILENAME.jpg", ambil nama filenya
    const namaFile = song.cover_path.replace('/covers/', '');
    const pathLokal = join(COVERS_DIR, namaFile);

    if (existsSync(pathLokal)) {
      unlink(pathLokal, (err) => {
        if (err) console.error(`[Cover] Gagal menghapus ${namaFile}:`, err.message);
        else console.log(`[Cover] Dihapus: ${namaFile}`);
      });
    }
  }

  return res.json({
    message: `Lagu "${song.title}" berhasil dihapus.`,
    deleted_id: id
  });
});

export default router;
