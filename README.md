# MusikLokal 🎵

**Manajer koleksi metadata lagu Spotify untuk pemakaian pribadi.**

MusikLokal membantu kamu menyimpan metadata lagu/playlist Spotify (judul, artis, album, durasi, cover) dan melacak status download offline-nya. Aplikasi **hanya mengelola metadata** — download offline tetap dilakukan manual di aplikasi Spotify Premium.

> ⚠️ Aplikasi ini **tidak** mengunduh, merekam, atau mengekstrak audio dari Spotify maupun sumber lain.

---

## Tampilan

- 🌙 Dark mode (default) / ☀️ Light mode — tersimpan otomatis
- 🃏 Kartu lagu responsif dengan cover art
- 🔍 Pencarian real-time + filter status
- 📥 Export koleksi ke JSON atau CSV

---

## Prasyarat

- Node.js v18 atau lebih baru
- npm
- Akun Spotify (gratis cukup untuk mendaftarkan app developer)

---

## Langkah 1 — Buat App di Spotify Developer Dashboard

1. Kunjungi [https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Login dengan akun Spotify-mu
3. Klik **"Create app"**
4. Isi formulir:
   - **App name**: MusikLokal (atau nama lain sesukamu)
   - **App description**: Manajer koleksi metadata pribadi
   - **Redirect URIs**: `http://localhost:3000` (wajib diisi, meski tidak dipakai di alur ini)
   - **Which API/SDKs are you planning to use?**: Centang **Web API**
5. Setujui Terms of Service → klik **Save**
6. Di halaman app-mu, klik **Settings**
7. Salin **Client ID** dan klik "View client secret" untuk menyalin **Client Secret**

---

## Langkah 2 — Install & Konfigurasi

```bash
# Clone / download project
cd web-spotify-download

# Install dependensi
npm install

# Buat file .env dari template
cp .env.example .env
```

Edit file `.env` dan isi dengan kredensial yang sudah kamu salin:

```env
SPOTIFY_CLIENT_ID=client_id_kamu_disini
SPOTIFY_CLIENT_SECRET=client_secret_kamu_disini
PORT=3000
```

---

## Langkah 3 — Jalankan Aplikasi

```bash
npm start
```

Buka browser dan akses: **http://localhost:3000**

Untuk development (auto-restart saat ada perubahan file):

```bash
npm run dev
```

---

## Cara Penggunaan

### Tambah Lagu
1. Salin link track atau playlist dari Spotify
2. Tempel di kolom input → klik **Tambah**
3. Metadata dan cover diambil otomatis dari Spotify API

Format link yang didukung:
- `https://open.spotify.com/track/ID`
- `https://open.spotify.com/playlist/ID`
- `spotify:track:ID`
- `spotify:playlist:ID`

### Tandai Status Download
- Klik checkbox **"Sudah didownload"** di kartu lagu untuk menandai lagu yang sudah kamu download di Spotify Premium
- Status tersimpan di database lokal

### Buka di Spotify
- **Ikon bulat di cover** → buka langsung di aplikasi Spotify (via URI `spotify:track:ID`)
- **Tombol "Buka"** → buka di browser web Spotify

### Hapus Lagu
- Klik ikon 🗑 → konfirmasi penghapusan
- Data di database dan file cover lokal ikut terhapus

### Export
- **JSON**: Format terstruktur untuk backup/integrasi
- **CSV**: Bisa dibuka di Excel/Google Sheets (sudah ada BOM untuk kompatibilitas)

---

## Struktur Folder

```
web-spotify-download/
├── server.js           # Entry point Express
├── db/database.js      # Schema SQLite
├── routes/
│   ├── songs.js        # CRUD lagu
│   └── export.js       # Export CSV/JSON
├── services/
│   ├── spotifyService.js  # Spotify API + token cache
│   └── coverService.js    # Download cover art
├── public/             # Frontend statis
│   ├── index.html
│   ├── style.css
│   └── app.js
└── data/               # Dibuat otomatis (tidak di-commit)
    ├── koleksi.db
    └── covers/
```

---

## Catatan Penting

### preview_url bisa kosong
Spotify API terkadang mengembalikan `preview_url = null` untuk track tertentu, terutama di wilayah tertentu atau untuk lagu yang belum dirilis. Ini adalah keterbatasan dari API Spotify, bukan bug aplikasi. Metadata lainnya (judul, artis, album, cover) tetap tersedia.

### Akses API dapat berubah
Kebijakan dan endpoint Spotify Web API dapat berubah sewaktu-waktu. Jika fitur tertentu berhenti berfungsi, cek dokumentasi resmi di [developer.spotify.com/documentation/web-api](https://developer.spotify.com/documentation/web-api) untuk pembaruan.

### Client Credentials Flow
Alur autentikasi yang digunakan adalah **Client Credentials**, yang hanya memberi akses ke data publik Spotify (metadata track/playlist publik). Playlist privat tidak dapat diakses.

### Rate Limit
Spotify API memiliki rate limit. Jika kamu menambahkan banyak playlist sekaligus, mungkin terkena limit sementara (error 429). Tunggu beberapa menit sebelum mencoba lagi.

---

## API Endpoints

| Method | URL | Deskripsi |
|--------|-----|-----------|
| `POST` | `/api/songs` | Tambah dari link Spotify |
| `GET` | `/api/songs` | Daftar lagu (`?search=&filter=all\|downloaded\|pending`) |
| `PATCH` | `/api/songs/:id/downloaded` | Toggle status download |
| `DELETE` | `/api/songs/:id` | Hapus lagu |
| `GET` | `/api/export` | Export (`?format=json\|csv`) |
| `GET` | `/api/health` | Cek status server |

---

## Lisensi

MIT — gunakan bebas untuk keperluan pribadi.
