import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { createToonMaterial, applyOutline } from "../utils/Visual";

let counter = 0;

export type BirdState = "flying" | "perched" | "diving" | "returning" | "leaving";

/**
 * Pássaro invasor (Fase 2). Voa até um ninho, pousa e o constrói; mergulha
 * em pets que se aproximam; foge se assustado (Latido do Sirius). O movimento
 * é dirigido pela fase; a classe guarda estado e visual (placeholder).
 */
export class Bird {
  readonly mesh: Mesh;
  private beak: Mesh;
  state: BirdState = "flying";
  /** índice do ninho-alvo */
  nestIndex: number;
  /** índice do player sendo atacado (no estado diving) */
  diveTarget = -1;

  constructor(scene: Scene, spawn: Vector3, nestIndex: number) {
    counter++;
    this.nestIndex = nestIndex;

    this.mesh = MeshBuilder.CreateSphere(`bird_${counter}`, { diameterX: 0.5, diameterY: 0.45, diameterZ: 0.7 }, scene);
    this.mesh.position.copyFrom(spawn);
    this.mesh.material = createToonMaterial(scene, "#4A4A5A", `bird_${counter}`);
    applyOutline(this.mesh, 0.04);

    this.beak = MeshBuilder.CreateCylinder(`beak_${counter}`, { diameterTop: 0, diameterBottom: 0.18, height: 0.3, tessellation: 8 }, scene);
    this.beak.material = createToonMaterial(scene, "#FFD166", `beak_${counter}`);
    this.beak.parent = this.mesh;
    this.beak.rotation.x = Math.PI / 2;
    this.beak.position = new Vector3(0, 0, 0.4);
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  /** Move em direção a um ponto. Retorna a distância restante. */
  moveTowards(target: Vector3, speed: number, dt: number): number {
    const dir = target.subtract(this.mesh.position);
    const dist = dir.length();
    if (dist > 0.001) {
      dir.normalize();
      const step = Math.min(speed * dt, dist);
      this.mesh.position.addInPlace(dir.scale(step));
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }
    return dist - speed * dt;
  }

  /** Batida de asas / flutuação (feedback visual). */
  bob(): void {
    this.mesh.rotation.z = Math.sin(performance.now() * 0.02) * 0.25;
  }

  dispose(): void {
    this.beak.dispose();
    this.mesh.dispose();
  }
}
