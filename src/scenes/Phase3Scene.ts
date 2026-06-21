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
import { GiantPuff } from "../entities/GiantPuff";
import { Cushion } from "../objects/Cushion";
import { HUD } from "../ui/HUD";

const ARENA = 28;
const HALF = ARENA / 2;
const NUM_CUSHIONS = 24;
const MIN_INTACT = 12;
const BASE_TIME = 120;
const BED = new Vector3(-HALF + 4.5, 0, -HALF + 4.5);
const BED_RADIUS = 3.6;
const PICKUP_RADIUS = 1.6;
const WIND_INTERVAL = 6;
const GUST_INTERVAL = 30;
const ALIVE_AT = 4; // segundos até o puff "ganhar vida"
const PUFF_SPEED = 3.2;
const CUSHION_COLORS = [PALETTE.pink, PALETTE.purple, PALETTE.blue, PALETTE.yellow, PALETTE.teal];

/** Fase 3 — "A Rebelião das Almofadas". */
export class Phase3Scene implements SceneController {
  readonly scene: Scene;
  private cam: CameraSystem;
  private hud: HUD;
  private shadows: ShadowGenerator;

  private players: Player[] = [];
  private cushions: Cushion[] = [];
  private puff!: GiantPuff;

  private timeLeft: number;
  private windTimer = WIND_INTERVAL;
  private gustTimer = GUST_INTERVAL;
  private elapsed = 0;
  private shakeCooldown = 0;
  private ended = false;
  private hooks: AbilityHooks;

  constructor(private game: GameManager) {
    this.scene = new Scene(game.engine);
    this.scene.clearColor = Color4.FromHexString("#2B2335FF");
    enablePhysics(this.scene, game.havok);
    GameConfig.phase = 3;

    this.timeLeft = Math.round(BASE_TIME * GameConfig.difficulty.timer);

    const hemi = new HemisphericLight("hemi", new Vector3(0.3, 1, 0.2), this.scene);
    hemi.intensity = 0.8;
    const dir = new DirectionalLight("dir", new Vector3(-0.5, -1, -0.3), this.scene);
    dir.position = new Vector3(12, 22, 12);
    dir.intensity = 1.0;
    this.shadows = new ShadowGenerator(1024, dir);
    this.shadows.useBlurExponentialShadowMap = true;

    this.buildRoom();
    this.cam = new CameraSystem(this.scene);

    this.hooks = {
      stunEnemies: (center, radius) => {
        if (Vector3.Distance(this.puff.position, center) <= radius + this.puff.radius) {
          const away = this.puff.position.subtract(center);
          away.y = 0;
          this.puff.shove(away.normalize(), 28);
          this.hud.floatingText(this.puff.position, "💨 repelido!", PALETTE.teal);
        }
      },
      spawnShockwave: () => {},
      floatingText: (pos, text, hex) => this.hud.floatingText(pos, text, hex),
    };

    this.spawnPlayers();
    this.puff = new GiantPuff(this.scene, new Vector3(0, 1.5, 0), "#C9C2D9");
    this.shadows.addShadowCaster(this.puff.mesh);
    this.spawnCushions();

    this.hud = new HUD(this.scene, this.players);
  }

