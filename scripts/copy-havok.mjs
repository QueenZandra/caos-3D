// Copia o binário WASM do Havok para /public para que o Vite o sirva.
// O pacote @babylonjs/havok não expõe o .wasm no seu "exports", então
// importá-lo direto via ?url falha no build — copiar para public resolve.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm");
const destDir = resolve(root, "public");
const dest = resolve(destDir, "HavokPhysics.wasm");

if (!existsSync(src)) {
  console.error("[copy-havok] WASM não encontrado em", src, "— rode npm install primeiro.");
  process.exit(1);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("[copy-havok] HavokPhysics.wasm copiado para public/");
