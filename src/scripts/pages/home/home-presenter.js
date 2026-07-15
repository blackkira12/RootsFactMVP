import { APP_CONFIG, CAMERA_CONFIG } from "../../config.js";
import {
  isValidDetection,
  getCameraErrorMessage,
  logError,
} from "../../utils/index.js";

/**
 * HomePresenter — lapisan Presenter (MVP).
 * Menghubungkan CameraService, DetectionService, RootFactsService, dan View.
 * Seluruh logika event, detection loop, stabilisasi, dan state generasi
 * berada di sini; View hanya menampilkan, Service hanya menghitung.
 */
export default class HomePresenter {
  #view;
  #camera;
  #detection;
  #rootFacts;

  #isScanning = false;
  #isPredicting = false;
  #rafId = null;
  #lastFrameTime = 0;

  // Stabilisasi hasil deteksi.
  #stableLabel = null;
  #stableCount = 0;
  #generatedLabel = null;

  // Penghalusan tampilan confidence (EMA) + pembatasan frekuensi update UI
  // agar angka tidak melonjak-lonjak setiap frame.
  #displayConfidence = 0;
  #lastDisplayLabel = null;
  #lastUiUpdate = 0;

  constructor({ view, cameraService, detectionService, rootFactsService }) {
    this.#view = view;
    this.#camera = cameraService;
    this.#detection = detectionService;
    this.#rootFacts = rootFactsService;
  }

  async init() {
    this.#bindEvents();
    this.#camera.initializeElements("media-video", "media-canvas");
    await this.#loadModels();
  }

  #bindEvents() {
    const el = this.#view.elements;

    el.btnToggle?.addEventListener("click", () => this.#toggleScan());
    el.cameraSelect?.addEventListener("change", () => this.#onCameraChange());
    el.fpsSlider?.addEventListener("input", (e) =>
      this.#onFPSChange(Number(e.target.value)),
    );
    el.toneSelect?.addEventListener("change", (e) =>
      this.#onToneChange(e.target.value),
    );
    el.btnCopy?.addEventListener("click", () => this.#onCopy());
    el.btnRetry?.addEventListener("click", () => this.#regenerate());

    // Lifecycle cleanup.
    window.addEventListener("beforeunload", () => this.destroy());
  }

  async #loadModels() {
    // 1. Model Computer Vision (wajib untuk deteksi offline).
    try {
      this.#view.setStatus("Memuat model AI...", { active: false });
      const { backend, labels } = await this.#detection.loadModel(
        (percent, text) => this.#view.setStatus(text, { active: false }),
      );
      this.#view.setVisionBackend(this.#backendLabel(backend));
      this.#rootFacts.setAllowedLabels(labels);
    } catch (error) {
      logError("Gagal memuat model deteksi", error);
      this.#view.setStatus("Gagal memuat model deteksi", { active: false });
      this.#view.showCameraError(
        "Model deteksi gagal dimuat. Muat ulang halaman.",
      );
      return;
    }

    // 2. Model Generative AI (dimuat di latar; deteksi tetap bisa jalan).
    this.#view.setStatus("Memuat model AI...", { active: false });
    this.#rootFacts
      .loadModel((percent, text) =>
        this.#view.setStatus(text, { active: false }),
      )
      .then((backend) => {
        this.#view.setTextBackend(this.#backendLabel(backend));
        this.#view.setStatus("Siap", { active: false });
      })
      .catch((error) => {
        logError("Gagal memuat model Generative AI", error);
        this.#view.setTextBackend("gagal");
        this.#view.setStatus("Text AI gagal dimuat", { active: false });
      });

    this.#view.setStatus("Siap", { active: false });
  }