  // ─── Cenário ────────────────────────────────────────────────
  private buildRoom(): void {
    const floor = MeshBuilder.CreateBox(
      "floor",
      { width: ARENA, height: 1, depth: ARENA },
      this.scene,
    );
    floor.position.y = -0.5;
    const fmat = createToonMaterial(this.scene, "#9A6B5A", "carpet");
    (fmat as StandardMaterial).emissiveColor = Color3.FromHexString("#7A4F44").scale(0.3);
    floor.material = fmat;
    floor.receiveShadows = true;
    new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0, friction: 0.6 }, this.scene);

    const wallH = 3;
    const mk = (name: string, w: number, dep: number, x: number, z: number) => {
      const wall = MeshBuilder.CreateBox(name, { width: w, height: wallH, depth: dep }, this.scene);
      wall.position.set(x, wallH / 2, z);
      wall.material = createToonMaterial(this.scene, "#6E5A8C", name);
      applyOutline(wall, 0.04);
      new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    };
    mk("wW", 0.5, ARENA, -HALF, 0);
    mk("wE", 0.5, ARENA, HALF, 0);
    mk("wN", ARENA, 0.5, 0, HALF);
    mk("wS", ARENA, 0.5, 0, -HALF);

    // zona segura (cama/colchão) — almofadas aqui ficam protegidas
    const bed = MeshBuilder.CreateBox(
      "bed",
      { width: BED_RADIUS * 2, height: 0.4, depth: BED_RADIUS * 2 },
      this.scene,
    );
    bed.position.set(BED.x, 0.2, BED.z);
    const bmat = createToonMaterial(this.scene, PALETTE.teal, "bed");
    (bmat as StandardMaterial).emissiveColor = Color3.FromHexString(PALETTE.teal).scale(0.4);
    bed.material = bmat;
    applyOutline(bed, 0.04);
    bed.receiveShadows = true;
    new PhysicsAggregate(bed, PhysicsShapeType.BOX, { mass: 0, friction: 0.7 }, this.scene);

    const ring = MeshBuilder.CreateTorus(
      "bedRing",
      { diameter: BED_RADIUS * 2, thickness: 0.18, tessellation: 28 },
      this.scene,
    );
    ring.position.set(BED.x, 0.45, BED.z);
    const rmat = createToonMaterial(this.scene, PALETTE.teal, "bedRing");
    (rmat as StandardMaterial).emissiveColor = Color3.FromHexString(PALETTE.teal).scale(0.8);
    ring.material = rmat;
  }

  private spawnPlayers(): void {
    const spread = [
      new Vector3(3, 1, 3),
      new Vector3(6, 1, 3),
      new Vector3(3, 1, 6),
      new Vector3(6, 1, 6),
    ];
    GameConfig.players.forEach((slot, i) => {
      const p = createPlayer(this.scene, slot, spread[i] ?? new Vector3(4, 1, 4), this.hooks);
      p.registerShadows(this.shadows);
      void p.loadModel();
      this.players.push(p);
    });
  }

  private spawnCushions(): void {
    for (let i = 0; i < NUM_CUSHIONS; i++) {
      // dispostas em anel ao redor do centro (longe do puff no início)
      const ang = (i / NUM_CUSHIONS) * Math.PI * 2;
      const r = 6 + (i % 3) * 1.6;
      const pos = new Vector3(Math.cos(ang) * r, 0.4, Math.sin(ang) * r);
      const c = new Cushion(this.scene, pos, CUSHION_COLORS[i % CUSHION_COLORS.length]);
      this.shadows.addShadowCaster(c.mesh);
      this.cushions.push(c);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────
  private horiz(a: Vector3, b: Vector3): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }
  private isSafe(c: Cushion): boolean {
    return c.state === "carried" || this.horiz(c.position, BED) < BED_RADIUS;
  }

  private tryPickup(player: Player, index: number): void {
    if (player.carrying >= player.carryCapacity) return;
    let best: Cushion | null = null;
    let bestDist = PICKUP_RADIUS;
    for (const c of this.cushions) {
      if (c.state !== "free") continue;
      const d = Vector3.Distance(c.position, player.position);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (best) {
      best.pickUp(index);
      player.carrying++;
    }
  }

  private dropAll(player: Player, index: number, forward: Vector3): void {
    for (const c of this.cushions) {
      if (c.state === "carried" && c.carriedBy === index) c.drop(forward);
    }
    player.carrying = 0;
  }

  private updateCarried(): void {
    const stack: Record<number, number> = {};
    for (const c of this.cushions) {
      if (c.state !== "carried" || c.carriedBy === null) continue;
      const idx = c.carriedBy;
      const p = this.players[idx];
      if (!p) continue;
      const s = stack[idx] ?? 0;
      c.followCarrier(p.position, s);
      stack[idx] = s + 1;
    }
  }

  // ─── Puff ───────────────────────────────────────────────────
  private updatePuff(dt: number): void {
    if (!this.puff.alive && this.elapsed >= ALIVE_AT) {
      this.puff.alive = true;
      this.hud.floatingText(this.puff.position, "O PUFF GANHOU VIDA! 👀", PALETTE.pink);
    }

    // persegue o pet mais próximo
    if (this.puff.alive && this.players.length > 0) {
      let nearest = this.players[0];
      let nd = Infinity;
      for (const p of this.players) {
        const d = this.horiz(p.position, this.puff.position);
        if (d < nd) {
          nd = d;
          nearest = p;
        }
      }
      this.puff.glideToward(nearest.position, PUFF_SPEED);
    }

    // rajada lateral periódica (rola pelo corredor)
    this.gustTimer -= dt;
    if (this.gustTimer <= 0) {
      const a = Math.random() * Math.PI * 2;
      this.puff.shove(new Vector3(Math.cos(a), 0, Math.sin(a)), 40);
      this.gustTimer = GUST_INTERVAL;
    }

    // câmera treme ao bater na parede
    this.shakeCooldown -= dt;
    const near =
      Math.abs(this.puff.position.x) > HALF - 2 || Math.abs(this.puff.position.z) > HALF - 2;
    if (near && this.puff.speed > 4 && this.shakeCooldown <= 0) {
      this.cam.shake(0.7, 0.35);
      this.shakeCooldown = 0.8;
    }

    // destrói almofadas livres desprotegidas que o puff toca
    for (const c of this.cushions) {
      if (c.state !== "free" || this.isSafe(c)) continue;
      if (this.horiz(c.position, this.puff.position) < this.puff.radius + 0.5) {
        c.destroy();
        this.hud.floatingText(c.position, "💥", PALETTE.orange);
      }
    }
  }

  // ─── Loop ───────────────────────────────────────────────────
  update(dt: number): void {
    if (this.ended) return;
    this.elapsed += dt;
    this.timeLeft -= dt;

    // vento periódico
    this.windTimer -= dt;
    if (this.windTimer <= 0) {
      const a = Math.random() * Math.PI * 2;
      const wind = new Vector3(Math.cos(a), 0, Math.sin(a));
      for (const c of this.cushions) c.applyWind(wind, 2.2);
      this.hud.floatingText(new Vector3(0, 2, 0), "💨 Vento!", PALETTE.blue);
      this.windTimer = WIND_INTERVAL;
    }

    const forward = this.cam.getGroundForward();
    this.players.forEach((p, i) => {
      const input = this.game.input.getInput(p.slot);
      p.update(dt, input, forward);
      if (input.interact) this.tryPickup(p, i);
      if (input.drop) this.dropAll(p, i, forward);
    });

    this.updateCarried();
    this.updatePuff(dt);

    this.cam.update(
      dt,
      this.players.map((p) => p.position),
    );
    this.hud.setSplit(this.cam.isSplit);

    // remove destruídas
    this.cushions = this.cushions.filter((c) => c.state !== "destroyed");
    const intact = this.cushions.length;
    const destroyed = NUM_CUSHIONS - intact;

    this.hud.update({
      objective: `🛋️ Almofadas intactas: ${intact}/${NUM_CUSHIONS} (mín. ${MIN_INTACT})`,
      timeLeft: this.timeLeft,
      bar: destroyed / (NUM_CUSHIONS - MIN_INTACT + 1),
      barWarn: intact <= MIN_INTACT + 2,
      showCarry: true,
      players: this.players,
    });

    if (intact < MIN_INTACT) this.finish(false);
    else if (this.timeLeft <= 0) this.finish(true);
  }

  private finish(win: boolean): void {
    if (this.ended) return;
    this.ended = true;

    const intact = this.cushions.filter((c) => c.state !== "destroyed").length;
    let stars = 0;
    if (win) {
      stars = 1;
      if (intact >= 16) stars = 2;
      if (intact >= 20) stars = 3;
    }
    GameConfig.lastResult = {
      phaseName: "A Rebelião das Almofadas",
      win,
      stars,
      collected: intact,
      goal: NUM_CUSHIONS,
      destruction: (NUM_CUSHIONS - intact) / NUM_CUSHIONS,
    };
    this.game.goTo(GameState.Result);
  }

  dispose(): void {
    this.hud.dispose();
    this.cushions.forEach((c) => c.dispose());
    this.players.forEach((p) => p.dispose());
    this.puff?.dispose();
    this.scene.dispose();
  }
}
