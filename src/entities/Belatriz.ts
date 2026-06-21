import { Player } from "./Player";
import { Audio } from "../systems/AudioManager";

/** Belatriz — "Corrida Veloz": velocidade 2× por 3s e carrega 2 objetos. */
export class Belatriz extends Player {
  protected onAbilityStart(): void {
    this.hooks.floatingText(this.position, "ZOOM!", this.def.color);
    Audio.sfx("bark");
    Audio.sfx("whoosh");
    this.speedMultiplier = 2;
    this.carryCapacity = 2;
    this.setAbilityActive(3);
  }
  protected onAbilityEnd(): void {
    this.speedMultiplier = 1;
    this.carryCapacity = 1;
  }
}
