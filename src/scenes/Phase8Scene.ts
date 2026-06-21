import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
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
import { Audio } from "../systems/AudioManager";
import type { CharId } from "../utils/Constants";
import { GameConfig } from "../utils/GameConfig";
import { enablePhysics } from "../systems/PhysicsSystem";
import { CameraSystem } from "../systems/CameraSystem";
import { createToonMaterial, applyOutline } from "../utils/Visual";
import { createPlayer } from "../entities/createPlayer";
import type { Player, AbilityHooks } from "../entities/Player";
import { HUD } from "../ui/HUD";

const ARENA = 26;
const HALF = ARENA / 2;
const BASE_TIME = 90;
const ACTION_R = 2.4;
const ACTION_CD = 1.1;
const SUPER_CD = 4;
const ANGER_START = 0.85;

const OWNERS = [
  { pos: new Vector3(-3, 1.2, -HALF + 3.5), name: "Dono 1", color: "#4C7BD9" },
  { pos: new Vector3(3, 1.2, -HALF + 3.5), name: "Dono 2", color: "#D98C4C" },
];

/** Reduções de raiva por pet × dono (eficácias do GDD). */
function reduction(id: CharId, owner: number, zoeUsed: boolean): number {
  switch (id) {
    case "sirius":
      return owner === 0 ? 0.12 : 0.05; // Olhinhos Tristes — eficaz no Dono 1
    case "belatriz":
      return owner === 1 ? 0.12 : 0.05; // Trazer Brinquedo — eficaz no Dono 2
    case "minerva":
      return 0.1; // Ronron e Colo — eficaz com ambos
    case "zoe":
      return zoeUsed ? 0.03 : 0.2; // Caçar Mosquito — forte uma vez
    default:
      return 0.05;
  }
}

function cuteText(id: CharId): string {
  switch (id) {
    case "sirius":
      return "🥺 olhinhos tristes";
    case "belatriz":
      return "🧸 trouxe o brinquedo!";
    case "minerva":
      return "😽 ronron…";
    case "zoe":
      return "🦟 pulo do mosquito!";
    default:
      return "❤️";
  }
}

/** Fase 8 — "Operação Perdão". Zere a raiva dos donos com as ações fofas. */
export class Phase8Scene implements SceneController {
  readonly scene: Scene;
  private cam: CameraSystem;
  private hud: HUD;
  private shadows: ShadowGenerator;

  private players: Player[] = [];
  private ownerMesh: Mesh[] = [];
  private anger = [ANGER_START, ANGER_START];

  private actionCd: number[] = [];
  private performing: number[] = [];
  private zoeUsed = false;
  private superCd = 0;

  private timeLeft: number;
  private ended = false;
  private resolving = false;
  private resolveTimer = 0;
  private outcomeWin = false;
  private hooks: AbilityHooks;

  constructor(private game: GameManager) {
    this.scene = new Scene(game.engine);
    this.scene.clearColor = Color4.FromHexString("#2A2440FF");
    enablePhysics(this.scene, game.havok);
    GameConfig.phase = 8;

    this.timeLeft = Math.round(BASE_TIME * GameConfig.difficulty.timer);

    const hemi = new HemisphericLight("hemi", new Vector3(0.3, 1, 0.2), this.scene);
    hemi.intensity = 0.85;
    const dir = new DirectionalLight("dir", new Vector3(-0.4, -1, -0.3), this.scene);
    dir.position = new Vector3(10, 22, 10);
    dir.intensity = 1.0;
    this.shadows = new ShadowGenerator(1024, dir);
    this.shadows.useBlurExponentialShadowMap = true;

    this.buildRoom();
    this.cam = new CameraSystem(this.scene);

    this.hooks = {
      stunEnemies: () => {},
      spawnShockwave: () => {},
      floatingText: (pos, text, hex) => this.hud.floatingText(pos, text, hex),
    };

    this.spawnPlayers();
    this.actionCd = this.players.map(() => 0);
    this.performing = this.players.map(() => 0);

    this.hud = new HUD(this.scene, this.players);
    this.hud.floatingText(new Vector3(0, 3, -HALF + 4), "Os donos chegaram… façam fofura! 🥺", PALETTE.yellow);
  }

