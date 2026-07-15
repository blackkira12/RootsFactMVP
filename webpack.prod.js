const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const WorkboxWebpackPlugin = require("workbox-webpack-plugin");

module.exports = merge(common, {
  mode: "production",
  devtool: false,
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
    }),
    new WorkboxWebpackPlugin.GenerateSW({
      swDest: "sw.js",
      clientsClaim: true,
      skipWaiting: true,
      cleanupOutdatedCaches: true,
      navigateFallback: "index.html",
      // weights.bin (~2.1 MB) dan bundle AI besar harus ikut ter-precache.
      // Batas 5 MB dinaikkan ke 30 MB dengan margin aman.
      maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      // Pastikan model lokal (.json & .bin) masuk precache selain aset webpack.
      include: [
        /\.html$/,
        /\.js$/,
        /\.css$/,
        /\.json$/,
        /\.bin$/,
        /\.(?:png|ico|webmanifest)$/,
      ],
      runtimeCaching: [
        // Model Generative AI (Transformers.js) dari Hugging Face — CacheFirst
        // agar dapat dipakai ulang offline setelah sekali diunduh.
        {
          urlPattern:
            /^https:\/\/(huggingface\.co|cdn-lfs.*\.huggingface\.co)\//i,
          handler: "CacheFirst",
          options: {
            cacheName: "hf-models-cache",
            expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        // Runtime WASM Transformers.js (jsdelivr).
        {
          urlPattern: /^https:\/\/cdn\.jsdelivr\.net\//i,
          handler: "CacheFirst",
          options: {
            cacheName: "jsdelivr-cache",
            expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        // Google Fonts & Lucide CDN — StaleWhileRevalidate agar tetap tampil offline.
        {
          urlPattern:
            /^https:\/\/(fonts\.(googleapis|gstatic)\.com|unpkg\.com)\//i,
          handler: "StaleWhileRevalidate",
          options: {
            cacheName: "cdn-assets-cache",
            expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    }),
  ],
});
