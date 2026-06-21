import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import {
  PhysicsShapeType,
  PhysicsMotionType,
} from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { createToonMaterial, applyOutline } from "../utils/Visual";
import { Audio } from "../systems/AudioManager";

let counter = 0;

export type CushionState = "free" | "carried" | "destroyed";

/**
 * Almofada com RigidBody (Fase 3). É empurrada pelo vento e pelo puff gigante;
 * pode ser carregada por um pet para a zona segura. Some quando destruída.
 */
export class Cushion {
  readonly mesh: Mesh;
  readonly aggregate: PhysicsAggregate;
  state: CushionState = "free";
  private carrier: number | null = null;

  constructor(scene: Scene, spawn: Vector3, color: string) {
    counter++;
    this.mesh = MeshBuilder.CreateBox(
      `cushion_${counter}`,
      { width: 0.8, height: 0.32, depth: 0.8 },
      scene,
    );
    this.mesh.position.copyFrom(spawn);
    this.mesh.material = createToonMaterial(scene, color, `cushion_${counter}`);
    applyOutline(this.mesh, 0.03);

    this.aggregate = new PhysicsAggregate(
      this.mesh,
      PhysicsShapeType.BOX,
      { mass: 0.5, friction: 0.5, restitution: 0.3 },
      scene,
    );
  }

  get position(): Vector3 {
    return this.mesh.position;
  }
  get carriedBy(): number | null {
    return this.carrier;
  }

  applyWind(dir: Vector3, force: number): void {
    if (this.state !== "free") return;
    this.aggregate.body.applyImpulse(dir.scale(force), this.mesh.position);
  }

  pickUp(playerIndex: number): void {
    if (this.state !== "free") return;
    this.state = "carried";
    this.carrier = playerIndex;
    this.aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
    Audio.sfx("pickup");
  }

  followCarrier(pos: Vector3, stackIndex: number): void {
    if (this.state !== "carried") return;
    this.mesh.position.set(pos.x, pos.y + 1.3 + stackIndex * 0.4, pos.z);
  }

  drop(impulseDir?: Vector3): void {
    if (this.state !== "carried") return;
    this.state = "free";
    this.carrier = null;
    this.aggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
    if (impulseDir) this.aggregate.body.applyImpulse(impulseDir.scale(2), this.mesh.position);
  }

  destroy(): void {
    if (this.state === "destroyed") return;
    this.state = "destroyed";
    this.dispose();
  }

  dispose(): void {
    this.aggregate.dispose();
    this.mesh.dispose();
  }
}
