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
import type { CharId } from "../utils/Constants";
import { GameConfig } from "../utils/GameConfig";
import { enablePhysics } from "../systems/PhysicsSystem";
import { CameraSystem } from "../systems/CameraSystem";
import { createToonMaterial, applyOutline } from "../utils/Visual";
import { createPlayer } from "../entities/createPlayer";
import type { Player, AbilityHooks } from "../entities/Player";
import { Food } from "../objects/Food";
import { HUD } from "../ui/HUD";

const ARENA = 28;
const HALF = ARENA / 2;
const BROKEN_LIMIT = 5;
const BASE_TIME = 100;
const PLATE = new Vector3(0, 0, -10);
const PLATE_R = 2.6;
const PICKUP_H = 1.5;
const BOOST_RANGE = 2.2;
const BOOST_TIME = 4;
const BREAK_Y = 0.7;
const COUNTER_TOP = 1.7;
const FOOD_COLORS = [PALETTE.orange, PALETTE.yellow, PALETTE.pink, PALETTE.teal, PALETTE.blue];
const COUNTERS = [
  { x: -8, z: -5 },
  { x: 8, z: -5 },
  { x: 0, z: 7 },
];

function isCat(id: CharId): boolean {
  return id === "minerva" || id === "zoe";
}

/** Fase 4 — "O Roubo Épico da Cozinha". */
export class Phase4Scene implements SceneController {
  readonly scene: Scene;
  private cam: CameraSystem;
  private hud: HUD;
  private shadows: ShadowGenerator;

  private players: Player[] = [];
  private foods: Food[] = [];

  private goal: number;
  private collected = 0;
  private broken = 0;
  private timeLeft: number;
  private ended = false;
  private hooks: AbilityHooks;

  constructor(private game: GameManager) {
    this.scene = new Scene(game.engine);
    this.scene.clearColor = Color4.FromHexString("#1E2630FF"); // luz fria de cozinha
    enablePhysics(this.scene, game.havok);
    GameConfig.phase = 4;

    const d = GameConfig.difficulty;
    this.goal = Math.max(5, Math.round(10 * d.objective));
    this.timeLeft = Math.round(BASE_TIME * d.timer);

    const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = 0.7;
    hemi.diffuse = Color3.FromHexString("#CFE8FF"); // tom frio
    const dir = new DirectionalLight("dir", new Vector3(-0.4, -1, -0.3), this.scene);
    dir.position = new Vector3(12, 22, 12);
    dir.intensity = 1.0;
    this.shadows = new ShadowGenerator(1024, dir);
    this.shadows.useBlurExponentialShadowMap = true;

    this.buildKitchen();
    this.cam = new CameraSystem(this.scene);

    this.hooks = {
      stunEnemies: () => {},
      spawnShockwave: () => {},
      floatingText: (pos, text, hex) => this.hud.floatingText(pos, text, hex),
    };

    this.spawnPlayers();
    this.spawnFoods();
    this.hud = new HUD(this.scene, this.players);
    this.hud.setObjective(PLATE); // seta aponta o prato
  }

