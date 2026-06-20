import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { PlayerSlot } from "../utils/GameConfig";
import { CHARACTERS } from "../utils/CharacterData";
import { Player, type AbilityHooks } from "./Player";
import { Sirius } from "./Sirius";
import { Belatriz } from "./Belatriz";
import { Minerva } from "./Minerva";
import { Zoe } from "./Zoe";

/** Instancia o personagem correto a partir do slot do jogador. */
export function createPlayer(
  scene: Scene,
  slot: PlayerSlot,
  spawn: Vector3,
  hooks: AbilityHooks,
): Player {
  const def = CHARACTERS[slot.charId];
  switch (slot.charId) {
    case "sirius":
      return new Sirius(scene, def, slot, spawn, hooks);
    case "belatriz":
      return new Belatriz(scene, def, slot, spawn, hooks);
    case "minerva":
      return new Minerva(scene, def, slot, spawn, hooks);
    case "zoe":
      return new Zoe(scene, def, slot, spawn, hooks);
    default:
      return new Player(scene, def, slot, spawn, hooks);
  }
}
