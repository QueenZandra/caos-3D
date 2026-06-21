import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

import type { GameManager } from "../systems/GameManager";
import type { SceneController } from "./SceneController";
import { GameState } from "../utils/Constants";
import { GameConfig, type PlayerSlot } from "../utils/GameConfig";
import { CHAR_ORDER, CHARACTERS } from "../utils/CharacterData";
import { createMenuScene, addTitle, type MenuPet } from "./menuHelpers";
import { createToonMaterial } from "../utils/Visual";

const PLAYER_HEX = ["#06D6A0", "#FF4D8D", "#9B5DE5", "#FF6B35"];

/**
 * Seleção de personagens por jogador (turnos). Cada jogador move o cursor
 * pelos 4 pedestais e confirma. Personagens já escolhidos ficam bloqueados.
 * Com 4 jogadores, a distribuição é automática (GDD).
 */
export class CharSelectScene implements SceneController {
  readonly scene: Scene;
  private ui: AdvancedDynamicTexture;
  private pets: MenuPet[];
  private pedestals: Mesh[] = [];

  private cursor = 0;
  private currentPlayer = 0;
  private takenBy: (number | null)[] = [null, null, null, null];
  private prompt: TextBlock;
  private picksLabel: TextBlock;
  private done = false;

  constructor(private game: GameManager) {
    const { scene, pets } = createMenuScene(game.engine);
    this.scene = scene;
    this.pets = pets;

    // pedestais sob cada pet
    pets.forEach((p, i) => {
      const ped = MeshBuilder.CreateCylinder(`ped_${i}`, { diameter: 1.6, height: 0.3 }, scene);
      ped.position = new Vector3(p.root.position.x, 0.15, 0);
      ped.material = createToonMaterial(scene, "#2A2A45", `ped_${i}`);
      this.pedestals.push(ped);
    });

    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("charUI", true, scene);
    addTitle(this.ui, "Escolha seu pet", "← → move · Confirmar: Espaço/Enter/Botão Sul");

    this.prompt = new TextBlock();
    this.prompt.color = "#FFFFFF";
    this.prompt.fontSize = 26;
    this.prompt.fontWeight = "800";
    this.prompt.top = "200px";
    this.prompt.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.ui.addControl(this.prompt);

    this.picksLabel = new TextBlock();
    this.picksLabel.color = "#FFFFFFCC";
    this.picksLabel.fontSize = 18;
    this.picksLabel.top = "250px";
    this.picksLabel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.ui.addControl(this.picksLabel);

    if (GameConfig.playerCount === 4) {
      this.autoAssignFour();
    } else {
      GameConfig.players = [];
      this.refresh();
    }
  }

  private autoAssignFour(): void {
    GameConfig.players = CHAR_ORDER.map((charId, i) => this.makeSlot(i, charId));
    this.done = true;
    this.prompt.text = "4 pets prontos! Iniciando…";
    this.picksLabel.text = "Sirius · Belatriz · Minerva · Zoe";
    // pequena pausa antes de iniciar
    setTimeout(() => this.game.goTo(GameState.Phase1), 1200);
  }

  private makeSlot(index: number, charId: (typeof CHAR_ORDER)[number]): PlayerSlot {
    const pads = this.game.input.connectedPads();
    if (index === 0) return { index, charId, inputKind: "keyboard-wasd" };
    if (index === 1) return { index, charId, inputKind: "keyboard-arrows" };
    const gamepadIndex = pads[index - 2] ?? index - 2;
    return { index, charId, inputKind: "gamepad", gamepadIndex };
  }

  private refresh(): void {
    this.prompt.text = `Jogador ${this.currentPlayer + 1}, escolha seu pet`;
    this.prompt.color = PLAYER_HEX[this.currentPlayer];

    this.pets.forEach((p, i) => {
      const taken = this.takenBy[i] !== null;
      p.setVisibility(taken ? 0.35 : 1);
      const focused = i === this.cursor;
      p.root.scaling.setAll(focused && !taken ? 1.25 : 1);
      const ped = this.pedestals[i];
      const ownerHex = taken ? PLAYER_HEX[this.takenBy[i]!] : focused ? PLAYER_HEX[this.currentPlayer] : "#2A2A45";
      (ped.material as StandardMaterial).emissiveColor = Color3.FromHexString(ownerHex);
    });

    const picks = GameConfig.players
      .map((s) => `P${s.index + 1}: ${CHARACTERS[s.charId].name}`)
      .join("   ");
    this.picksLabel.text = picks;
  }

  private moveCursor(dir: number): void {
    for (let i = 0; i < 4; i++) {
      this.cursor = (this.cursor + dir + 4) % 4;
      if (this.takenBy[this.cursor] === null) break;
    }
    this.refresh();
  }

  private confirm(): void {
    if (this.takenBy[this.cursor] !== null) return;
    const charId = CHAR_ORDER[this.cursor];
    this.takenBy[this.cursor] = this.currentPlayer;
    GameConfig.players.push(this.makeSlot(this.currentPlayer, charId));
    this.currentPlayer++;

    if (this.currentPlayer >= GameConfig.playerCount) {
      this.done = true;
      this.prompt.text = "Pronto! Iniciando…";
      setTimeout(() => this.game.goTo(GameState.Phase1), 900);
      return;
    }
    // move cursor para o próximo livre
    this.moveCursor(1);
  }

  update(_dt: number): void {
    if (this.done) return;
    const m = this.game.input.menuInput();
    if (m.navX !== 0) this.moveCursor(m.navX);
    if (m.interact) this.confirm();
    if (m.drop) this.game.goTo(GameState.PlayerCount);
  }

  dispose(): void {
    this.ui.dispose();
    this.scene.dispose();
  }
}
