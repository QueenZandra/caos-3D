import type { PlayerSlot } from "../utils/GameConfig";

/** Mapa de botões do GDD (layout padrão Gamepad API). */
const BUTTON = {
  SOUTH: 0, // × (PS) / A (Xbox) — interagir / confirmar
  EAST: 1, // ○ / B — largar / voltar
  WEST: 2, // □ / X — habilidade
  NORTH: 3, // △ / Y — ação conjunta
  START: 9, // Options / Menu — pausar
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
} as const;

const DEADZONE = 0.25;

export interface FrameInput {
  moveX: number; // -1..1 (esquerda/direita)
  moveY: number; // -1..1 (frente positivo)
  interact: boolean; // edge (just pressed)
  ability: boolean; // edge
  drop: boolean; // edge
  joint: boolean; // edge
  pause: boolean; // edge
  /** navegação de menu (edge): -1/0/1 */
  navX: number;
  navY: number;
}

export type GamepadKind = "playstation" | "xbox" | "generic";

const EMPTY: FrameInput = {
  moveX: 0,
  moveY: 0,
  interact: false,
  ability: false,
  drop: false,
  joint: false,
  pause: false,
  navX: 0,
  navY: 0,
};

/**
 * Coleta input de teclado e gamepads. Chame update() uma vez por frame
 * (antes de qualquer consumidor) para calcular as bordas de "just pressed".
 */
export class InputManager {
  /** teclas fisicamente pressionadas (para movimento contínuo) */
  private keys = new Set<string>();
  /** keydowns acumulados desde o último update (borda) */
  private keyEdgeBuffer = new Set<string>();
  /** bordas de tecla expostas neste frame */
  private keyEdges = new Set<string>();

  // estado anterior de botões por gamepad, p/ detectar edges
  private prevPadButtons: Record<number, boolean[]> = {};
  private curPadButtons: Record<number, boolean[]> = {};

  // ─── toque (mobile) ───────────────────────────────────────────
  /** botões de toque atualmente pressionados (interact/ability/drop/joint/pause/back) */
  private touch = new Set<string>();
  /** presses de toque acumulados desde o último update (borda) */
  private touchEdgeBuffer = new Set<string>();
  /** bordas de toque expostas neste frame */
  private touchEdges = new Set<string>();
  /** vetor do joystick virtual já normalizado (−1..1; y+ = frente) */
  private touchMove = { x: 0, y: 0 };
  private touchNavX = 0;
  private touchNavY = 0;
  private prevBeyondX = 0;
  private prevBeyondY = 0;
  /** sensibilidade do joystick (0..1), persistida */
  private touchSensitivity = InputManager.loadSens();

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    // alguns navegadores só listam gamepads após o evento de conexão
    window.addEventListener("gamepadconnected", () => {});
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // só registra a borda na descida real (ignora o auto-repeat do navegador)
    if (!this.keys.has(e.code)) this.keyEdgeBuffer.add(e.code);
    this.keys.add(e.code);
    // evita rolagem da página com setas/espaço
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  /** Captura o snapshot do frame. Deve rodar antes de getInput/menu reads. */
  update(): void {
    // expõe as bordas acumuladas desde o último frame e zera o acumulador
    this.keyEdges = this.keyEdgeBuffer;
    this.keyEdgeBuffer = new Set();

    const pads = this.getGamepads();
    this.prevPadButtons = this.curPadButtons;
    this.curPadButtons = {};
    for (const pad of pads) {
      if (!pad) continue;
      this.curPadButtons[pad.index] = pad.buttons.map((b) => b.pressed);
    }

    // toque: bordas acumuladas + bordas de navegação do joystick em menus
    this.touchEdges = this.touchEdgeBuffer;
    this.touchEdgeBuffer = new Set();
    const bx = Math.abs(this.touchMove.x) > 0.5 ? Math.sign(this.touchMove.x) : 0;
    const by = Math.abs(this.touchMove.y) > 0.5 ? Math.sign(this.touchMove.y) : 0;
    this.touchNavX = bx !== 0 && bx !== this.prevBeyondX ? bx : 0;
    this.touchNavY = by !== 0 && by !== this.prevBeyondY ? by : 0;
    this.prevBeyondX = bx;
    this.prevBeyondY = by;
  }

