/**
 * public/app.js
 * Frontend MusikLokal — Vanilla JavaScript
 * Mengelola interaksi UI: tambah lagu, tampilkan koleksi, search/filter, export.
 */

// ── State Aplikasi ─────────────────────────────────────────────────────────
const state = {
  songs: [],
  filter: 'all',
  search: ''
};

// ── Referensi Elemen DOM ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const linkInput      = $('link-input');
const addBtn         = $('add-btn');
const addStatus      = $('add-status');
const searchInput    = $('search-input');
const filterBtns     = document.querySelectorAll('.filter-btn');
const songGrid       = $('song-grid');
const totalCounter   = $('total-counter');
const exportJsonBtn  = $('export-json');
const exportCsvBtn   = $('export-csv');
const themeToggle    = $('theme-toggle');
const loadingOverlay = $('loading-overlay');

// ── Helper: Format Durasi ──────────────────────────────────────────────────
function formatDurasi(ms) {
  if (!ms) return '–';
  const totalDetik = Math.floor(ms / 1000);
  const menit = Math.floor(totalDetik / 60);
  const detik = totalDetik % 60;
  return `${menit}:${detik.toString().padStart(2, '0')}`;
}

// ── Helper: Tampilkan Pesan Status ─────────────────────────────────────────
function tampilkanStatus(elemen, pesan, tipe = 'info') {
  elemen.textContent = pesan;
  elemen.className = `status-msg status-${tipe}`;
  elemen.classList.remove('hidden');
  if (tipe === 'success') {
    setTimeout(() => elemen.classList.add('hidden'), 5000);
  }
}

function sembunyikanStatus(elemen) {
  elemen.classList.add('hidden');
}

// ── Helper: Loading Overlay ────────────────────────────────────────────────
function tampilkanLoading(teks = 'Mengambil metadata dari Spotify...') {
  $('loading-text').textContent = teks;
  loadingOverlay.classList.remove('hidden');
  loadingOverlay.classList.add('visible');
}

function sembunyikanLoading() {
  loadingOverlay.classList.remove('visible');
  setTimeout(() => loadingOverlay.classList.add('hidden'), 300);
}

// ── Tema Gelap / Terang ────────────────────────────────────────────────────
function initTema() {
  const tersimpan = localStorage.getItem('tema') || 'dark';
  terapkanTema(tersimpan);
}

function terapkanTema(tema) {
  document.documentElement.setAttribute('data-tema', tema);
  themeToggle.innerHTML = tema === 'dark'
    ? '<svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>';
  localStorage.setItem('tema', tema);
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-tema');
  terapkanTema(current === 'dark' ? 'light' : 'dark');
});

// ── Tambah Lagu dari Link Spotify ──────────────────────────────────────────
async function tambahLagu() {
  const link = linkInput.value.trim();
  if (!link) {
    tampilkanStatus(addStatus, 'Masukkan link Spotify terlebih dahulu.', 'error');
    return;
  }

  addBtn.disabled = true;
  linkInput.disabled = true;
  sembunyikanStatus(addStatus);

  // Deteksi playlist untuk pesan loading yang lebih informatif
  const isPlaylist = link.includes('/playlist/') || link.includes('playlist:');
  tampilkanLoading(isPlaylist
    ? 'Mengambil semua lagu dari playlist...'
    : 'Mengambil metadata dari Spotify...'
  );

  try {
    const resp = await fetch('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link })
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || 'Terjadi kesalahan tidak diketahui.');
    }

    tampilkanStatus(addStatus, `✓ ${data.message}`, 'success');
    linkInput.value = '';
    await muatKoleksi();

  } catch (err) {
    tampilkanStatus(addStatus, `✗ ${err.message}`, 'error');
  } finally {
    addBtn.disabled = false;
    linkInput.disabled = false;
    sembunyikanLoading();
  }
}

// Event listeners untuk form tambah lagu
addBtn.addEventListener('click', tambahLagu);
linkInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') tambahLagu();
});

// ── Muat & Render Koleksi ──────────────────────────────────────────────────
async function muatKoleksi() {
  const params = new URLSearchParams({
    filter: state.filter,
    search: state.search
  });

  try {
    const resp = await fetch(`/api/songs?${params}`);
    const data = await resp.json();

    if (!resp.ok) throw new Error(data.error);

    state.songs = data.songs;
    renderKoleksi();
    totalCounter.textContent = `${data.total} lagu`;
  } catch (err) {
    console.error('[App] Gagal memuat koleksi:', err.message);
    songGrid.innerHTML = `<div class="empty-state"><p>Gagal memuat koleksi: ${err.message}</p></div>`;
  }
}

