import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { Ellipse } from "@babylonjs/gui/2D/controls/ellipse";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { Player } from "../entities/Player";
import { UI_LAYER, PALETTE } from "../utils/Constants";
import { Settings } from "../utils/Settings";

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
  private radarPanel?: Rectangle;
  private radarDots: Ellipse[] = [];
  private dangerOverlay?: Rectangle;
  private objectiveArrow: TextBlock;
  private objectiveTarget: Vector3 | null = null;

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

    // overlay de perigo (sprint final) — vermelho pulsante, não bloqueia input
    this.dangerOverlay = new Rectangle("danger");
    this.dangerOverlay.width = "100%";
    this.dangerOverlay.height = "100%";
    this.dangerOverlay.background = "#FF1E3C";
    this.dangerOverlay.thickness = 0;
    this.dangerOverlay.alpha = 0;
    this.dangerOverlay.isVisible = false;
    this.dangerOverlay.isPointerBlocker = false;
    this.ui.addControl(this.dangerOverlay);

    // timer (topo centro). resizeToFit: sem isso o TextBlock ocupa a tela toda
    // e o texto centraliza no meio (ficava sobre os pets).
    this.timer = new TextBlock();
    this.timer.text = "90";
    this.timer.color = "#FFFFFF";
    this.timer.fontSize = 40;
    this.timer.fontWeight = "900";
    this.timer.resizeToFit = true;
    this.timer.top = "20px";
    this.timer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.ui.addControl(this.timer);

    // objetivo (abaixo do timer)
    this.objective = new TextBlock();
    this.objective.text = "";
    this.objective.color = "#FFD166";
    this.objective.fontSize = 20;
    this.objective.fontWeight = "800";
    this.objective.resizeToFit = true;
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
    chaosLabel.resizeToFit = true;
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

    // seta que aponta o objetivo quando ele está fora da tela
    this.objectiveArrow = new TextBlock();
    this.objectiveArrow.text = "➤";
    this.objectiveArrow.color = PALETTE.teal;
    this.objectiveArrow.fontSize = 46;
    this.objectiveArrow.outlineColor = "#1A1A2E";
    this.objectiveArrow.outlineWidth = 6;
    this.objectiveArrow.isVisible = false;
    this.objectiveArrow.zIndex = 5;
    this.ui.addControl(this.objectiveArrow);
  }

  /** Define a posição-alvo (mundo) que a seta aponta; null desliga a seta. */
  setObjective(target: Vector3 | null): void {
    this.objectiveTarget = target ? target.clone() : null;
    if (!target) this.objectiveArrow.isVisible = false;
  }

  /** Projeta o alvo na tela; se estiver fora, mostra a seta na borda apontando-o. */
  private updateObjectiveArrow(): void {
    const cam = this.scene.activeCamera;
    if (!this.objectiveTarget || !cam) {
      this.objectiveArrow.isVisible = false;
      return;
    }
    const engine = this.scene.getEngine();
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    const vp = cam.viewport.toGlobal(w, h);
    const proj = Vector3.Project(
      this.objectiveTarget,
      Matrix.Identity(),
      this.scene.getTransformMatrix(),
      vp,
    );
    const cx = w / 2;
    const cy = h / 2;
    const margin = 64;
    const behind = proj.z < 0 || proj.z > 1;
    let dx = proj.x - cx;
    let dy = proj.y - cy;
    if (behind) {
      dx = -dx;
      dy = -dy;
    }
    const onScreen =
      !behind &&
      proj.x >= margin &&
      proj.x <= w - margin &&
      proj.y >= margin &&
      proj.y <= h - margin;
    if (onScreen) {
      this.objectiveArrow.isVisible = false;
      return;
    }
    if (dx === 0 && dy === 0) dy = 1;
    // projeta (dx,dy) na borda do retângulo seguro (meia-extensão menos a margem)
    const hx = Math.max(1, cx - margin);
    const hy = Math.max(1, cy - margin);
    const scale = 1 / Math.max(Math.abs(dx) / hx, Math.abs(dy) / hy);
    this.objectiveArrow.isVisible = true;
    this.objectiveArrow.left = `${dx * scale}px`;
    this.objectiveArrow.top = `${dy * scale}px`;
    this.objectiveArrow.rotation = Math.atan2(dy, dx); // "➤" aponta para +x em rotação 0
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
    objective: string;
    bar: number; // 0..1
    timeLeft?: number; // omitido = sem timer
    barWarn?: boolean;
    showCarry?: boolean;
    players: Player[];
  }): void {
    if (opts.timeLeft === undefined) {
      this.timer.isVisible = false;
    } else {
      this.timer.isVisible = true;
      this.timer.text = `${Math.ceil(opts.timeLeft)}`;
      this.timer.color = opts.timeLeft <= 10 ? "#FF4D8D" : "#FFFFFF";
    }
    this.objective.text = opts.objective;
    const v = Math.round(Math.min(1, Math.max(0, opts.bar)) * 100);
    this.chaosFill.height = `${v}%`;
    this.chaosFill.background = opts.barWarn || opts.bar > 0.66 ? "#FF4D8D" : "#FF6B35";

    if (this.dangerOverlay?.isVisible) {
      // acessibilidade: sem pulsação (flash) quando "reduzir efeitos" está ligado
      this.dangerOverlay.alpha = Settings.reduceMotion
        ? 0.16
        : 0.12 + 0.14 * (Math.sin(performance.now() * 0.008) + 1) * 0.5;
    }

    this.updateObjectiveArrow();

    opts.players.forEach((p, i) => {
      const card = this.playerCards[i];
      if (!card) return;
      card.cooldown.width = `${Math.round(p.cooldownPct * 100)}%`;
      card.carry.isVisible = opts.showCarry ?? false;
      if (opts.showCarry) card.carry.text = `📦 ${p.carrying}/${p.carryCapacity}`;
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

  /** Liga/desliga o overlay vermelho de perigo (sprint final). */
  setDanger(on: boolean): void {
    if (this.dangerOverlay) this.dangerOverlay.isVisible = on;
  }

  /** Atualiza o radar/minimapa com pontos do mundo (x,z em [-half,half]). */
  radar(half: number, dots: { x: number; z: number; hex: string }[]): void {
    const SIZE = 140;
    const R = SIZE / 2 - 8;
    if (!this.radarPanel) {
      this.radarPanel = new Rectangle("radar");
      this.radarPanel.width = `${SIZE}px`;
      this.radarPanel.height = `${SIZE}px`;
      this.radarPanel.cornerRadius = 12;
      this.radarPanel.background = "#1A1A2EAA";
      this.radarPanel.color = "#FFFFFF44";
      this.radarPanel.thickness = 2;
      this.radarPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.radarPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      this.radarPanel.left = "-20px";
      this.radarPanel.top = "20px";
      this.ui.addControl(this.radarPanel);
    }
    // pool de pontos
    while (this.radarDots.length < dots.length) {
      const d = new Ellipse(`dot_${this.radarDots.length}`);
      d.width = "10px";
      d.height = "10px";
      d.thickness = 0;
      this.radarPanel.addControl(d);
      this.radarDots.push(d);
    }
    this.radarDots.forEach((d, i) => {
      if (i >= dots.length) {
        d.isVisible = false;
        return;
      }
      d.isVisible = true;
      d.background = dots[i].hex;
      d.left = `${(dots[i].x / half) * R}px`;
      d.top = `${(dots[i].z / half) * R}px`;
    });
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