  // ─── Toque (API usada pela TouchControls) ───────────────────
  private static loadSens(): number {
    try {
      const v = Number(localStorage.getItem("caos_touch_sens"));
      return Number.isFinite(v) && v > 0 ? Math.max(0, Math.min(1, v)) : 0.6;
    } catch {
      return 0.6;
    }
  }
  get sensitivity(): number {
    return this.touchSensitivity;
  }
  setSensitivity(v: number): void {
    this.touchSensitivity = Math.max(0, Math.min(1, v));
    try {
      localStorage.setItem("caos_touch_sens", String(this.touchSensitivity));
    } catch {
      /* ignore */
    }
  }
  /** Define o vetor do joystick (já normalizado pela UI). */
  setTouchMove(x: number, y: number): void {
    this.touchMove.x = x;
    this.touchMove.y = y;
  }
  touchPress(name: string): void {
    if (!this.touch.has(name)) this.touchEdgeBuffer.add(name); // borda na descida
    this.touch.add(name);
  }
  touchRelease(name: string): void {
    this.touch.delete(name);
  }
  private touchEdge(name: string): boolean {
    return this.touchEdges.has(name);
  }
  /** Mescla o toque no input do P1 (slot 0). */
  private applyTouch(fi: FrameInput): void {
    fi.moveX = Math.max(-1, Math.min(1, fi.moveX + this.touchMove.x));
    fi.moveY = Math.max(-1, Math.min(1, fi.moveY + this.touchMove.y));
    fi.interact ||= this.touchEdge("interact");
    fi.ability ||= this.touchEdge("ability");
    fi.drop ||= this.touchEdge("drop");
    fi.joint ||= this.touchEdge("joint");
  }

  private getGamepads(): (Gamepad | null)[] {
    return navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
  }

  // ─── Teclado ────────────────────────────────────────────────
  private keyDown(code: string): boolean {
    return this.keys.has(code);
  }
  private keyEdge(code: string): boolean {
    return this.keyEdges.has(code);
  }

  // ─── Gamepad ────────────────────────────────────────────────
  private padEdge(idx: number, btn: number): boolean {
    return !!this.curPadButtons[idx]?.[btn] && !this.prevPadButtons[idx]?.[btn];
  }
  private stick(idx: number): { x: number; y: number } {
    const pad = this.getGamepads()[idx];
    if (!pad) return { x: 0, y: 0 };
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    return {
      x: Math.abs(ax) > DEADZONE ? ax : 0,
      // Gamepad: para cima = -1; convertemos p/ "frente positivo"
      y: Math.abs(ay) > DEADZONE ? -ay : 0,
    };
  }

  detectGamepadKind(idx: number): GamepadKind {
    const pad = this.getGamepads()[idx];
    if (!pad) return "generic";
    const id = pad.id.toLowerCase();
    if (
      id.includes("dualsense") ||
      id.includes("dualshock") ||
      id.includes("playstation") ||
      id.includes("054c")
    )
      return "playstation";
    if (id.includes("xbox") || id.includes("xinput") || id.includes("045e")) return "xbox";
    return "generic";
  }

  /** Lista de gamepads conectados (índices). */
  connectedPads(): number[] {
    return this.getGamepads()
      .filter((p): p is Gamepad => !!p)
      .map((p) => p.index);
  }

  /**
   * Borda de "pausar" agregada de qualquer controle (Esc no teclado ou Start
   * em qualquer gamepad). Usada pelo GameManager para abrir/fechar a pausa.
   */
  pauseEdge(): boolean {
    if (this.keyEdge("Escape")) return true;
    if (this.touchEdge("pause")) return true;
    for (const idx of this.connectedPads()) {
      if (this.padEdge(idx, BUTTON.START)) return true;
    }
    return false;
  }

  /** Input de um slot de jogador (gameplay). O P1 (slot 0) recebe o toque. */
  getInput(slot: PlayerSlot): FrameInput {
    const fi = this.slotInput(slot);
    if (slot.index === 0) this.applyTouch(fi);
    return fi;
  }

