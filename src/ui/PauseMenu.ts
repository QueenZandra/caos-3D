import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import type { Scene } from "@babylonjs/core/scene";

import { MenuList } from "../scenes/menuHelpers";
import { UI_LAYER, PALETTE } from "../utils/Constants";
import type { FrameInput } from "../systems/InputManager";

/** Ações do menu de pausa (fornecidas pelo GameManager). */
export interface PauseActions {
  resume: () => void;
  restart: () => void;
  quit: () => void;
}

/**
 * Overlay de pausa sobreposto à cena da fase. Reusa a MenuList (mesma
 * navegação e sons de UI dos demais menus). Renderiza só pela câmera de UI
 * (UI_LAYER) para não duplicar nas viewports do split-view.
 */
export class PauseMenu {
  private ui: AdvancedDynamicTexture;
  private list: MenuList;

  constructor(scene: Scene, actions: PauseActions) {
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("pauseUI", true, scene);
    if (this.ui.layer) this.ui.layer.layerMask = UI_LAYER;

    const dim = new Rectangle("pauseDim");
    dim.width = "100%";
    dim.height = "100%";
    dim.background = "#1A1A2ECC";
    dim.thickness = 0;
    this.ui.addControl(dim);

    const title = new TextBlock();
    title.text = "⏸️  PAUSA";
    title.color = "#FFFFFF";
    title.fontSize = 48;
    title.fontWeight = "900";
    title.top = "-180px";
    title.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.ui.addControl(title);

    const hint = new TextBlock();
    hint.text = "Esc / Start retoma  ·  M alterna o som";
    hint.color = "#FFFFFF99";
    hint.fontSize = 15;
    hint.top = "200px";
    hint.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.ui.addControl(hint);

    this.list = new MenuList(PALETTE.teal);
    this.list.addButton(this.ui, "▶  Retomar", actions.resume);
    this.list.addButton(this.ui, "🔁  Reiniciar fase", actions.restart);
    this.list.addButton(this.ui, "🏠  Menu principal", actions.quit);
    this.list.layout(-10);
  }

  /** Navegação por teclado/gamepad enquanto pausado. */
  handleInput(m: FrameInput): void {
    if (m.navY !== 0) this.list.move(-m.navY);
    if (m.interact) this.list.confirm();
  }

  dispose(): void {
    this.ui.dispose();
  }
}
