import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

export interface BurstOptions {
  /** número de fragmentos */
  count?: number;
  /** tamanho base de cada fragmento */
  size?: number;
  /** velocidade inicial */
  speed?: number;
  /** duração de vida (s) */
  life?: number;
  /** gravidade aplicada (unidades/s²) */
  gravity?: number;
}

/**
 * Estouro de partículas autossuficiente: cria fragmentos cúbicos que voam,
 * caem e somem, registrando-se no loop da cena e se removendo ao fim. Sem
 * dependência de texturas e sem precisar ser atualizado de fora (DRY: dá para
 * disparar em qualquer evento — pegar, entregar, quebrar).
 */
export function burst(scene: Scene, position: Vector3, hex: string, opts: BurstOptions = {}): void {
  const count = opts.count ?? 8;
  const size = opts.size ?? 0.16;
  const speed = opts.speed ?? 4;
  const maxLife = opts.life ?? 0.55;
  const gravity = opts.gravity ?? 9;

  const mat = new StandardMaterial("burst", scene);
  const c = Color3.FromHexString(hex);
  mat.diffuseColor = c;
  mat.emissiveColor = c.scale(0.8);
  mat.disableLighting = true;

  const parts: Mesh[] = [];
  const vels: Vector3[] = [];
  const spins: Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const m = MeshBuilder.CreateBox(
      `burst_${i}`,
      { size: size * (0.6 + Math.random() * 0.8) },
      scene,
    );
    m.material = mat;
    m.position.copyFrom(position);
    const a = Math.random() * Math.PI * 2;
    const up = 0.4 + Math.random() * 0.9;
    const r = 0.4 + Math.random();
    vels.push(new Vector3(Math.cos(a) * r * speed, up * speed, Math.sin(a) * r * speed));
    spins.push(new Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    parts.push(m);
  }

  let life = maxLife;
  const baseScale = parts.map((p) => p.scaling.x);

  const obs = scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;
    life -= dt;
    const t = Math.max(0, life / maxLife);
    parts.forEach((m, i) => {
      if (m.isDisposed()) return;
      vels[i].y -= gravity * dt;
      m.position.addInPlace(vels[i].scale(dt));
      m.rotation.addInPlace(spins[i].scale(dt));
      m.scaling.setAll(baseScale[i] * t);
    });
    if (life <= 0) {
      scene.onBeforeRenderObservable.remove(obs);
      parts.forEach((m) => m.dispose());
      mat.dispose();
    }
  });
}
