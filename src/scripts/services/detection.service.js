import * as tf from "@tensorflow/tfjs";
// PENTING: backend WebGPU harus benar-benar di-import agar terdaftar di registry.
// Tanpa import ini, tf.setBackend("webgpu") akan gagal dengan
// "Backend name 'webgpu' not found in registry".
import "@tensorflow/tfjs-backend-webgpu";

import { APP_CONFIG, DETECTION_CONFIG } from "../config.js";
import { logError } from "../utils/index.js";

/**
 * DetectionService — Model/Service layer untuk Computer Vision (TensorFlow.js).
 * Backend adaptif: WebGPU -> WebGL -> CPU (fallback terakhir).
 * Manajemen memori tensor dilakukan dengan tf.tidy + dispose.
 */
class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.metadata = null;
    this.config = { ...DETECTION_CONFIG };
    this.currentBackend = null;
    this.performanceStats = {
      operations: 0,
      totalTime: 0,
      averageTime: 0,
    };
  }

  // [Advance] Strategi Backend Adaptive untuk Computer Vision: WebGPU -> WebGL -> CPU.
  async #setupBackend() {
    // 1. Coba WebGPU bila tersedia.
    if ("gpu" in navigator && navigator.gpu) {
      try {
        await tf.setBackend("webgpu");
        await tf.ready();
        if (tf.getBackend() === "webgpu") {
          this.currentBackend = "webgpu";
          return this.currentBackend;
        }
      } catch (error) {
        logError("WebGPU backend gagal, fallback ke WebGL", error);
      }
    }

    // 2. Fallback WebGL.
    try {
      await tf.setBackend("webgl");
      await tf.ready();
      if (tf.getBackend() === "webgl") {
        this.currentBackend = "webgl";
        return this.currentBackend;
      }
    } catch (error) {
      logError("WebGL backend gagal, fallback ke CPU", error);
    }

    // 3. Fallback terakhir CPU.
    await tf.setBackend("cpu");
    await tf.ready();
    this.currentBackend = tf.getBackend();
    return this.currentBackend;
  }

  // [Basic] Muat model + metadata, siapkan backend, dan validasi.
  // onProgress(percent, statusText) dipanggil untuk memperbarui UI.
  async loadModel(onProgress = () => {}) {
    onProgress(0, "Menyiapkan backend Vision");
    await this.#setupBackend();

    onProgress(0, "Memuat metadata");
    const metaResponse = await fetch(this.config.metadataUrl);
    if (!metaResponse.ok) {
      throw new Error(`Gagal memuat metadata (${metaResponse.status}).`);
    }
    this.metadata = await metaResponse.json();

    if (
      !Array.isArray(this.metadata.labels) ||
      this.metadata.labels.length === 0
    ) {
      throw new Error("metadata.labels tidak valid.");
    }
    this.labels = this.metadata.labels;

    if (this.metadata.imageSize) {
      this.config.imageSize = this.metadata.imageSize;
    }

    onProgress(0, "Memuat model deteksi 0%");
    this.model = await tf.loadLayersModel(this.config.modelUrl, {
      onProgress: (fraction) => {
        const percent = Math.round(fraction * 100);
        onProgress(percent, `Memuat model deteksi ${percent}%`);
      },
    });

    // Validasi jumlah output model sama dengan jumlah label.
    const outputShape = this.model.outputs[0].shape;
    const outputUnits = outputShape[outputShape.length - 1];
    if (outputUnits !== this.labels.length) {
      throw new Error(
        `Jumlah output model (${outputUnits}) != jumlah label (${this.labels.length}).`,
      );
    }

    // Warm-up agar prediksi pertama tidak lambat.
    tf.tidy(() => {
      const size = this.config.imageSize;
      const warm = tf.zeros([1, size, size, 3]);
      const out = this.model.predict(warm);
      return out;
    });

    onProgress(100, "Model deteksi siap");
    return { backend: this.currentBackend, labels: this.labels };
  }

  // Preprocessing sesuai model Teachable Machine MobileNet.
  // Dijalankan di dalam tf.tidy agar seluruh tensor antara otomatis dibersihkan.
  #preprocess(imageElement) {
    const { imageSize, normalization } = this.config;
    return tf.tidy(() => {
      const pixels = tf.browser.fromPixels(imageElement);
      const resized = tf.image.resizeBilinear(pixels, [imageSize, imageSize]);
      const normalized = resized
        .toFloat()
        .div(normalization.offset)
        .add(normalization.shift);
      return normalized.expandDims(0);
    });
  }

  // [Basic] Prediksi pada elemen gambar (video/canvas) dan kembalikan hasil.
  async predict(imageElement) {
    if (!this.model) {
      throw new Error("Model deteksi belum dimuat.");
    }

    const start = performance.now();
    let outputTensor = null;
    let probabilities = null;

    try {
      // Preprocess + inferensi. Tensor batched dibersihkan di dalam tidy.
      outputTensor = tf.tidy(() => {
        const batched = this.#preprocess(imageElement);
        return this.model.predict(batched);
      });

      // Baca data ke CPU lalu dispose output tensor (hindari kebocoran).
      probabilities = await outputTensor.data();
    } finally {
      if (outputTensor) outputTensor.dispose();
    }

    const inferenceTime = performance.now() - start;
    this.#updateStats(inferenceTime);

    // Susun prediksi dan urutkan berdasarkan confidence.
    const predictions = Array.from(probabilities)
      .map((confidenceRaw, index) => ({
        label: this.labels[index],
        confidenceRaw,
        confidence: confidenceRaw * 100,
      }))
      .sort((a, b) => b.confidenceRaw - a.confidenceRaw);

    const top = predictions[0];
    const isValid = top.confidence >= APP_CONFIG.detectionConfidenceThreshold;

    return {
      label: top.label,
      confidence: top.confidence,
      confidenceRaw: top.confidenceRaw,
      isValid,
      backend: this.currentBackend,
      inferenceTime,
      predictions: predictions.slice(0, 3),
    };
  }

  #updateStats(time) {
    this.performanceStats.operations += 1;
    this.performanceStats.totalTime += time;
    this.performanceStats.averageTime =
      this.performanceStats.totalTime / this.performanceStats.operations;
  }

  getBackend() {
    return this.currentBackend;
  }

  getTensorCount() {
    return tf.memory().numTensors;
  }

  // Dispose model saat service dihancurkan (lifecycle cleanup).
  dispose() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}

export default DetectionService;
