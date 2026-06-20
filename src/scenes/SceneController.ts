import type { Scene } from "@babylonjs/core/scene";
import type { GameManager } from "../systems/GameManager";

/** Contrato comum de todas as cenas (menus e fases). */
export interface SceneController {
  readonly scene: Scene;
  /** chamado por frame (input já atualizado pelo GameManager) */
  update(dt: number): void;
  dispose(): void;
}

/** Fábrica de cena, recebe o GameManager para solicitar transições. */
export type SceneFactory = (game: GameManager) => SceneController;
