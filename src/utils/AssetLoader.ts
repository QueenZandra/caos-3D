import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { ISceneLoaderAsyncResult } from "@babylonjs/core/Loading/sceneLoader";
import type { Scene } from "@babylonjs/core/scene";

/** Base dos modelos: arquivos servidos de /public/assets/models/. */
export const MODELS_BASE = `${import.meta.env.BASE_URL}assets/models/`;

/** Verifica se o arquivo existe (evita erros barulhentos do loader em 404). */
async function fileExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return false;
    // Vite pode responder index.html (SPA fallback) para rotas inexistentes —
    // um .glb real não é text/html.
    const type = res.headers.get("content-type") ?? "";
    return !type.includes("text/html");
  } catch {
    return false;
  }
}

/**
 * Tenta carregar um GLB relativo a MODELS_BASE. Retorna null (sem lançar) se o
 * arquivo não existir ou falhar — o chamador então mantém o placeholder.
 */
export async function tryLoadModel(
  scene: Scene,
  relPath: string,
): Promise<ISceneLoaderAsyncResult | null> {
  const url = MODELS_BASE + relPath;
  if (!(await fileExists(url))) return null;
  try {
    return await SceneLoader.ImportMeshAsync("", MODELS_BASE, relPath, scene);
  } catch (e) {
    console.warn(`[AssetLoader] falha ao carregar ${relPath}:`, e);
    return null;
  }
}
