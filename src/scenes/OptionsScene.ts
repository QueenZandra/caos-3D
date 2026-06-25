import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import type { Scene } from "@babylonjs/core/scene";

import type { GameManager } from "../systems/GameManager";
import type { SceneController } from "./SceneController";
import { GameState, PALETTE } from "../utils/Constants";
import { Audio } from "../systems/AudioManager";
import { Progress } from "../utils/Progress";
import { Settings } from "../utils/Settings";
import { createMenuScene, addTitle } from "./menuHelpers";

type RowKind = "volume" | "toggle" | "action";

interface OptRow {
  kind: RowKind;
  label: string;
  get?: () => number;
  set?: (v: number) => void;
  toggle?: () => void;
  state?: () => string;
  action?: () => void;
  container: Rectangle;
  value: TextBlock;
  fill?: Rectangle;
}

const STEP = 0.1;
const BAR_W = 200;

/** Tela de opções de áudio: volumes geral/música/efeitos + mudo. */
export class OptionsScene implements SceneController {
  readonly scene: Scene;
  private ui: AdvancedDynamicTexture;
  private rows: OptRow[] = [];
  private cursor = 0;
  private resetRow?: OptRow;
  private confirmingReset = false;

  constructor(private game: GameManager) {
    const { scene } = createMenuScene(game.engine);
    this.scene = scene;

    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("optionsUI", true, scene);
    addTitle(this.ui, "Opções", "↑ ↓ seleciona · ← → ajusta · Confirmar · Esc volta");

    this.rows = [
      this.makeVolume(
        "🔊  Volume geral",
        () => Audio.volumes.master,
        (v) => Audio.setMasterVolume(v),
      ),
      this.makeVolume(
        "🎵  Música",
        () => Audio.volumes.music,
        (v) => Audio.setMusicVolume(v),
      ),
      this.makeVolume(
        "💥  Efeitos",
        () => Audio.volumes.sfx,
        (v) => Audio.setSfxVolume(v),
      ),
      this.makeVolume(
        "🕹️  Sensibilidade (toque)",
        () => this.game.input.sensitivity,
        (v) => this.game.input.setSensitivity(v),
      ),
      this.makeRow("🔇  Mudo", "toggle", {
        toggle: () => Audio.toggleMute(),
        state: () => (Audio.isMuted ? "Sim" : "Não"),
      }),
      this.makeRow("♿  Reduzir efeitos", "toggle", {
        toggle: () => Settings.toggleReduceMotion(),
        state: () => (Settings.reduceMotion ? "Sim" : "Não"),
      }),
      this.makeRow("🎨  Alto contraste", "toggle", {
        toggle: () => Settings.toggleHighContrast(),
        state: () => (Settings.highContrast ? "Sim" : "Não"),
      }),
      this.makeRow("🗑️  Zerar progresso", "action", {}),
      this.makeRow("⬅️  Voltar", "action", { action: () => this.game.goTo(GameState.Menu) }),
    ];

    // a linha de reset gerencia seu próprio texto (confirmação em 2 passos)
    this.resetRow = this.rows.find((r) => r.label.includes("Zerar"))!;
    this.resetRow.action = () => this.handleReset();

    this.rows.forEach((r, i) => {
      r.container.top = `${(i - (this.rows.length - 1) / 2) * 56 + 16}px`;
    });
    this.refresh();
  }

  private makeVolume(label: string, get: () => number, set: (v: number) => void): OptRow {
    return this.makeRow(label, "volume", { get, set });
  }

