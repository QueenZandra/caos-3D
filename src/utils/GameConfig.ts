import type { CharId } from "./Constants";

/** Como cada slot de jogador é controlado. */
export interface PlayerSlot {
  /** P1..P4 */
  index: number;
  /** personagem escolhido */
  charId: CharId;
  /** fonte de input */
  inputKind: "keyboard-wasd" | "keyboard-arrows" | "gamepad";
  /** índice do gamepad (quando inputKind === "gamepad") */
  gamepadIndex?: number;
}

/** Resultado de uma fase, usado pela tela de resultado. */
export interface PhaseResult {
  phaseName: string;
  win: boolean;
  stars: number;
  collected: number;
  goal: number;
  destruction: number; // 0..1
}

/**
 * Estado global do jogo, compartilhado entre cenas.
 * Singleton simples — não precisamos de algo mais sofisticado para a fatia vertical.
 */
class GameConfigStore {
  playerCount = 2;
  players: PlayerSlot[] = [];
  lastResult: PhaseResult | null = null;
  /** fase atual (1..TOTAL_PHASES) — usada pela tela de resultado. */
  phase = 1;
  /** fase em que a campanha começa ao iniciar (1 = início; outra = continuar/seleção). */
  startPhase = 1;

  /** Multiplicadores do DifficultyScaler (GDD passo 2). */
  get difficulty(): { spawnRate: number; timer: number; objective: number } {
    switch (this.playerCount) {
      case 2:
        return { spawnRate: 0.6, timer: 1.3, objective: 0.7 };
      case 3:
        return { spawnRate: 0.8, timer: 1.1, objective: 0.85 };
      default:
        return { spawnRate: 1, timer: 1, objective: 1 };
    }
  }

  reset(): void {
    this.players = [];
    this.lastResult = null;
  }
}

export const GameConfig = new GameConfigStore();
