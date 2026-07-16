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
    // Cache hasil per "sayuran|persona" dalam satu sesi agar memilih persona
    // yang sama tidak menghasilkan ulang (dan tetap konsisten).
    this.factCache = new Map();
  }

  // Reset cache (dipanggil presenter saat mulai scan baru) sehingga setiap
  // sesi deteksi menghasilkan fun fact segar.
  resetContext() {
    this.factCache.clear();
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

  // Prompt dinamis per persona (bahasa Inggris). Gaya ditegaskan di kalimat
  // pembuka + fokus, sehingga tiap persona menghasilkan gaya yang jelas berbeda.
  #buildPrompt(vegetable, tone) {
    const persona = PERSONA_CONFIG[tone] || PERSONA_CONFIG.normal;
    const lead = persona.lead.replaceAll("%V%", vegetable);
    return [
      lead,
      persona.focus,
      `The fun fact must be specifically about "${vegetable}", not any other plant.`,
      "Use one or two short sentences. Do not repeat words or phrases.",
      "Do not give medical advice. Do not invent numerical statistics.",
      "Return only the fun fact.",
    ].join(" ");
  }

  // Bersihkan output dari token khusus, label meta, & baris kosong.
  #cleanOutput(text) {
    return (
      text
        .replace(/<\/?s>|<pad>|<\/?unk>/gi, "")
        // Buang label meta yang kadang bocor dari instruksi restyle.
        .replace(/(-\s*)?(rewritten\s+)?fun\s*fact\s*[:-]\s*/gi, "")
        .replace(/^\s*fakta\s*[:-]\s*/i, "")
        .replace(/^["']|["']$/g, "")
        .replace(/\n{2,}/g, "\n")
        .trim()
        .slice(0, 400)
    );
  }

  // Jalankan pipeline sekali dengan parameter tertentu, kembalikan teks bersih.
  async #run(prompt, params) {
    const output = await this.generator(prompt, {
      max_new_tokens: Math.min(params.max_new_tokens, 150),
      min_new_tokens: params.min_new_tokens,
      temperature: params.temperature,
      top_p: params.top_p,
      do_sample: params.do_sample,
      repetition_penalty: params.repetition_penalty,
      no_repeat_ngram_size: params.no_repeat_ngram_size,
    });
    const raw = Array.isArray(output)
      ? output[0]?.generated_text
      : output?.generated_text;
    return this.#cleanOutput(raw || "");
  }

  // [Basic/Skilled/Advance] Hasilkan fun fact untuk label + tone.
  // Generasi langsung per persona dengan prompt & parameter khas gaya masing-
  // masing, sehingga tiap persona menghasilkan gaya yang jelas berbeda.
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

    const persona = PERSONA_CONFIG[tone] || PERSONA_CONFIG.normal;
    const cacheKey = `${safeLabel}|${tone}`;
    if (this.factCache.has(cacheKey)) {
      return this.factCache.get(cacheKey);
    }

    this.isGenerating = true;
    try {
      const fact = await this.#run(this.#buildPrompt(safeLabel, tone), {
        ...this.config.generation,
        temperature: persona.temperature,
        top_p: persona.top_p,
      });
      if (!fact) {
        throw new Error("Model tidak menghasilkan teks.");
      }
      this.factCache.set(cacheKey, fact);
      return fact;
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