  private makeRow(label: string, kind: RowKind, opts: Partial<OptRow>): OptRow {
    const container = new Rectangle(`opt_${label}`);
    container.width = "520px";
    container.height = "48px";
    container.cornerRadius = 14;
    container.thickness = 3;
    container.background = "#FFFFFF14";
    container.color = "#FFFFFF22";
    container.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;

    const name = new TextBlock();
    name.text = label;
    name.color = "#FFFFFF";
    name.fontSize = 20;
    name.fontWeight = "800";
    name.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    name.paddingLeft = "22px";
    container.addControl(name);

    const value = new TextBlock();
    value.color = "#FFFFFFDD";
    value.fontSize = 18;
    value.fontWeight = "800";
    value.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    value.paddingRight = "22px";
    container.addControl(value);

    let fill: Rectangle | undefined;
    if (kind === "volume") {
      // trilho da barra
      const track = new Rectangle(`${label}_track`);
      track.width = `${BAR_W}px`;
      track.height = "14px";
      track.cornerRadius = 7;
      track.thickness = 0;
      track.background = "#FFFFFF22";
      track.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      track.paddingRight = "80px";
      container.addControl(track);

      fill = new Rectangle(`${label}_fill`);
      fill.height = "14px";
      fill.cornerRadius = 7;
      fill.thickness = 0;
      fill.background = PALETTE.teal;
      fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      track.addControl(fill);
    }

    this.ui.addControl(container);
    return { kind, label, container, value, fill, ...opts };
  }

  private refresh(): void {
    this.rows.forEach((r, i) => {
      const focused = i === this.cursor;
      r.container.background = focused ? PALETTE.teal : "#FFFFFF14";
      r.container.color = focused ? "#FFFFFF" : "#FFFFFF22";
      r.container.scaleX = focused ? 1.04 : 1;
      r.container.scaleY = focused ? 1.04 : 1;

      if (r.kind === "volume" && r.get && r.fill) {
        const v = r.get();
        r.value.text = `${Math.round(v * 100)}%`;
        r.fill.width = `${Math.max(1, Math.round(v * BAR_W))}px`;
      } else if (r.kind === "toggle" && r.state) {
        r.value.text = r.state();
      } else if (r === this.resetRow) {
        // texto gerenciado por handleReset (não sobrescreve)
      } else {
        r.value.text = "";
      }
    });
  }

  private moveCursor(dir: number): void {
    this.cancelReset();
    const n = this.rows.length;
    this.cursor = (this.cursor + dir + n) % n;
    Audio.sfx("uiMove");
    this.refresh();
  }

  /** Cancela a confirmação de reset se o usuário sair da linha. */
  private cancelReset(): void {
    if (this.confirmingReset && this.resetRow) {
      this.confirmingReset = false;
      this.resetRow.value.text = "";
    }
  }

  private handleReset(): void {
    if (!this.resetRow) return;
    if (!this.confirmingReset) {
      this.confirmingReset = true;
      this.resetRow.value.text = "Confirmar?";
      this.resetRow.value.color = "#FF6B6B";
      Audio.sfx("uiBack");
    } else {
      Progress.reset();
      this.confirmingReset = false;
      this.resetRow.value.text = "Zerado! ✓";
      this.resetRow.value.color = PALETTE.teal;
      Audio.sfx("uiConfirm");
    }
  }

  private adjust(dir: number): void {
    const r = this.rows[this.cursor];
    if (r.kind !== "volume" || !r.get || !r.set) return;
    const v = Math.round((r.get() + dir * STEP) * 100) / 100;
    r.set(v);
    Audio.sfx("uiMove"); // feedback audível (também testa o volume de efeitos)
    this.refresh();
  }

  private confirm(): void {
    const r = this.rows[this.cursor];
    if (r.kind === "toggle" && r.toggle) {
      r.toggle();
      Audio.sfx("uiConfirm");
      this.refresh();
    } else if (r.kind === "action" && r.action) {
      if (r !== this.resetRow) Audio.sfx("uiConfirm"); // reset gerencia seu som
      r.action();
    }
  }

  update(_dt: number): void {
    const m = this.game.input.menuInput();
    if (m.navY !== 0) this.moveCursor(-m.navY);
    if (m.navX !== 0) this.adjust(m.navX);
    if (m.interact) this.confirm();
    if (m.drop) this.game.goTo(GameState.Menu);
  }

  dispose(): void {
    this.ui.dispose();
    this.scene.dispose();
  }
}
