import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { createToonMaterial, applyOutline } from "../utils/Visual";

let counter = 0;

export type InvaderState = "advancing" | "fleeing";

/**
 * Invasor (Fase 5): vizinho cão/gato que entra pelo muro e avança até a casa.
 * Movimento cinemático (sem rigidbody) para IA previsível. Expulso por
 * proximidade (interagir) ou pelo Latido do Sirius; os "duros" precisam de 2
 * acertos. Placeholder primitivo até existir GLB.
 */
export class Invader {
  readonly mesh: Mesh;
  private snout: Mesh;
  state: InvaderState = "advancing";
  toughness: number;
  readonly speed: number;

  constructor(scene: Scene, spawn: Vector3, toughness: number, speed: number, colorHex: string) {
    counter++;
    this.toughness = toughness;
    this.speed = speed;

    const h = toughness > 1 ? 1.6 : 1.2;
    this.mesh = MeshBuilder.CreateCapsule(`invader_${counter}`, { radius: 0.45, height: h }, scene);
    this.mesh.position.copyFrom(spawn);
    this.mesh.material = createToonMaterial(scene, colorHex, `invader_${counter}`);
    applyOutline(this.mesh, 0.05);

    // focinho para indicar direção
    this.snout = MeshBuilder.CreateBox(`isnout_${counter}`, { width: 0.25, height: 0.25, depth: 0.4 }, scene);
    this.snout.material = createToonMaterial(scene, "#2A2A35", `isnout_${counter}`);
    this.snout.parent = this.mesh;
    this.snout.position = new Vector3(0, 0.1, 0.55);
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  moveTowards(target: Vector3, dt: number): void {
    const dir = target.subtract(this.mesh.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist > 0.01) {
      dir.normalize();
      this.mesh.position.addInPlace(dir.scale(Math.min(this.speed * dt, dist)));
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }

  /** Recebe um acerto. Retorna true se foi expulso (toughness esgotada). */
  hit(): boolean {
    if (this.state === "fleeing") return false;
    this.toughness--;
    if (this.toughness <= 0) {
      this.state = "fleeing";
      return true;
    }
    return false;
  }

  dispose(): void {
    this.snout.dispose();
    this.mesh.dispose();
  }
}
