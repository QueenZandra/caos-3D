import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import type { Scene } from "@babylonjs/core/scene";
import type { GameManager } from "../systems/GameManager";
import type { SceneController } from "./SceneController";
import { GameState, TOTAL_PHASES, phaseState } from "../utils/Constants";
import { GameConfig } from "../utils/GameConfig";
import { createMenuScene, MenuList, addTitle } from "./menuHelpers";

/** Tela de resultado da fase (vitória/derrota + estrelas). */
export class ResultScene implements SceneController {
  readonly scene: Scene;
  private ui: AdvancedDynamicTexture;
  private list: MenuList;

  constructor(private game: GameManager) {
    const { scene } = createMenuScene(game.engine);
    this.scene = scene;

    const r = GameConfig.lastResult;
    const win = r?.win ?? false;
    const stars = r?.stars ?? 0;
    const champion = win && GameConfig.phase >= TOTAL_PHASES;

    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("resultUI", true, scene);
    addTitle(
      this.ui,
      champion ? "🏆 Campanha Completa!" : win ? "🎉 Vitória!" : "😿 Quase lá…",
      champion ? "Os pets salvaram o dia (de novo)!" : r ? `Fase: ${r.phaseName}` : "",
    );

    const starsTb = new TextBlock();
    starsTb.text = "⭐".repeat(stars) + "☆".repeat(3 - stars);
    starsTb.fontSize = 56;
    starsTb.color = "#FFD166";
    starsTb.top = "-150px";
    starsTb.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.ui.addControl(starsTb);

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

  update(_dt: number): void {
    const m = this.game.input.menuInput();
    if (m.navY !== 0) this.list.move(-m.navY);
    if (m.interact) this.list.confirm();
  }

  dispose(): void {
    this.ui.dispose();
    this.scene.dispose();
  }
}
