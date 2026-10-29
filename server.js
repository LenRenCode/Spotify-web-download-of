/**
 * server.js
 * Entry point aplikasi MusikLokal.
 * Setup Express, middleware, routing, dan static file serving.
 */

import 'dotenv/config';
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Inisialisasi database saat startup (membuat folder & tabel jika belum ada)
import db, { ROOT_DIR } from './db/database.js';

// Import routes
import songsRouter from './routes/songs.js';
import exportRouter from './routes/export.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json());                                     // Parse JSON body
app.use(express.urlencoded({ extended: true }));             // Parse form body
app.use(express.static(join(__dirname, 'public')));          // Sajikan frontend
app.use('/covers', express.static(join(ROOT_DIR, 'data', 'covers'))); // Sajikan file cover

// ── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'MusikLokal',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ── Routes API ────────────────────────────────────────────────────────────
app.use('/api/songs', songsRouter);
app.use('/api/export', exportRouter);

// ── Fallback: semua route non-API ke index.html ───────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ── Jalankan server ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] MusikLokal berjalan di http://localhost:${PORT}`);
  console.log(`[Server] Mode: ${process.env.NODE_ENV || 'development'}`);

  // Validasi kredensial Spotify (peringatan jika belum diisi)
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.warn('[WARN] SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET belum diisi di .env!');
    console.warn('[WARN] Fitur fetch metadata Spotify tidak akan berfungsi.');
  }
});

export default app;
