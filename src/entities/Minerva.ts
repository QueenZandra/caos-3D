import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Player } from "./Player";
import { Audio } from "../systems/AudioManager";

/**
 * Minerva — "Escalar": dá um impulso vertical (placeholder de subir em
 * superfícies) e empurra objetos próximos para baixo com uma onda.
 */
export class Minerva extends Player {
  protected onAbilityStart(): void {
    this.hooks.floatingText(this.position, "↑ Escalar", this.def.color);
    Audio.sfx("meow");
    const v = this.aggregate.body.getLinearVelocity();
    this.aggregate.body.setLinearVelocity(new Vector3(v.x, 6, v.z));
    this.hooks.spawnShockwave(this.position, 2, this.def.color);
  }
}
