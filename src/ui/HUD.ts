import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { Player } from "../entities/Player";
import { UI_LAYER } from "../utils/Constants";

interface FloatText {
  text: TextBlock;
  anchor: import("@babylonjs/core/Meshes/abstractMesh").AbstractMesh;
  life: number;
}

/** HUD 2D sobreposto à cena 3D (BABYLON.GUI). */
export class HUD {
  private ui: AdvancedDynamicTexture;
  private timer: TextBlock;
  private objective: TextBlock;
  private chaosFill: Rectangle;
  private playerCards: { cooldown: Rectangle; carry: TextBlock; name: TextBlock }[] = [];
  private floats: FloatText[] = [];
  private divider: Rectangle;

  constructor(
    private scene: Scene,
    players: Player[],
  ) {
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI("hud", true, scene);
    // renderiza o HUD apenas pela câmera de UI (tela cheia), nunca duplicado
    // nas viewports do split-view.
    if (this.ui.layer) this.ui.layer.layerMask = UI_LAYER;

    // linha divisória do split-view (oculta por padrão)
    this.divider = new Rectangle("split-divider");
    this.divider.width = "4px";
    this.divider.height = "100%";
    this.divider.background = "#1A1A2E";
    this.divider.thickness = 0;
    this.divider.isVisible = false;
    this.ui.addControl(this.divider);

    // timer (topo centro)
    this.timer = new TextBlock();
    this.timer.text = "90";
    this.timer.color = "#FFFFFF";
    this.timer.fontSize = 40;
    this.timer.fontWeight = "900";
    this.timer.top = "20px";
    this.timer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.ui.addControl(this.timer);

    // objetivo (abaixo do timer)
    this.objective = new TextBlock();
    this.objective.text = "";
    this.objective.color = "#FFD166";
    this.objective.fontSize = 20;
    this.objective.fontWeight = "800";
    this.objective.top = "66px";
    this.objective.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.ui.addControl(this.objective);

    // barra de caos (direita)
    const chaosBg = new Rectangle("chaosBg");
    chaosBg.width = "28px";
    chaosBg.height = "200px";
    chaosBg.cornerRadius = 8;
    chaosBg.background = "#00000055";
    chaosBg.thickness = 2;
    chaosBg.color = "#FFFFFF44";
    chaosBg.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    chaosBg.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    chaosBg.left = "-20px";
    this.ui.addControl(chaosBg);

    this.chaosFill = new Rectangle("chaosFill");
    this.chaosFill.width = "100%";
    this.chaosFill.height = "0%";
    this.chaosFill.background = "#FF6B35";
    this.chaosFill.thickness = 0;
    this.chaosFill.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    chaosBg.addControl(this.chaosFill);

    const chaosLabel = new TextBlock();
    chaosLabel.text = "🔥";
    chaosLabel.fontSize = 20;
    chaosLabel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    chaosLabel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    chaosLabel.left = "-22px";
    chaosLabel.top = "120px";
    this.ui.addControl(chaosLabel);

    // cartões dos jogadores (rodapé esquerdo)
    const panel = new StackPanel();
    panel.isVertical = false;
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.left = "16px";
    panel.top = "-16px";
    panel.height = "92px";
    this.ui.addControl(panel);

    players.forEach((p) => panel.addControl(this.buildCard(p)));
  }

  private buildCard(p: Player): Rectangle {
    const card = new Rectangle();
    card.width = "150px";
    card.height = "84px";
    card.cornerRadius = 12;
    card.background = "#1A1A2ECC";
    card.color = p.def.color;
    card.thickness = 3;
    card.paddingRight = "8px";

    const name = new TextBlock();
    name.text = `${p.def.emoji} ${p.def.name}`;
    name.color = "#FFFFFF";
    name.fontSize = 16;
    name.fontWeight = "800";
    name.top = "8px";
    name.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    card.addControl(name);

    const carry = new TextBlock();
    carry.text = "📦 0";
    carry.color = "#FFFFFFCC";
    carry.fontSize = 14;
    carry.top = "30px";
    carry.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    card.addControl(carry);

    const cdBg = new Rectangle();
    cdBg.width = "120px";
    cdBg.height = "12px";
    cdBg.cornerRadius = 6;
    cdBg.background = "#00000066";
    cdBg.thickness = 0;
    cdBg.top = "-10px";
    cdBg.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    card.addControl(cdBg);

    const cdFill = new Rectangle();
    cdFill.width = "0%";
    cdFill.height = "100%";
    cdFill.background = p.def.color;
    cdFill.thickness = 0;
    cdFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    cdBg.addControl(cdFill);

    this.playerCards.push({ cooldown: cdFill, carry, name });
    return card;
  }

  update(opts: {
    timeLeft: number;
    collected: number;
    goal: number;
    chaos: number; // 0..1
    players: Player[];
  }): void {
    this.timer.text = `${Math.ceil(opts.timeLeft)}`;
    this.timer.color = opts.timeLeft <= 10 ? "#FF4D8D" : "#FFFFFF";
    this.objective.text = `📬 Cartas: ${opts.collected} / ${opts.goal}`;
    this.chaosFill.height = `${Math.round(Math.min(1, opts.chaos) * 100)}%`;
    this.chaosFill.background = opts.chaos > 0.66 ? "#FF4D8D" : "#FF6B35";

    opts.players.forEach((p, i) => {
      const card = this.playerCards[i];
      if (!card) return;
      card.cooldown.width = `${Math.round(p.cooldownPct * 100)}%`;
      card.carry.text = `📦 ${p.carrying}/${p.carryCapacity}`;
    });

    // textos flutuantes
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= this.scene.getEngine().getDeltaTime() / 1000;
      f.text.alpha = Math.max(0, f.life / 1.0);
      if (f.life <= 0) {
        f.text.dispose();
        f.anchor.dispose();
        this.floats.splice(i, 1);
      }
    }
  }

  /** Mostra/oculta a linha divisória central do split-view. */
  setSplit(on: boolean): void {
    this.divider.isVisible = on;
  }

  /** Texto que sobe e some, ancorado numa posição 3D. */
  floatingText(position: Vector3, text: string, hex: string): void {
    const anchor = MeshBuilder.CreateBox("ft_anchor", { size: 0.01 }, this.scene);
    anchor.position.copyFrom(position);
    anchor.position.y += 1.6;
    anchor.isVisible = false;

    const tb = new TextBlock();
    tb.text = text;
    tb.color = hex;
    tb.fontSize = 28;
    tb.fontWeight = "900";
    tb.outlineColor = "#1A1A2E";
    tb.outlineWidth = 4;
    this.ui.addControl(tb);
    tb.linkWithMesh(anchor);
    tb.linkOffsetY = -20;

    this.floats.push({ text: tb, anchor, life: 1.0 });
  }

  dispose(): void {
    this.floats.forEach((f) => {
      f.text.dispose();
      f.anchor.dispose();
    });
    this.ui.dispose();
  }
}
