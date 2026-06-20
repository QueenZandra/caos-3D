import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import type { Scene } from "@babylonjs/core/scene";
import type { GameManager } from "../systems/GameManager";
import type { SceneController } from "./SceneController";
import { GameState } from "../utils/Constants";
import { GameConfig } from "../utils/GameConfig";
import { createMenuScene, MenuList, addTitle } from "./menuHelpers";

/** Menu principal animado. */
export class MenuScene implements SceneController {
  readonly scene: Scene;
  private ui: AdvancedDynamicTexture;
  private list: MenuList;
  private controlsPanel: Rectangle;
  private controlsShown = false;

  constructor(private game: GameManager) {
    const { scene } = createMenuScene(game.engine);
    this.scene = scene;
    GameConfig.reset();

    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("menuUI", true, scene);
    addTitle(this.ui, "🐾 Caos em Casa 🐾", "A Saga dos Pets · Babylon.js 3D");

    this.list = new MenuList();
    this.list.addButton(this.ui, "▶  Jogar", () => this.game.goTo(GameState.PlayerCount));
    this.list.addButton(this.ui, "🎮  Controles", () => this.toggleControls());
    this.list.layout(20);

    this.controlsPanel = this.buildControlsPanel();

    const foot = new TextBlock();
    foot.text = "Navegar: WASD/Setas/Analógico  ·  Confirmar: Espaço/Enter/Botão Sul";
    foot.color = "#FFFFFF99";
    foot.fontSize = 14;
    foot.top = "300px";
    foot.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.ui.addControl(foot);
  }

  private buildControlsPanel(): Rectangle {
    const panel = new Rectangle("controls");
    panel.width = "440px";
    panel.height = "260px";
    panel.cornerRadius = 18;
    panel.background = "#1A1A2EEE";
    panel.color = "#9B5DE5";
    panel.thickness = 3;
    panel.isVisible = false;

    const txt = new TextBlock();
    txt.text =
      "🎮 CONTROLES\n\n" +
      "Mover:  WASD / Setas / Analógico esq.\n" +
      "Interagir / Pegar:  Espaço / Enter / Botão Sul (× / A)\n" +
      "Habilidade:  E / Shift / Botão Oeste (□ / X)\n" +
      "Largar:  Q / Ctrl / Botão Leste (○ / B)\n" +
      "Ação conjunta:  F / Botão Norte (△ / Y)\n" +
      "Pausar:  Esc / Start";
    txt.color = "#FFFFFF";
    txt.fontSize = 16;
    txt.textWrapping = true;
    txt.paddingLeft = "20px";
    txt.paddingRight = "20px";
    panel.addControl(txt);

    this.ui.addControl(panel);
    return panel;
  }

  private toggleControls(): void {
    this.controlsShown = !this.controlsShown;
    this.controlsPanel.isVisible = this.controlsShown;
  }

  update(_dt: number): void {
    const m = this.game.input.menuInput();
    if (m.navY !== 0) this.list.move(-m.navY);
    if (m.interact) this.list.confirm();
    if (m.drop && this.controlsShown) this.toggleControls();
  }

  dispose(): void {
    this.ui.dispose();
    this.scene.dispose();
  }
}
