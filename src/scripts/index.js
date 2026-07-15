import "../styles/styles.css";
import App from "./pages/app.js";

document.addEventListener("DOMContentLoaded", async () => {
  const app = new App({
    container: document.querySelector("#main-content"),
  });

  await app.renderPage();

  if (typeof window.lucide !== "undefined") {
    window.lucide.createIcons();
  }

  registerServiceWorker();
});

// Registrasi service worker Workbox — hanya pada production build (sw.js dibuat
// oleh GenerateSW). Pada development tidak ada sw.js sehingga dilewati agar
// cache lama tidak mengganggu.
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") return;

  const register = async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (error) {
      console.error("Gagal registrasi service worker:", error);
    }
  };

  // Event load bisa saja sudah lewat (renderPage menunggu model AI dimuat),
  // jadi daftarkan langsung bila dokumen sudah selesai dimuat.
  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register);
  }
}
