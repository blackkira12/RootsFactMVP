import { CAMERA_CONFIG } from "../config.js";
import { isMobileDevice, logError } from "../utils/index.js";

/**
 * CameraService — Model/Service layer untuk MediaStream API.
 * Bertanggung jawab atas: izin kamera, enumerasi perangkat, constraints,
 * FPS, start/stop, dan pembersihan stream. Tidak melakukan inferensi AI.
 */
class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.config = { ...CAMERA_CONFIG };
    this.currentFPS = CAMERA_CONFIG.defaultFPS;
    this.devices = [];
  }

  // [Basic] Inisiasi elemen video dan canvas dari DOM.
  initializeElements(videoId, canvasId) {
    this.video = document.getElementById(videoId);
    this.canvas = document.getElementById(canvasId);
    return { video: this.video, canvas: this.canvas };
  }

  // [Basic] Enumerasi perangkat video dan isi dropdown kamera.
  // Membutuhkan izin kamera agar label perangkat tersedia.
  async loadCameras(cameraSelect) {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return [];
    }

    const allDevices = await navigator.mediaDevices.enumerateDevices();
    this.devices = allDevices.filter((d) => d.kind === "videoinput");

    if (!cameraSelect) return this.devices;

    // Jika label belum tersedia (belum ada izin), pertahankan opsi default.
    const hasLabels = this.devices.some((d) => d.label);
    if (!hasLabels || this.devices.length === 0) {
      return this.devices;
    }

    cameraSelect.innerHTML = "";
    this.devices.forEach((device, index) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || `Kamera ${index + 1}`;
      cameraSelect.appendChild(option);
    });

    // Preferensi kamera belakang pada perangkat mobile.
    if (isMobileDevice()) {
      const backCamera = this.devices.find((d) =>
        /back|rear|environment|belakang/i.test(d.label),
      );
      if (backCamera) cameraSelect.value = backCamera.deviceId;
    }

    return this.devices;
  }

  // Bangun constraints berdasarkan konfigurasi dan kamera yang dipilih.
  #buildConstraints(selectedValue) {
    const { video } = this.config;
    const videoConstraints = {
      width: video.width,
      height: video.height,
      frameRate: { ideal: this.currentFPS, max: this.currentFPS },
    };

    if (selectedValue === "front" || selectedValue === "user") {
      videoConstraints.facingMode = "user";
    } else if (
      !selectedValue ||
      selectedValue === "default" ||
      selectedValue === "environment"
    ) {
      videoConstraints.facingMode = { ideal: this.config.facingMode };
    } else {
      // Anggap sebagai deviceId hasil enumerateDevices.
      videoConstraints.deviceId = { exact: selectedValue };
    }

    return { video: videoConstraints, audio: false };
  }

  // [Basic] Memulai kamera dengan perangkat terpilih dan menampilkannya.
  async startCamera(videoId, canvasId, cameraSelect) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Browser tidak mendukung akses kamera (getUserMedia).");
    }

    // Hentikan stream lama sebelum memulai yang baru.
    this.stopCamera();

    if (!this.video || !this.canvas) {
      this.initializeElements(videoId, canvasId);
    }

    const selectedValue = cameraSelect?.value;
    let constraints = this.#buildConstraints(selectedValue);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      // Fallback bila constraints terlalu ketat (mis. OverconstrainedError).
      if (error.name === "OverconstrainedError") {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } else {
        throw error;
      }
    }

    this.video.srcObject = this.stream;

    // Setelah izin diberikan, label perangkat tersedia — isi ulang dropdown.
    await this.loadCameras(cameraSelect);

    await new Promise((resolve) => {
      if (this.video.readyState >= 1) {
        resolve();
        return;
      }
      this.video.onloadedmetadata = () => resolve();
    });

    await this.video.play();

    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;

    return this.stream;
  }

  // [Basic] Hentikan stream kamera dan bersihkan sumber daya.
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  // [Skilled] Atur FPS kamera. Terapkan ke track bila stream aktif;
  // detection loop juga tetap dibatasi secara software oleh presenter.
  async setFPS(fps) {
    this.currentFPS = fps;
    this.config.video.frameRate = { ideal: fps, max: fps };

    if (!this.stream) return;

    const [videoTrack] = this.stream.getVideoTracks();
    if (!videoTrack?.applyConstraints) return;

    try {
      await videoTrack.applyConstraints({
        frameRate: { ideal: fps, max: fps },
      });
    } catch (error) {
      // Bila hardware tidak mendukung, throttling software menjadi cadangan.
      logError("Camera setFPS applyConstraints", error);
    }
  }

  getFPS() {
    return this.currentFPS;
  }

  // [Basic] Periksa apakah kamera sedang aktif.
  isActive() {
    if (!this.stream) return false;
    const [videoTrack] = this.stream.getVideoTracks();
    return Boolean(videoTrack && videoTrack.readyState === "live");
  }

  getVideoElement() {
    return this.video;
  }
}

export default CameraService;
