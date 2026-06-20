import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { Color3 } from "@babylonjs/core/Maths/math.color";

import type { CharacterDef } from "../utils/CharacterData";
import type { PlayerSlot } from "../utils/GameConfig";
import type { FrameInput } from "../systems/InputManager";
import { createToonMaterial, applyOutline } from "../utils/Visual";

/** Ganchos que a fase fornece para as habilidades afetarem o mundo. */
export interface AbilityHooks {
  stunEnemies(center: Vector3, radius: number, seconds: number): void;
  spawnShockwave(center: Vector3, radius: number, hex: string): void;
  floatingText(position: Vector3, text: string, hex: string): void;
}

const PLAYER_RADIUS = 0.45;
const PLAYER_HEIGHT = 1.2;

/**
 * Classe base dos pets. Usa um placeholder primitivo (cápsula + focinho)
 * com toon shading; o modelo GLB pode ser plugado depois sem mudar a lógica.
 */
export class Player {
  readonly def: CharacterDef;
  readonly slot: PlayerSlot;
  readonly root: TransformNode;
  readonly body: Mesh;
  protected snout: Mesh;
  readonly aggregate: PhysicsAggregate;
  protected scene: Scene;
  protected hooks: AbilityHooks;

  // estado
  protected facing = new Vector3(0, 0, 1);
  carrying = 0;
  carryCapacity = 1;
  speedMultiplier = 1;
  /** lentidão de terreno (slowzone) — 1 = normal, <1 = lento */
  slowFactor = 1;
  stunnedFor = 0;
  protected cooldownRemaining = 0;
  protected abilityActiveFor = 0;

  constructor(
    scene: Scene,
    def: CharacterDef,
    slot: PlayerSlot,
    spawn: Vector3,
    hooks: AbilityHooks,
  ) {
    this.scene = scene;
    this.def = def;
    this.slot = slot;
    this.hooks = hooks;

    this.root = new TransformNode(`player_${def.id}`, scene);

    // corpo (cápsula)
    this.body = MeshBuilder.CreateCapsule(
      `${def.id}_body`,
      { radius: PLAYER_RADIUS, height: PLAYER_HEIGHT },
      scene,
    );
    this.body.position.copyFrom(spawn);
    const mat = createToonMaterial(scene, def.color, def.id);
    this.body.material = mat;
    applyOutline(this.body, 0.05);

    // focinho — indica a direção que o pet encara
    this.snout = MeshBuilder.CreateSphere(
      `${def.id}_snout`,
      { diameter: 0.35 },
      scene,
    );
    this.snout.material = createToonMaterial(scene, "#FFF8F0", `${def.id}_snout`);
    applyOutline(this.snout, 0.03);
    this.snout.parent = this.body;
    this.snout.position = new Vector3(0, 0.15, PLAYER_RADIUS + 0.1);

    // física: cápsula com massa, rotação travada
    this.aggregate = new PhysicsAggregate(
      this.body,
      PhysicsShapeType.CAPSULE,
      { mass: 1, friction: 0.4, restitution: 0 },
      scene,
    );
    // trava rotação para o pet não tombar
    this.aggregate.body.setMassProperties({ inertia: Vector3.Zero() });
    this.aggregate.body.setLinearDamping(0.6);
    this.aggregate.body.setAngularDamping(1);
  }

  get position(): Vector3 {
    return this.body.position;
  }

  get cooldownPct(): number {
    if (this.def.cooldown <= 0) return 1;
    return 1 - this.cooldownRemaining / this.def.cooldown;
  }

  get isStunned(): boolean {
    return this.stunnedFor > 0;
  }

  stun(seconds: number): void {
    this.stunnedFor = Math.max(this.stunnedFor, seconds);
  }

  /** Atualiza por frame. cameraForward = direção "frente" no plano do chão. */
  update(dt: number, input: FrameInput, cameraForward: Vector3): void {
    if (this.cooldownRemaining > 0) this.cooldownRemaining -= dt;
    if (this.abilityActiveFor > 0) {
      this.abilityActiveFor -= dt;
      if (this.abilityActiveFor <= 0) this.onAbilityEnd();
    }
    if (this.stunnedFor > 0) {
      this.stunnedFor -= dt;
      this.aggregate.body.setLinearVelocity(new Vector3(0, this.currentVy(), 0));
      this.body.material && this.flashStun();
      return;
    }

    // base relativa à câmera isométrica
    const fwd = new Vector3(cameraForward.x, 0, cameraForward.z).normalize();
    const right = Vector3.Cross(Vector3.Up(), fwd).normalize();
    let move = right.scale(input.moveX).add(fwd.scale(input.moveY));

    const speed = this.def.speed * this.speedMultiplier * this.slowFactor;
    if (move.lengthSquared() > 0.0001) {
      move = move.normalize();
      this.facing.copyFrom(move);
      // orienta o focinho
      this.body.rotation.y = Math.atan2(move.x, move.z);
      this.aggregate.body.setLinearVelocity(
        new Vector3(move.x * speed, this.currentVy(), move.z * speed),
      );
    } else {
      const vy = this.currentVy();
      this.aggregate.body.setLinearVelocity(new Vector3(0, vy, 0));
    }

    if (input.ability && this.cooldownRemaining <= 0) {
      this.cooldownRemaining = this.def.cooldown;
      this.onAbilityStart();
    }
  }

  private currentVy(): number {
    return this.aggregate.body.getLinearVelocity().y;
  }

  private flashStun(): void {
    // pisca o emissive para feedback de atordoamento
    const mat = this.body.material as { emissiveColor?: Color3 };
    if (mat.emissiveColor) {
      const t = (Math.sin(performance.now() * 0.02) + 1) * 0.5;
      mat.emissiveColor = Color3.FromHexString(this.def.color).scale(0.2 + t * 0.4);
    }
  }

  /** Sobrescrito por cada personagem. */
  protected onAbilityStart(): void {
    this.hooks.floatingText(this.position, "✨", this.def.color);
  }
  protected onAbilityEnd(): void {}

  /** Marca a habilidade como ativa por X segundos (para buffs temporários). */
  protected setAbilityActive(seconds: number): void {
    this.abilityActiveFor = seconds;
  }

  dispose(): void {
    this.aggregate.dispose();
    this.snout.dispose();
    this.body.dispose();
    this.root.dispose();
  }
}
