# Nusantara Grand Prix 3D

Game balap 3D berbasis browser menggunakan Three.js dan Tailwind CSS melalui CDN.

## Struktur proyek

```text
.
├── index.html              # Struktur antarmuka dan entry point game
├── src/
│   ├── css/
│   │   └── styles.css      # Gaya global dan komponen HUD
│   └── js/
│       └── game.js         # Logika game, renderer, fisika, AI, audio, dan UI
└── README.md
```

## Menjalankan game

Buka `index.html` langsung di browser, atau jalankan server statis dari folder proyek, misalnya:

```bash
python3 -m http.server 8000
```

Lalu buka `http://localhost:8000`.

Koneksi internet diperlukan untuk memuat Tailwind CSS, Google Fonts, dan Three.js dari CDN.
## Bermain di handphone

1. Buka game melalui browser modern di Android atau iPhone.
2. Tekan **Mulai Balapan**; game akan mencoba masuk layar penuh dan lanskap jika browser mendukungnya.
3. Gunakan dua jempol secara bersamaan: tombol arah di kiri serta gas, rem/drift, dan nitro di kanan.
4. Jika rotasi otomatis diblokir browser, putar handphone secara manual. Mode potret tetap dapat dipakai melalui tombol **Tetap Main Potret**.
