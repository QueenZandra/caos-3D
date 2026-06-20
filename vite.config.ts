import { defineConfig } from "vite";

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
  },
  server: {
    port: 5173,
    open: false,
  },
});
