import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import type { Scene } from "@babylonjs/core/scene";
import type { GameManager } from "../systems/GameManager";
import type { SceneController } from "./SceneController";
import { GameState } from "../utils/Constants";
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

    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("resultUI", true, scene);
    addTitle(
      this.ui,
      win ? "🎉 Vitória!" : "😿 Quase lá…",
      r ? `Fase: ${r.phaseName}` : "",
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

    this.list = new MenuList(win ? "#06D6A0" : "#FF6B35");
    this.list.addButton(this.ui, "🔁  Jogar de novo", () => this.game.goTo(GameState.Phase1));
    this.list.addButton(this.ui, "🏠  Menu principal", () => this.game.goTo(GameState.Menu));
    this.list.layout(60);
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