function renderKoleksi() {
  if (state.songs.length === 0) {
    const pesanKosong = state.search || state.filter !== 'all'
      ? 'Tidak ada lagu yang cocok dengan pencarian/filter.'
      : 'Koleksi masih kosong. Tambahkan lagu dari link Spotify!';

    songGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎵</div>
        <p>${pesanKosong}</p>
      </div>`;
    return;
  }

  songGrid.innerHTML = state.songs.map(song => buatKartuLagu(song)).join('');

  // Pasang event listeners untuk setiap kartu
  state.songs.forEach(song => {
    // Checkbox downloaded
    const checkbox = $(`chk-${song.id}`);
    if (checkbox) {
      checkbox.addEventListener('change', () => toggleDownloaded(song.id));
    }

    // Tombol hapus
    const hapusBtn = $(`hapus-${song.id}`);
    if (hapusBtn) {
      hapusBtn.addEventListener('click', () => hapusLagu(song.id, song.title));
    }
  });
}

function buatKartuLagu(song) {
  const coverSrc = song.cover_path
    ? song.cover_path
    : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231a1a2e"/><text y=".9em" font-size="60" x="20">🎵</text></svg>';

  const durasiStr = formatDurasi(song.duration_ms);
  const isDownloaded = song.is_downloaded === 1;

  // Buat Spotify URI untuk tombol buka di Spotify
  const spotifyUri = `spotify:track:${song.spotify_id}`;

  return `
    <article class="song-card ${isDownloaded ? 'is-downloaded' : ''}" id="card-${song.id}">
      <div class="cover-wrap">
        <img
          class="cover-img"
          src="${coverSrc}"
          alt="Cover ${escapeHtml(song.title)}"
          loading="lazy"
          onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'><rect width=\\'100\\' height=\\'100\\' fill=\\'%231a1a2e\\'/><text y=\\'.9em\\' font-size=\\'60\\' x=\\'20\\'>🎵</text></svg>'"
        />
        <div class="cover-overlay">
          <a href="${spotifyUri}" class="btn-spotify-uri" title="Buka di Spotify">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
          </a>
        </div>
      </div>

      <div class="card-body">
        <h3 class="song-title" title="${escapeHtml(song.title)}">${escapeHtml(song.title)}</h3>
        <p class="song-artist">${escapeHtml(song.artist)}</p>
        <p class="song-album">📀 ${escapeHtml(song.album || '–')}</p>
        <p class="song-duration">⏱ ${durasiStr}</p>

        <div class="card-actions">
          <label class="download-label ${isDownloaded ? 'checked' : ''}">
            <input type="checkbox" id="chk-${song.id}" ${isDownloaded ? 'checked' : ''} />
            <span class="checkmark"></span>
            <span class="dl-text">${isDownloaded ? 'Sudah didownload' : 'Belum didownload'}</span>
          </label>

          <div class="btn-group">
            <a href="${song.spotify_url}" target="_blank" rel="noopener" class="btn btn-spotify" title="Buka di browser">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
              Buka
            </a>
            <button class="btn btn-hapus" id="hapus-${song.id}" title="Hapus lagu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>
      </div>

      ${isDownloaded ? '<div class="downloaded-badge">✓ Downloaded</div>' : ''}
    </article>
  `;
}

// Escape HTML untuk mencegah XSS
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Toggle Status Downloaded ───────────────────────────────────────────────
async function toggleDownloaded(id) {
  try {
    const resp = await fetch(`/api/songs/${id}/downloaded`, { method: 'PATCH' });
    const data = await resp.json();

    if (!resp.ok) throw new Error(data.error);

    // Update state lokal dan re-render kartu yang bersangkutan
    const idx = state.songs.findIndex(s => s.id === id);
    if (idx !== -1) {
      state.songs[idx].is_downloaded = data.is_downloaded;

      // Update visual kartu tanpa full reload
      const kartu = $(`card-${id}`);
      const label = kartu?.querySelector('.download-label');
      const dlText = kartu?.querySelector('.dl-text');
      const badge = kartu?.querySelector('.downloaded-badge');

      if (data.is_downloaded === 1) {
        kartu?.classList.add('is-downloaded');
        label?.classList.add('checked');
        if (dlText) dlText.textContent = 'Sudah didownload';
        if (!badge) {
          const badgeEl = document.createElement('div');
          badgeEl.className = 'downloaded-badge';
          badgeEl.textContent = '✓ Downloaded';
          kartu?.appendChild(badgeEl);
        }
      } else {
        kartu?.classList.remove('is-downloaded');
        label?.classList.remove('checked');
        if (dlText) dlText.textContent = 'Belum didownload';
        badge?.remove();
      }
    }
  } catch (err) {
    console.error('[App] Gagal toggle downloaded:', err.message);
    alert(`Gagal memperbarui status: ${err.message}`);
    await muatKoleksi(); // Reload untuk sinkronisasi
  }
}

// ── Hapus Lagu ─────────────────────────────────────────────────────────────
async function hapusLagu(id, judul) {
  if (!confirm(`Hapus "${judul}" dari koleksi?\n\nTindakan ini tidak bisa dibatalkan.`)) return;

  try {
    const resp = await fetch(`/api/songs/${id}`, { method: 'DELETE' });
    const data = await resp.json();

    if (!resp.ok) throw new Error(data.error);

    // Animasi hilang sebelum hapus dari DOM
    const kartu = $(`card-${id}`);
    if (kartu) {
      kartu.style.transition = 'opacity 0.3s, transform 0.3s';
      kartu.style.opacity = '0';
      kartu.style.transform = 'scale(0.95)';
      setTimeout(() => {
        state.songs = state.songs.filter(s => s.id !== id);
        renderKoleksi();
        totalCounter.textContent = `${state.songs.length} lagu`;
      }, 300);
    }

  } catch (err) {
    console.error('[App] Gagal hapus:', err.message);
    alert(`Gagal menghapus: ${err.message}`);
  }
}

// ── Search & Filter ────────────────────────────────────────────────────────
let searchTimeout;
searchInput.addEventListener('input', e => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    state.search = e.target.value;
    muatKoleksi();
  }, 400); // Debounce 400ms
});

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.dataset.filter;
    muatKoleksi();
  });
});

// ── Export ─────────────────────────────────────────────────────────────────
exportJsonBtn.addEventListener('click', () => {
  window.open('/api/export?format=json', '_blank');
});

exportCsvBtn.addEventListener('click', () => {
  window.open('/api/export?format=csv', '_blank');
});

// ── Inisialisasi Aplikasi ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTema();
  muatKoleksi();
});
