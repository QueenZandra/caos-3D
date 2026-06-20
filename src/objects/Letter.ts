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

let counter = 0;

/** Estados de uma carta. */
export type LetterState = "free" | "carried" | "destroyed";

/**
 * Carta com física 3D (Fase 1 — O Carteiro do Mal). Desliza pelo chão ao
 * entrar; pode ser pega (vira "carried") e entregue na lixeira ("destroyed").
 */
export class Letter {
  readonly mesh: Mesh;
  readonly aggregate: PhysicsAggregate;
  state: LetterState = "free";
  private carrier: number | null = null; // índice do player que carrega
  private offset = new Vector3(0, 1.4, 0);

  constructor(scene: Scene, spawn: Vector3, color: string) {
    counter++;
    this.mesh = MeshBuilder.CreateBox(
      `letter_${counter}`,
      { width: 0.5, height: 0.08, depth: 0.36 },
      scene,
    );
    this.mesh.position.copyFrom(spawn);
    this.mesh.material = createToonMaterial(scene, color, `letter_${counter}`);
    applyOutline(this.mesh, 0.02);

    this.aggregate = new PhysicsAggregate(
      this.mesh,
      PhysicsShapeType.BOX,
      { mass: 0.2, friction: 0.5, restitution: 0.1 },
      scene,
    );
  }

  /** Empurra a carta para dentro (deslizar pelo chão). */
  slideIn(dir: Vector3, force: number): void {
    this.aggregate.body.applyImpulse(dir.scale(force), this.mesh.position);
  }

  pickUp(playerIndex: number): void {
    if (this.state !== "free") return;
    this.state = "carried";
    this.carrier = playerIndex;
    this.aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
  }

  /** Reposiciona a carta sobre o portador. stackIndex empilha múltiplas. */
  followCarrier(pos: Vector3, stackIndex: number): void {
    if (this.state !== "carried") return;
    this.mesh.position.set(
      pos.x,
      pos.y + this.offset.y + stackIndex * 0.18,
      pos.z,
    );
  }

  drop(): void {
    if (this.state !== "carried") return;
    this.state = "free";
    this.carrier = null;
    this.aggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
  }

  destroy(): void {
    if (this.state === "destroyed") return;
    this.state = "destroyed";
    this.dispose();
  }

  get carriedBy(): number | null {
    return this.carrier;
  }

  dispose(): void {
    this.aggregate.dispose();
    this.mesh.dispose();
  }
}
