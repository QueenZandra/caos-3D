import { Player } from "./Player";
import { Audio } from "../systems/AudioManager";

/**
 * Zoe — "Furtividade": fica semi-transparente por 3s; ao voltar, solta uma
 * onda de susto que atordoa inimigos próximos (raio 1.5).
 */
export class Zoe extends Player {
  protected onAbilityStart(): void {
    this.hooks.floatingText(this.position, "…", this.def.color);
    Audio.sfx("whoosh");
    this.setVisualAlpha(0.25);
    this.setAbilityActive(3);
  }
  protected onAbilityEnd(): void {
    this.setVisualAlpha(1);
    Audio.sfx("meow");
    Audio.sfx("stun");
    this.hooks.spawnShockwave(this.position, 1.5, this.def.color);
    this.hooks.stunEnemies(this.position, 1.5, 1.5);
  }
}
