/**
 * db/database.js
 * Inisialisasi koneksi SQLite dan pembuatan skema tabel.
 * Folder ./data dan ./data/covers dibuat otomatis jika belum ada.
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Direktori root proyek
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

// Pastikan folder data & covers tersedia sebelum membuka DB
const DATA_DIR = join(ROOT_DIR, 'data');
const COVERS_DIR = join(DATA_DIR, 'covers');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(COVERS_DIR)) mkdirSync(COVERS_DIR, { recursive: true });

// Buka koneksi database
const DB_PATH = join(DATA_DIR, 'koleksi.db');
const db = new Database(DB_PATH);

// Aktifkan WAL mode untuk performa lebih baik
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Skema tabel songs ──────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS songs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    spotify_id    TEXT    NOT NULL UNIQUE,        -- ID unik dari Spotify (track/playlist item)
    type          TEXT    NOT NULL DEFAULT 'track', -- 'track' atau 'playlist'
    title         TEXT    NOT NULL,               -- Judul lagu
    artist        TEXT    NOT NULL,               -- Nama artis (dipisah koma jika lebih dari satu)
    album         TEXT    NOT NULL DEFAULT '',    -- Nama album
    duration_ms   INTEGER NOT NULL DEFAULT 0,     -- Durasi dalam milidetik
    cover_path    TEXT    NOT NULL DEFAULT '',    -- Path file cover lokal
    spotify_url   TEXT    NOT NULL DEFAULT '',    -- URL Spotify untuk dibuka di browser
    is_downloaded INTEGER NOT NULL DEFAULT 0,     -- 0 = belum, 1 = sudah di-download di Spotify
    created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`);

// Indeks untuk mempercepat pencarian dan filter
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_songs_spotify_id ON songs(spotify_id);
  CREATE INDEX IF NOT EXISTS idx_songs_is_downloaded ON songs(is_downloaded);
`);

console.log(`[DB] Database terhubung: ${DB_PATH}`);

export default db;
export { COVERS_DIR, ROOT_DIR };
