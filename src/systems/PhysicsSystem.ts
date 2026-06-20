import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

// O WASM é copiado para /public por scripts/copy-havok.mjs e servido na raiz.
const havokWasmUrl = `${import.meta.env.BASE_URL}HavokPhysics.wasm`;

let havokPlugin: HavokPlugin | null = null;

/**
 * Inicializa o Havok uma única vez (o WASM é caro de carregar).
 * O plugin pode ser reutilizado entre cenas.
 */
export async function initPhysics(): Promise<HavokPlugin> {
  if (havokPlugin) return havokPlugin;
  const havok = await HavokPhysics({ locateFile: () => havokWasmUrl });
  havokPlugin = new HavokPlugin(true, havok);
  return havokPlugin;
}

/** Habilita a física Havok numa cena com gravidade terrestre. */
export function enablePhysics(scene: Scene, plugin: HavokPlugin): void {
  scene.enablePhysics(new Vector3(0, -9.81, 0), plugin);
}
