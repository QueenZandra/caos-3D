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
import { GameConfig } from "../utils/GameConfig";
import { enablePhysics } from "../systems/PhysicsSystem";
import { CameraSystem } from "../systems/CameraSystem";
import { createToonMaterial, applyOutline } from "../utils/Visual";
import { createPlayer } from "../entities/createPlayer";
import type { Player, AbilityHooks } from "../entities/Player";
import { Letter } from "../objects/Letter";
import { Invader } from "../entities/Invader";
import { GiantPuff } from "../entities/GiantPuff";
import { HUD } from "../ui/HUD";

const ARENA = 34;
const HALF = ARENA / 2;
const CENTER_R = 5;
const BIN = new Vector3(-HALF + 4, 0.5, -HALF + 4);
const BIN_R = 2.6;
const DOOR_Z = HALF - 1.5;
const PICKUP_R = 1.6;
const EXPEL_R = 1.9;
const BASE_TIME = 180;
const DANGER_AT = 30;
const MAX_LETTERS = 30;
const MAX_INVADERS = 8;
const LETTER_COLORS = [PALETTE.yellow, PALETTE.blue, PALETTE.pink, PALETTE.teal];
const INVADER_COLORS = ["#8C5A3C", "#7A7A88", "#A86F4C"];
const ENTRIES: Vector3[] = [
  new Vector3(-HALF + 1, 1, HALF - 3),
  new Vector3(HALF - 1, 1, HALF - 3),
  new Vector3(-HALF + 1, 1, 0),
  new Vector3(HALF - 1, 1, 0),
];

/** Fase 7 — "Caos Total". Sobreviva 3 minutos com o caos sob controle. */
export class Phase7Scene implements SceneController {
  readonly scene: Scene;
  private cam: CameraSystem;
  private hud: HUD;
  private shadows: ShadowGenerator;

  private players: Player[] = [];
  private letters: Letter[] = [];
  private invaders: Invader[] = [];
  private puff!: GiantPuff;
  private puffStunCd = 0;

  private timeLeft: number;
  private chaos = 0;
  private letterTimer = 1;
  private invaderTimer = 3;
  private ended = false;
  private danger = false;
  private hooks: AbilityHooks;

  constructor(private game: GameManager) {
    this.scene = new Scene(game.engine);
    this.scene.clearColor = Color4.FromHexString("#221C33FF");
    enablePhysics(this.scene, game.havok);
    GameConfig.phase = 7;

    this.timeLeft = Math.round(BASE_TIME * GameConfig.difficulty.timer);

    const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = 0.8;
    const dir = new DirectionalLight("dir", new Vector3(-0.5, -1, -0.4), this.scene);
    dir.position = new Vector3(15, 28, 15);
    dir.intensity = 1.0;
    this.shadows = new ShadowGenerator(1024, dir);
    this.shadows.useBlurExponentialShadowMap = true;

    this.buildHouse();
    this.cam = new CameraSystem(this.scene);

    this.hooks = {
      stunEnemies: (center, radius) => this.barkArea(center, radius),
      spawnShockwave: () => {},
      floatingText: (pos, text, hex) => this.hud.floatingText(pos, text, hex),
    };

    this.spawnPlayers();
    this.puff = new GiantPuff(this.scene, new Vector3(0, 1.5, 0), "#C9C2D9");
    this.puff.alive = true;
    this.shadows.addShadowCaster(this.puff.mesh);

    this.hud = new HUD(this.scene, this.players);
  }

