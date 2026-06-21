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
import { enablePhysics } from "../systems/PhysicsSystem";
import { CameraSystem } from "../systems/CameraSystem";
import { createToonMaterial, applyOutline } from "../utils/Visual";
import { createPlayer } from "../entities/createPlayer";
import type { Player, AbilityHooks } from "../entities/Player";
import { Mailman } from "../entities/Mailman";
import { Letter } from "../objects/Letter";
import { HUD } from "../ui/HUD";
import { PALETTE } from "../utils/Constants";
import { Audio } from "../systems/AudioManager";

const ARENA = 28; // lado interno
const HALF = ARENA / 2;
const BIN_POS = new Vector3(-HALF + 3, 0.5, -HALF + 3);
const BIN_RADIUS = 2.4;
const PICKUP_RADIUS = 1.6;
const DOOR_Z = HALF - 1.5;
const LETTER_COLORS = [PALETTE.yellow, PALETTE.blue, PALETTE.pink, PALETTE.teal, PALETTE.cream];

interface Effect {
  mesh: Mesh;
  life: number;
  maxLife: number;
  radius: number;
}

/** Fase 1 — "O Carteiro do Mal". Colete/entregue cartas antes do tempo acabar. */
export class Phase1Scene implements SceneController {
  readonly scene: Scene;
  private cam: CameraSystem;
  private hud: HUD;
  private shadows: ShadowGenerator;

  private players: Player[] = [];
  private letters: Letter[] = [];
  private mailman: Mailman;
  private effects: Effect[] = [];

  // gameplay
  private goal: number;
  private timeLimit: number;
  private timeLeft: number;
  private collected = 0;
  private peakFloor = 0;
  private spawnInterval: number;
  private spawnTimer = 0;
  private ended = false;
  private hooks: AbilityHooks;

  constructor(private game: GameManager) {
    this.scene = new Scene(game.engine);
    this.scene.clearColor = Color4.FromHexString("#2B2B45FF");
    enablePhysics(this.scene, game.havok);
    GameConfig.phase = 1;

    // dificuldade (DifficultyScaler do GDD)
    const d = GameConfig.difficulty;
    this.goal = Math.max(8, Math.round(30 * d.objective));
    this.timeLimit = Math.round(90 * d.timer);
    this.timeLeft = this.timeLimit;
    this.spawnInterval = 1.2 / d.spawnRate;

    // iluminação
    const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = 0.75;
    const dir = new DirectionalLight("dir", new Vector3(-0.5, -1, -0.4), this.scene);
    dir.position = new Vector3(15, 25, 15);
    dir.intensity = 1.1;
    this.shadows = new ShadowGenerator(1024, dir);
    this.shadows.useBlurExponentialShadowMap = true;
    this.shadows.blurScale = 2;

    this.buildArena();
    this.buildBin();

    this.cam = new CameraSystem(this.scene);

    // ganchos de habilidade
    this.hooks = {
      stunEnemies: (center, radius, sec) => {
        if (Vector3.Distance(this.mailman.position, center) <= radius) {
          this.mailman.stun(sec);
          this.hud.floatingText(this.mailman.position, "💫", PALETTE.yellow);
        }
      },
      spawnShockwave: (center, radius, hex) => this.spawnShockwave(center, radius, hex),
      floatingText: (pos, text, hex) => this.hud.floatingText(pos, text, hex),
    };

    // carteiro (fora, na "janela")
    this.mailman = new Mailman(this.scene, new Vector3(0, 1, HALF + 2));

    this.spawnPlayers();

    // HUD precisa dos players prontos
    this.hud = new HUD(this.scene, this.players);
  }

