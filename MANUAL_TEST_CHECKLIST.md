# MANUAL TEST CHECKLIST — RootFacts MVP

Pengujian berikut membutuhkan kamera fisik dan/atau browser interaktif, sehingga
**belum diuji otomatis** dan harus dijalankan manual sebelum submit.

## Persiapan

```bash
npm install
npm run build
npm run serve      # buka http://localhost:8080 (Chrome/Edge terbaru untuk WebGPU)
```

> Gunakan `npm run start-dev` untuk pengembangan. Jangan pakai Live Server VS Code.

## A. Kamera & Computer Vision

- [ ] Klik tombol scan → muncul dialog izin kamera.
- [ ] Izinkan → video tampil, placeholder hilang, overlay frame muncul.
- [ ] Tolak izin → pesan error tampil di UI (bukan hanya console).
- [ ] Dropdown kamera terisi perangkat; ganti kamera → stream berganti.
- [ ] Geser slider FPS (15/30/45/60) → label FPS berubah & laju deteksi menyesuaikan.
- [ ] Arahkan ke sayuran → label + confidence (%) tampil dan bar terisi.
- [ ] Setelah deteksi stabil: kamera **otomatis berhenti** (mode sekali jepret),
      hasil + confidence tetap tampil, lalu fun fact dibuat.
- [ ] Klik tombol scan saat memindai → kamera berhenti manual.
- [ ] Klik scan lagi → sesi pemindaian baru dimulai (fakta baru dibuat).

## B. Backend & Memori

- [ ] Badge "Vision: WebGPU" (atau "WebGL" bila WebGPU tak ada). Tidak ada error
      `Backend name 'webgpu' not found in registry` di console.
- [ ] Badge "Text AI: WebGPU" (atau "WASM").
- [ ] DevTools console: pantau `tf.memory().numTensors` selama scan berjalan —
      angka **stabil**, tidak bertambah tiap frame.

## C. Generative AI & Persona

- [ ] Setelah sayuran stabil terdeteksi → "Memuat fakta menarik..." lalu fun fact
      muncul, relevan dengan sayuran.
- [ ] Deteksi sayuran berbeda → fun fact berbeda (bukan teks statis yang sama).
- [ ] Ganti persona (Normal/Lucu/Profesional/Sejarah/Santai) → gaya fakta berubah.
- [ ] Klik tombol salin → ikon berubah "berhasil disalin", teks tersalin ke clipboard.
- [ ] Jika generasi gagal → pesan error + tombol "Coba lagi" berfungsi.

## D. PWA & Offline

- [ ] DevTools → Application → Manifest: nama, ikon, start_url, display standalone terdeteksi.
- [ ] DevTools → Application → Service Workers: `sw.js` **activated and running**.
- [ ] DevTools → Application → Cache Storage: `workbox-precache-*` berisi
      `models/model.json`, `models/metadata.json`, `models/weights.bin`, index.html, bundle, css.
- [ ] Aktifkan Offline (Network → Offline) → reload → aplikasi tetap terbuka (tidak blank/404).
- [ ] Offline → jalankan scan → deteksi Computer Vision tetap bekerja.
- [ ] Prompt install PWA muncul (atau menu "Install app") → aplikasi dapat dipasang.

## E. Deploy

- [ ] Deploy ke Netlify berhasil (HTTPS).
- [ ] Isi `STUDENT.txt` → `APP_URL=https://<subdomain>.netlify.app` (URL asli).
- [ ] Buka URL Netlify di HP → PWA installable, kamera & fun fact bekerja.
