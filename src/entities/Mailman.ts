import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { createToonMaterial, applyOutline } from "../utils/Visual";
import { PALETTE } from "../utils/Constants";

/**
 * O Carteiro do Mal — fica na janela e "joga" cartas pela porta. Pode ser
 * atordoado pelo Latido do Sirius, o que pausa o envio de cartas.
 */
export class Mailman {
  readonly mesh: Mesh;
  private hat: Mesh;
  stunnedFor = 0;

  constructor(scene: Scene, position: Vector3) {
    this.mesh = MeshBuilder.CreateCapsule("mailman", { radius: 0.5, height: 1.6 }, scene);
    this.mesh.position.copyFrom(position);
    this.mesh.material = createToonMaterial(scene, "#3A6EA5", "mailman");
    applyOutline(this.mesh, 0.05);

    this.hat = MeshBuilder.CreateCylinder("mailman_hat", { diameter: 0.7, height: 0.25 }, scene);
    this.hat.material = createToonMaterial(scene, PALETTE.dark, "mailman_hat");
    this.hat.parent = this.mesh;
    this.hat.position = new Vector3(0, 0.95, 0);
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  stun(seconds: number): void {
    this.stunnedFor = Math.max(this.stunnedFor, seconds);
  }

  get isStunned(): boolean {
    return this.stunnedFor > 0;
  }

  update(dt: number): void {
    if (this.stunnedFor > 0) {
      this.stunnedFor -= dt;
      // treme quando atordoado
      this.mesh.rotation.z = Math.sin(performance.now() * 0.03) * 0.15;
    } else {
      this.mesh.rotation.z = 0;
    }
  }

  dispose(): void {
    this.hat.dispose();
    this.mesh.dispose();
  }
}
