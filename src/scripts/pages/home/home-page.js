import {
  generateCameraSection,
  generateInfoPanel,
  generateFooter,
} from "../../templates.js";
import HomePresenter from "./home-presenter.js";
import CameraService from "../../services/camera.service.js";
import DetectionService from "../../services/detection.service.js";
import RootFactsService from "../../services/rootfacts.service.js";
import {
  showElement,
  hideElement,
  setElementText,
  addFadeInAnimation,
} from "../../utils/index.js";

/**
 * HomePage — lapisan View (MVP).
 * Menyediakan struktur tampilan, referensi elemen, dan metode UI untuk Presenter.
 * View tidak menjalankan inferensi AI apa pun.
 */
export default class HomePage {
  #presenter = null;
  elements = {};

  async render() {
    return `
      <main class="main-content">
        ${generateCameraSection()}
        ${generateInfoPanel()}
      </main>
      ${generateFooter()}
    `;
  }

  async afterRender() {
    this.#cacheElements();

    // Dependency injection service ke presenter (arsitektur MVP).
    this.#presenter = new HomePresenter({
      view: this,
      cameraService: new CameraService(),
      detectionService: new DetectionService(),
      rootFactsService: new RootFactsService(),
    });

    await this.#presenter.init();
  }

  #cacheElements() {
    const byId = (id) => document.getElementById(id);
    this.elements = {
      video: byId("media-video"),
      canvas: byId("media-canvas"),
      placeholder: byId("camera-placeholder"),
      overlay: byId("camera-overlay"),
      cameraError: byId("camera-error"),
      btnToggle: byId("btn-toggle"),
      cameraSelect: byId("camera-select"),
      fpsSlider: byId("fps-slider"),
      fpsLabel: byId("fps-label"),
      toneSelect: byId("tone-select"),
      visionBackend: byId("vision-backend"),
      textBackend: byId("text-backend"),
      statusDot: byId("status-dot"),
      statusText: byId("status-text"),
      stateIdle: byId("state-idle"),
      stateLoading: byId("state-loading"),
      stateResult: byId("state-result"),
      detectedName: byId("detected-name"),
      detectedConfidence: byId("detected-confidence"),
      confidenceFill: byId("confidence-fill"),
      funFactText: byId("fun-fact-text"),
      funFactContent: byId("fun-fact-content"),
      funFactLoading: byId("fun-fact-loading"),
      funFactError: byId("fun-fact-error"),
      funFactErrorText: byId("fun-fact-error-text"),
      btnCopy: byId("btn-copy"),
      btnRetry: byId("btn-retry"),
    };
  }

  #refreshIcons() {
    if (typeof window.lucide !== "undefined") {
      window.lucide.createIcons();
    }
  }

  // ===== Status & backend =====
  setStatus(text, { active = false } = {}) {
    setElementText(this.elements.statusText, text);
    if (this.elements.statusDot) {
      this.elements.statusDot.classList.toggle("active", active);
    }
  }

  setVisionBackend(text) {
    setElementText(this.elements.visionBackend, text);
  }

  setTextBackend(text) {
    setElementText(this.elements.textBackend, text);
  }

  // ===== Kamera =====
  setScanning(isScanning) {
    const { btnToggle, placeholder, overlay } = this.elements;
    if (btnToggle) btnToggle.classList.toggle("scanning", isScanning);
    if (placeholder) placeholder.classList.toggle("hidden", isScanning);
    if (overlay) overlay.classList.toggle("active", isScanning);
  }

  showCameraError(message) {
    const { cameraError } = this.elements;
    if (!cameraError) return;
    setElementText(cameraError, message);
    showElement(cameraError);
  }

  hideCameraError() {
    hideElement(this.elements.cameraError);
  }

  updateFPSLabel(fps) {
    setElementText(this.elements.fpsLabel, `${fps} FPS`);
  }

  // ===== State panel =====
  #currentState = null;

  showState(name) {
    // Jangan proses ulang (termasuk animasi fadeIn) bila state tidak berubah —
    // mencegah panel hasil berkedip saat dipanggil berulang dari detection loop.
    if (this.#currentState === name) return;
    this.#currentState = name;

    const { stateIdle, stateLoading, stateResult } = this.elements;
    hideElement(stateIdle);
    hideElement(stateLoading);
    hideElement(stateResult);

    if (name === "idle") showElement(stateIdle);
    else if (name === "loading") showElement(stateLoading);
    else if (name === "result") {
      showElement(stateResult);
      addFadeInAnimation(stateResult);
    }
  }

  renderDetection({ label, confidence }) {
    const pct = Math.round(confidence);
    setElementText(this.elements.detectedName, label);
    setElementText(this.elements.detectedConfidence, `${pct}%`);
    if (this.elements.confidenceFill) {
      this.elements.confidenceFill.style.width = `${pct}%`;
    }
  }

  // ===== Fun fact =====
  setFactLoading(isLoading, message) {
    const { funFactLoading, funFactContent } = this.elements;
    if (isLoading) {
      if (message) {
        const span = funFactLoading?.querySelector("span");
        if (span) span.textContent = message;
      }
      showElement(funFactLoading);
      hideElement(funFactContent);
    } else {
      hideElement(funFactLoading);
      showElement(funFactContent);
    }
  }

  setFact(text) {
    setElementText(this.elements.funFactText, text);
    this.hideFactError();
  }

  getFactText() {
    return this.elements.funFactText?.textContent || "";
  }

  showFactError(message) {
    setElementText(this.elements.funFactErrorText, message);
    showElement(this.elements.funFactError);
  }

  hideFactError() {
    hideElement(this.elements.funFactError);
  }

  setCopyState(state) {
    const { btnCopy } = this.elements;
    if (!btnCopy) return;

    if (state === "copied") {
      btnCopy.classList.add("copied");
      btnCopy.setAttribute("title", "Berhasil disalin");
      btnCopy.innerHTML = '<i data-lucide="check" width="18" height="18"></i>';
      this.#refreshIcons();
      setTimeout(() => {
        btnCopy.classList.remove("copied");
        btnCopy.setAttribute("title", "Salin fakta");
        btnCopy.innerHTML = '<i data-lucide="copy" width="18" height="18"></i>';
        this.#refreshIcons();
      }, 1500);
    } else if (state === "error") {
      btnCopy.setAttribute("title", "Gagal menyalin");
    }
  }
}
