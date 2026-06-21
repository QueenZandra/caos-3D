import { TOTAL_PHASES } from "./Constants";

/**
 * Progressão persistida em localStorage: melhores estrelas por fase e a fase
 * mais avançada desbloqueada. Tolerante a dados ausentes/corrompidos (sempre
 * volta a um estado válido). Singleton exportado como `Progress`.
 */

const KEY = "caos_progress_v1";

interface ProgressData {
  /** melhores estrelas por fase (0..3), índice 0 = Fase 1 */
  stars: number[];
  /** fase mais avançada já desbloqueada (1..TOTAL_PHASES) */
  maxUnlocked: number;
}

function blank(): ProgressData {
  return { stars: new Array(TOTAL_PHASES).fill(0), maxUnlocked: 1 };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

class ProgressStore {
  private data: ProgressData = this.load();

  private load(): ProgressData {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const p = JSON.parse(raw) as Partial<ProgressData>;
      const d = blank();
      if (Array.isArray(p.stars)) {
        for (let i = 0; i < TOTAL_PHASES; i++) {
          d.stars[i] = clamp(Math.floor(Number(p.stars[i]) || 0), 0, 3);
        }
      }
      d.maxUnlocked = clamp(Math.floor(Number(p.maxUnlocked) || 1), 1, TOTAL_PHASES);
      return d;
    } catch {
      return blank();
    }
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* localStorage indisponível — segue só em memória */
    }
  }

  /** Estrelas (0..3) registradas para uma fase (1..TOTAL_PHASES). */
  getStars(phase: number): number {
    return this.data.stars[phase - 1] ?? 0;
  }

  /** A fase está liberada para jogar? (Fase 1 sempre; demais conforme avanço.) */
  isUnlocked(phase: number): boolean {
    return phase >= 1 && phase <= this.data.maxUnlocked;
  }

  get maxUnlocked(): number {
    return this.data.maxUnlocked;
  }

  /** Soma de estrelas conquistadas (0..TOTAL_PHASES*3). */
  totalStars(): number {
    return this.data.stars.reduce((a, b) => a + b, 0);
  }

  /**
   * Registra o resultado de uma fase: guarda o melhor número de estrelas e,
   * ao vencer, desbloqueia a fase seguinte.
   */
  recordResult(phase: number, win: boolean, stars: number): void {
    if (phase < 1 || phase > TOTAL_PHASES) return;
    const idx = phase - 1;
    if (stars > this.data.stars[idx]) this.data.stars[idx] = clamp(stars, 0, 3);
    if (win && phase < TOTAL_PHASES) {
      this.data.maxUnlocked = Math.max(this.data.maxUnlocked, phase + 1);
    }
    this.save();
  }

  /** Zera todo o progresso (para um eventual botão de reset). */
  reset(): void {
    this.data = blank();
    this.save();
  }
}

export const Progress = new ProgressStore();
