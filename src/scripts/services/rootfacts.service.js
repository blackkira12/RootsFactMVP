import { pipeline, env } from "@huggingface/transformers";
import { GENAI_CONFIG, PERSONA_CONFIG } from "../config.js";
import { logError, isWebGPUSupported } from "../utils/index.js";

// Izinkan pengunduhan model dari Hugging Face Hub (bukan hanya model lokal).
env.allowRemoteModels = true;

/**
 * RootFactsService — Model/Service layer untuk Generative AI (Transformers.js).
 * Backend adaptif: WebGPU -> WASM (fallback). Menghasilkan fun fact unik
 * berdasarkan label sayuran yang dideteksi + persona. Tidak ada teks statis.
 */
class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = { ...GENAI_CONFIG };
    this.currentBackend = null;
    this.currentTone = "normal";
    this.loadingPromise = null;
    // Whitelist label — diisi dari metadata.json model CV oleh presenter.
    this.allowedLabels = new Set();
  }

  // Whitelist label valid berdasarkan metadata.json (mencegah prompt injection).
  setAllowedLabels(labels = []) {
    this.allowedLabels = new Set(
      labels.map((label) => label.toLowerCase().trim()),
    );
  }

  // Coba muat pipeline dengan device+dtype tertentu.
  async #tryLoad(device, dtype, onProgress) {
    // progress_callback Transformers.js melapor per-file (tokenizer, encoder,
    // decoder, dst) — masing-masing 0-100% — sehingga angka tampak melompat.
    // Agregasikan byte seluruh file dan jaga persentase tetap monoton naik.
    const files = new Map();
    let lastPercent = 0;

    return pipeline(this.config.task, this.config.model, {
      device,
      dtype,
      progress_callback: (data) => {
        if (data.status === "progress" && data.total) {
          files.set(data.file, {
            loaded: data.loaded || 0,
            total: data.total,
          });

          let loaded = 0;
          let total = 0;
          for (const file of files.values()) {
            loaded += file.loaded;
            total += file.total;
          }

          const percent = Math.min(100, Math.round((loaded / total) * 100));
          if (percent > lastPercent) {
            lastPercent = percent;
            onProgress(percent, `Memuat Text AI ${percent}%`);
          }
        } else if (data.status === "ready") {
          onProgress(100, "Text AI siap");
        }
      },
    });
  }

  // [Advance] Strategi Backend Adaptive untuk Generative AI: WebGPU -> WASM.
  // Transformers.js (ONNX Runtime Web) memakai WASM sebagai fallback, bukan WebGL.
  async #load(onProgress) {
    const { dtype } = this.config;

    // 1. Coba WebGPU + dtype q4 bila tersedia.
    if (isWebGPUSupported()) {
      try {
        onProgress(0, "Menyiapkan Text AI (WebGPU)");
        this.generator = await this.#tryLoad("webgpu", dtype, onProgress);
        this.currentBackend = "webgpu";
        return;
      } catch (error) {
        logError("Transformers.js WebGPU gagal, fallback ke WASM", error);
      }
    }

    // 2. Fallback WASM + dtype q4.
    try {
      onProgress(0, "Menyiapkan Text AI (WASM)");
      this.generator = await this.#tryLoad("wasm", dtype, onProgress);
      this.currentBackend = "wasm";
      return;
    } catch (error) {
      logError("Transformers.js WASM q4 gagal, mencoba dtype q8", error);
    }

    // 3. Fallback terakhir: WASM + q8 (bila dtype q4 tidak tersedia untuk model).
    this.generator = await this.#tryLoad("wasm", "q8", onProgress);
    this.currentBackend = "wasm";
  }

  // [Basic] Muat model & inisialisasi pipeline (singleton, hanya sekali).
  async loadModel(onProgress = () => {}) {
    if (this.isModelLoaded) return this.currentBackend;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      await this.#load(onProgress);
      this.isModelLoaded = true;
      return this.currentBackend;
    })();

    try {
      return await this.loadingPromise;
    } finally {
      this.loadingPromise = null;
    }
  }

  // [Advance] Konfigurasi tone/persona fakta yang dihasilkan.
  setTone(tone) {
    if (PERSONA_CONFIG[tone]) {
      this.currentTone = tone;
    }
    return this.currentTone;
  }

  // Sanitasi & validasi label terhadap whitelist metadata.
  #sanitizeLabel(vegetable) {
    if (typeof vegetable !== "string") return null;
    // Batasi panjang & buang karakter non-alfabet (cegah prompt injection).
    const cleaned = vegetable
      .trim()
      .slice(0, 40)
      .replace(/[^a-zA-Z\s-]/g, "");

    if (!cleaned) return null;

    // Tolak nilai yang tidak ada dalam metadata (bila whitelist tersedia).
    if (
      this.allowedLabels.size > 0 &&
      !this.allowedLabels.has(cleaned.toLowerCase())
    ) {
      return null;
    }
    return cleaned;
  }

  // Bangun prompt dinamis (bahasa Inggris) berdasarkan label + persona.
  #buildPrompt(vegetable, tone) {
    const persona = PERSONA_CONFIG[tone] || PERSONA_CONFIG.normal;
    return [
      `Write one short and accurate fun fact in Indonesian about the vegetable "${vegetable}".`,
      `The fun fact must be specifically about "${vegetable}" and mention "${vegetable}" by name.`,
      "Do not write about any other plant, fruit, or vegetable.",
      `Writing style: ${persona.instruction}`,
      "Use one or two concise sentences.",
      "Do not give medical advice.",
      "Do not invent numerical statistics.",
      "Do not include a heading.",
      "Return only the fun fact.",
    ].join("\n");
  }

  // Bersihkan output dari token khusus, prompt yang terulang, & baris kosong.
  #cleanOutput(text) {
    return text
      .replace(/<\/?s>|<pad>|<\/?unk>/gi, "")
      .replace(/^\s*(fun fact|fakta)\s*[:-]/i, "")
      .replace(/\n{2,}/g, "\n")
      .trim()
      .slice(0, 400);
  }

  // [Basic/Skilled/Advance] Hasilkan fun fact untuk label + tone.
  async generateFacts(vegetable, tone = this.currentTone) {
    if (!this.isReady()) {
      throw new Error("Model Generative AI belum siap.");
    }
    if (this.isGenerating) {
      // Hindari generasi paralel.
      throw new Error("Generasi sedang berjalan.");
    }

    const safeLabel = this.#sanitizeLabel(vegetable);
    if (!safeLabel) {
      throw new Error(`Label tidak valid atau di luar daftar: "${vegetable}".`);
    }

    const prompt = this.#buildPrompt(safeLabel, tone);
    this.isGenerating = true;

    try {
      const { generation } = this.config;
      const output = await this.generator(prompt, {
        max_new_tokens: Math.min(generation.max_new_tokens, 150),
        temperature: generation.temperature,
        top_p: generation.top_p,
        do_sample: generation.do_sample,
        repetition_penalty: generation.repetition_penalty,
      });

      const raw = Array.isArray(output)
        ? output[0]?.generated_text
        : output?.generated_text;

      const cleaned = this.#cleanOutput(raw || "");
      if (!cleaned) {
        throw new Error("Model tidak menghasilkan teks.");
      }
      return cleaned;
    } finally {
      this.isGenerating = false;
    }
  }

  getBackend() {
    return this.currentBackend;
  }

  // [Basic] Periksa apakah model siap digunakan.
  isReady() {
    return this.isModelLoaded && this.generator !== null;
  }
}

export default RootFactsService;
