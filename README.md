# RootFacts — Fakta Unik Sayuran AI (MVP)

Aplikasi Progressive Web App yang mengenali sayuran secara real-time melalui
kamera menggunakan **TensorFlow.js**, lalu menghasilkan _fun fact_ unik dengan
**Transformers.js** — seluruh inferensi berjalan **di dalam browser** (tanpa
server AI, tanpa API key).

Peserta: **Muhammad Fadhil Abdul Baasith** — baasith.dhil98@gmail.com

## Arsitektur (Model–View–Presenter)

```
src/scripts/
├─ services/                 # MODEL / SERVICES
│  ├─ camera.service.js      # MediaStream API (izin, enumerasi, FPS, start/stop)
│  ├─ detection.service.js   # TensorFlow.js: backend adaptif, preprocessing, prediksi, tensor
│  └─ rootfacts.service.js   # Transformers.js: pipeline, persona, prompt, generasi
├─ pages/
│  ├─ app.js                 # Router sederhana
│  └─ home/
│     ├─ home-page.js        # VIEW — struktur & metode UI
│     └─ home-presenter.js   # PRESENTER — orkestrasi service + view + event + lifecycle
├─ templates.js              # Template HTML view
├─ utils/index.js            # Helper murni (validasi, format, DOM helper)
└─ config.js                 # Konfigurasi terpusat (kamera, model, persona, generasi)
```

## Model AI

| Peran           | Model                                      | Sumber                  |
| --------------- | ------------------------------------------ | ----------------------- |
| Computer Vision | Teachable Machine MobileNet (`model.json`) | Lokal (`src/model`)     |
| Generative AI   | `Xenova/LaMini-Flan-T5-783M` (text2text)   | Hugging Face (di-cache) |

- **CV**: 18 label sayuran, imageSize 224, normalisasi `(x / 127.5) - 1`. Model,
  bobot, dan urutan label **tidak diubah**.
- **GenAI**: `dtype: "q4"` (fallback q8). Output bahasa Inggris (model
  LaMini-Flan-T5 paling akurat di Inggris; Indonesia opsional pada rubrik).
  Generasi **dua tahap** demi akurasi & konsistensi antar persona:
  1. **Fakta dasar** — `temperature 0.3`, faktual, di-cache per sesi deteksi.
  2. **Restyle** — menulis ulang fakta dasar sesuai persona tanpa mengubah
     faktanya (`temperature 0.7`). Ganti persona hanya menjalankan tahap 2.

  Semua tahap: `do_sample: true`, `top_p: 0.9`, `no_repeat_ngram_size: 3`,
  `repetition_penalty: 1.4`, `max_new_tokens ≤ 150`.

- **Deteksi**: hanya area **kotak hijau** yang diklasifikasi (crop `inset 18%`).
  Kamera **auto-stop** hanya bila objek terdeteksi yakin (≥90% + margin ≥25%)
  dan stabil **~2 detik** (dwell berbasis waktu), lalu fun fact dibuat.

## Backend Adaptif

- **Computer Vision (TensorFlow.js)**: `WebGPU → WebGL → CPU`. Backend WebGPU
  di-`import` langsung (`@tensorflow/tfjs-backend-webgpu`) sebelum `tf.setBackend`.
- **Generative AI (Transformers.js / ONNX Runtime Web)**: `WebGPU → WASM`.

Backend aktif ditampilkan di UI (badge _Vision_ dan _Text AI_).

## Manajemen Memori Tensor

Preprocessing + prediksi dibungkus `tf.tidy()`; tensor output dibaca lalu
`dispose()` di blok `finally`. Model di-`dispose()` saat lifecycle berakhir.
`tf.memory().numTensors` tidak bertambah tiap frame.

## Skrip

```bash
npm install
npm run start-dev     # server pengembangan (http://localhost:8080)
npm run build         # build produksi -> dist/ (Webpack + Workbox sw.js)
npm run serve         # menyajikan dist/
npm run lint          # ESLint
npm run prettier      # cek format
```

## PWA & Offline

- Manifest: `src/public/manifest.json` (display standalone, ikon 192 & 512).
- Service worker Workbox (`GenerateSW`) mem-precache aset inti + **model CV
  lokal** (`models/model.json`, `models/metadata.json`, `models/weights.bin`).
- Deteksi Computer Vision tetap berjalan **offline** setelah precache.

## Deployment (Netlify)

`netlify.toml` sudah tersedia (`build = npm run build`, `publish = dist`).
Setelah deploy, isi `STUDENT.txt` dengan URL asli:

```
APP_URL=https://<subdomain>.netlify.app
```
