import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

import type { GameManager } from "../systems/GameManager";
import type { SceneController } from "./SceneController";
import { GameState, PALETTE } from "../utils/Constants";
import { GameConfig, type PlayerSlot } from "../utils/GameConfig";
import { enablePhysics } from "../systems/PhysicsSystem";
import { CameraSystem } from "../systems/CameraSystem";
import { createToonMaterial, applyOutline } from "../utils/Visual";
import { createPlayer } from "../entities/createPlayer";
import type { Player, AbilityHooks } from "../entities/Player";
import { Letter } from "../objects/Letter";
import { HUD } from "../ui/HUD";

const ARENA = 18;
const HALF = ARENA / 2;
const BIN = new Vector3(HALF - 3, 0.5, -HALF + 3);
const BIN_R = 2.4;
const PICKUP_R = 1.6;

interface Step {
  hint: string;
  check: () => boolean;
  enter?: () => void;
}

/**
 * Tutorial guiado: ensina mover → pegar → entregar → habilidade, um passo de
 * cada vez, sem tempo nem derrota. Acessível pelo menu; volta ao menu no fim.
 */
export class TutorialScene implements SceneController {
  readonly scene: Scene;
  private cam: CameraSystem;
  private hud: HUD;
  private shadows: ShadowGenerator;
  private players: Player[] = [];
  private hooks: AbilityHooks;

  private steps: Step[];
  private stepIndex = 0;
  private moved = 0;
  private prev: Vector3[] = [];
  private collected = 0;
  private abilityUsed = false;
  private letter: Letter | null = null;
  private finished = false;
  private endTimer = 2.6;

  constructor(private game: GameManager) {
    this.scene = new Scene(game.engine);
    this.scene.clearColor = Color4.FromHexString("#26304BFF");
    enablePhysics(this.scene, game.havok);

    const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = 0.85;
    const dir = new DirectionalLight("dir", new Vector3(-0.5, -1, -0.4), this.scene);
    dir.position = new Vector3(12, 20, 12);
    dir.intensity = 1.0;
    this.shadows = new ShadowGenerator(1024, dir);
    this.shadows.useBlurExponentialShadowMap = true;

    this.buildArena();
    this.buildBin();
    this.cam = new CameraSystem(this.scene);
    this.hooks = {
      stunEnemies: () => {},
      spawnShockwave: () => {},
      floatingText: (pos, text, hex) => this.hud.floatingText(pos, text, hex),
    };
    this.spawnPlayers();
    this.hud = new HUD(this.scene, this.players);
    this.prev = this.players.map((p) => p.position.clone());

    this.steps = this.buildSteps();
    this.steps[0]?.enter?.();
  }

  private buildSteps(): Step[] {
    return [
      {
        hint: "Mover: WASD / setas / analógico / joystick",
        check: () => this.moved > 5,
      },
      {
        hint: "Pegar: chegue na carta e aperte Interagir (Espaço / × / ✋)",
        enter: () => this.spawnLetter(),
        check: () => this.players.some((p) => p.carrying > 0),
      },
      {
        hint: "Entregar: leve a carta até a lixeira (zona verde)",
        enter: () => this.hud.setObjective(BIN),
        check: () => this.collected > 0,
      },
      {
        hint: "Habilidade: use a sua (E / □ / ✨) — cada pet tem a sua!",
        enter: () => this.hud.setObjective(null),
        check: () => this.abilityUsed,
      },
    ];
  }

