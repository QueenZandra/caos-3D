import type { InputManager } from "../systems/InputManager";

/**
 * Controles de toque para mobile: um joystick virtual flutuante (metade
 * esquerda) e botões de ação (direita), além de pausa. Vive em DOM sobreposto
 * ao canvas (persiste entre cenas) e alimenta o InputManager (P1).
 *
 * Só aparece em dispositivos de toque. O contexto ("menu"/"phase") decide quais
 * botões mostrar: nos menus, Confirmar/Voltar; nas fases, as ações de gameplay.
 */
export class TouchControls {
  private root: HTMLDivElement;
  private zone: HTMLDivElement; // área de captura do joystick (esquerda)
  private base: HTMLDivElement; // círculo-base do joystick
  private thumb: HTMLDivElement;
  private phaseBtns: HTMLElement[] = [];
  private menuBtns: HTMLElement[] = [];
  private stickPointer: number | null = null;
  private cx = 0;
  private cy = 0;

  static isTouchDevice(): boolean {
    return (
      (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) ||
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0
    );
  }

  constructor(private input: InputManager) {
    this.root = document.createElement("div");
    Object.assign(this.root.style, {
      position: "fixed",
      inset: "0",
      zIndex: "40",
      pointerEvents: "none",
      touchAction: "none",
      userSelect: "none",
    } as CSSStyleDeclaration);
    document.body.appendChild(this.root);

    this.zone = this.div({ left: "0", top: "0", width: "45%", height: "100%" });
    this.base = this.div({
      width: "120px",
      height: "120px",
      borderRadius: "50%",
      background: "#ffffff14",
      border: "3px solid #ffffff44",
      display: "none",
    });
    this.thumb = this.div({
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      background: "#ffffff55",
      border: "3px solid #ffffffaa",
    });
    this.base.appendChild(this.thumb);
    Object.assign(this.thumb.style, { position: "absolute", left: "29px", top: "29px" });

    if (!TouchControls.isTouchDevice()) {
      this.root.style.display = "none";
      return;
    }

    this.bindStick();
    this.buildButtons();
    this.setContext("menu");
  }

  /** Mostra os botões certos para o contexto atual. */
  setContext(ctx: "menu" | "phase"): void {
    const phase = ctx === "phase";
    this.phaseBtns.forEach((b) => (b.style.display = phase ? "flex" : "none"));
    this.menuBtns.forEach((b) => (b.style.display = phase ? "none" : "flex"));
  }

  // ─── joystick ───────────────────────────────────────────────
  private bindStick(): void {
    this.zone.style.pointerEvents = "auto";
    this.zone.addEventListener("pointerdown", (e) => {
      this.stickPointer = e.pointerId;
      this.cx = e.clientX;
      this.cy = e.clientY;
      this.base.style.display = "block";
      this.base.style.left = `${e.clientX - 60}px`;
      this.base.style.top = `${e.clientY - 60}px`;
      this.moveThumb(0, 0);
      this.zone.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    this.zone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.stickPointer) return;
      const full = 60 * (1.4 - this.input.sensitivity * 0.9); // raio p/ deflexão máxima
      let dx = (e.clientX - this.cx) / full;
      let dy = (e.clientY - this.cy) / full;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      this.input.setTouchMove(dx, -dy); // tela: y p/ baixo → frente positivo
      this.moveThumb(dx * 32, dy * 32);
      e.preventDefault();
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointer) return;
      this.stickPointer = null;
      this.input.setTouchMove(0, 0);
      this.base.style.display = "none";
    };
    this.zone.addEventListener("pointerup", end);
    this.zone.addEventListener("pointercancel", end);
  }

  private moveThumb(dx: number, dy: number): void {
    this.thumb.style.left = `${29 + dx}px`;
    this.thumb.style.top = `${29 + dy}px`;
  }

  // ─── botões ─────────────────────────────────────────────────
  private buildButtons(): void {
    // fases: ações de gameplay (canto inferior direito)
    this.actionBtn("✋", "interact", "#06D6A0", 24, 120, true);
    this.actionBtn("✨", "ability", "#9B5DE5", 130, 150, true);
    this.actionBtn("📦", "drop", "#FF6B35", 150, 70, true);
    this.actionBtn("🤝", "joint", "#FFD166", 56, 40, true);
    // pausa (canto superior direito)
    this.cornerBtn("⏸️", "pause");

    // menus: confirmar / voltar
    this.actionBtn("✓", "interact", "#06D6A0", 24, 120, false);
    this.actionBtn("⬅", "back", "#FF6B35", 150, 70, false);
  }

  private actionBtn(
    label: string,
    name: string,
    color: string,
    right: number,
    bottom: number,
    phase: boolean,
  ): void {
    const b = this.div({
      right: `${right}px`,
      bottom: `${bottom}px`,
      width: "76px",
      height: "76px",
      borderRadius: "50%",
      background: color + "cc",
      border: "3px solid #ffffffaa",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "30px",
      color: "#fff",
    });
    b.textContent = label;
    b.style.pointerEvents = "auto";
    b.style.display = "none";
    const down = (e: PointerEvent) => {
      this.input.touchPress(name);
      b.style.transform = "scale(0.9)";
      e.preventDefault();
    };
    const up = () => {
      this.input.touchRelease(name);
      b.style.transform = "scale(1)";
    };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("pointerleave", up);
    (phase ? this.phaseBtns : this.menuBtns).push(b);
  }

  private cornerBtn(label: string, name: string): void {
    const b = this.div({
      right: "20px",
      top: "20px",
      width: "52px",
      height: "52px",
      borderRadius: "12px",
      background: "#1a1a2ecc",
      border: "2px solid #ffffff66",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "22px",
    });
    b.textContent = label;
    b.style.pointerEvents = "auto";
    b.style.display = "none";
    b.addEventListener("pointerdown", (e) => {
      this.input.touchPress(name);
      e.preventDefault();
    });
    b.addEventListener("pointerup", () => this.input.touchRelease(name));
    this.phaseBtns.push(b);
  }

  // ─── util ───────────────────────────────────────────────────
  private div(style: Partial<CSSStyleDeclaration>): HTMLDivElement {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.display = "flex";
    Object.assign(el.style, style);
    this.root.appendChild(el);
    return el;
  }
}
