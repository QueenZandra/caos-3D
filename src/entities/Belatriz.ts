import { Player } from "./Player";

/** Belatriz — "Corrida Veloz": velocidade 2× por 3s e carrega 2 objetos. */
export class Belatriz extends Player {
  protected onAbilityStart(): void {
    this.hooks.floatingText(this.position, "ZOOM!", this.def.color);
    this.speedMultiplier = 2;
    this.carryCapacity = 2;
    this.setAbilityActive(3);
  }
  protected onAbilityEnd(): void {
    this.speedMultiplier = 1;
    this.carryCapacity = 1;
  }
}