  // ─── Cenário ────────────────────────────────────────────────
  private buildHouse(): void {
    const floor = MeshBuilder.CreateBox("floor", { width: ARENA, height: 1, depth: ARENA }, this.scene);
    floor.position.y = -0.5;
    const fmat = createToonMaterial(this.scene, "#A88C6B", "floor");
    (fmat as StandardMaterial).emissiveColor = Color3.FromHexString("#8A7050").scale(0.3);
    floor.material = fmat;
    floor.receiveShadows = true;
    new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0, friction: 0.6 }, this.scene);

    const wallH = 3;
    const mk = (name: string, w: number, dep: number, x: number, z: number) => {
      const wall = MeshBuilder.CreateBox(name, { width: w, height: wallH, depth: dep }, this.scene);
      wall.position.set(x, wallH / 2, z);
      wall.material = createToonMaterial(this.scene, "#5C4B7A", name);
      applyOutline(wall, 0.03);
      new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    };
    mk("wW", 0.5, ARENA, -HALF, 0);
    mk("wE", 0.5, ARENA, HALF, 0);
    mk("wS", ARENA, 0.5, 0, -HALF);
    mk("wN1", HALF - 2, 0.5, -(HALF / 2 + 1), HALF);
    mk("wN2", HALF - 2, 0.5, HALF / 2 + 1, HALF);

    // núcleo a proteger (centro)
    const core = MeshBuilder.CreateTorus("core", { diameter: CENTER_R * 2, thickness: 0.2, tessellation: 32 }, this.scene);
    core.position.y = 0.06;
    const cmat = createToonMaterial(this.scene, PALETTE.pink, "core");
    (cmat as StandardMaterial).emissiveColor = Color3.FromHexString(PALETTE.pink).scale(0.6);
    core.material = cmat;

    // lixeira de cartas
    const bin = MeshBuilder.CreateCylinder("bin", { diameter: BIN_R * 1.4, height: 1, tessellation: 16 }, this.scene);
    bin.position.copyFrom(BIN);
    const bmat = createToonMaterial(this.scene, PALETTE.teal, "bin");
    (bmat as StandardMaterial).emissiveColor = Color3.FromHexString(PALETTE.teal).scale(0.6);
    bin.material = bmat;
    applyOutline(bin, 0.05);
  }

  private spawnPlayers(): void {
    const spread = [new Vector3(-2, 1, -2), new Vector3(2, 1, -2), new Vector3(-2, 1, 2), new Vector3(2, 1, 2)];
    GameConfig.players.forEach((slot, i) => {
      const p = createPlayer(this.scene, slot, spread[i] ?? new Vector3(0, 1, 0), this.hooks);
      p.registerShadows(this.shadows);
      void p.loadModel();
      this.players.push(p);
    });
  }

  // ─── Helpers ────────────────────────────────────────────────
  private horiz(a: Vector3, b: Vector3): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  private barkArea(center: Vector3, radius: number): void {
    for (const inv of this.invaders) {
      if (inv.state === "advancing" && this.horiz(inv.position, center) <= radius) inv.hit();
    }
    if (this.horiz(this.puff.position, center) <= radius + this.puff.radius) {
      const away = this.puff.position.subtract(center);
      away.y = 0;
      this.puff.shove(away.normalize(), 26);
    }
  }

  // ─── Spawns ─────────────────────────────────────────────────
  private spawnLetter(): void {
    if (this.letters.length >= MAX_LETTERS) return;
    const x = (Math.random() - 0.5) * 3;
    const l = new Letter(this.scene, new Vector3(x, 0.4, DOOR_Z), LETTER_COLORS[Math.floor(Math.random() * LETTER_COLORS.length)]);
    this.shadows.addShadowCaster(l.mesh);
    l.slideIn(new Vector3((Math.random() - 0.5) * 0.5, 0, -1).normalize(), 2.2 + Math.random());
    this.letters.push(l);
  }

  private spawnInvader(): void {
    if (this.invaders.length >= MAX_INVADERS) return;
    const entry = ENTRIES[Math.floor(Math.random() * ENTRIES.length)];
    const inv = new Invader(this.scene, entry.clone(), 1, 2.2 + Math.random(), INVADER_COLORS[Math.floor(Math.random() * INVADER_COLORS.length)]);
    this.shadows.addShadowCaster(inv.mesh);
    this.invaders.push(inv);
  }

  // ─── Interação ──────────────────────────────────────────────
  private interact(player: Player, index: number): void {
    // 1) expulsar invasor próximo
    for (const inv of this.invaders) {
      if (inv.state === "advancing" && this.horiz(inv.position, player.position) < EXPEL_R) {
        if (inv.hit()) this.hud.floatingText(inv.position, "FORA! 🐾", PALETTE.teal);
        return;
      }
    }
    // 2) pegar carta
    if (player.carrying >= player.carryCapacity) return;
    let best: Letter | null = null;
    let bd = PICKUP_R;
    for (const l of this.letters) {
      if (l.state !== "free") continue;
      const d = Vector3.Distance(l.mesh.position, player.position);
      if (d < bd) {
        bd = d;
        best = l;
      }
    }
    if (best) {
      best.pickUp(index);
      player.carrying++;
    }
  }

  private dropAll(player: Player, index: number): void {
    for (const l of this.letters) if (l.state === "carried" && l.carriedBy === index) l.drop();
    player.carrying = 0;
  }

  private updateCarried(): void {
    const stack: Record<number, number> = {};
    for (const l of this.letters) {
      if (l.state !== "carried" || l.carriedBy === null) continue;
      const idx = l.carriedBy;
      const p = this.players[idx];
      if (!p) continue;
      if (this.horiz(p.position, BIN) < BIN_R) {
        l.destroy();
        p.carrying = Math.max(0, p.carrying - 1);
        this.hud.floatingText(p.position, "+1 🗑️", PALETTE.teal);
        continue;
      }
      const s = stack[idx] ?? 0;
      l.followCarrier(p.position, s);
      stack[idx] = s + 1;
    }
  }

  private updateInvaders(dt: number): number {
    let inside = 0;
    for (let i = this.invaders.length - 1; i >= 0; i--) {
      const inv = this.invaders[i];
      if (inv.state === "advancing") {
        if (this.horiz(inv.position, Vector3.Zero()) > CENTER_R) {
          inv.moveTowards(Vector3.Zero(), dt);
        } else {
          inside++; // chegou ao núcleo → bombeia caos
        }
      } else {
        const dir = new Vector3(inv.position.x, 0, inv.position.z);
        if (dir.lengthSquared() < 0.01) dir.set(1, 0, 0);
        const away = inv.position.add(dir.normalize().scale(20));
        inv.moveTowards(away, dt);
        if (Math.abs(inv.position.x) > HALF || Math.abs(inv.position.z) > HALF) {
          inv.dispose();
          this.invaders.splice(i, 1);
        }
      }
    }
    return inside;
  }

  private updatePuff(dt: number): void {
    let nearest = this.players[0];
    let nd = Infinity;
    for (const p of this.players) {
      const d = this.horiz(p.position, this.puff.position);
      if (d < nd) {
        nd = d;
        nearest = p;
      }
    }
    if (nearest) this.puff.glideToward(nearest.position, 3.0);

    this.puffStunCd -= dt;
    if (this.puffStunCd <= 0) {
      for (const p of this.players) {
        if (!p.isStunned && this.horiz(p.position, this.puff.position) < this.puff.radius + 0.5) {
          p.stun(1.0);
          this.hud.floatingText(p.position, "💫", PALETTE.purple);
          this.puffStunCd = 1.2;
          break;
        }
      }
    }
  }

  // ─── Loop ───────────────────────────────────────────────────
  update(dt: number): void {
    if (this.ended) return;
    this.timeLeft -= dt;

    // sprint final
    if (!this.danger && this.timeLeft <= DANGER_AT) {
      this.danger = true;
      this.hud.setDanger(true);
      this.hud.floatingText(new Vector3(0, 3, 0), "🚨 SPRINT FINAL! 🚨", PALETTE.pink);
    }
    const rush = this.danger ? 0.5 : 1;

    // spawns
    this.letterTimer -= dt;
    if (this.letterTimer <= 0) {
      this.spawnLetter();
      this.letterTimer = (1.0 / GameConfig.difficulty.spawnRate) * rush;
    }
    this.invaderTimer -= dt;
    if (this.invaderTimer <= 0) {
      this.spawnInvader();
      this.invaderTimer = (2.6 / GameConfig.difficulty.spawnRate) * rush;
    }

    const forward = this.cam.getGroundForward();
    this.players.forEach((p, i) => {
      const input = this.game.input.getInput(p.slot);
      p.update(dt, input, forward);
      if (input.interact) this.interact(p, i);
      if (input.drop) this.dropAll(p, i);
      if (input.pause) this.finish(false);
    });

    this.updateCarried();
    const inside = this.updateInvaders(dt);
    this.updatePuff(dt);

    // limpa cartas fora da arena e remove destruídas
    for (const l of this.letters) if (l.state === "free" && l.mesh.position.y < -3) l.destroy();
    this.letters = this.letters.filter((l) => l.state !== "destroyed");
    const onFloor = this.letters.filter((l) => l.state === "free").length;

    // medidor de caos
    this.chaos += dt * (0.006 * onFloor + 0.045 * inside) - dt * 0.02;
    this.chaos = Math.max(0, Math.min(1, this.chaos));

    this.cam.update(dt, this.players.map((p) => p.position));
    this.hud.setSplit(this.cam.isSplit);
    this.updateRadar();

    this.hud.update({
      objective: this.danger
        ? "🚨 SPRINT FINAL — segure o caos!"
        : `🧹 Sobreviva! Cartas: ${onFloor}  ·  Invasores no núcleo: ${inside}`,
      timeLeft: this.timeLeft,
      bar: this.chaos,
      barWarn: this.chaos > 0.7,
      players: this.players,
    });

    if (this.chaos >= 1) this.finish(false);
    else if (this.timeLeft <= 0) this.finish(true);
  }

  private updateRadar(): void {
    const dots: { x: number; z: number; hex: string }[] = [];
    dots.push({ x: 0, z: 0, hex: PALETTE.pink }); // núcleo
    dots.push({ x: BIN.x, z: BIN.z, hex: PALETTE.teal }); // lixeira
    for (const p of this.players) dots.push({ x: p.position.x, z: p.position.z, hex: p.def.color });
    for (const inv of this.invaders) dots.push({ x: inv.position.x, z: inv.position.z, hex: "#FF3B30" });
    dots.push({ x: this.puff.position.x, z: this.puff.position.z, hex: "#FFFFFF" });
    this.hud.radar(HALF, dots);
  }

  private finish(win: boolean): void {
    if (this.ended) return;
    this.ended = true;
    let stars = 0;
    if (win) {
      stars = 1;
      if (this.chaos < 0.6) stars = 2;
      if (this.chaos < 0.35) stars = 3;
    }
    GameConfig.lastResult = {
      phaseName: "Caos Total",
      win,
      stars,
      collected: Math.round((1 - this.chaos) * 100),
      goal: 100,
      destruction: this.chaos,
    };
    this.game.goTo(GameState.Result);
  }

  dispose(): void {
    this.hud.dispose();
    this.letters.forEach((l) => l.dispose());
    this.invaders.forEach((inv) => inv.dispose());
    this.players.forEach((p) => p.dispose());
    this.puff?.dispose();
    this.scene.dispose();
  }
}
