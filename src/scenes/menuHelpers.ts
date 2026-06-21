import { Scene } from "@babylonjs/core/scene";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CHAR_ORDER, CHARACTERS } from "../utils/CharacterData";
import { PALETTE } from "../utils/Constants";
import { buildPetModel } from "../entities/PetModel";
import { Audio } from "../systems/AudioManager";

import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";

/** Pet exibido nos menus (modelo procedural sob um nó animável). */
export interface MenuPet {
  root: TransformNode;
  /** ajusta a visibilidade de todas as partes (ex.: 0.35 = já escolhido) */
  setVisibility(v: number): void;
}

/** Cena de fundo padrão dos menus: os 4 pets girando + luz suave. */
export function createMenuScene(engine: Engine): {
  scene: Scene;
  pets: MenuPet[];
} {
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString(PALETTE.dark + "FF");

  const cam = new ArcRotateCamera(
    "menuCam",
    -Math.PI / 2,
    Math.PI / 2.6,
    14,
    new Vector3(0, 1, 0),
    scene,
  );
  cam.minZ = 0.1;

  const light = new HemisphericLight("menuLight", new Vector3(0.3, 1, 0.2), scene);
  light.intensity = 0.95;

  // 4 pets procedurais (PetModel) enfileirados, girando sobre os pedestais
  const pets: MenuPet[] = [];
  CHAR_ORDER.forEach((id, i) => {
    const def = CHARACTERS[id];
    const root = new TransformNode(`menu_${id}`, scene);
    root.position = new Vector3((i - 1.5) * 2.4, 1.3, 0);
    const { parts } = buildPetModel(scene, root, def);
    pets.push({
      root,
      setVisibility: (v) => parts.forEach((m) => (m.visibility = v)),
    });
  });

  scene.registerBeforeRender(() => {
    const t = performance.now() * 0.001;
    pets.forEach((p, i) => {
      p.root.rotation.y = t + i;
      p.root.position.y = 1.3 + Math.sin(t * 2 + i) * 0.12;
    });
  });

  return { scene, pets };
}

/** Item navegável de menu (rótulo + destaque). */
export interface MenuItem {
  control: Rectangle;
  label: TextBlock;
  onSelect: () => void;
}

/**
 * Lista vertical navegável por teclado/gamepad. Gerencia destaque do item
 * atual e dispara onSelect ao confirmar.
 */
export class MenuList {
  private items: MenuItem[] = [];
  private index = 0;

  constructor(private accentHex: string = PALETTE.orange) {}

  addButton(ui: AdvancedDynamicTexture, text: string, onSelect: () => void): Rectangle {
    const rect = new Rectangle(`menuItem_${this.items.length}`);
    rect.width = "360px";
    rect.height = "64px";
    rect.cornerRadius = 16;
    rect.thickness = 3;
    rect.color = "#FFFFFF22";
    rect.background = "#FFFFFF14";
    rect.paddingBottom = "10px";

    const label = new TextBlock();
    label.text = text;
    label.color = "#FFFFFF";
    label.fontSize = 22;
    label.fontWeight = "800";
    rect.addControl(label);

    ui.addControl(rect);
    this.items.push({ control: rect, label, onSelect });
    this.refresh();
    return rect;
  }

  /** Reposiciona os botões num stack vertical centralizado. */
  layout(startY = 0, gap = 74): void {
    this.items.forEach((it, i) => {
      it.control.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
      it.control.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      it.control.top = `${startY + i * gap}px`;
    });
  }

  move(dir: number): void {
    if (this.items.length === 0) return;
    this.index = (this.index + dir + this.items.length) % this.items.length;
    Audio.sfx("uiMove");
    this.refresh();
  }

  confirm(): void {
    Audio.sfx("uiConfirm");
    this.items[this.index]?.onSelect();
  }

  private refresh(): void {
    this.items.forEach((it, i) => {
      const active = i === this.index;
      it.control.background = active ? this.accentHex : "#FFFFFF14";
      it.control.color = active ? "#FFFFFF" : "#FFFFFF22";
      it.control.scaleX = active ? 1.06 : 1;
      it.control.scaleY = active ? 1.06 : 1;
      it.label.color = active ? "#1A1A2E" : "#FFFFFF";
    });
  }
}

/** Cria um título grande no topo. */
export function addTitle(ui: AdvancedDynamicTexture, text: string, sub?: string): void {
  const title = new TextBlock();
  title.text = text;
  title.color = "#FFFFFF";
  title.fontSize = 44;
  title.fontWeight = "900";
  title.top = "-260px";
  title.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  ui.addControl(title);

  if (sub) {
    const s = new TextBlock();
    s.text = sub;
    s.color = "#FFFFFFAA";
    s.fontSize = 18;
    s.top = "-212px";
    s.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    ui.addControl(s);
  }
}
