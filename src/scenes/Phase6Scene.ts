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
import { Audio } from "../systems/AudioManager";
import { GameConfig } from "../utils/GameConfig";
import { enablePhysics } from "../systems/PhysicsSystem";
import { CameraSystem } from "../systems/CameraSystem";
import { createToonMaterial, applyOutline } from "../utils/Visual";
import { createPlayer } from "../entities/createPlayer";
import type { Player, AbilityHooks } from "../entities/Player";
import { Motorcycle } from "../entities/Motorcycle";
import { HUD } from "../ui/HUD";

const ARENA = 30;
const HALF = ARENA / 2;
const WINDOWS_X = [-10, -5, 0, 5, 10];
const WINDOW_Z = -HALF + 2.5;
const WINDOW_R = 2.3;
const STREET_Z = -HALF - 3;
const X_LIMIT = HALF + 7;
const BASE_TIME = 120;
const BARK = 0.11;
const SIRIUS_BURST = 0.32;
const DECAY = 0.18;
const THRESHOLD = 1;
const PASS_GAP = 1.2;
const MOTO_COLORS = ["#C0392B", "#2980B9", "#27AE60", "#8E44AD", "#E67E22"];

/** Fase 6 — "A Moto do Terror". */
export class Phase6Scene implements SceneController {
  readonly scene: Scene;
  private cam: CameraSystem;
  private hud: HUD;
  private shadows: ShadowGenerator;

  private players: Player[] = [];
  private bikes: Motorcycle[] = [];

  private goal: number;
  private scared = 0;
  private timeLeft: number;
  private noise = 0;
  private passScored = false;
  private gapTimer = 1.5;
  private ended = false;
  private hooks: AbilityHooks;

  constructor(private game: GameManager) {
    this.scene = new Scene(game.engine);
    this.scene.clearColor = Color4.FromHexString("#3A4A6BFF"); // entardecer
    enablePhysics(this.scene, game.havok);
    GameConfig.phase = 6;

    const d = GameConfig.difficulty;
    this.goal = Math.max(8, Math.round(15 * d.objective));
    this.timeLeft = Math.round(BASE_TIME * d.timer);

    const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = 0.8;
    const dir = new DirectionalLight("dir", new Vector3(-0.4, -1, 0.3), this.scene);
    dir.position = new Vector3(10, 22, -10);
    dir.intensity = 1.0;
    this.shadows = new ShadowGenerator(1024, dir);
    this.shadows.useBlurExponentialShadowMap = true;

    this.buildFacade();
    this.cam = new CameraSystem(this.scene);

    this.hooks = {
      stunEnemies: (center) => {
        if (this.atWindow(center)) this.noise = Math.min(1.4, this.noise + SIRIUS_BURST);
      },
      spawnShockwave: () => {},
      floatingText: (pos, text, hex) => this.hud.floatingText(pos, text, hex),
    };

    this.spawnPlayers();
    this.hud = new HUD(this.scene, this.players);
  }

