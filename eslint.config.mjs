import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  {
    // Abaikan build output, dependencies, dan file model.
    ignores: ["dist/**", "node_modules/**", "src/model/**", "**/*.bin"],
  },
  js.configs.recommended,
  {
    // Source aplikasi (browser, ES modules).
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        process: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
  {
    // Konfigurasi Webpack & Node (CommonJS).
    files: ["*.js", "webpack.*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },
  prettier,
];
