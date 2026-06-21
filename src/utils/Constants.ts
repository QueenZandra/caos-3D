import { Color3 } from "@babylonjs/core/Maths/math.color";

/** Paleta do GDD (Caos em Casa). */
export const PALETTE = {
  orange: "#FF6B35",
  pink: "#FF4D8D",
  yellow: "#FFD166",
  teal: "#06D6A0",
  purple: "#9B5DE5",
  blue: "#4CC9F0",
  dark: "#1A1A2E",
  cream: "#FFF8F0",
} as const;

/** Converte hex (#RRGGBB) para Color3 do Babylon. */
export function hexToColor3(hex: string): Color3 {
  return Color3.FromHexString(hex);
}

/** Identificadores dos personagens jogáveis. */
export type CharId = "sirius" | "belatriz" | "minerva" | "zoe";

/** Estados de jogo (cenas de alto nível). */
export enum GameState {
  Menu = "menu",
  PlayerCount = "player_count",
  CharSelect = "char_select",
  LevelSelect = "level_select",
  Options = "options",
  Phase1 = "phase1",
  Phase2 = "phase2",
  Phase3 = "phase3",
  Phase4 = "phase4",
  Phase5 = "phase5",
  Phase6 = "phase6",
  Phase7 = "phase7",
  Phase8 = "phase8",
  Result = "result",
}

/** Número de fases jogáveis implementadas. */
export const TOTAL_PHASES = 8;

/** Nomes das 8 fases (índice 0 = Fase 1). */
export const PHASE_NAMES = [
  "O Carteiro do Mal",
  "Os Pássaros Abusados",
  "A Rebelião das Almofadas",
  "O Roubo Épico da Cozinha",
  "O Vizinho Invasor",
  "A Moto do Terror",
  "Caos Total",
  "Operação Perdão",
] as const;

/** Mapeia um número de fase para o estado de jogo correspondente. */
export function phaseState(n: number): GameState {
  if (n === 8) return GameState.Phase8;
  if (n === 7) return GameState.Phase7;
  if (n === 6) return GameState.Phase6;
  if (n === 5) return GameState.Phase5;
  if (n === 4) return GameState.Phase4;
  if (n === 3) return GameState.Phase3;
  if (n === 2) return GameState.Phase2;
  return GameState.Phase1;
}

/** Câmera isométrica do GDD. */
export const CAMERA = {
  alpha: -Math.PI / 4,
  beta: Math.PI / 3,
  radius: 22,
} as const;

/** Alvo de performance. */
export const TARGET_FPS = 60;

/**
 * Layer masks para separar mundo 3D da UI quando há múltiplas câmeras ativas
 * (split-view). A câmera de gameplay usa a máscara padrão (não inclui o bit de
 * UI); a câmera de UI usa só o bit de UI — assim o HUD renderiza uma única vez
 * em tela cheia, sem duplicar nas viewports.
 */
export const GAMEPLAY_LAYER = 0x0fffffff;
export const UI_LAYER = 0x20000000;
