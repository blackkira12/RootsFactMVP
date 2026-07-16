const APP_CONFIG = {
  // Ambang utama: sayuran dianggap terdeteksi bila confidence >= 80%.
  detectionConfidenceThreshold: 80,
  analyzingDelay: 2000,
  factsGenerationDelay: 2000,
  detectionRetryInterval: 100,
  // Objek harus terdeteksi yakin & stabil (label sama) selama ~1 detik
  // sebelum kamera auto-stop — cepat tapi tetap tidak salah picu sekejap.
  detectionHoldMs: 1000,
  // Minimal frame berturut-turut sebagai gerbang tambahan (anti-fluke).
  detectionStabilityCount: 3,
  // Selisih minimum antara kandidat teratas dan kedua (%) — memastikan model
  // condong ke satu objek, bukan ragu di antara dua yang mirip.
  detectionConfidenceMargin: 10,
  // Jaring pengaman: bila setelah durasi ini belum ada objek yang tembus 80%,
  // ambang dilonggarkan ke nilai fallback agar kamera DIJAMIN berhenti begitu
  // objek dikenali (objek marginal terkunci ~2,5 detik, bukan memindai lama).
  detectionFallbackAfterMs: 1500,
  detectionFallbackThreshold: 60,
  // Timeout keras: bila hingga durasi ini tidak ada sayuran yang terdeteksi
  // sama sekali, kamera dihentikan dengan pesan agar tidak memindai selamanya.
  detectionScanTimeoutMs: 15000,
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
  // Parameter generasi umum. temperature & top_p ditimpa per persona agar gaya
  // benar-benar berbeda (Lucu lebih kreatif, Profesional lebih terkendali).
  generation: {
    max_new_tokens: 100, // wajib <= 150
    min_new_tokens: 18,
    do_sample: true,
    repetition_penalty: 1.4,
    no_repeat_ngram_size: 3,
  },
};

// Persona / gaya penulisan dinamis (prompt wajib bahasa Inggris).
// `lead` = kalimat pembuka prompt yang menegaskan gaya; %V% diganti nama sayuran.
// `focus` = penekanan tambahan opsional. temperature/top_p disesuaikan per gaya
// agar output setiap persona jelas berbeda. Seluruh teks tetap dari model AI.
const PERSONA_CONFIG = {
  normal: {
    label: "Normal",
    lead: 'Write one interesting and accurate fun fact about the vegetable "%V%".',
    focus: "Keep it neutral, clear, and informative.",
    temperature: 0.5,
    top_p: 0.9,
  },
  funny: {
    label: "Lucu",
    lead: 'Write one funny and playful fun fact about the vegetable "%V%".',
    focus:
      "Make it humorous and light-hearted, like a witty joke, with a cheerful comedic tone. Keep it family-friendly.",
    temperature: 0.95,
    top_p: 0.95,
  },
  professional: {
    label: "Profesional",
    lead: 'Write one fun fact about the vegetable "%V%" in a formal, professional, scientific tone.',
    focus:
      "Use precise and technical language, as if written for an encyclopedia.",
    temperature: 0.3,
    top_p: 0.9,
  },
  history: {
    label: "Sejarah",
    lead: 'Write one fun fact about the historical origin, cultural background, or traditional culinary use of the vegetable "%V%".',
    focus: "Focus on its history and origin.",
    temperature: 0.6,
    top_p: 0.9,
  },
  casual: {
    label: "Santai",
    lead: 'Write one relaxed, friendly, and conversational fun fact about the vegetable "%V%".',
    focus: "Write it like you are casually chatting with a friend.",
    temperature: 0.85,
    top_p: 0.95,
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