  #backendLabel(backend) {
    if (!backend) return "—";
    if (backend === "webgpu") return "WebGPU";
    if (backend === "webgl") return "WebGL";
    if (backend === "wasm") return "WASM";
    return backend.toUpperCase();
  }

  async #toggleScan() {
    if (this.#isScanning) {
      this.#stopScan();
    } else {
      await this.#startScan();
    }
  }

  async #startScan() {
    this.#view.hideCameraError();
    try {
      await this.#camera.startCamera(
        "media-video",
        "media-canvas",
        this.#view.elements.cameraSelect,
      );
    } catch (error) {
      logError("Gagal memulai kamera", error);
      this.#view.showCameraError(getCameraErrorMessage(error));
      return;
    }

    this.#isScanning = true;
    this.#resetStabilization();
    this.#view.setScanning(true);
    this.#view.setStatus("Memindai", { active: true });
    this.#view.showState("loading");

    this.#lastFrameTime = 0;
    this.#rafId = requestAnimationFrame((t) => this.#detectionLoop(t));
  }

  #stopScan() {
    this.#isScanning = false;
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
    this.#camera.stopCamera();
    this.#view.setScanning(false);
    this.#view.setStatus("Siap", { active: false });

    // Seperti aplikasi referensi: hasil deteksi terakhir tetap ditampilkan
    // setelah kamera dihentikan; kembali ke idle hanya bila belum ada hasil.
    if (this.#generatedLabel || this.#stableLabel) {
      this.#view.showState("result");
    } else {
      this.#view.showState("idle");
    }
  }

  async #detectionLoop(timestamp) {
    if (!this.#isScanning) return;

    const fps = this.#camera.getFPS() || CAMERA_CONFIG.defaultFPS;
    const frameInterval = 1000 / fps;

    if (
      timestamp - this.#lastFrameTime >= frameInterval &&
      !this.#isPredicting
    ) {
      this.#lastFrameTime = timestamp;
      await this.#runDetection();
    }

    this.#rafId = requestAnimationFrame((t) => this.#detectionLoop(t));
  }

  async #runDetection() {
    const video = this.#camera.getVideoElement();
    if (!video || video.readyState < 2) return;

    this.#isPredicting = true;
    try {
      const result = await this.#detection.predict(video);
      this.#handleDetection(result);
    } catch (error) {
      logError("Kesalahan prediksi", error);
    } finally {
      this.#isPredicting = false;
    }
  }

  #handleDetection(result) {
    const now = performance.now();

    // 1) Tampilan live: selalu tunjukkan tebakan teratas saat memindai, dengan
    //    confidence dihaluskan (EMA) dan diperbarui maks ~4x/detik agar angka
    //    tidak berkedip mengikuti setiap frame.
    if (result.label === this.#lastDisplayLabel) {
      this.#displayConfidence =
        this.#displayConfidence * 0.7 + result.confidence * 0.3;
    } else {
      this.#lastDisplayLabel = result.label;
      this.#displayConfidence = result.confidence;
    }

    if (now - this.#lastUiUpdate >= 250) {
      this.#lastUiUpdate = now;
      this.#view.showState("result");
      this.#view.renderDetection({
        ...result,
        confidence: this.#displayConfidence,
      });
    }

    // 2) Streak "objek pasti": confidence tinggi (>= threshold) DAN margin
    //    jelas dari kandidat kedua. Hanya frame yang benar-benar yakin dihitung.
    const isConfident =
      isValidDetection(result) &&
      result.margin >= APP_CONFIG.detectionConfidenceMargin;

    if (!isConfident) {
      // Belum yakin — reset streak, jangan matikan kamera.
      this.#stableLabel = null;
      this.#stableCount = 0;
      return;
    }

    if (result.label === this.#stableLabel) {
      this.#stableCount += 1;
    } else {
      this.#stableLabel = result.label;
      this.#stableCount = 1;
    }

    // 3) Auto-stop sekali jepret: kamera mati HANYA setelah objek terdeteksi
    //    yakin sepanjang N frame berturut-turut. Lalu hasil final dibekukan
    //    dan fun fact dibuat.
    if (this.#stableCount >= APP_CONFIG.detectionStabilityCount) {
      this.#generatedLabel = this.#stableLabel;
      this.#view.showState("result");
      this.#view.renderDetection(result);
      this.#stopScan();
      this.#view.setStatus("Sayuran terdeteksi", { active: true });
      this.#generateFacts(this.#stableLabel);
    }
  }

  async #generateFacts(label) {
    if (this.#rootFacts.isGenerating) return;

    this.#view.hideFactError();

    // Tunggu Text AI siap bila masih dimuat (loadModel bersifat singleton,
    // langsung kembali bila sudah selesai).
    if (!this.#rootFacts.isReady()) {
      this.#view.setFactLoading(true, "Menyiapkan Text AI...");
      try {
        await this.#rootFacts.loadModel();
      } catch (error) {
        logError("Text AI gagal dimuat", error);
        this.#view.setFactLoading(false);
        this.#view.showFactError("Text AI gagal dimuat.");
        return;
      }
    }

    this.#view.setFactLoading(true, "Memuat fakta menarik...");
    this.#view.setStatus("Membuat fun fact", { active: true });
    try {
      const fact = await this.#rootFacts.generateFacts(label);
      this.#view.setFact(fact);
      this.#view.setStatus("Siap", { active: false });
    } catch (error) {
      logError("Gagal membuat fun fact", error);
      this.#view.showFactError("Gagal membuat fakta.");
      this.#view.setStatus("Siap", { active: false });
    } finally {
      this.#view.setFactLoading(false);
    }
  }

  #regenerate() {
    const label = this.#generatedLabel || this.#stableLabel;
    if (label) this.#generateFacts(label);
  }

  #onCameraChange() {
    if (this.#isScanning) {
      // Restart kamera dengan perangkat baru.
      this.#startScan();
    }
  }

  async #onFPSChange(fps) {
    this.#view.updateFPSLabel(fps);
    await this.#camera.setFPS(fps);
  }

  #onToneChange(tone) {
    this.#rootFacts.setTone(tone);
    // Regenerasi bila sudah ada label valid.
    const label = this.#generatedLabel || this.#stableLabel;
    if (label && this.#rootFacts.isReady()) {
      this.#generateFacts(label);
    }
  }

  async #onCopy() {
    const text = this.#view.getFactText();
    if (!text || !text.trim()) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback browser lama tanpa library tambahan.
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      this.#view.setCopyState("copied");
    } catch (error) {
      logError("Gagal menyalin", error);
      this.#view.setCopyState("error");
    }
  }

  #resetStabilization() {
    this.#stableLabel = null;
    this.#stableCount = 0;
    this.#generatedLabel = null;
    this.#displayConfidence = 0;
    this.#lastDisplayLabel = null;
    this.#lastUiUpdate = 0;
  }

  destroy() {
    this.#stopScan();
    this.#detection.dispose();
  }
}
