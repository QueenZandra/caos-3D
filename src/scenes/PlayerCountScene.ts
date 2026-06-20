import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import type { Scene } from "@babylonjs/core/scene";
import type { GameManager } from "../systems/GameManager";
import type { SceneController } from "./SceneController";
import { GameState } from "../utils/Constants";
import { GameConfig } from "../utils/GameConfig";
import { createMenuScene, MenuList, addTitle } from "./menuHelpers";

/** Seleção de quantidade de jogadores (2, 3 ou 4). */
export class PlayerCountScene implements SceneController {
  readonly scene: Scene;
  private ui: AdvancedDynamicTexture;
  private list: MenuList;
  private status: TextBlock;

  constructor(private game: GameManager) {
    const { scene } = createMenuScene(game.engine);
    this.scene = scene;

    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("countUI", true, scene);
    addTitle(this.ui, "Quantos pets?", "P1 e P2 podem usar teclado · P3 e P4 precisam de gamepad");

    this.list = new MenuList();
    [2, 3, 4].forEach((n) => {
      this.list.addButton(this.ui, `${n} Pets`, () => this.choose(n));
    });
    this.list.layout(0);

    this.status = new TextBlock();
    this.status.color = "#FFFFFFCC";
    this.status.fontSize = 16;
    this.status.top = "260px";
    this.status.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.ui.addControl(this.status);
  }

  private choose(n: number): void {
    GameConfig.playerCount = n;
    this.game.goTo(GameState.CharSelect);
  }

  update(_dt: number): void {
    const m = this.game.input.menuInput();
    if (m.navY !== 0) this.list.move(-m.navY);
    if (m.interact) this.list.confirm();
    if (m.drop) this.game.goTo(GameState.Menu);

    const pads = this.game.input.connectedPads().length;
    this.status.text = `🎮 Gamepads conectados: ${pads}   ·   ⌨️ Teclado: P1 (WASD) + P2 (Setas)`;
  }

  dispose(): void {
    this.ui.dispose();
    this.scene.dispose();
  }
}
