import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import type { Scene } from "@babylonjs/core/scene";
import type { GameManager } from "../systems/GameManager";
import type { SceneController } from "./SceneController";
import { GameState, TOTAL_PHASES, phaseState } from "../utils/Constants";
import { GameConfig } from "../utils/GameConfig";
import { Progress } from "../utils/Progress";
import { createMenuScene, MenuList, addTitle } from "./menuHelpers";
import { Audio } from "../systems/AudioManager";

/** Tela de resultado da fase (vitória/derrota + estrelas). */
export class ResultScene implements SceneController {
  readonly scene: Scene;
  private ui: AdvancedDynamicTexture;
  private list: MenuList;
  private starsTb!: TextBlock;
  private starsTarget = 0;
  private revealed = 0;
  private animT = 0;
  private nextRevealAt = 0.45;

  constructor(private game: GameManager) {
    const { scene } = createMenuScene(game.engine);
    this.scene = scene;

    const r = GameConfig.lastResult;
    const win = r?.win ?? false;
    const stars = r?.stars ?? 0;
    const champion = win && GameConfig.phase >= TOTAL_PHASES;

    // persiste estrelas e desbloqueia a próxima fase
    Progress.recordResult(GameConfig.phase, win, stars);

    Audio.sfx(win ? "win" : "lose");

    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("resultUI", true, scene);
    addTitle(
      this.ui,
      champion ? "🏆 Campanha Completa!" : win ? "🎉 Vitória!" : "😿 Quase lá…",
      champion ? "Os pets salvaram o dia (de novo)!" : r ? `Fase: ${r.phaseName}` : "",
    );

    const starsTb = new TextBlock();
    starsTb.text = "☆☆☆"; // reveladas uma a uma em update()
    starsTb.fontSize = 56;
    starsTb.color = "#FFD166";
    starsTb.top = "-150px";
    starsTb.scaleX = 0.2;
    starsTb.scaleY = 0.2;
    starsTb.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.ui.addControl(starsTb);
    this.starsTb = starsTb;
    this.starsTarget = stars;

    const stats = new TextBlock();
    stats.text = r
      ? `Cartas entregues: ${r.collected} / ${r.goal}\nBagunça: ${Math.round(r.destruction * 100)}%`
      : "";
    stats.color = "#FFFFFFDD";
    stats.fontSize = 20;
    stats.top = "-70px";
    stats.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.ui.addControl(stats);

    const phase = GameConfig.phase;
    const hasNext = win && phase < TOTAL_PHASES;

    this.list = new MenuList(win ? "#06D6A0" : "#FF6B35");
    if (hasNext) {
      this.list.addButton(this.ui, `➡️  Próxima fase (${phase + 1})`, () =>
        this.game.goTo(phaseState(phase + 1)),
      );
    }
    this.list.addButton(this.ui, "🔁  Repetir fase", () => this.game.goTo(phaseState(phase)));
    this.list.addButton(this.ui, "🏠  Menu principal", () => this.game.goTo(GameState.Menu));
    this.list.layout(hasNext ? 40 : 60);
  }

  update(dt: number): void {
    this.animStars(dt);

    const m = this.game.input.menuInput();
    if (m.navY !== 0) this.list.move(-m.navY);
    if (m.interact) this.list.confirm();
  }

  /** Pop-in das estrelas (ease-out-back) e revelação sequencial com som. */
  private animStars(dt: number): void {
    this.animT += dt;
    const p = Math.min(1, this.animT / 0.4);
    const c1 = 1.70158;
    const eb = 1 + (c1 + 1) * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); // easeOutBack
    const s = 0.2 + 0.8 * eb;
    this.starsTb.scaleX = s;
    this.starsTb.scaleY = s;

    if (this.revealed < this.starsTarget && this.animT >= this.nextRevealAt) {
      this.revealed++;
      this.starsTb.text = "⭐".repeat(this.revealed) + "☆".repeat(3 - this.revealed);
      Audio.sfx("deliver");
      this.nextRevealAt += 0.32;
    }
  }

  dispose(): void {
    this.ui.dispose();
    this.scene.dispose();
  }
}
