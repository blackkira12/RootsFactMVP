const APP_CONFIG = {
  detectionConfidenceThreshold: 70,
  analyzingDelay: 2000,
  factsGenerationDelay: 2000,
  detectionRetryInterval: 100,
  // Berapa kali label valid yang sama harus muncul berturut-turut sebelum
  // dianggap stabil dan memicu generasi fun fact (mencegah generate tiap frame).
  detectionStabilityCount: 3,
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
};

// Konfigurasi Generative AI (Transformers.js).
// Model LaMini-Flan-T5 sesuai materi pelatihan (text2text-generation).
// dtype "q4" dipakai bila tersedia; RootFactsService melakukan fallback otomatis.
const GENAI_CONFIG = {
  model: "Xenova/LaMini-Flan-T5-248M",
  task: "text2text-generation",
  dtype: "q4",
  generation: {
    max_new_tokens: 80, // wajib <= 150
    temperature: 0.8,
    top_p: 0.9,
    do_sample: true,
    repetition_penalty: 1.3,
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
