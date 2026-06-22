import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";

import type { CharacterDef } from "../utils/CharacterData";
import type { PlayerSlot } from "../utils/GameConfig";
import type { FrameInput } from "../systems/InputManager";
import { tryLoadModel } from "../utils/AssetLoader";
import { buildPetModel } from "./PetModel";
import { Audio } from "../systems/AudioManager";
import { burst } from "../utils/Particles";

/** Ganchos que a fase fornece para as habilidades afetarem o mundo. */
export interface AbilityHooks {
  stunEnemies(center: Vector3, radius: number, seconds: number): void;
  spawnShockwave(center: Vector3, radius: number, hex: string): void;
  floatingText(position: Vector3, text: string, hex: string): void;
}

const PLAYER_RADIUS = 0.45;
const PLAYER_HEIGHT = 1.2;
/** offset do "pé" do modelo até o centro da cápsula de colisão */
const FEET_OFFSET = -(PLAYER_HEIGHT / 2 + PLAYER_RADIUS);
/** altura-alvo para auto-escalar qualquer GLB importado */
const TARGET_VISUAL_HEIGHT = 2.0;
/** duração do "pop" de escala ao usar a habilidade */
const POP_DUR = 0.35;

/**
 * Classe base dos pets.
 *
 * Separa colisão de visual: a cápsula `body` é o collider físico (invisível);
 * `visualRoot` carrega o que aparece — um placeholder primitivo OU o modelo GLB
 * (carregado via loadModel()). Como a lógica não depende do mesh visual, basta
 * fornecer o .glb que ele substitui o placeholder sem outras mudanças.
 */
export class Player {
  readonly def: CharacterDef;
  readonly slot: PlayerSlot;
  readonly body: Mesh; // collider (invisível)
  readonly visualRoot: TransformNode;
  readonly aggregate: PhysicsAggregate;
  protected scene: Scene;
  protected hooks: AbilityHooks;

  private placeholder: Mesh;
  private placeholderParts: Mesh[] = [];
  private modelMeshes: AbstractMesh[] = [];
  private shadows?: ShadowGenerator;

  // animações (quando há GLB com AnimationGroups, ex.: Mixamo)
  private animIdle?: AnimationGroup;
  private animWalk?: AnimationGroup;
  private animCurrent?: AnimationGroup;

  // estado
  protected facing = new Vector3(0, 0, 1);
  carrying = 0;
  carryCapacity = 1;
  speedMultiplier = 1;
  slowFactor = 1;
  stunnedFor = 0;
  /** elevado por boost (QTE de 2 players) — permite pegar comidas altas */
  boostedFor = 0;
  protected cooldownRemaining = 0;
  protected abilityActiveFor = 0;
  /** tempo até o próximo passo (s); ritmo acompanha a velocidade efetiva */
  private stepTimer = 0;
  /** acumulador para o balanço de idle/andar */
  private animTime = Math.random() * 10;
  /** tempo restante do "pop" de habilidade */
  private popT = 0;

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

    // collider (cápsula invisível com física)
    this.body = MeshBuilder.CreateCapsule(
      `${def.id}_collider`,
      { radius: PLAYER_RADIUS, height: PLAYER_HEIGHT },
      scene,
    );
    this.body.position.copyFrom(spawn);
    this.body.isVisible = false;

    this.aggregate = new PhysicsAggregate(
      this.body,
      PhysicsShapeType.CAPSULE,
      { mass: 1, friction: 0.4, restitution: 0 },
      scene,
    );
    this.aggregate.body.setMassProperties({ inertia: Vector3.Zero() });
    this.aggregate.body.setLinearDamping(0.6);
    this.aggregate.body.setAngularDamping(1);

