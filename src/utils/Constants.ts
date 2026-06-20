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
  Phase1 = "phase1",
  Result = "result",
}

/** Câmera isométrica do GDD. */
export const CAMERA = {
  alpha: -Math.PI / 4,
  beta: Math.PI / 3,
  radius: 22,
} as const;

/** Alvo de performance. */
export const TARGET_FPS = 60;
