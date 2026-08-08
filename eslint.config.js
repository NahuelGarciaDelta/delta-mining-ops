export default [
  {
    ignores: ["dist/**", "node_modules/**", "docs/history/**", "public/**"]
  },
  {
    files: ["src/**/*.{js,jsx}", "scripts/**/*.mjs", "tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: "readonly", document: "readonly", localStorage: "readonly", sessionStorage: "readonly",
        fetch: "readonly", URL: "readonly", URLSearchParams: "readonly", Blob: "readonly", DOMParser: "readonly", navigator: "readonly",
        FileReader: "readonly", FormData: "readonly", setTimeout: "readonly", clearTimeout: "readonly",
        setInterval: "readonly", clearInterval: "readonly", console: "readonly", structuredClone: "readonly",
        AbortController: "readonly", CustomEvent: "readonly", Event: "readonly", Worker: "readonly",
        performance: "readonly", requestAnimationFrame: "readonly", cancelAnimationFrame: "readonly",
        indexedDB: "readonly", self: "readonly", process: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-func-assign": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
    }
  }
];
