import { defineConfig } from "vitest/config";

// Babylon + Havok: o WASM do Havok não deve ser pré-bundlado pelo esbuild,
// e é resolvido em runtime via ?url (ver src/systems/PhysicsSystem.ts).
export default defineConfig({
  base: "./",
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
  assetsInclude: ["**/*.glb", "**/*.gltf", "**/*.hdr", "**/*.env"],
  build: {
    target: "es2020",
    sourcemap: false,
    // o vendor chunk (Babylon) é grande por natureza; o aviso de 500 kB não
    // se aplica a ele — o que importa é o código do jogo ficar separado.
    chunkSizeWarningLimit: 2800,
    rollupOptions: {
      output: {
        // separa o motor (Babylon) e o GUI do código do jogo, melhorando o
        // cache entre deploys e o carregamento inicial.
        manualChunks: {
          babylon: ["@babylonjs/core", "@babylonjs/loaders"],
          gui: ["@babylonjs/gui"],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