  private slotInput(slot: PlayerSlot): FrameInput {
    switch (slot.inputKind) {
      case "keyboard-wasd":
        return this.keyboardInput(
          "KeyW",
          "KeyS",
          "KeyA",
          "KeyD",
          "Space",
          "KeyE",
          "KeyQ",
          "KeyF",
          "Escape",
        );
      case "keyboard-arrows":
        return this.keyboardInput(
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Enter",
          "ShiftRight",
          "ControlRight",
          "Slash",
          "Escape",
        );
      case "gamepad":
        return this.gamepadInput(slot.gamepadIndex ?? 0);
      default:
        return { ...EMPTY };
    }
  }

  private keyboardInput(
    up: string,
    down: string,
    left: string,
    right: string,
    interact: string,
    ability: string,
    drop: string,
    joint: string,
    pause: string,
  ): FrameInput {
    const moveY = (this.keyDown(up) ? 1 : 0) - (this.keyDown(down) ? 1 : 0);
    const moveX = (this.keyDown(right) ? 1 : 0) - (this.keyDown(left) ? 1 : 0);
    return {
      moveX,
      moveY,
      interact: this.keyEdge(interact),
      ability: this.keyEdge(ability),
      drop: this.keyEdge(drop),
      joint: this.keyEdge(joint),
      pause: this.keyEdge(pause),
      navX: (this.keyEdge(right) ? 1 : 0) - (this.keyEdge(left) ? 1 : 0),
      navY: (this.keyEdge(up) ? 1 : 0) - (this.keyEdge(down) ? 1 : 0),
    };
  }

  private gamepadInput(idx: number): FrameInput {
    const s = this.stick(idx);
    const navX =
      (this.padEdge(idx, BUTTON.DPAD_RIGHT) ? 1 : 0) -
      (this.padEdge(idx, BUTTON.DPAD_LEFT) ? 1 : 0);
    const navY =
      (this.padEdge(idx, BUTTON.DPAD_UP) ? 1 : 0) - (this.padEdge(idx, BUTTON.DPAD_DOWN) ? 1 : 0);
    return {
      moveX: s.x,
      moveY: s.y,
      interact: this.padEdge(idx, BUTTON.SOUTH),
      ability: this.padEdge(idx, BUTTON.WEST),
      drop: this.padEdge(idx, BUTTON.EAST),
      joint: this.padEdge(idx, BUTTON.NORTH),
      pause: this.padEdge(idx, BUTTON.START),
      navX,
      navY,
    };
  }

  /**
   * Input agregado de menu: combina TODOS os teclados e gamepads,
   * para que qualquer controle navegue nos menus pré-jogo.
   */
  menuInput(): FrameInput {
    const out: FrameInput = { ...EMPTY };

    // teclado (WASD + setas)
    const kNavX =
      (this.keyEdge("KeyD") || this.keyEdge("ArrowRight") ? 1 : 0) -
      (this.keyEdge("KeyA") || this.keyEdge("ArrowLeft") ? 1 : 0);
    const kNavY =
      (this.keyEdge("KeyW") || this.keyEdge("ArrowUp") ? 1 : 0) -
      (this.keyEdge("KeyS") || this.keyEdge("ArrowDown") ? 1 : 0);
    out.navX += kNavX;
    out.navY += kNavY;
    out.interact ||= this.keyEdge("Space") || this.keyEdge("Enter");
    out.drop ||= this.keyEdge("Escape") || this.keyEdge("Backspace");

    // todos os gamepads
    for (const idx of this.connectedPads()) {
      const g = this.gamepadInput(idx);
      out.navX += g.navX;
      out.navY += g.navY;
      out.interact ||= g.interact;
      out.drop ||= g.drop;
      out.pause ||= g.pause;
    }

    // toque (joystick vira navegação; botões A/B viram confirmar/voltar)
    out.navX += this.touchNavX;
    out.navY += this.touchNavY;
    out.interact ||= this.touchEdge("interact");
    out.drop ||= this.touchEdge("drop") || this.touchEdge("back");

    out.navX = Math.sign(out.navX);
    out.navY = Math.sign(out.navY);
    return out;
  }
}
