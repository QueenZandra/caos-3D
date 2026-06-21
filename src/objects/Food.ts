import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import {
  PhysicsShapeType,
  PhysicsMotionType,
} from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { createToonMaterial, applyOutline } from "../utils/Visual";
import { Audio } from "../systems/AudioManager";

let counter = 0;

export type FoodState = "free" | "carried" | "collected" | "broken";

/**
 * Item de comida com física (Fase 4). Fica empilhado em bancadas; ao remover um
 * de baixo, os de cima caem por gravidade (cascata real do Havok). Quebra ao
 * cair no chão se nunca foi carregado (vítima de cascata). `high` marca os itens
 * em bancada alta, que só gatos (ou pets com boost) alcançam.
 */
export class Food {
  readonly mesh: Mesh;
  readonly aggregate: PhysicsAggregate;
  readonly high: boolean;
  readonly special: boolean;
  state: FoodState = "free";
  everCarried = false;
  private carrier: number | null = null;
  private baseOutline: number;

  constructor(scene: Scene, spawn: Vector3, color: string, high: boolean, special = false) {
    counter++;
    this.high = high;
    this.special = special;
    const size = special ? 0.7 : 0.5;
    this.mesh = MeshBuilder.CreateBox(`food_${counter}`, { size }, scene);
    this.mesh.position.copyFrom(spawn);
    const mat = createToonMaterial(scene, color, `food_${counter}`);
    if (special) (mat as StandardMaterial).emissiveColor = Color3.FromHexString(color);
    this.mesh.material = mat;
    this.baseOutline = special ? 0.05 : 0.03;
    applyOutline(this.mesh, this.baseOutline);

    this.aggregate = new PhysicsAggregate(
      this.mesh,
      PhysicsShapeType.BOX,
      { mass: 0.5, friction: 0.6, restitution: 0.1 },
      scene,
    );
  }

  get position(): Vector3 {
    return this.mesh.position;
  }
  get carriedBy(): number | null {
    return this.carrier;
  }

  pickUp(playerIndex: number): void {
    if (this.state !== "free") return;
    this.state = "carried";
    this.everCarried = true;
    this.carrier = playerIndex;
    this.setHighlight(false);
    this.aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
    Audio.sfx("pickup");
  }

  followCarrier(pos: Vector3, stackIndex: number): void {
    if (this.state !== "carried") return;
    this.mesh.position.set(pos.x, pos.y + 1.3 + stackIndex * 0.35, pos.z);
  }

  drop(): void {
    if (this.state !== "carried") return;
    this.state = "free";
    this.carrier = null;
    this.aggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
  }

  collect(): void {
    if (this.state === "collected" || this.state === "broken") return;
    this.state = "collected";
    Audio.sfx("deliver");
    this.dispose();
  }

  break(): void {
    if (this.state === "broken") return;
    this.state = "broken";
    Audio.sfx("broke");
    // achata e fica vermelho (visual de quebrado)
    this.mesh.scaling.y = 0.2;
    (this.mesh.material as StandardMaterial).diffuseColor = Color3.FromHexString("#C0392B");
    (this.mesh.material as StandardMaterial).emissiveColor =
      Color3.FromHexString("#C0392B").scale(0.4);
    this.aggregate.body.setMotionType(PhysicsMotionType.STATIC);
  }

  /** Destaque vermelho de "vai cair" (preview de cascata). */
  setHighlight(on: boolean): void {
    this.mesh.outlineColor = on ? Color3.FromHexString("#FF3B30") : Color3.FromHexString("#1A1A2E");
    this.mesh.outlineWidth = on ? this.baseOutline * 2 : this.baseOutline;
  }

  dispose(): void {
    this.aggregate.dispose();
    this.mesh.dispose();
  }
}
