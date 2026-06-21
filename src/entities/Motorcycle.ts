import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { createToonMaterial, applyOutline } from "../utils/Visual";

let counter = 0;

/**
 * Moto que cruza a rua (Fase 6). Movimento cinemático em X. Quando afugentada,
 * acelera e some. Placeholder primitivo (corpo + 2 rodas).
 */
export class Motorcycle {
  readonly root: TransformNode;
  readonly dir: number; // +1 ou -1
  private speed: number;
  fleeing = false;

  constructor(scene: Scene, startX: number, z: number, dir: number, speed: number, colorHex: string) {
    counter++;
    this.dir = dir;
    this.speed = speed;

    this.root = new TransformNode(`moto_${counter}`, scene);
    this.root.position.set(startX, 0.6, z);
    this.root.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;

    const body = MeshBuilder.CreateBox(`motobody_${counter}`, { width: 1.8, height: 0.6, depth: 0.6 }, scene);
    body.material = createToonMaterial(scene, colorHex, `moto_${counter}`);
    applyOutline(body, 0.04);
    body.parent = this.root;
    body.position.y = 0.2;

    const rider = MeshBuilder.CreateCapsule(`rider_${counter}`, { radius: 0.3, height: 0.9 }, scene);
    rider.material = createToonMaterial(scene, "#2A2A35", `rider_${counter}`);
    rider.parent = this.root;
    rider.position.set(-0.2, 0.7, 0);

    for (const wx of [-0.6, 0.6]) {
      const wheel = MeshBuilder.CreateCylinder(`wheel_${counter}_${wx}`, { diameter: 0.7, height: 0.2, tessellation: 12 }, scene);
      wheel.material = createToonMaterial(scene, "#1A1A2E", `wheel_${counter}`);
      wheel.parent = this.root;
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, -0.15, 0);
    }
  }

  get position(): Vector3 {
    return this.root.position;
  }

  flee(): void {
    if (this.fleeing) return;
    this.fleeing = true;
    this.speed *= 2.4;
  }

  update(dt: number): void {
    this.root.position.x += this.dir * this.speed * dt;
  }

  /** Saiu da tela (passou da rua). */
  offscreen(limit: number): boolean {
    return Math.abs(this.root.position.x) > limit;
  }

  dispose(): void {
    this.root.getChildMeshes().forEach((m) => m.dispose());
    this.root.dispose();
  }
}
