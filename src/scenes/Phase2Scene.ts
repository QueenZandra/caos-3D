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
import { GameState } from "../utils/Constants";
import { GameConfig } from "../utils/GameConfig";
import type { CharId } from "../utils/Constants";
import { enablePhysics } from "../systems/PhysicsSystem";
import { CameraSystem } from "../systems/CameraSystem";
import { createToonMaterial, applyOutline } from "../utils/Visual";
import { createPlayer } from "../entities/createPlayer";
import type { Player, AbilityHooks } from "../entities/Player";
import { Bird } from "../entities/Bird";
import { Nest } from "../objects/Nest";
import { HUD } from "../ui/HUD";
import { PALETTE } from "../utils/Constants";

const ARENA = 28;
const HALF = ARENA / 2;
const PERMANENT_LIMIT = 5;
const BUILD_TIME = 11; // segundos de pássaro pousado para virar permanente
const FLY_SPEED = 7;
const DIVE_SPEED = 11;
const DIVE_TRIGGER = 2.6; // distância p/ o pássaro mergulhar
const DESTROY_H = 1.9; // raio horizontal p/ destruir ninho
const MAX_BIRDS = 5;
const VULTURE_RADIUS = 3.6;

interface SpotDef {
  x: number;
  z: number;
  h: number; // altura do arbusto
  cat: boolean; // ninho alto (só gatos)
}

const SPOTS: SpotDef[] = [
  { x: -8, z: -6, h: 0.6, cat: false },
  { x: 6, z: -8, h: 0.6, cat: false },
  { x: -6, z: 7, h: 0.6, cat: false },
  { x: 9, z: 6, h: 0.6, cat: false },
  { x: 0, z: -10, h: 0.6, cat: false },
  { x: -10, z: 2, h: 2.2, cat: true },
  { x: 10, z: -2, h: 2.2, cat: true },
  { x: 2, z: 10, h: 2.2, cat: true },
  { x: -2, z: 1, h: 2.2, cat: true },
];

