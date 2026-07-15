const APP_CONFIG = {
  // Threshold ketat: objek baru dianggap "pasti" bila confidence >= 90%.
  detectionConfidenceThreshold: 90,
  analyzingDelay: 2000,
  factsGenerationDelay: 2000,
  detectionRetryInterval: 100,
  // Objek harus terdeteksi yakin & stabil (label sama) selama durasi ini
  // sebelum kamera auto-stop. Basis WAKTU, bukan jumlah frame, agar tidak
  // "langsung mati" (5 frame @30fps hanya ~0,17 detik).
  detectionHoldMs: 2000,
  // Minimal frame berturut-turut sebagai gerbang tambahan (anti-fluke).
  detectionStabilityCount: 3,
  // Selisih minimum antara kandidat teratas dan kedua (%). Memastikan model
  // benar-benar yakin pada satu objek, bukan menebak di antara dua yang mirip.
  detectionConfidenceMargin: 25,
};

const UI_CONFIG = {
  animationDuration: 300,
  fadeAnimation: "fadeIn 0.5s ease-out forwards",
  confidenceThresholds: {
    excellent: 90,
    good: 80,
  },
  factsCardOpacity: {
    loading: 0.6,
    normal: 1.0,
  },
};

// Konfigurasi kamera (MediaStream API) — dipakai CameraService & utils.
const CAMERA_CONFIG = {
  defaultFPS: 30,
  minFPS: 15,
  maxFPS: 60,
  // facingMode awal yang dipilih pada perangkat mobile.
  facingMode: "environment",
  // Constraints video ideal. Audio selalu false (tidak butuh mikrofon).
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  },
};

// Konfigurasi model Computer Vision (TensorFlow.js — Teachable Machine MobileNet).
// Path relatif terhadap root situs; file disalin ke dist/models oleh CopyWebpackPlugin.
const DETECTION_CONFIG = {
  modelUrl: "models/model.json",
  metadataUrl: "models/metadata.json",
  imageSize: 224,
  // Teachable Machine menormalkan pixel ke rentang [-1, 1] => (x / 127.5) - 1.
  normalization: { offset: 127.5, shift: -1 },
  // Crop input hanya ke area kotak hijau (overlay-frame `inset: 18%` di CSS).
  // Model MobileNet menilai seluruh gambar, jadi dengan meng-crop ke tengah,
  // deteksi hanya bereaksi pada objek yang berada di dalam kotak hijau.
  cropInset: 0.18,
};

// Konfigurasi Generative AI (Transformers.js).
// Model LaMini-Flan-T5 sesuai materi pelatihan (text2text-generation).
// dtype "q4" dipakai bila tersedia; RootFactsService melakukan fallback otomatis.
const GENAI_CONFIG = {
  // 783M untuk akurasi faktual lebih baik (LaMini-Flan-T5).
  model: "Xenova/LaMini-Flan-T5-783M",
  task: "text2text-generation",
  dtype: "q4",
  // Generasi dua tahap agar akurat & konsisten antar persona:
  //  - base: fakta inti, randomness rendah (temperature 0.3) = lebih faktual.
  //  - style: menuliskan ulang fakta base sesuai persona (tanpa mengubah fakta).
  generation: {
    base: {
      max_new_tokens: 80, // wajib <= 150
      min_new_tokens: 20,
      temperature: 0.3,
      top_p: 0.9,
      do_sample: true,
      repetition_penalty: 1.4,
      no_repeat_ngram_size: 3,
    },
    style: {
      max_new_tokens: 100, // wajib <= 150
      min_new_tokens: 20,
      temperature: 0.7,
      top_p: 0.9,
      do_sample: true,
      repetition_penalty: 1.4,
      no_repeat_ngram_size: 3,
    },
  },
};

// Persona / gaya penulisan dinamis. `instruction` selalu berbahasa Inggris
// (prompt Generative AI wajib bahasa Inggris), output tetap diminta bahasa Indonesia.
const PERSONA_CONFIG = {
  normal: {
    label: "Normal",
    instruction: "Neutral, informative, and concise.",
  },
  funny: {
    label: "Lucu",
    instruction:
      "Playful, light, and family-friendly, without offensive jokes.",
  },
  professional: {
    label: "Profesional",
    instruction: "Formal, factual, and concise.",
  },
  history: {
    label: "Sejarah",
    instruction:
      "Focus on culinary history, origin, or traditional use. Avoid unsupported claims.",
  },
  casual: {
    label: "Santai",
    instruction: "Friendly and conversational.",
  },
};

export {
  APP_CONFIG,
  UI_CONFIG,
  CAMERA_CONFIG,
  DETECTION_CONFIG,
  GENAI_CONFIG,
  PERSONA_CONFIG,
};
