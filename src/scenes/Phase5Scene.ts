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
import { GameConfig } from "../utils/GameConfig";
import { enablePhysics } from "../systems/PhysicsSystem";
import { CameraSystem } from "../systems/CameraSystem";
import { createToonMaterial, applyOutline } from "../utils/Visual";
import { createPlayer } from "../entities/createPlayer";
import type { Player, AbilityHooks } from "../entities/Player";
import { Invader } from "../entities/Invader";
import { HUD } from "../ui/HUD";

const ARENA = 30;
const HALF = ARENA / 2;
const HOUSE = new Vector3(0, 0, -HALF + 3);
const HOUSE_R = 3.4;
const ENTER_LIMIT = 3;
const EXPEL_RADIUS = 1.9;
const MAX_INVADERS = 7;
const BOSS_RADIUS = 3.2;
const INVADER_COLORS = ["#8C5A3C", "#7A7A88", "#A86F4C", "#5C6B7A"];

const ENTRIES: Vector3[] = [
  new Vector3(-HALF + 1, 1, 9),
  new Vector3(HALF - 1, 1, 9),
  new Vector3(0, 1, HALF - 1),
  new Vector3(-HALF + 1, 1, 2),
  new Vector3(HALF - 1, 1, 2),
];

/** Fase 5 — "O Vizinho Invasor". */
export class Phase5Scene implements SceneController {
  readonly scene: Scene;
  private cam: CameraSystem;
  private hud: HUD;
  private shadows: ShadowGenerator;

  private players: Player[] = [];
  private invaders: Invader[] = [];

  // galinha caótica
  private chicken!: Mesh;
  private chickenDir = new Vector3(1, 0, 0);
  private chickenDirTimer = 0;

  // boss
  private boss: Invader | null = null;
  private bossSpawned = false;
  private bossExpelTimer = 0;

  private goal: number;
  private expelled = 0;
  private entered = 0;
  private spawnInterval: number;
  private spawnTimer = 1;
  private ended = false;
  private hooks: AbilityHooks;

  constructor(private game: GameManager) {
    this.scene = new Scene(game.engine);
    this.scene.clearColor = Color4.FromHexString("#8FB7D6FF");
    enablePhysics(this.scene, game.havok);
    GameConfig.phase = 5;

    const d = GameConfig.difficulty;
    this.goal = Math.max(8, Math.round(20 * d.objective));
    this.spawnInterval = 1.8 / d.spawnRate;

    const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = 0.85;
    const dir = new DirectionalLight("dir", new Vector3(-0.5, -1, -0.4), this.scene);
    dir.position = new Vector3(15, 25, 15);
    dir.intensity = 1.0;
    this.shadows = new ShadowGenerator(1024, dir);
    this.shadows.useBlurExponentialShadowMap = true;

    this.buildYard();
    this.cam = new CameraSystem(this.scene);

    this.hooks = {
      stunEnemies: (center, radius) => this.barkExpel(center, radius),
      spawnShockwave: () => {},
      floatingText: (pos, text, hex) => this.hud.floatingText(pos, text, hex),
    };

    this.spawnPlayers();
    this.spawnChicken();
    this.hud = new HUD(this.scene, this.players);
  }

