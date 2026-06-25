/**
 * Preferências de acessibilidade, persistidas em localStorage.
 *
 * - reduceMotion: corta tremor de câmera, o flash de perigo pulsante e reduz
 *   partículas (fotossensibilidade / enjoo de movimento).
 * - highContrast: contornos pretos mais grossos nos meshes (baixa visão /
 *   daltonismo). Aplica-se às cenas construídas a partir do momento em que é
 *   ligado (entrar/reiniciar uma fase já reflete a mudança).
 *
 * Singleton exportado como `Settings`.
 */

const KEY = "caos_a11y_v1";

interface A11y {
  reduceMotion: boolean;
  highContrast: boolean;
}

class SettingsStore {
  reduceMotion = false;
  highContrast = false;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<A11y>;
        this.reduceMotion = !!p.reduceMotion;
        this.highContrast = !!p.highContrast;
      }
    } catch {
      /* localStorage indisponível — usa padrões */
    }
  }

  private save(): void {
    try {
      const a: A11y = { reduceMotion: this.reduceMotion, highContrast: this.highContrast };
      localStorage.setItem(KEY, JSON.stringify(a));
    } catch {
      /* ignore */
    }
  }

  toggleReduceMotion(): boolean {
    this.reduceMotion = !this.reduceMotion;
    this.save();
    return this.reduceMotion;
  }

  toggleHighContrast(): boolean {
    this.highContrast = !this.highContrast;
    this.save();
    return this.highContrast;
  }
}

export const Settings = new SettingsStore();