  // ─── Cenário ────────────────────────────────────────────────
  private buildRoom(): void {
    const floor = MeshBuilder.CreateBox("floor", { width: ARENA, height: 1, depth: ARENA }, this.scene);
    floor.position.y = -0.5;
    const fmat = createToonMaterial(this.scene, "#9A6B5A", "floor");
    (fmat as StandardMaterial).emissiveColor = Color3.FromHexString("#7A4F44").scale(0.3);
    floor.material = fmat;
    floor.receiveShadows = true;
    new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0, friction: 0.6 }, this.scene);

    const wallH = 3;
    const mk = (name: string, w: number, dep: number, x: number, z: number) => {
      const wall = MeshBuilder.CreateBox(name, { width: w, height: wallH, depth: dep }, this.scene);
      wall.position.set(x, wallH / 2, z);
      wall.material = createToonMaterial(this.scene, "#6E5A8C", name);
      applyOutline(wall, 0.03);
      new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    };
    mk("wW", 0.5, ARENA, -HALF, 0);
    mk("wE", 0.5, ARENA, HALF, 0);
    mk("wN", ARENA, 0.5, 0, HALF);
    mk("wS", ARENA, 0.5, 0, -HALF);

    // bagunça acumulada (decorativa) — a casa destruída
    for (let i = 0; i < 14; i++) {
      const junk = MeshBuilder.CreateBox(`junk_${i}`, { width: 0.6, height: 0.3, depth: 0.6 }, this.scene);
      junk.position.set((Math.random() - 0.5) * ARENA * 0.8, 0.2, (Math.random() - 0.5) * ARENA * 0.6 + 2);
      junk.rotation.y = Math.random() * Math.PI;
      junk.material = createToonMaterial(this.scene, [PALETTE.pink, PALETTE.blue, PALETTE.yellow][i % 3], `junk_${i}`);
      applyOutline(junk, 0.02);
    }

    // donos
    OWNERS.forEach((o, i) => {
      const m = MeshBuilder.CreateCapsule(`owner_${i}`, { radius: 0.6, height: 2.0 }, this.scene);
      m.position.copyFrom(o.pos);
      m.material = createToonMaterial(this.scene, o.color, `owner_${i}`);
      applyOutline(m, 0.06);
      const label = MeshBuilder.CreateBox(`ohead_${i}`, { size: 0.5 }, this.scene);
      label.material = createToonMaterial(this.scene, "#FFE0C0", `ohead_${i}`);
      label.parent = m;
      label.position.y = 1.3;
      this.shadows.addShadowCaster(m);
      this.ownerMesh.push(m);
    });
  }

  private spawnPlayers(): void {
    const spread = [new Vector3(-3, 1, 4), new Vector3(3, 1, 4), new Vector3(-1, 1, 6), new Vector3(1, 1, 6)];
    GameConfig.players.forEach((slot, i) => {
      const p = createPlayer(this.scene, slot, spread[i] ?? new Vector3(0, 1, 5), this.hooks);
      p.registerShadows(this.shadows);
      void p.loadModel();
      this.players.push(p);
    });
  }

  // ─── Ações fofas ────────────────────────────────────────────
  private horiz(a: Vector3, b: Vector3): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  private nearestOwner(pos: Vector3): number {
    let idx = -1;
    let best = ACTION_R;
    OWNERS.forEach((o, i) => {
      const d = this.horiz(pos, o.pos);
      if (d < best) {
        best = d;
        idx = i;
      }
    });
    return idx;
  }

  private doAction(player: Player, index: number): void {
    if (this.actionCd[index] > 0) return;
    const owner = this.nearestOwner(player.position);
    if (owner < 0) {
      this.hud.floatingText(player.position, "→ chegue perto de um dono!", PALETTE.yellow);
      return;
    }
    const amt = reduction(player.def.id, owner, this.zoeUsed);
    if (player.def.id === "zoe") this.zoeUsed = true;
    this.anger[owner] = Math.max(0, this.anger[owner] - amt);
    this.actionCd[index] = ACTION_CD;
    this.performing[index] = 1.0;
    Audio.sfx("deliver");
    this.hud.floatingText(player.position, cuteText(player.def.id), player.def.color);
    this.hud.floatingText(OWNERS[owner].pos, "❤️", PALETTE.pink);
  }

  private trySuperFofo(): void {
    if (this.superCd > 0) return;
    const allPerforming = this.players.every((_, i) => this.performing[i] > 0);
    if (this.players.length >= 2 && allPerforming) {
      this.superCd = SUPER_CD;
      this.anger[0] = Math.max(0, this.anger[0] - 0.22);
      this.anger[1] = Math.max(0, this.anger[1] - 0.22);
      this.cam.shake(0.3, 0.3);
      this.hud.floatingText(new Vector3(0, 3.5, -HALF + 4), "SUPER FOFO! 💖💖💖", PALETTE.pink);
    }
  }

  private updateOwnerColors(): void {
    this.ownerMesh.forEach((m, i) => {
      const a = this.anger[i];
      const mat = m.material as StandardMaterial;
      mat.emissiveColor = new Color3(0.15 + 0.6 * a, 0.15 + 0.6 * (1 - a), 0.15).scale(0.8);
    });
  }

  // ─── Confete / desfecho ─────────────────────────────────────
  private spawnConfetti(): void {
    const colors = [PALETTE.orange, PALETTE.pink, PALETTE.yellow, PALETTE.teal, PALETTE.purple, PALETTE.blue];
    for (let i = 0; i < 60; i++) {
      const c = MeshBuilder.CreateBox(`confetti_${i}`, { width: 0.25, height: 0.25, depth: 0.05 }, this.scene);
      c.position.set((Math.random() - 0.5) * 6, 8 + Math.random() * 3, -HALF + 4 + (Math.random() - 0.5) * 4);
      c.material = createToonMaterial(this.scene, colors[i % colors.length], `confetti_${i}`);
      const agg = new PhysicsAggregate(c, PhysicsShapeType.BOX, { mass: 0.05, restitution: 0.4 }, this.scene);
      agg.body.applyImpulse(new Vector3((Math.random() - 0.5) * 0.6, 0.2, (Math.random() - 0.5) * 0.6), c.position);
    }
  }

  private beginResolve(win: boolean): void {
    if (this.resolving || this.ended) return;
    this.resolving = true;
    this.outcomeWin = win;
    this.resolveTimer = win ? 2.6 : 1.8;
    if (win) {
      this.spawnConfetti();
      this.cam.shake(0.4, 0.4);
      this.hud.floatingText(new Vector3(0, 3.5, -HALF + 4), "ABRAÇO EM GRUPO! ❤️🎉", PALETTE.teal);
    } else {
      this.hud.floatingText(new Vector3(0, 3.5, -HALF + 4), "…de castigo no quarto 😔", PALETTE.purple);
    }
  }

  private commitResult(): void {
    this.ended = true;
    const avg = (this.anger[0] + this.anger[1]) / 2;
    let stars = 0;
    if (this.outcomeWin) {
      const ratio = this.timeLeft / Math.round(BASE_TIME * GameConfig.difficulty.timer);
      stars = 1;
      if (ratio > 0.2) stars = 2;
      if (ratio > 0.4) stars = 3;
    }
    GameConfig.lastResult = {
      phaseName: "Operação Perdão",
      win: this.outcomeWin,
      stars,
      collected: Math.round((1 - avg) * 100),
      goal: 100,
      destruction: avg,
    };
    this.game.goTo(GameState.Result);
  }

  // ─── Loop ───────────────────────────────────────────────────
  update(dt: number): void {
    if (this.ended) return;

    if (this.resolving) {
      this.resolveTimer -= dt;
      this.cam.update(dt, this.players.map((p) => p.position));
      if (this.resolveTimer <= 0) this.commitResult();
      return;
    }

    this.timeLeft -= dt;
    if (this.superCd > 0) this.superCd -= dt;
    this.players.forEach((_, i) => {
      if (this.actionCd[i] > 0) this.actionCd[i] -= dt;
      if (this.performing[i] > 0) this.performing[i] -= dt;
    });

    const forward = this.cam.getGroundForward();
    this.players.forEach((p, i) => {
      const input = this.game.input.getInput(p.slot);
      p.update(dt, input, forward);
      if (input.interact) this.doAction(p, i);
      if (input.pause) this.beginResolve(false);
    });

    this.trySuperFofo();
    this.updateOwnerColors();

    this.cam.update(dt, this.players.map((p) => p.position));
    this.hud.setSplit(this.cam.isSplit);

    const avg = (this.anger[0] + this.anger[1]) / 2;
    this.hud.update({
      objective: `❤️ Raiva — ${OWNERS[0].name}: ${Math.round(this.anger[0] * 100)}%  ·  ${OWNERS[1].name}: ${Math.round(this.anger[1] * 100)}%`,
      timeLeft: this.timeLeft,
      bar: avg,
      barWarn: avg > 0.6,
      players: this.players,
    });

    if (this.anger[0] <= 0 && this.anger[1] <= 0) this.beginResolve(true);
    else if (this.timeLeft <= 0) this.beginResolve(false);
  }

  dispose(): void {
    this.hud.dispose();
    this.players.forEach((p) => p.dispose());
    this.scene.dispose();
  }
}
