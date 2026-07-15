# REVIEWER CHECKLIST — RootFacts MVP

Status: ✅ terverifikasi otomatis · 🟡 perlu uji manual (butuh kamera/perangkat)

## KRITERIA 1 — Computer Vision (Advanced)

| Kriteria                        | Level    | Implementasi                                                 | File                                     | Class/Function                                    | Cara menguji                          | Status |
| ------------------------------- | -------- | ------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------- | ------------------------------------- | ------ |
| MediaStream API                 | Basic    | `getUserMedia`, `enumerateDevices`, constraints, audio:false | `services/camera.service.js`             | `startCamera`, `loadCameras`, `#buildConstraints` | Klik tombol scan, izinkan kamera      | 🟡     |
| Izin kamera & error             | Basic    | Tangani NotAllowed/NotFound/NotReadable/Overconstrained      | `camera.service.js`, `utils/index.js`    | `startCamera`, `getCameraErrorMessage`            | Tolak izin → pesan error tampil di UI | 🟡     |
| Streaming kamera start/stop     | Basic    | play/stop track, cleanup srcObject                           | `camera.service.js`                      | `startCamera`, `stopCamera`, `isActive`           | Tombol toggle                         | 🟡     |
| Pergantian kamera               | Basic    | deviceId exact / facingMode                                  | `camera.service.js`                      | `#buildConstraints`                               | Pilih dropdown kamera                 | 🟡     |
| Model TensorFlow.js dimuat      | Basic    | `tf.loadLayersModel` + metadata                              | `services/detection.service.js`          | `loadModel`                                       | Status "Model deteksi siap"           | ✅     |
| Label + confidence tampil       | Basic    | prediksi terurut, ditampilkan                                | `detection.service.js`, `home-page.js`   | `predict`, `renderDetection`                      | Arahkan ke sayuran                    | 🟡     |
| FPS limit                       | Skilled  | applyConstraints + throttle rAF                              | `camera.service.js`, `home-presenter.js` | `setFPS`, `#detectionLoop`                        | Geser slider FPS                      | ✅/🟡  |
| Loading percentage              | Advanced | `onProgress` callback %                                      | `detection.service.js`                   | `loadModel(onProgress)`                           | Muat ulang, lihat status %            | ✅     |
| `navigator.gpu` check           | Advanced | cek sebelum setBackend                                       | `detection.service.js`                   | `#setupBackend`                                   | —                                     | ✅     |
| import tfjs-backend-webgpu      | Advanced | import backend nyata                                         | `detection.service.js` (baris atas)      | —                                                 | Tidak ada error "webgpu not found"    | ✅     |
| WebGPU → WebGL fallback         | Advanced | urutan backend adaptif                                       | `detection.service.js`                   | `#setupBackend`                                   | Badge "Vision: WebGPU/WebGL"          | ✅     |
| tf.tidy / dispose tiap prediksi | Advanced | tidy + dispose finally                                       | `detection.service.js`                   | `#preprocess`, `predict`                          | `tf.memory().numTensors` stabil       | ✅/🟡  |
| Arsitektur MVP                  | Advanced | Service/View/Presenter terpisah                              | seluruh `scripts/`                       | —                                                 | Tinjau struktur                       | ✅     |

## KRITERIA 2 — Generative AI (Advanced)