    // raiz visual — controlada por nós (posição/rotação), não pela física
    this.visualRoot = new TransformNode(`${def.id}_visual`, scene);
    this.placeholder = this.buildPlaceholder();
  }

  /** Placeholder: pet procedural chibi (ver PetModel.ts) sob a visualRoot. */
  private buildPlaceholder(): Mesh {
    const { parts, main } = buildPetModel(this.scene, this.visualRoot, this.def);
    this.placeholderParts = parts;
    return main;
  }

  /**
   * Carrega o modelo GLB do personagem (assíncrono). Se o arquivo não existir,
   * mantém o placeholder. Pode ser chamado fire-and-forget.
   */
  async loadModel(): Promise<void> {
    const result = await tryLoadModel(this.scene, this.def.model);
    if (!result || result.meshes.length === 0) return;

    const root = result.meshes[0];
    // auto-escala pela altura do bounding box
    const { min, max } = root.getHierarchyBoundingVectors();
    const h = max.y - min.y;
    if (h > 0.01) root.scaling.setAll(TARGET_VISUAL_HEIGHT / h);
    root.parent = this.visualRoot;
    root.position = new Vector3(0, FEET_OFFSET, 0);

    this.modelMeshes = result.meshes;
    for (const m of result.meshes) {
      this.shadows?.addShadowCaster(m);
    }

    // animações (Mixamo): idle/walk por nome
    const groups = result.animationGroups ?? [];
    groups.forEach((g) => g.stop());
    this.animIdle = groups.find((g) => /idle/i.test(g.name)) ?? groups[0];
    this.animWalk = groups.find((g) => /walk|run/i.test(g.name)) ?? this.animIdle;
    if (this.animIdle) {
      this.animIdle.start(true);
      this.animCurrent = this.animIdle;
    }

    // esconde o placeholder
    this.placeholderParts.forEach((p) => p.setEnabled(false));
  }

  /** Registra os meshes visuais como projetores de sombra. */
  registerShadows(sg: ShadowGenerator): void {
    this.shadows = sg;
    for (const p of this.placeholderParts) sg.addShadowCaster(p);
    for (const m of this.modelMeshes) sg.addShadowCaster(m);
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

  get boosted(): boolean {
    return this.boostedFor > 0;
  }

  stun(seconds: number): void {
    if (this.stunnedFor <= 0) {
      // estrelinhas só na transição (evita spam enquanto já atordoado)
      burst(this.scene, this.position.add(new Vector3(0, 1.2, 0)), "#FFD166", {
        count: 6,
        size: 0.1,
        speed: 2.2,
        gravity: 2,
      });
    }
    this.stunnedFor = Math.max(this.stunnedFor, seconds);
  }

  /** Recebe um boost (QTE): pequeno salto + janela para alcançar lugares altos. */
  boost(seconds: number): void {
    this.boostedFor = Math.max(this.boostedFor, seconds);
    const v = this.aggregate.body.getLinearVelocity();
    this.aggregate.body.setLinearVelocity(new Vector3(v.x, 5, v.z));
  }

  /** Transparência visual (usado pela Furtividade da Zoe). */
  setVisualAlpha(alpha: number): void {
    for (const p of this.placeholderParts) p.visibility = alpha;
    for (const m of this.modelMeshes) m.visibility = alpha;
  }

  /** Atualiza por frame. cameraForward = direção "frente" no plano do chão. */
  update(dt: number, input: FrameInput, cameraForward: Vector3): void {
    if (this.cooldownRemaining > 0) this.cooldownRemaining -= dt;
    if (this.boostedFor > 0) this.boostedFor -= dt;
    if (this.abilityActiveFor > 0) {
      this.abilityActiveFor -= dt;
      if (this.abilityActiveFor <= 0) this.onAbilityEnd();
    }

    let moving = false;
    if (this.stunnedFor > 0) {
      this.stunnedFor -= dt;
      this.aggregate.body.setLinearVelocity(new Vector3(0, this.currentVy(), 0));
      this.flashStun();
    } else {
      const fwd = new Vector3(cameraForward.x, 0, cameraForward.z).normalize();
      const right = Vector3.Cross(Vector3.Up(), fwd).normalize();
      let move = right.scale(input.moveX).add(fwd.scale(input.moveY));

      const speed = this.def.speed * this.speedMultiplier * this.slowFactor;
      if (move.lengthSquared() > 0.0001) {
        move = move.normalize();
        this.facing.copyFrom(move);
        moving = true;
        this.aggregate.body.setLinearVelocity(
          new Vector3(move.x * speed, this.currentVy(), move.z * speed),
        );
      } else {
        this.aggregate.body.setLinearVelocity(new Vector3(0, this.currentVy(), 0));
      }

      if (input.ability && this.cooldownRemaining <= 0) {
        this.cooldownRemaining = this.def.cooldown;
        this.popT = POP_DUR;
        burst(this.scene, this.position, this.def.color, { count: 8, size: 0.14 });
        this.onAbilityStart();
      }
    }

    // sincroniza visual com o collider
    this.visualRoot.position.copyFrom(this.body.position);
    if (moving) {
      this.visualRoot.rotation.y = Math.atan2(this.facing.x, this.facing.z);
    }
    this.updateLiveliness(moving, dt);
    this.updateSteps(moving, dt);
    this.updateAnim(moving);
  }

  /** Balanço de idle/andar + "pop" de habilidade (vida nos pets, todas as fases). */
  private updateLiveliness(moving: boolean, dt: number): void {
    this.animTime += dt;
    let bobY = 0;
    let sx = 1;
    let sy = 1;
    if (moving) {
      // saltitar sincronizado com o passo + leve squash/stretch
      const ph = this.animTime * this.def.speed * this.speedMultiplier * 1.4;
      bobY = Math.abs(Math.sin(ph)) * 0.12;
      sy = 1 + Math.sin(ph * 2) * 0.05;
      sx = 1 - Math.sin(ph * 2) * 0.05;
    } else {
      // respiração sutil
      bobY = Math.sin(this.animTime * 2) * 0.03;
      sy = 1 + Math.sin(this.animTime * 2) * 0.02;
    }
    if (this.popT > 0) {
      this.popT -= dt;
      const s = 1 + Math.sin((this.popT / POP_DUR) * Math.PI) * 0.25;
      sx *= s;
      sy *= s;
    }
    this.visualRoot.position.y += bobY;
    this.visualRoot.scaling.set(sx, sy, sx);
  }

  /** Toca passos no ritmo da velocidade efetiva enquanto o pet anda. */
  private updateSteps(moving: boolean, dt: number): void {
    if (!moving) {
      this.stepTimer = 0; // próximo passo assim que recomeçar a andar
      return;
    }
    this.stepTimer -= dt;
    if (this.stepTimer <= 0) {
      Audio.sfx("step");
      const eff = this.def.speed * this.speedMultiplier * this.slowFactor;
      this.stepTimer = Math.max(0.14, 1.6 / Math.max(1, eff));
    }
  }

  private updateAnim(moving: boolean): void {
    const target = moving ? this.animWalk : this.animIdle;
    if (target && target !== this.animCurrent) {
      this.animCurrent?.stop();
      target.start(true);
      this.animCurrent = target;
    }
  }

  private currentVy(): number {
    return this.aggregate.body.getLinearVelocity().y;
  }

  private flashStun(): void {
    const mat = this.placeholder.material as { emissiveColor?: Color3 } | null;
    if (mat?.emissiveColor) {
      const t = (Math.sin(performance.now() * 0.02) + 1) * 0.5;
      mat.emissiveColor = Color3.FromHexString(this.def.color).scale(0.2 + t * 0.4);
    }
  }

  /** Sobrescrito por cada personagem. */
  protected onAbilityStart(): void {
    this.hooks.floatingText(this.position, "✨", this.def.color);
  }
  protected onAbilityEnd(): void {}

  protected setAbilityActive(seconds: number): void {
    this.abilityActiveFor = seconds;
  }

  dispose(): void {
    this.aggregate.dispose();
    this.placeholderParts.forEach((p) => p.dispose());
    this.modelMeshes.forEach((m) => m.dispose());
    this.visualRoot.dispose();
    this.body.dispose();
  }
}
