const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    app: path.resolve(__dirname, "src/scripts/index.js"),
  },
  output: {
    filename: "[name].bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif)$/i,
        type: "asset/resource",
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ],
    parser: {
      javascript: {
        // Jangan biarkan webpack mengganti import.meta (dipakai internal
        // @huggingface/transformers / onnxruntime-web). Bundle dimuat sebagai
        // <script type="module"> sehingga import.meta valid secara native.
        // importMeta: true menyebabkan "__webpack_module__ is not defined"
        // pada production build.
        importMeta: false,
      },
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/index.html"),
      scriptLoading: "module",
    }),
    new CopyWebpackPlugin({
      patterns: [
        // Aset publik: manifest, favicon, ikon PWA, screenshots.
        {
          from: path.resolve(__dirname, "src/public"),
          to: path.resolve(__dirname, "dist"),
        },
        // Model Computer Vision (offline): model.json + metadata.json + weights.bin.
        // Disalin ke dist/models agar konsisten dengan DETECTION_CONFIG.
        {
          from: path.resolve(__dirname, "src/model"),
          to: path.resolve(__dirname, "dist/models"),
        },
      ],
    }),
  ],
  stats: {
    warningsFilter: /import\.meta/,
  },
};
