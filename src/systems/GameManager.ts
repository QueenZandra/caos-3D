import { Engine } from "@babylonjs/core/Engines/engine";
import type { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { GameState } from "../utils/Constants";
import { InputManager } from "./InputManager";
import { initPhysics } from "./PhysicsSystem";
import { Audio } from "./AudioManager";
import type { SceneController } from "../scenes/SceneController";
import { PauseMenu } from "../ui/PauseMenu";

import { MenuScene } from "../scenes/MenuScene";
import { PlayerCountScene } from "../scenes/PlayerCountScene";
import { CharSelectScene } from "../scenes/CharSelectScene";
import { PhaseSelectScene } from "../scenes/PhaseSelectScene";
import { Phase1Scene } from "../scenes/Phase1Scene";
import { Phase2Scene } from "../scenes/Phase2Scene";
import { Phase3Scene } from "../scenes/Phase3Scene";
import { Phase4Scene } from "../scenes/Phase4Scene";
import { Phase5Scene } from "../scenes/Phase5Scene";
import { Phase6Scene } from "../scenes/Phase6Scene";
import { Phase7Scene } from "../scenes/Phase7Scene";
import { Phase8Scene } from "../scenes/Phase8Scene";
import { ResultScene } from "../scenes/ResultScene";

/**
 * Orquestrador central: dono da engine, do input e da física. Gerencia a
 * transição entre cenas (máquina de estados) e roda o loop de render.
 */
export class GameManager {
  readonly engine: Engine;
  readonly canvas: HTMLCanvasElement;
  readonly input: InputManager;
  havok!: HavokPlugin;

  private current: SceneController | null = null;
  private nextState: GameState | null = null;
  private activeState: GameState = GameState.Menu;
  private paused = false;
  private pauseMenu: PauseMenu | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
    });
    this.input = new InputManager();

    window.addEventListener("resize", () => this.engine.resize());

    // áudio: destrava no 1º gesto e tecla M alterna mudo globalmente
    Audio.unlock();
    window.addEventListener("keydown", (e) => {
      if (e.key === "m" || e.key === "M") Audio.toggleMute();
    });
  }

  async start(): Promise<void> {
    this.havok = await initPhysics();
    this.goTo(GameState.Menu);

    let last = performance.now();
    this.engine.runRenderLoop(() => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05); // clamp p/ estabilidade
      last = now;

      // troca de cena adiada (fora do meio de um update)
      if (this.nextState !== null) {
        this.swap(this.nextState);
        this.nextState = null;
      }

      this.input.update();

      // pausa real (só em fases): congela lógica e física; Esc/Start alterna
      if (this.activeState.startsWith("phase") && this.current) {
        if (this.input.pauseEdge()) {
          this.paused ? this.resume() : this.pause();
        }
      }

      if (this.paused) {
        this.pauseMenu?.handleInput(this.input.menuInput());
      } else {
        this.current?.update(dt);
      }
      this.current?.scene.render();
    });
  }

  /** Abre o menu de pausa e congela a fase atual. */
  private pause(): void {
    if (this.paused || !this.current) return;
    this.paused = true;
    const scene = this.current.scene;
    scene.getPhysicsEngine()?.setTimeStep(0);
    scene.animationsEnabled = false;
    this.pauseMenu = new PauseMenu(scene, {
      resume: () => this.resume(),
      restart: () => {
        this.resume();
        this.goTo(this.activeState);
      },
      quit: () => {
        this.resume();
        this.goTo(GameState.Menu);
      },
    });
  }

  /** Fecha o menu de pausa e descongela a fase. */
  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    const scene = this.current?.scene;
    if (scene) {
      scene.getPhysicsEngine()?.setTimeStep(1 / 60);
      scene.animationsEnabled = true;
    }
    this.pauseMenu?.dispose();
    this.pauseMenu = null;
  }

  /** Solicita transição (efetivada no início do próximo frame). */
  goTo(state: GameState): void {
    this.nextState = state;
  }

  private swap(state: GameState): void {
    if (this.paused) this.resume(); // limpa pausa pendente ao trocar de cena
    this.current?.dispose();
    this.current = this.build(state);
    this.activeState = state;
    // trilha conforme o contexto: fases = gameplay; menus/resultado = calmo
    const inPhase = state.startsWith("phase");
    Audio.music(inPhase ? "gameplay" : "menu");
  }

  private build(state: GameState): SceneController {
    switch (state) {
      case GameState.Menu:
        return new MenuScene(this);
      case GameState.PlayerCount:
        return new PlayerCountScene(this);
      case GameState.CharSelect:
        return new CharSelectScene(this);
      case GameState.LevelSelect:
        return new PhaseSelectScene(this);
      case GameState.Phase1:
        return new Phase1Scene(this);
      case GameState.Phase2:
        return new Phase2Scene(this);
      case GameState.Phase3:
        return new Phase3Scene(this);
      case GameState.Phase4:
        return new Phase4Scene(this);
      case GameState.Phase5:
        return new Phase5Scene(this);
      case GameState.Phase6:
        return new Phase6Scene(this);
      case GameState.Phase7:
        return new Phase7Scene(this);
      case GameState.Phase8:
        return new Phase8Scene(this);
      case GameState.Result:
        return new ResultScene(this);
      default:
        return new MenuScene(this);
    }
  }
}