| Kriteria                            | Level    | Implementasi                           | File                            | Class/Function                       | Cara menguji                    | Status |
| ----------------------------------- | -------- | -------------------------------------- | ------------------------------- | ------------------------------------ | ------------------------------- | ------ |
| Label → prompt dinamis              | Basic    | label deteksi jadi input prompt        | `services/rootfacts.service.js` | `#buildPrompt`, `generateFacts`      | Deteksi berbeda → fakta berbeda | 🟡     |
| Prompt bahasa Inggris               | Advanced | instruksi Inggris, output Indonesia    | `rootfacts.service.js`          | `#buildPrompt`                       | Tinjau kode                     | ✅     |
| Transformers.js lokal (bukan cloud) | Advanced | pipeline `@huggingface/transformers`   | `rootfacts.service.js`          | `#tryLoad`                           | Tidak ada fetch API cloud       | ✅     |
| Bukan teks statis                   | Advanced | tidak ada fun fact hard-coded          | `rootfacts.service.js`          | `generateFacts`                      | Grep: tidak ada array fakta     | ✅     |
| Parameter generasi                  | Skilled  | temperature/top_p/do_sample            | `config.js`                     | `GENAI_CONFIG.generation`            | Tinjau kode                     | ✅     |
| max_new_tokens ≤ 150                | Skilled  | 80 (di-clamp `Math.min(...,150)`)      | `rootfacts.service.js`          | `generateFacts`                      | Tinjau kode                     | ✅     |
| dtype q4                            | Advanced | q4 + fallback q8                       | `rootfacts.service.js`          | `#load`                              | Tinjau kode                     | ✅     |
| Copy to Clipboard                   | Advanced | writeText + fallback + feedback        | `home-presenter.js`             | `#onCopy`                            | Klik tombol salin               | 🟡     |
| Persona dinamis (5)                 | Advanced | Normal/Lucu/Profesional/Sejarah/Santai | `config.js`, `templates.js`     | `PERSONA_CONFIG`                     | Ganti dropdown → gaya berbeda   | ✅/🟡  |
| `navigator.gpu` check (GenAI)       | Advanced | cek sebelum device webgpu              | `rootfacts.service.js`          | `#load`, `isWebGPUSupported`         | —                               | ✅     |
| WebGPU → WASM fallback              | Advanced | fallback valid Transformers.js         | `rootfacts.service.js`          | `#load`                              | Badge "Text AI: WebGPU/WASM"    | ✅     |
| Sanitasi & whitelist label          | Skilled  | validasi vs metadata, batas panjang    | `rootfacts.service.js`          | `#sanitizeLabel`, `setAllowedLabels` | Tinjau kode                     | ✅     |

## KRITERIA 3 — PWA / Offline / Lint / Netlify (Advanced)

| Kriteria                   | Level    | Implementasi                              | File                                    | Cara menguji                      | Status     |
| -------------------------- | -------- | ----------------------------------------- | --------------------------------------- | --------------------------------- | ---------- |
| Web App Manifest valid     | Skilled  | id, name, ikon, standalone, id-ID         | `src/public/manifest.json`              | DevTools → Application → Manifest | ✅         |
| Manifest ter-link          | Skilled  | `<link rel="manifest">`                   | `src/index.html`                        | View source                       | ✅         |
| Service worker aktif       | Skilled  | GenerateSW + registrasi                   | `webpack.prod.js`, `scripts/index.js`   | DevTools → Service Workers        | ✅/🟡      |
| Workbox precache aset inti | Skilled  | html/js/css/manifest/ikon                 | `webpack.prod.js`                       | Lihat `dist/sw.js`                | ✅         |
| ESLint                     | Skilled  | flat config + script lint                 | `eslint.config.mjs`, `package.json`     | `npm run lint` (0 masalah)        | ✅         |
| Installable PWA            | Advanced | manifest+SW+ikon+HTTPS                    | —                                       | Netlify → Install                 | 🟡         |
| model.json precache        | Advanced | `models/model.json` di sw.js              | `webpack.prod.js`                       | grep sw.js                        | ✅         |
| metadata.json precache     | Advanced | `models/metadata.json` di sw.js           | `webpack.prod.js`                       | grep sw.js                        | ✅         |
| weights.bin precache       | Advanced | `models/weights.bin` (naikkan limit 30MB) | `webpack.prod.js`                       | grep sw.js                        | ✅         |
| Deteksi CV offline         | Advanced | model lokal ter-precache                  | `webpack.common.js` (CopyWebpackPlugin) | Offline reload → scan             | 🟡         |
| URL Netlify di STUDENT.txt | Advanced | isi setelah deploy                        | `STUDENT.txt`                           | —                                 | 🟡 (WAJIB) |

## Bukti otomatis yang sudah dijalankan

- `npm run lint` → **0 error, 0 warning**
- `npm run prettier` → **All matched files use Prettier code style**
- `npm run build` → sukses; `GenerateSW: 11 URLs, 4.54 MB`
- `grep sw.js` → `models/model.json`, `models/metadata.json`, `models/weights.bin` **ada di precache**
- `npm run serve` → semua aset (index, bundle, sw.js, manifest, model, ikon) **HTTP 200**
- Browser (dev): status "Siap memindai", **Vision: WebGPU**, **Text AI: WebGPU** — kedua model termuat tanpa error registry.