function isCat(id: CharId): boolean {
  return id === "minerva" || id === "zoe";
}
function horiz(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Fase 2 — "Os Pássaros Abusados". */
export class Phase2Scene implements SceneController {
  readonly scene: Scene;
  private cam: CameraSystem;
  private hud: HUD;
  private shadows: ShadowGenerator;

  private players: Player[] = [];
  private nests: Nest[] = [];
  private birds: Bird[] = [];

  private goal: number;
  private destroyed = 0;
  private permanent = 0;
  private spawnInterval: number;
  private spawnTimer = 1;
  private buildRate = 1 / BUILD_TIME;
  private ended = false;
  private hooks: AbilityHooks;

  // urubu (twist)
  private vulture: Mesh | null = null;
  private vultureSpawned = false;
  private vultureExpelTimer = 0;

  constructor(private game: GameManager) {
    this.scene = new Scene(game.engine);
    this.scene.clearColor = Color4.FromHexString("#7EC8E3FF"); // céu
    enablePhysics(this.scene, game.havok);
    GameConfig.phase = 2;

    const d = GameConfig.difficulty;
    this.goal = Math.max(3, Math.round(8 * d.objective));
    this.spawnInterval = 2.4 / d.spawnRate;

    // luz
    const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = 0.85;
    const dir = new DirectionalLight("dir", new Vector3(-0.5, -1, -0.4), this.scene);
    dir.position = new Vector3(15, 25, 15);
    dir.intensity = 1.0;
    this.shadows = new ShadowGenerator(1024, dir);
    this.shadows.useBlurExponentialShadowMap = true;

    this.buildYard();
    this.buildNests();

    this.cam = new CameraSystem(this.scene);
    this.hooks = {
      stunEnemies: (center, radius) => this.scareBirds(center, radius),
      spawnShockwave: () => {}, // efeito reutilizável poderia ser plugado aqui
      floatingText: (pos, text, hex) => this.hud.floatingText(pos, text, hex),
    };

    this.spawnPlayers();
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

    // cerca
    const wallH = 2;
    const mk = (name: string, w: number, dep: number, x: number, z: number) => {
      const wall = MeshBuilder.CreateBox(name, { width: w, height: wallH, depth: dep }, this.scene);
      wall.position.set(x, wallH / 2, z);
      wall.material = createToonMaterial(this.scene, "#B98A5E", name);
      applyOutline(wall, 0.03);
      new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    };
    mk("wW", 0.5, ARENA, -HALF, 0);
    mk("wE", 0.5, ARENA, HALF, 0);
    mk("wN", ARENA, 0.5, 0, HALF);
    mk("wS", ARENA, 0.5, 0, -HALF);

    // árvores decorativas nos cantos
    [[-11, -11], [11, 11], [-11, 11], [11, -11]].forEach(([x, z], i) => {
      const trunk = MeshBuilder.CreateCylinder(`trunk_${i}`, { diameter: 0.6, height: 3 }, this.scene);
      trunk.position.set(x, 1.5, z);
      trunk.material = createToonMaterial(this.scene, "#6B4226", `trunk_${i}`);
      const crown = MeshBuilder.CreateSphere(`crown_${i}`, { diameter: 3.5 }, this.scene);
      crown.position.set(x, 3.6, z);
      crown.material = createToonMaterial(this.scene, "#3F9B4F", `crown_${i}`);
      applyOutline(crown, 0.05);
    });
  }

  private buildNests(): void {
    SPOTS.forEach((s, i) => {
      // arbusto
      const bush = MeshBuilder.CreateSphere(`bush_${i}`, { diameter: 1.8, segments: 8 }, this.scene);
      bush.scaling.y = s.h / 1.8 + 0.3;
      bush.position.set(s.x, (s.h * bush.scaling.y) / 2, s.z);
      bush.material = createToonMaterial(this.scene, s.cat ? "#2E7D4F" : "#57B368", `bush_${i}`);
      applyOutline(bush, 0.04);
      new PhysicsAggregate(bush, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);

      const nestY = s.h + 0.35;
      const nest = new Nest(this.scene, new Vector3(s.x, nestY, s.z), s.cat);
      this.nests.push(nest);
    });
  }

  private spawnPlayers(): void {
    const spread = [
      new Vector3(-2, 1, -2),
      new Vector3(2, 1, -2),
      new Vector3(-2, 1, 2),
      new Vector3(2, 1, 2),
    ];
    GameConfig.players.forEach((slot, i) => {
      const p = createPlayer(this.scene, slot, spread[i] ?? new Vector3(0, 1, 0), this.hooks);
      p.registerShadows(this.shadows);
      void p.loadModel();
      this.players.push(p);
    });
  }

  // ─── Pássaros ───────────────────────────────────────────────
  private availableSpot(): number {
    const targeted = new Set(this.birds.filter((b) => b.state !== "leaving").map((b) => b.nestIndex));
    const candidates = this.nests
      .map((n, i) => ({ n, i }))
      .filter(({ n, i }) => n.state === "empty" && !targeted.has(i));
    if (candidates.length === 0) return -1;
    return candidates[Math.floor(Math.random() * candidates.length)].i;
  }

  private spawnBird(): void {
    const idx = this.availableSpot();
    if (idx < 0) return;
    // entra por um ponto alto na borda
    const edge = Math.floor(Math.random() * 4);
    const t = (Math.random() - 0.5) * ARENA;
    const pos = [
      new Vector3(-HALF, 6, t),
      new Vector3(HALF, 6, t),
      new Vector3(t, 6, -HALF),
      new Vector3(t, 6, HALF),
    ][edge];
    const bird = new Bird(this.scene, pos, idx);
    this.shadows.addShadowCaster(bird.mesh);
    this.birds.push(bird);
  }

  private scareBirds(center: Vector3, radius: number): void {
    for (const b of this.birds) {
      if (horiz(b.position, center) <= radius && b.state !== "leaving") {
        b.state = "leaving";
        this.nests[b.nestIndex]?.reset();
        this.hud.floatingText(b.position, "😱", PALETTE.yellow);
      }
    }
  }

  private updateBirds(dt: number): void {
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      const nest = this.nests[b.nestIndex];
      b.bob();

      switch (b.state) {
        case "flying": {
          b.moveTowards(nest.perch, FLY_SPEED, dt);
          if (horiz(b.position, nest.perch) < 0.4) {
            b.mesh.position.copyFrom(nest.perch);
            b.state = "perched";
            nest.claim();
          }
          break;
        }
        case "perched": {
          b.mesh.position.copyFrom(nest.perch);
          const res = nest.build(dt, this.buildRate);
          if (res === "permanent") {
            this.permanent++;
            this.hud.floatingText(nest.position, "🥚!", PALETTE.pink);
            b.state = "leaving";
            break;
          }
          // mãe mergulha em quem se aproxima
          const victim = this.players.findIndex((p) => horiz(p.position, nest.position) < DIVE_TRIGGER && !p.isStunned);
          if (victim >= 0) {
            b.diveTarget = victim;
            b.state = "diving";
          }
          break;
        }
        case "diving": {
          const target = this.players[b.diveTarget];
          if (!target) {
            b.state = "returning";
            break;
          }
          b.moveTowards(target.position.add(new Vector3(0, 0.5, 0)), DIVE_SPEED, dt);
          if (Vector3.Distance(b.position, target.position) < 1.0) {
            target.stun(1.2);
            this.hud.floatingText(target.position, "PECK!", PALETTE.orange);
            b.state = "returning";
          }
          break;
        }
        case "returning": {
          b.moveTowards(nest.perch, FLY_SPEED, dt);
          if (horiz(b.position, nest.perch) < 0.5) b.state = "perched";
          break;
        }
        case "leaving": {
          b.moveTowards(new Vector3(b.position.x * 1.4, 14, b.position.z * 1.4), FLY_SPEED, dt);
          if (b.position.y > 10) {
            b.dispose();
            this.birds.splice(i, 1);
          }
          break;
        }
      }
    }
  }

  // ─── Destruição de ninhos pelos pets ────────────────────────
  private tryDestroy(player: Player): void {
    let best: Nest | null = null;
    let bestDist = DESTROY_H;
    for (const n of this.nests) {
      if (n.state !== "building") continue;
      if (n.requiresCat && !isCat(player.def.id)) continue;
      const d = horiz(player.position, n.position);
      if (d < bestDist) {
        bestDist = d;
        best = n;
      }
    }
    if (!best) {
      // dica quando há ninho alto perto e o pet não é gato
      const highNear = this.nests.some(
        (n) => n.state === "building" && n.requiresCat && !isCat(player.def.id) && horiz(player.position, n.position) < DESTROY_H,
      );
      if (highNear) this.hud.floatingText(player.position, "🐱 só gatos!", PALETTE.purple);
      return;
    }
    const idx = this.nests.indexOf(best);
    best.reset();
    this.destroyed++;
    this.hud.floatingText(player.position, "-1 🪺", PALETTE.teal);
    const bird = this.birds.find((b) => b.nestIndex === idx && b.state !== "leaving");
    if (bird) bird.state = "leaving";
  }

  // ─── Urubu (twist cooperativo) ──────────────────────────────
  private spawnVulture(): void {
    this.vultureSpawned = true;
    const v = MeshBuilder.CreateSphere("vulture", { diameterX: 2.4, diameterY: 2.0, diameterZ: 3.0 }, this.scene);
    v.position.set(0, 1.4, 0);
    v.material = createToonMaterial(this.scene, "#2A2A35", "vulture");
    applyOutline(v, 0.08);
    const beak = MeshBuilder.CreateCylinder("vbeak", { diameterTop: 0, diameterBottom: 0.6, height: 1.0 }, this.scene);
    beak.material = createToonMaterial(this.scene, "#E8A33D", "vbeak");
    beak.parent = v;
    beak.rotation.x = Math.PI / 2;
    beak.position = new Vector3(0, 0.2, 1.7);
    this.shadows.addShadowCaster(v);
    this.vulture = v;
    this.hud.floatingText(v.position, "URUBU! 2 pets p/ expulsar!", PALETTE.pink);
  }

  private updateVulture(dt: number): void {
    if (!this.vultureSpawned && this.destroyed >= Math.ceil(this.goal / 2)) {
      this.spawnVulture();
    }
    if (!this.vulture) return;
    this.vulture.rotation.y += dt * 0.5;
    const near = this.players.filter((p) => horiz(p.position, this.vulture!.position) < VULTURE_RADIUS).length;
    if (near >= 2) {
      this.vultureExpelTimer += dt;
      this.vulture.position.y = 1.4 + Math.sin(performance.now() * 0.02) * 0.2; // treme
      if (this.vultureExpelTimer >= 1.5) {
        this.destroyed++;
        this.hud.floatingText(this.vulture.position, "URUBU EXPULSO! 🎉", PALETTE.teal);
        this.vulture.dispose();
        this.vulture = null;
      }
    } else {
      this.vultureExpelTimer = Math.max(0, this.vultureExpelTimer - dt);
    }
  }

  // ─── Loop ───────────────────────────────────────────────────
  update(dt: number): void {
    if (this.ended) return;

    // spawn de pássaros
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.birds.length < MAX_BIRDS) {
      this.spawnBird();
      this.spawnTimer = this.spawnInterval;
    }

    const forward = this.cam.getGroundForward();
    this.players.forEach((p) => {
      const input = this.game.input.getInput(p.slot);
      p.update(dt, input, forward);
      if (input.interact) this.tryDestroy(p);
      if (input.pause) this.finish(false);
    });

    this.updateBirds(dt);
    this.updateVulture(dt);

    this.cam.update(dt, this.players.map((p) => p.position));
    this.hud.setSplit(this.cam.isSplit);

    this.hud.update({
      objective: `🪺 Destruídos: ${this.destroyed}/${this.goal}   ·   ⚠️ Permanentes: ${this.permanent}/${PERMANENT_LIMIT}`,
      bar: this.permanent / PERMANENT_LIMIT,
      barWarn: this.permanent >= PERMANENT_LIMIT - 1,
      players: this.players,
    });

    if (this.destroyed >= this.goal) this.finish(true);
    else if (this.permanent >= PERMANENT_LIMIT) this.finish(false);
  }

  private finish(win: boolean): void {
    if (this.ended) return;
    this.ended = true;

    let stars = 0;
    if (win) {
      stars = 1;
      if (this.permanent <= 2) stars = 2;
      if (this.permanent === 0) stars = 3;
    }
    GameConfig.lastResult = {
      phaseName: "Os Pássaros Abusados",
      win,
      stars,
      collected: this.destroyed,
      goal: this.goal,
      destruction: this.permanent / PERMANENT_LIMIT,
    };
    this.game.goTo(GameState.Result);
  }

  dispose(): void {
    this.hud.dispose();
    this.birds.forEach((b) => b.dispose());
    this.nests.forEach((n) => n.dispose());
    this.players.forEach((p) => p.dispose());
    this.vulture?.dispose();
    this.scene.dispose();
  }
}