  // ─── Cenário ────────────────────────────────────────────────
  private buildFacade(): void {
    const floor = MeshBuilder.CreateBox(
      "floor",
      { width: ARENA, height: 1, depth: ARENA },
      this.scene,
    );
    floor.position.y = -0.5;
    const fmat = createToonMaterial(this.scene, "#8A8FA3", "floor");
    (fmat as StandardMaterial).emissiveColor = Color3.FromHexString("#6E7488").scale(0.3);
    floor.material = fmat;
    floor.receiveShadows = true;
    new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0, friction: 0.6 }, this.scene);

    // rua (faixa visual além da fachada)
    const street = MeshBuilder.CreateBox(
      "street",
      { width: X_LIMIT * 2.4, height: 0.1, depth: 4 },
      this.scene,
    );
    street.position.set(0, 0.02, STREET_Z);
    street.material = createToonMaterial(this.scene, "#3A3A45", "street");

    const wallH = 3.4;
    const mk = (name: string, w: number, dep: number, x: number, z: number) => {
      const wall = MeshBuilder.CreateBox(name, { width: w, height: wallH, depth: dep }, this.scene);
      wall.position.set(x, wallH / 2, z);
      wall.material = createToonMaterial(this.scene, "#C97B5A", name);
      applyOutline(wall, 0.03);
      new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    };
    mk("wW", 0.5, ARENA, -HALF, 0);
    mk("wE", 0.5, ARENA, HALF, 0);
    mk("wN", ARENA, 0.5, 0, HALF);
    mk("wFacade", ARENA, 0.5, 0, -HALF); // fachada (sul)

    // janelas (postos) — molduras na fachada + marcador no chão
    WINDOWS_X.forEach((wx, i) => {
      const frame = MeshBuilder.CreateBox(
        `win_${i}`,
        { width: 2.4, height: 1.8, depth: 0.3 },
        this.scene,
      );
      frame.position.set(wx, 1.8, -HALF + 0.3);
      frame.material = createToonMaterial(this.scene, "#7FC8F0", `win_${i}`);
      applyOutline(frame, 0.04);

      const mark = MeshBuilder.CreateTorus(
        `winmark_${i}`,
        { diameter: WINDOW_R * 1.6, thickness: 0.16, tessellation: 24 },
        this.scene,
      );
      mark.position.set(wx, 0.06, WINDOW_Z);
      const mmat = createToonMaterial(this.scene, PALETTE.yellow, `winmark_${i}`);
      (mmat as StandardMaterial).emissiveColor = Color3.FromHexString(PALETTE.yellow).scale(0.6);
      mark.material = mmat;
    });
  }

  private spawnPlayers(): void {
    const spread = [
      new Vector3(-6, 1, 0),
      new Vector3(-2, 1, 0),
      new Vector3(2, 1, 0),
      new Vector3(6, 1, 0),
    ];
    GameConfig.players.forEach((slot, i) => {
      const p = createPlayer(this.scene, slot, spread[i] ?? new Vector3(0, 1, 0), this.hooks);
      p.registerShadows(this.shadows);
      void p.loadModel();
      this.players.push(p);
    });
  }

  // ─── Barulho / passagens ────────────────────────────────────
  private atWindow(pos: Vector3): boolean {
    return WINDOWS_X.some((wx) => Math.hypot(pos.x - wx, pos.z - WINDOW_Z) < WINDOW_R);
  }

  private spawnPass(): void {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const startX = -dir * X_LIMIT;
    const isFinal = this.scared >= this.goal - 1;
    this.passScored = false;

    if (isFinal) {
      // carreata final em V (5 veículos)
      const vOff = [
        { dx: 0, dz: 0 },
        { dx: -2.5, dz: 1 },
        { dx: -2.5, dz: -1 },
        { dx: -5, dz: 2 },
        { dx: -5, dz: -2 },
      ];
      vOff.forEach((o, k) => {
        const m = new Motorcycle(
          this.scene,
          startX + dir * o.dx,
          STREET_Z + o.dz,
          dir,
          7,
          MOTO_COLORS[k % MOTO_COLORS.length],
        );
        this.shadows.addShadowCaster(m.root.getChildMeshes()[0]);
        this.bikes.push(m);
      });
      this.hud.floatingText(new Vector3(0, 3, STREET_Z), "CARREATA FINAL! 🏍️🏍️🏍️", PALETTE.pink);
    } else {
      const speed = 7 + Math.random() * 4;
      const m = new Motorcycle(
        this.scene,
        startX,
        STREET_Z,
        dir,
        speed,
        MOTO_COLORS[Math.floor(Math.random() * MOTO_COLORS.length)],
      );
      this.shadows.addShadowCaster(m.root.getChildMeshes()[0]);
      this.bikes.push(m);
    }
  }

  private updatePass(dt: number): void {
    // sem passagem ativa → conta o intervalo e spawna a próxima
    if (this.bikes.length === 0) {
      this.gapTimer -= dt;
      this.noise = Math.max(0, this.noise - DECAY * dt);
      if (this.gapTimer <= 0) this.spawnPass();
      return;
    }

    this.bikes.forEach((b) => b.update(dt));
    this.noise = Math.max(0, this.noise - DECAY * dt);

    // barulho suficiente → afugenta
    if (!this.passScored && this.noise >= THRESHOLD) {
      this.passScored = true;
      this.scared++;
      Audio.sfx("deliver");
      this.bikes.forEach((b) => b.flee());
      this.cam.shake(0.4, 0.3);
      this.hud.floatingText(new Vector3(0, 3, STREET_Z), "AFUGENTADA! 🏍️💨", PALETTE.teal);
    }

    // todas saíram da tela → encerra a passagem
    if (this.bikes.every((b) => b.offscreen(X_LIMIT))) {
      if (!this.passScored) {
        this.cam.shake(0.6, 0.45);
        Audio.sfx("broke");
        this.hud.floatingText(new Vector3(0, 3, STREET_Z), "vrumm... passou 😬", PALETTE.orange);
      }
      this.bikes.forEach((b) => b.dispose());
      this.bikes = [];
      this.noise = 0;
      this.gapTimer = PASS_GAP;
    }
  }

  private makeNoise(player: Player): void {
    if (this.atWindow(player.position)) {
      this.noise = Math.min(1.4, this.noise + BARK);
      this.hud.floatingText(
        player.position,
        player.def.species === "Cachorro" || player.def.species === "Cachorra" ? "AU!" : "MIAU!",
        player.def.color,
      );
    } else {
      this.hud.floatingText(player.position, "→ vá p/ a janela!", PALETTE.yellow);
    }
  }

  // ─── Loop ───────────────────────────────────────────────────
  update(dt: number): void {
    if (this.ended) return;
    this.timeLeft -= dt;

    const forward = this.cam.getGroundForward();
    this.players.forEach((p) => {
      const input = this.game.input.getInput(p.slot);
      p.update(dt, input, forward);
      if (input.interact) this.makeNoise(p);
    });

    this.updatePass(dt);

    this.cam.update(
      dt,
      this.players.map((p) => p.position),
    );
    this.hud.setSplit(this.cam.isSplit);

    const passActive = this.bikes.length > 0;
    this.hud.update({
      objective: `🏍️ Afugentadas: ${this.scared}/${this.goal}${passActive ? "   ·   🔊 FAÇA BARULHO!" : ""}`,
      timeLeft: this.timeLeft,
      bar: Math.min(1, this.noise),
      players: this.players,
    });

    if (this.scared >= this.goal) this.finish(true);
    else if (this.timeLeft <= 0) this.finish(false);
  }

  private finish(win: boolean): void {
    if (this.ended) return;
    this.ended = true;

    const ratio = this.timeLeft / Math.round(BASE_TIME * GameConfig.difficulty.timer);
    let stars = 0;
    if (win) {
      stars = 1;
      if (ratio > 0.25) stars = 2;
      if (ratio > 0.45) stars = 3;
    }
    GameConfig.lastResult = {
      phaseName: "A Moto do Terror",
      win,
      stars,
      collected: this.scared,
      goal: this.goal,
      destruction: 0,
    };
    this.game.goTo(GameState.Result);
  }

  dispose(): void {
    this.hud.dispose();
    this.bikes.forEach((b) => b.dispose());
    this.players.forEach((p) => p.dispose());
    this.scene.dispose();
  }
}