  private buildArena(): void {
    const floor = MeshBuilder.CreateBox(
      "floor",
      { width: ARENA, height: 1, depth: ARENA },
      this.scene,
    );
    floor.position.y = -0.5;
    const mat = createToonMaterial(this.scene, "#3A4668", "floor");
    (mat as StandardMaterial).emissiveColor = Color3.FromHexString("#3A4668").scale(0.2);
    floor.material = mat;
    floor.receiveShadows = true;
    new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0, friction: 0.6 }, this.scene);

    const wallH = 2.5;
    const mk = (name: string, w: number, d: number, x: number, z: number) => {
      const wall = MeshBuilder.CreateBox(name, { width: w, height: wallH, depth: d }, this.scene);
      wall.position.set(x, wallH / 2, z);
      wall.material = createToonMaterial(this.scene, "#5A6488", name);
      applyOutline(wall, 0.04);
      new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    };
    mk("wW", 0.6, ARENA, -HALF, 0);
    mk("wE", 0.6, ARENA, HALF, 0);
    mk("wN", ARENA, 0.6, 0, HALF);
    mk("wS", ARENA, 0.6, 0, -HALF);
  }

  private buildBin(): void {
    const bin = MeshBuilder.CreateCylinder(
      "bin",
      { diameter: BIN_R * 1.4, height: 1, tessellation: 16 },
      this.scene,
    );
    bin.position.copyFrom(BIN);
    const mat = createToonMaterial(this.scene, PALETTE.teal, "bin");
    (mat as StandardMaterial).emissiveColor = Color3.FromHexString(PALETTE.teal).scale(0.6);
    bin.material = mat;
    applyOutline(bin, 0.05);
    const ring = MeshBuilder.CreateTorus(
      "binRing",
      { diameter: BIN_R * 2, thickness: 0.18, tessellation: 24 },
      this.scene,
    );
    ring.position.set(BIN.x, 0.06, BIN.z);
    const rmat = createToonMaterial(this.scene, PALETTE.teal, "binRing");
    (rmat as StandardMaterial).emissiveColor = Color3.FromHexString(PALETTE.teal).scale(0.8);
    ring.material = rmat;
  }

  private spawnPlayers(): void {
    // usa os players configurados; se não houver, um Sirius de demonstração (P1)
    const slots: PlayerSlot[] = GameConfig.players.length
      ? GameConfig.players
      : [{ index: 0, charId: "sirius", inputKind: "keyboard-wasd" }];
    const spread = [
      new Vector3(-2, 1, 3),
      new Vector3(2, 1, 3),
      new Vector3(-4, 1, 3),
      new Vector3(4, 1, 3),
    ];
    slots.forEach((slot, i) => {
      const p = createPlayer(this.scene, slot, spread[i] ?? new Vector3(0, 1, 3), this.hooks);
      p.registerShadows(this.shadows);
      void p.loadModel();
      this.players.push(p);
    });
  }

  private spawnLetter(): void {
    this.letter = new Letter(this.scene, new Vector3(0, 0.4, -1), PALETTE.yellow);
    this.shadows.addShadowCaster(this.letter.mesh);
  }

  private tryPickup(player: Player, index: number): void {
    if (!this.letter || this.letter.state !== "free" || player.carrying > 0) return;
    if (Vector3.Distance(this.letter.mesh.position, player.position) < PICKUP_R) {
      this.letter.pickUp(index);
      player.carrying++;
    }
  }

  private updateCarried(): void {
    const l = this.letter;
    if (!l || l.state !== "carried" || l.carriedBy === null) return;
    const p = this.players[l.carriedBy];
    if (!p) return;
    if (Vector3.Distance(p.position, BIN) < BIN_R) {
      l.destroy();
      this.collected++;
      p.carrying = 0;
      this.hud.floatingText(p.position, "+1 ✅", PALETTE.teal);
    } else {
      l.followCarrier(p.position, 0);
    }
  }

  update(dt: number): void {
    if (this.game.input.pauseEdge()) {
      this.game.goTo(GameState.Menu);
      return;
    }

    const forward = this.cam.getGroundForward();
    this.players.forEach((p, i) => {
      const input = this.game.input.getInput(p.slot);
      p.update(dt, input, forward);
      if (input.interact) this.tryPickup(p, i);
      if (input.ability) this.abilityUsed = true;
      // distância percorrida (passo "mover")
      const prev = this.prev[i];
      if (prev) this.moved += Math.hypot(p.position.x - prev.x, p.position.z - prev.z);
      this.prev[i] = p.position.clone();
    });

    this.updateCarried();

    if (!this.finished) {
      const step = this.steps[this.stepIndex];
      if (step && step.check()) {
        this.hud.floatingText(this.players[0].position, "✓", PALETTE.teal);
        this.stepIndex++;
        const next = this.steps[this.stepIndex];
        if (next) next.enter?.();
        else this.finished = true;
      }
    } else {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.game.goTo(GameState.Menu);
    }

    this.cam.update(
      dt,
      this.players.map((p) => p.position),
    );
    this.hud.setSplit(this.cam.isSplit);
    this.hud.update({
      objective: this.finished
        ? "🎉 Tutorial completo! Voltando ao menu…"
        : `Passo ${this.stepIndex + 1}/${this.steps.length} · ${this.steps[this.stepIndex].hint}`,
      bar: this.stepIndex / this.steps.length,
      showCarry: true,
      players: this.players,
    });
  }

  dispose(): void {
    this.hud.dispose();
    this.letter?.dispose();
    this.players.forEach((p) => p.dispose());
    this.scene.dispose();
  }
}