  // ─── Cenário ────────────────────────────────────────────────
  private buildKitchen(): void {
    const floor = MeshBuilder.CreateBox(
      "floor",
      { width: ARENA, height: 1, depth: ARENA },
      this.scene,
    );
    floor.position.y = -0.5;
    const fmat = createToonMaterial(this.scene, "#D7DCE3", "tile");
    (fmat as StandardMaterial).emissiveColor = Color3.FromHexString("#AAB4C0").scale(0.25);
    floor.material = fmat;
    floor.receiveShadows = true;
    new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0, friction: 0.6 }, this.scene);

    const wallH = 3.2;
    const mk = (name: string, w: number, dep: number, x: number, z: number) => {
      const wall = MeshBuilder.CreateBox(name, { width: w, height: wallH, depth: dep }, this.scene);
      wall.position.set(x, wallH / 2, z);
      wall.material = createToonMaterial(this.scene, "#8FA3B0", name);
      applyOutline(wall, 0.04);
      new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    };
    mk("wW", 0.5, ARENA, -HALF, 0);
    mk("wE", 0.5, ARENA, HALF, 0);
    mk("wN", ARENA, 0.5, 0, HALF);
    mk("wS", ARENA, 0.5, 0, -HALF);

    // bancadas (colliders) — os gatos sobem; cães precisam de boost
    COUNTERS.forEach((c, i) => {
      const counter = MeshBuilder.CreateBox(
        `counter_${i}`,
        { width: 3.4, height: COUNTER_TOP, depth: 3.0 },
        this.scene,
      );
      counter.position.set(c.x, COUNTER_TOP / 2, c.z);
      counter.material = createToonMaterial(this.scene, "#B5926A", `counter_${i}`);
      applyOutline(counter, 0.04);
      counter.receiveShadows = true;
      new PhysicsAggregate(counter, PhysicsShapeType.BOX, { mass: 0, friction: 0.7 }, this.scene);
    });

    // prato de entrega (zona no chão)
    const plate = MeshBuilder.CreateCylinder(
      "plate",
      { diameter: PLATE_R * 1.6, height: 0.2, tessellation: 24 },
      this.scene,
    );
    plate.position.set(PLATE.x, 0.1, PLATE.z);
    const pmat = createToonMaterial(this.scene, PALETTE.teal, "plate");
    (pmat as StandardMaterial).emissiveColor = Color3.FromHexString(PALETTE.teal).scale(0.5);
    plate.material = pmat;
    applyOutline(plate, 0.04);
    const ring = MeshBuilder.CreateTorus(
      "plateRing",
      { diameter: PLATE_R * 2, thickness: 0.16, tessellation: 28 },
      this.scene,
    );
    ring.position.set(PLATE.x, 0.12, PLATE.z);
    const rmat = createToonMaterial(this.scene, PALETTE.teal, "plateRing");
    (rmat as StandardMaterial).emissiveColor = Color3.FromHexString(PALETTE.teal).scale(0.8);
    ring.material = rmat;

    // geladeira com bolo brilhante (decorativo)
    const fridge = MeshBuilder.CreateBox(
      "fridge",
      { width: 2.4, height: 4, depth: 1.6 },
      this.scene,
    );
    fridge.position.set(HALF - 1.4, 2, 8);
    fridge.material = createToonMaterial(this.scene, "#E8EEF2", "fridge");
    applyOutline(fridge, 0.05);
    new PhysicsAggregate(fridge, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    const cake = MeshBuilder.CreateCylinder(
      "cake",
      { diameter: 0.9, height: 0.6, tessellation: 16 },
      this.scene,
    );
    cake.position.set(HALF - 2.4, 1.2, 7.4);
    const cmat = createToonMaterial(this.scene, PALETTE.pink, "cake");
    (cmat as StandardMaterial).emissiveColor = Color3.FromHexString(PALETTE.pink);
    cake.material = cmat;
    applyOutline(cake, 0.04);
  }

  private spawnPlayers(): void {
    const spread = [
      new Vector3(-2, 1, -10),
      new Vector3(2, 1, -10),
      new Vector3(-4, 1, -8),
      new Vector3(4, 1, -8),
    ];
    GameConfig.players.forEach((slot, i) => {
      const p = createPlayer(this.scene, slot, spread[i] ?? new Vector3(0, 1, -9), this.hooks);
      p.registerShadows(this.shadows);
      void p.loadModel();
      this.players.push(p);
    });
  }

  private spawnFoods(): void {
    // 5 comidas por bancada: 3 avulsas + 1 pilha de 2 (cascata)
    const offs = [
      { dx: -0.8, dz: -0.7 },
      { dx: 0.8, dz: -0.7 },
      { dx: 0.8, dz: 0.7 },
    ];
    COUNTERS.forEach((c, ci) => {
      offs.forEach((o, oi) => {
        const pos = new Vector3(c.x + o.dx, COUNTER_TOP + 0.3, c.z + o.dz);
        this.foods.push(this.mkFood(pos, ci * 5 + oi, true));
      });
      // pilha de 2 no canto da bancada
      const base = new Vector3(c.x - 0.8, COUNTER_TOP + 0.3, c.z + 0.7);
      const top = new Vector3(c.x - 0.8, COUNTER_TOP + 0.85, c.z + 0.7);
      this.foods.push(this.mkFood(base, ci * 5 + 3, true));
      this.foods.push(this.mkFood(top, ci * 5 + 4, true, ci === 2));
    });
  }

  private mkFood(pos: Vector3, i: number, high: boolean, special = false): Food {
    const f = new Food(this.scene, pos, FOOD_COLORS[i % FOOD_COLORS.length], high, special);
    this.shadows.addShadowCaster(f.mesh);
    return f;
  }

  // ─── Helpers ────────────────────────────────────────────────
  private horiz(a: Vector3, b: Vector3): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }
  private canGrabHigh(p: Player): boolean {
    return isCat(p.def.id) || p.boosted;
  }

  private tryBoost(player: Player, index: number): void {
    if (isCat(player.def.id)) return; // gatos não precisam
    const helper = this.players.some(
      (o, j) => j !== index && this.horiz(o.position, player.position) < BOOST_RANGE,
    );
    if (helper) {
      player.boost(BOOST_TIME);
      this.hud.floatingText(player.position, "BOOST! 🤝", PALETTE.yellow);
    }
  }

  private tryPickup(player: Player, index: number): void {
    if (player.carrying >= player.carryCapacity) return;
    let best: Food | null = null;
    let bestDist = PICKUP_H;
    for (const f of this.foods) {
      if (f.state !== "free") continue;
      if (f.high && !this.canGrabHigh(player)) continue;
      const d = this.horiz(f.position, player.position);
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
    if (best) {
      best.pickUp(index);
      player.carrying++;
    } else {
      const highNear = this.foods.some(
        (f) =>
          f.state === "free" &&
          f.high &&
          !this.canGrabHigh(player) &&
          this.horiz(f.position, player.position) < PICKUP_H,
      );
      if (highNear) this.hud.floatingText(player.position, "🐱 ou BOOST (△/Y)!", PALETTE.purple);
    }
  }

  private dropAll(player: Player, index: number): void {
    for (const f of this.foods) {
      if (f.state === "carried" && f.carriedBy === index) f.drop();
    }
    player.carrying = 0;
  }

  private updateCarried(): void {
    const stack: Record<number, number> = {};
    for (const f of this.foods) {
      if (f.state !== "carried" || f.carriedBy === null) continue;
      const idx = f.carriedBy;
      const p = this.players[idx];
      if (!p) continue;
      // entrega automática no prato
      if (this.horiz(p.position, PLATE) < PLATE_R) {
        f.collect();
        this.collected++;
        p.carrying = Math.max(0, p.carrying - 1);
        this.hud.floatingText(p.position, "+1 🍖", PALETTE.teal);
        continue;
      }
      const s = stack[idx] ?? 0;
      f.followCarrier(p.position, s);
      stack[idx] = s + 1;
    }
  }

  /** Destaca em vermelho as comidas empilhadas acima da comida "mirada". */
  private updatePreview(): void {
    for (const f of this.foods) if (f.state === "free") f.setHighlight(false);
    for (const p of this.players) {
      let hovered: Food | null = null;
      let hd = 1.6;
      for (const f of this.foods) {
        if (f.state !== "free") continue;
        if (f.high && !this.canGrabHigh(p)) continue;
        const d = this.horiz(f.position, p.position);
        if (d < hd) {
          hd = d;
          hovered = f;
        }
      }
      if (!hovered) continue;
      for (const f of this.foods) {
        if (f.state !== "free" || f === hovered) continue;
        if (
          this.horiz(f.position, hovered.position) < 0.6 &&
          f.position.y > hovered.position.y + 0.2
        ) {
          f.setHighlight(true);
        }
      }
    }
  }

  // ─── Loop ───────────────────────────────────────────────────
  update(dt: number): void {
    if (this.ended) return;
    this.timeLeft -= dt;

    const forward = this.cam.getGroundForward();
    this.players.forEach((p, i) => {
      const input = this.game.input.getInput(p.slot);
      p.update(dt, input, forward);
      if (input.interact) this.tryPickup(p, i);
      if (input.joint) this.tryBoost(p, i);
      if (input.drop) this.dropAll(p, i);
    });

    this.updateCarried();
    this.updatePreview();

    // coleta de comidas livres no prato + quebra de vítimas de cascata
    for (const f of this.foods) {
      if (f.state !== "free") continue;
      if (this.horiz(f.position, PLATE) < PLATE_R && f.position.y < 1.0) {
        f.collect();
        this.collected++;
        this.hud.floatingText(f.position, "+1 🍖", PALETTE.teal);
      } else if (!f.everCarried && f.position.y < BREAK_Y) {
        f.break();
        this.broken++;
        this.hud.floatingText(f.position, "💥 quebrou!", PALETTE.orange);
      }
    }
    this.foods = this.foods.filter((f) => f.state !== "collected");

    this.cam.update(
      dt,
      this.players.map((p) => p.position),
    );
    this.hud.setSplit(this.cam.isSplit);

    this.hud.update({
      objective: `🍖 Comidas: ${this.collected}/${this.goal}   ·   💥 Quebradas: ${this.broken}/${BROKEN_LIMIT}`,
      timeLeft: this.timeLeft,
      bar: this.broken / (BROKEN_LIMIT + 1),
      barWarn: this.broken >= BROKEN_LIMIT - 1,
      showCarry: true,
      players: this.players,
    });

    if (this.collected >= this.goal) this.finish(true);
    else if (this.broken > BROKEN_LIMIT || this.timeLeft <= 0) this.finish(false);
  }

  private finish(win: boolean): void {
    if (this.ended) return;
    this.ended = true;

    let stars = 0;
    if (win) {
      stars = 1;
      if (this.broken <= 2) stars = 2;
      if (this.broken === 0) stars = 3;
    }
    GameConfig.lastResult = {
      phaseName: "O Roubo Épico da Cozinha",
      win,
      stars,
      collected: this.collected,
      goal: this.goal,
      destruction: this.broken / (BROKEN_LIMIT + 1),
    };
    this.game.goTo(GameState.Result);
  }

  dispose(): void {
    this.hud.dispose();
    this.foods.forEach((f) => f.dispose());
    this.players.forEach((p) => p.dispose());
    this.scene.dispose();
  }
}