  // ─── Construção do cenário ──────────────────────────────────
  private buildArena(): void {
    // chão (box fino para colisão confiável)
    const floor = MeshBuilder.CreateBox("floor", { width: ARENA, height: 1, depth: ARENA }, this.scene);
    floor.position.y = -0.5;
    const floorMat = createToonMaterial(this.scene, "#C8A06B", "floor");
    (floorMat as StandardMaterial).emissiveColor = Color3.FromHexString("#C8A06B").scale(0.2);
    floor.material = floorMat;
    floor.receiveShadows = true;
    new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0, friction: 0.6 }, this.scene);

    // paredes (com vão de porta no +Z)
    const wallH = 3;
    const mk = (name: string, w: number, d: number, x: number, z: number) => {
      const wall = MeshBuilder.CreateBox(name, { width: w, height: wallH, depth: d }, this.scene);
      wall.position.set(x, wallH / 2, z);
      wall.material = createToonMaterial(this.scene, "#8C5A3C", name);
      applyOutline(wall, 0.04);
      new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0, friction: 0.4 }, this.scene);
    };
    mk("wallW", 0.6, ARENA, -HALF, 0);
    mk("wallE", 0.6, ARENA, HALF, 0);
    mk("wallS", ARENA, 0.6, 0, -HALF);
    // parede norte dividida (vão central = porta)
    const doorGap = 4;
    const seg = (ARENA - doorGap) / 2;
    mk("wallN1", seg, 0.6, -(doorGap / 2 + seg / 2), HALF);
    mk("wallN2", seg, 0.6, doorGap / 2 + seg / 2, HALF);
  }

  private buildBin(): void {
    const bin = MeshBuilder.CreateCylinder("bin", { diameter: BIN_RADIUS * 1.4, height: 1, tessellation: 16 }, this.scene);
    bin.position.copyFrom(BIN_POS);
    const mat = createToonMaterial(this.scene, PALETTE.teal, "bin");
    (mat as StandardMaterial).emissiveColor = Color3.FromHexString(PALETTE.teal).scale(0.6);
    bin.material = mat;
    applyOutline(bin, 0.05);
    // anel de destaque no chão
    const ring = MeshBuilder.CreateTorus("binRing", { diameter: BIN_RADIUS * 2, thickness: 0.18, tessellation: 24 }, this.scene);
    ring.position.set(BIN_POS.x, 0.06, BIN_POS.z);
    const ringMat = createToonMaterial(this.scene, PALETTE.teal, "binRing");
    (ringMat as StandardMaterial).emissiveColor = Color3.FromHexString(PALETTE.teal).scale(0.8);
    ring.material = ringMat;
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
      void p.loadModel(); // carrega GLB se existir; senão mantém o placeholder
      this.players.push(p);
    });
  }

  // ─── Spawning de cartas ─────────────────────────────────────
  private spawnLetter(): void {
    const x = (Math.random() - 0.5) * 3;
    const spawn = new Vector3(x, 0.4, DOOR_Z);
    const color = LETTER_COLORS[Math.floor(Math.random() * LETTER_COLORS.length)];
    const letter = new Letter(this.scene, spawn, color);
    this.shadows.addShadowCaster(letter.mesh);
    // empurra para dentro com leve dispersão
    const dir = new Vector3((Math.random() - 0.5) * 0.5, 0, -1).normalize();
    letter.slideIn(dir, 2.2 + Math.random());
    this.letters.push(letter);
  }

  // ─── Efeitos ────────────────────────────────────────────────
  private spawnShockwave(center: Vector3, radius: number, hex: string): void {
    const disc = MeshBuilder.CreateDisc("shock", { radius: 1, tessellation: 32 }, this.scene);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(center.x, 0.1, center.z);
    const mat = createToonMaterial(this.scene, hex, "shock");
    (mat as StandardMaterial).emissiveColor = Color3.FromHexString(hex);
    (mat as StandardMaterial).alpha = 0.6;
    mat.backFaceCulling = false;
    disc.material = mat;
    this.effects.push({ mesh: disc, life: 0.45, maxLife: 0.45, radius });
  }

  private updateEffects(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      const t = 1 - e.life / e.maxLife;
      e.mesh.scaling.setAll(t * e.radius);
      (e.mesh.material as StandardMaterial).alpha = 0.6 * (1 - t);
      if (e.life <= 0) {
        e.mesh.dispose();
        this.effects.splice(i, 1);
      }
    }
  }

  // ─── Interação ──────────────────────────────────────────────
  private tryPickup(player: Player, index: number): void {
    if (player.carrying >= player.carryCapacity) return;
    let best: Letter | null = null;
    let bestDist = PICKUP_RADIUS;
    for (const l of this.letters) {
      if (l.state !== "free") continue;
      const d = Vector3.Distance(l.mesh.position, player.position);
      if (d < bestDist) {
        bestDist = d;
        best = l;
      }
    }
    if (best) {
      best.pickUp(index);
      player.carrying++;
    }
  }

  private dropAll(player: Player, index: number): void {
    for (const l of this.letters) {
      if (l.state === "carried" && l.carriedBy === index) {
        l.drop();
      }
    }
    player.carrying = 0;
  }

  private updateCarried(): void {
    const stackCount: Record<number, number> = {};
    for (const l of this.letters) {
      if (l.state !== "carried" || l.carriedBy === null) continue;
      const idx = l.carriedBy;
      const player = this.players[idx];
      if (!player) continue;
      // entrega automática na lixeira
      if (Vector3.Distance(player.position, BIN_POS) < BIN_RADIUS) {
        l.destroy();
        this.collected++;
        player.carrying = Math.max(0, player.carrying - 1);
        Audio.sfx("deliver");
        this.hud.floatingText(player.position, "+1 ✅", PALETTE.teal);
        continue;
      }
      const s = stackCount[idx] ?? 0;
      l.followCarrier(player.position, s);
      stackCount[idx] = s + 1;
    }
  }

  // ─── Loop principal ─────────────────────────────────────────
  update(dt: number): void {
    if (this.ended) return;

    this.timeLeft -= dt;

    // spawn (carteiro precisa estar ativo)
    this.mailman.update(dt);
    if (!this.mailman.isStunned) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnLetter();
        this.spawnTimer = this.spawnInterval;
      }
    }

    // contagem de cartas no chão → slowzone
    const onFloor = this.letters.filter((l) => l.state === "free").length;
    this.peakFloor = Math.max(this.peakFloor, onFloor);
    const slow = onFloor > 10 ? 0.6 : 1;

    // players
    const forward = this.cam.getGroundForward();
    this.players.forEach((p, i) => {
      const input = this.game.input.getInput(p.slot);
      p.slowFactor = slow;
      p.update(dt, input, forward);
      if (input.interact) this.tryPickup(p, i);
      if (input.drop) this.dropAll(p, i);
      if (input.pause) this.finish(false);
    });

    this.updateCarried();
    this.updateEffects(dt);

    // câmera segue os pets (split-view automático quando se separam)
    this.cam.update(dt, this.players.map((p) => p.position));
    this.hud.setSplit(this.cam.isSplit);

    // limpa cartas que caíram fora da arena (segurança)
    for (const l of this.letters) {
      if (l.state === "free" && l.mesh.position.y < -3) l.destroy();
    }
    this.letters = this.letters.filter((l) => l.state !== "destroyed");

    // HUD
    this.hud.update({
      objective: `📬 Cartas: ${this.collected} / ${this.goal}`,
      timeLeft: this.timeLeft,
      bar: onFloor / 16,
      showCarry: true,
      players: this.players,
    });

    // condições de fim
    if (this.collected >= this.goal) this.finish(true);
    else if (this.timeLeft <= 0) this.finish(false);
  }

  private finish(win: boolean): void {
    if (this.ended) return;
    this.ended = true;

    let stars = 0;
    if (win) {
      stars = 1;
      if (this.timeLeft > this.timeLimit * 0.25) stars = 2;
      if (this.timeLeft > this.timeLimit * 0.4 && this.peakFloor < 10) stars = 3;
    }

    GameConfig.lastResult = {
      phaseName: "O Carteiro do Mal",
      win,
      stars,
      collected: this.collected,
      goal: this.goal,
      destruction: Math.min(1, this.peakFloor / 25),
    };
    this.game.goTo(GameState.Result);
  }

  dispose(): void {
    this.hud.dispose();
    this.letters.forEach((l) => l.dispose());
    this.players.forEach((p) => p.dispose());
    this.mailman.dispose();
    this.effects.forEach((e) => e.mesh.dispose());
    this.scene.dispose();
  }
}
