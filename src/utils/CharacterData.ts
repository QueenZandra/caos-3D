import type { CharId } from "./Constants";
import { PALETTE } from "./Constants";

export interface CharacterDef {
  id: CharId;
  name: string;
  emoji: string;
  species: string;
  /** cor (hex) usada no toon shading e na UI */
  color: string;
  ability: string;
  abilityDesc: string;
  /** velocidade base (unidades/s) — do GDD */
  speed: number;
  /** força relativa (afeta empurrar objetos pesados) */
  strength: number;
  /** cooldown da habilidade em segundos */
  cooldown: number;
  /** caminho do modelo GLB (placeholder até existir) */
  model: string;
}

export const CHARACTERS: Record<CharId, CharacterDef> = {
  sirius: {
    id: "sirius",
    name: "Sirius",
    emoji: "🐕",
    species: "Cachorro",
    color: PALETTE.teal,
    ability: "Latido Poderoso",
    abilityDesc: "Onda sonora 3D que atordoa inimigos num raio de 3 unidades por 2s.",
    speed: 5,
    strength: 4,
    cooldown: 5,
    model: "characters/sirius.glb",
  },
  belatriz: {
    id: "belatriz",
    name: "Belatriz",
    emoji: "🐕",
    species: "Cachorra",
    color: PALETTE.pink,
    ability: "Corrida Veloz",
    abilityDesc: "Velocidade 2× por 3s e carrega 2 objetos ao mesmo tempo.",
    speed: 8,
    strength: 2,
    cooldown: 6,
    model: "characters/belatriz.glb",
  },
  minerva: {
    id: "minerva",
    name: "Minerva",
    emoji: "🐱",
    species: "Gata",
    color: PALETTE.purple,
    ability: "Escalar",
    abilityDesc: "Sobe em superfícies elevadas e empurra objetos para baixo.",
    speed: 6,
    strength: 3,
    cooldown: 4,
    model: "characters/minerva.glb",
  },
  zoe: {
    id: "zoe",
    name: "Zoe",
    emoji: "🐱",
    species: "Gata",
    color: PALETTE.orange,
    ability: "Furtividade",
    abilityDesc: "Fica semi-transparente por 3s; inimigos não detectam. Onda de susto ao voltar.",
    speed: 7,
    strength: 2,
    cooldown: 7,
    model: "characters/zoe.glb",
  },
};

export const CHAR_ORDER: CharId[] = ["sirius", "belatriz", "minerva", "zoe"];
