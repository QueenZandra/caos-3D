import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import type { Scene } from "@babylonjs/core/scene";

import type { GameManager } from "../systems/GameManager";
import type { SceneController } from "./SceneController";
import { GameState, TOTAL_PHASES, PHASE_NAMES, PALETTE } from "../utils/Constants";
import { GameConfig } from "../utils/GameConfig";
import { Progress } from "../utils/Progress";
import { Audio } from "../systems/AudioManager";
import { createMenuScene, addTitle } from "./menuHelpers";

const COLS = 4;
const ROWS = 2;

/** Grade de seleção de fase: mostra cadeado nas bloqueadas e estrelas nas vencidas. */
export class PhaseSelectScene implements SceneController {
  readonly scene: Scene;
  private ui: AdvancedDynamicTexture;
  private cards: Rectangle[] = [];
  private cursor = 0;

  constructor(private game: GameManager) {
    const { scene } = createMenuScene(game.engine);
    this.scene = scene;

    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("phaseSelectUI", true, scene);
    addTitle(
      this.ui,
      "Selecionar fase",
      `⭐ ${Progress.totalStars()}/${TOTAL_PHASES * 3}  ·  ← → ↑ ↓ move · Confirmar · Esc volta`,
    );

    for (let p = 1; p <= TOTAL_PHASES; p++) {
      this.cards.push(this.buildCard(p));
    }
    // começa no cursor na última fase desbloqueada
    this.cursor = Math.min(Progress.maxUnlocked, TOTAL_PHASES) - 1;
    this.refresh();
  }

  private buildCard(phase: number): Rectangle {
    const i = phase - 1;
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const card = new Rectangle(`phaseCard_${phase}`);
    card.width = "210px";
    card.height = "120px";
    card.cornerRadius = 16;
    card.thickness = 3;
    card.background = "#FFFFFF14";
    card.color = "#FFFFFF22";
    card.left = `${(col - (COLS - 1) / 2) * 226}px`;
    card.top = `${(row - (ROWS - 1) / 2) * 138 + 30}px`;
    card.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    card.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;

    const unlocked = Progress.isUnlocked(phase);

    const num = new TextBlock();
    num.text = `Fase ${phase}`;
    num.color = "#FFFFFF";
    num.fontSize = 16;
    num.fontWeight = "800";
    num.top = "-36px";
    card.addControl(num);

    const name = new TextBlock();
    name.text = unlocked ? PHASE_NAMES[i] : "🔒 Bloqueada";
    name.color = unlocked ? "#FFFFFFDD" : "#FFFFFF66";
    name.fontSize = 14;
    name.textWrapping = true;
    name.width = "190px";
    card.addControl(name);

    const stars = new TextBlock();
    const s = Progress.getStars(phase);
    stars.text = unlocked ? "⭐".repeat(s) + "☆".repeat(3 - s) : "";
    stars.color = "#FFD166";
    stars.fontSize = 20;
    stars.top = "36px";
    card.addControl(stars);

    this.ui.addControl(card);
    return card;
  }

  private refresh(): void {
    this.cards.forEach((card, i) => {
      const phase = i + 1;
      const focused = i === this.cursor;
      const unlocked = Progress.isUnlocked(phase);
      card.background = focused ? (unlocked ? PALETTE.teal : "#5A2A35") : "#FFFFFF14";
      card.color = focused ? "#FFFFFF" : "#FFFFFF22";
      card.scaleX = focused ? 1.06 : 1;
      card.scaleY = focused ? 1.06 : 1;
      card.alpha = unlocked ? 1 : 0.7;
    });
  }

  private moveCursor(dx: number, dy: number): void {
    let col = this.cursor % COLS;
    let row = Math.floor(this.cursor / COLS);
    col = Math.max(0, Math.min(COLS - 1, col + dx));
    row = Math.max(0, Math.min(ROWS - 1, row + dy));
    const next = row * COLS + col;
    if (next !== this.cursor) {
      this.cursor = next;
      Audio.sfx("uiMove");
      this.refresh();
    }
  }

  private confirm(): void {
    const phase = this.cursor + 1;
    if (!Progress.isUnlocked(phase)) {
      Audio.sfx("uiBack"); // bloqueada
      return;
    }
    Audio.sfx("uiConfirm");
    GameConfig.startPhase = phase;
    this.game.goTo(GameState.PlayerCount);
  }

  update(_dt: number): void {
    const m = this.game.input.menuInput();
    // navY: cima = +1; na grade, cima = linha anterior (dy negativo)
    if (m.navX !== 0 || m.navY !== 0) this.moveCursor(m.navX, -m.navY);
    if (m.interact) this.confirm();
    if (m.drop) this.game.goTo(GameState.Menu);
  }

  dispose(): void {
    this.ui.dispose();
    this.scene.dispose();
  }
}
