import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

/**
 * Material "toon" simples: cor chapada, brilho baixo e um pouco de emissive
 * para o look cartoon do Overcooked!. O contorno é aplicado por mesh
 * (applyOutline) usando o renderOutline nativo do Babylon.
 */
export function createToonMaterial(
  scene: Scene,
  hex: string,
  name = "toon",
): StandardMaterial {
  const mat = new StandardMaterial(`${name}_${hex}`, scene);
  const c = Color3.FromHexString(hex);
  mat.diffuseColor = c;
  mat.emissiveColor = c.scale(0.35);
  mat.specularColor = new Color3(0.08, 0.08, 0.08);
  mat.specularPower = 64;
  return mat;
}

/** Adiciona o contorno cartoon preto (ou cor custom) ao mesh. */
export function applyOutline(mesh: Mesh, width = 0.04, hex = "#1A1A2E"): void {
  mesh.renderOutline = true;
  mesh.outlineWidth = width;
  mesh.outlineColor = Color3.FromHexString(hex);
}
