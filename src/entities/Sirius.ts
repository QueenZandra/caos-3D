import { Player } from "./Player";
import { Audio } from "../systems/AudioManager";

/** Sirius — "Latido Poderoso": onda sonora que atordoa inimigos (raio 3). */
export class Sirius extends Player {
  protected onAbilityStart(): void {
    this.hooks.floatingText(this.position, "WOOF!", this.def.color);
    Audio.sfx("bark");
    this.hooks.spawnShockwave(this.position, 3, this.def.color);
    this.hooks.stunEnemies(this.position, 3, 2);
  }
}