  // ─── Cenário ────────────────────────────────────────────────
  private buildYard(): void {
    const floor = MeshBuilder.CreateBox("floor", { width: ARENA, height: 1, depth: ARENA }, this.scene);
    floor.position.y = -0.5;
    const fmat = createToonMaterial(this.scene, "#5FA05F", "grass");
    (fmat as StandardMaterial).emissiveColor = Color3.FromHexString("#4C8C4C").scale(0.3);
    floor.material = fmat;
    floor.receiveShadows = true;
    new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0, friction: 0.6 }, this.scene);

    // muro perimetral (só visual; invasores são cinemáticos)
    const wallH = 2.2;
    const mk = (name: string, w: number, dep: number, x: number, z: number) => {
      const wall = MeshBuilder.CreateBox(name, { width: w, height: wallH, depth: dep }, this.scene);
      wall.position.set(x, wallH / 2, z);
      wall.material = createToonMaterial(this.scene, "#C2B280", name);
      applyOutline(wall, 0.03);
      new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    };
    mk("wW", 0.5, ARENA, -HALF, 0);
    mk("wE", 0.5, ARENA, HALF, 0);
    mk("wN", ARENA, 0.5, 0, HALF);

    // a casa (porta/varanda) — alvo dos invasores
    const house = MeshBuilder.CreateBox("house", { width: 6, height: 3.2, depth: 2 }, this.scene);
    house.position.set(HOUSE.x, 1.6, -HALF + 1);
    house.material = createToonMaterial(this.scene, "#C97B5A", "house");
    applyOutline(house, 0.05);
    new PhysicsAggregate(house, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    const door = MeshBuilder.CreateBox("door", { width: 1.6, height: 2.4, depth: 0.2 }, this.scene);
    door.position.set(HOUSE.x, 1.2, -HALF + 2.05);
    door.material = createToonMaterial(this.scene, "#6B4226", "door");

    const ring = MeshBuilder.CreateTorus("houseRing", { diameter: HOUSE_R * 2, thickness: 0.18, tessellation: 28 }, this.scene);
    ring.position.set(HOUSE.x, 0.06, HOUSE.z);
    const rmat = createToonMaterial(this.scene, PALETTE.pink, "houseRing");
    (rmat as StandardMaterial).emissiveColor = Color3.FromHexString(PALETTE.pink).scale(0.7);
    ring.material = rmat;
  }

  private spawnPlayers(): void {
    const spread = [
      new Vector3(-2, 1, -4),
      new Vector3(2, 1, -4),
      new Vector3(-4, 1, -2),
      new Vector3(4, 1, -2),
    ];
    GameConfig.players.forEach((slot, i) => {
      const p = createPlayer(this.scene, slot, spread[i] ?? new Vector3(0, 1, -3), this.hooks);
      p.registerShadows(this.shadows);
      void p.loadModel();
      this.players.push(p);
    });
  }

  private spawnChicken(): void {
    this.chicken = MeshBuilder.CreateSphere("chicken", { diameterX: 0.6, diameterY: 0.7, diameterZ: 0.8 }, this.scene);
    this.chicken.position.set(0, 0.6, 4);
    this.chicken.material = createToonMaterial(this.scene, "#FFF8F0", "chicken");
    applyOutline(this.chicken, 0.04);
    const comb = MeshBuilder.CreateBox("comb", { width: 0.15, height: 0.2, depth: 0.3 }, this.scene);
    comb.material = createToonMaterial(this.scene, PALETTE.pink, "comb");
    comb.parent = this.chicken;
    comb.position = new Vector3(0, 0.45, 0.15);
    this.shadows.addShadowCaster(this.chicken);
  }

  // ─── Invasores ──────────────────────────────────────────────
  private spawnInvader(): void {
    const entry = ENTRIES[Math.floor(Math.random() * ENTRIES.length)];
    const tough = Math.random() < 0.25 ? 2 : 1;
    const speed = 2.2 + Math.random() * 1.2;
    const color = INVADER_COLORS[Math.floor(Math.random() * INVADER_COLORS.length)];
    const inv = new Invader(this.scene, entry.clone(), tough, speed, color);
    this.shadows.addShadowCaster(inv.mesh);
    this.invaders.push(inv);
  }

  private barkExpel(center: Vector3, radius: number): void {
    for (const inv of this.invaders) {
      if (inv.state !== "advancing") continue;
      if (Math.hypot(inv.position.x - center.x, inv.position.z - center.z) <= radius) {
        if (inv.hit()) {
          this.expelled++;
          this.hud.floatingText(inv.position, "FORA! 🐾", PALETTE.teal);
        }
      }
    }
    if (this.boss && Math.hypot(this.boss.position.x - center.x, this.boss.position.z - center.z) <= radius) {
      this.hud.floatingText(this.boss.position, "o boss resiste! 😼", PALETTE.purple);
    }
  }

  private tryExpel(player: Player): void {
    let best: Invader | null = null;
    let bestDist = EXPEL_RADIUS;
    for (const inv of this.invaders) {
      if (inv.state !== "advancing") continue;
      const d = Math.hypot(inv.position.x - player.position.x, inv.position.z - player.position.z);
      if (d < bestDist) {
        bestDist = d;
        best = inv;
      }
    }
    if (best && best.hit()) {
      this.expelled++;
      this.hud.floatingText(best.position, "FORA! 🐾", PALETTE.teal);
    }
  }

  private updateInvaders(dt: number): void {
    for (let i = this.invaders.length - 1; i >= 0; i--) {
      const inv = this.invaders[i];
      if (inv.state === "advancing") {
        inv.moveTowards(HOUSE, dt);
        if (Math.hypot(inv.position.x - HOUSE.x, inv.position.z - HOUSE.z) < HOUSE_R) {
          this.entered++;
          this.hud.floatingText(inv.position, "entrou! 😱", PALETTE.orange);
          inv.dispose();
          this.invaders.splice(i, 1);
        }
      } else {
        // foge para fora do quintal
        const away = inv.position.subtract(HOUSE);
        away.y = 0;
        const target = inv.position.add(away.normalize().scale(20));
        inv.moveTowards(target, dt);
        if (Math.abs(inv.position.x) > HALF || Math.abs(inv.position.z) > HALF) {
          inv.dispose();
          this.invaders.splice(i, 1);
        }
      }
    }
  }

  // ─── Galinha caótica ────────────────────────────────────────
  private updateChicken(dt: number): void {
    this.chickenDirTimer -= dt;
    if (this.chickenDirTimer <= 0) {
      const a = Math.random() * Math.PI * 2;
      this.chickenDir.set(Math.cos(a), 0, Math.sin(a));
      this.chickenDirTimer = 1 + Math.random() * 1.5;
    }
    const p = this.chicken.position;
    p.addInPlace(this.chickenDir.scale(5 * dt));
    if (Math.abs(p.x) > HALF - 1) this.chickenDir.x *= -1;
    if (Math.abs(p.z) > HALF - 1) this.chickenDir.z *= -1;
    p.x = Math.max(-HALF + 1, Math.min(HALF - 1, p.x));
    p.z = Math.max(-HALF + 1, Math.min(HALF - 1, p.z));
    this.chicken.rotation.y = Math.atan2(this.chickenDir.x, this.chickenDir.z);
    this.chicken.position.y = 0.6 + Math.abs(Math.sin(performance.now() * 0.02)) * 0.2;

    for (const pl of this.players) {
      if (pl.isStunned) continue;
      if (Math.hypot(pl.position.x - p.x, pl.position.z - p.z) < 0.9) {
        pl.stun(1.0);
        this.hud.floatingText(pl.position, "🐔 CÓ-CÓ!", PALETTE.yellow);
        this.chickenDir.scaleInPlace(-1);
      }
    }
  }

  // ─── Boss Gato Gigante ──────────────────────────────────────
  private updateBoss(dt: number): void {
    if (!this.bossSpawned && this.expelled >= Math.ceil(this.goal / 2)) {
      this.bossSpawned = true;
      this.boss = new Invader(this.scene, new Vector3(0, 1, HALF - 1), 99, 1.3, "#3A2E4A");
      this.boss.mesh.scaling.setAll(2.4);
      this.shadows.addShadowCaster(this.boss.mesh);
      this.cam.shake(0.8, 0.5);
      this.hud.floatingText(this.boss.position, "GATO GIGANTE! 2 pets p/ expulsar!", PALETTE.purple);
    }
    if (!this.boss) return;

    this.boss.moveTowards(HOUSE, dt);
    if (Math.hypot(this.boss.position.x - HOUSE.x, this.boss.position.z - HOUSE.z) < HOUSE_R + 1) {
      this.entered++;
      this.hud.floatingText(this.boss.position, "o boss entrou! 😱", PALETTE.orange);
      this.boss.dispose();
      this.boss = null;
      return;
    }
    // QTE: 2+ pets perto por 1.5s
    const near = this.players.filter(
      (p) => Math.hypot(p.position.x - this.boss!.position.x, p.position.z - this.boss!.position.z) < BOSS_RADIUS,
    ).length;
    if (near >= 2) {
      this.bossExpelTimer += dt;
      this.boss.mesh.rotation.z = Math.sin(performance.now() * 0.03) * 0.2;
      if (this.bossExpelTimer >= 1.5) {
        this.expelled++;
        this.hud.floatingText(this.boss.position, "GATO EXPULSO! 🎉", PALETTE.teal);
        this.cam.shake(0.6, 0.4);
        this.boss.dispose();
        this.boss = null;
      }
    } else {
      this.bossExpelTimer = Math.max(0, this.bossExpelTimer - dt);
    }
  }

  // ─── Loop ───────────────────────────────────────────────────
  update(dt: number): void {
    if (this.ended) return;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.invaders.length < MAX_INVADERS) {
      this.spawnInvader();
      this.spawnTimer = this.spawnInterval;
    }

    const forward = this.cam.getGroundForward();
    this.players.forEach((p) => {
      const input = this.game.input.getInput(p.slot);
      p.update(dt, input, forward);
      if (input.interact) this.tryExpel(p);
      if (input.pause) this.finish(false);
    });

    this.updateInvaders(dt);
    this.updateChicken(dt);
    this.updateBoss(dt);

    this.cam.update(dt, this.players.map((p) => p.position));
    this.hud.setSplit(this.cam.isSplit);

    this.hud.update({
      objective: `🐾 Expulsos: ${this.expelled}/${this.goal}   ·   🏠 Entraram: ${this.entered}/${ENTER_LIMIT}`,
      bar: this.entered / ENTER_LIMIT,
      barWarn: this.entered >= ENTER_LIMIT - 1,
      players: this.players,
    });

    if (this.expelled >= this.goal) this.finish(true);
    else if (this.entered >= ENTER_LIMIT) this.finish(false);
  }

  private finish(win: boolean): void {
    if (this.ended) return;
    this.ended = true;

    let stars = 0;
    if (win) {
      stars = 1;
      if (this.entered <= 1) stars = 2;
      if (this.entered === 0) stars = 3;
    }
    GameConfig.lastResult = {
      phaseName: "O Vizinho Invasor",
      win,
      stars,
      collected: this.expelled,
      goal: this.goal,
      destruction: this.entered / ENTER_LIMIT,
    };
    this.game.goTo(GameState.Result);
  }

  dispose(): void {
    this.hud.dispose();
    this.invaders.forEach((inv) => inv.dispose());
    this.players.forEach((p) => p.dispose());
    this.boss?.dispose();
    this.chicken?.dispose();
    this.scene.dispose();
  }
}
