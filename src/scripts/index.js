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

  // Bila halaman sudah dikontrol SW lama, muat ulang sekali saat SW baru
  // mengambil alih (deploy baru) agar pengguna selalu memakai versi terbaru
  // dan tidak melihat UI usang dari cache.
  if (navigator.serviceWorker.controller) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");
      // Paksa cek update setiap kunjungan agar bundle baru cepat terpasang.
      registration.update?.();
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
