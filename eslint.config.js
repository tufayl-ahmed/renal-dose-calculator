import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [".cache/", "dist/", "node_modules/", ".wrangler/", "coverage/", "test-results/", "playwright-report/", "dev-dist/"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js", "public/**/*.js"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["functions/**/*.js", "server/**/*.js"],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  {
    files: ["test/**/*.js", "scripts/**/*.mjs", "e2e/**/*.js", "*.config.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
];
