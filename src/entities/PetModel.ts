import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import type { CharId } from "../utils/Constants";
import type { CharacterDef } from "../utils/CharacterData";
import { createToonMaterial, applyOutline } from "../utils/Visual";

/**
 * Modelo procedural de pet (chibi, estilo Overcooked!) montado a partir de
 * primitivas. É o "placeholder rico" usado enquanto não existe o GLB real —
 * cada personagem fica reconhecível (cachorro x gata, cor do pelo, orelhas,
 * cauda, acessório), seguindo as descrições dos arquivos *.reference.md.
 *
 * Convenção: o pet é centrado em y≈0, olhando para +Z, com os pés em ≈ -0.95
 * (mesma extensão da cápsula de colisão do Player, então ele "pisa" no chão).
 */

type Ears = "floppy" | "pointed";
type Tail = "plume" | "short" | "slim";
type Accessory = "cape" | "scarf" | "none";

interface PetLook {
  species: "dog" | "cat";
  /** cor principal do pelo (real, não a cor de UI) */
  fur: string;
  /** cor secundária (manchas / reflexos / interior das orelhas) */
  furDark: string;
  /** barriga, focinho e patas (tom claro) */
  belly: string;
  /** cor dos olhos */
  eye: string;
  ears: Ears;
  tail: Tail;
  accessory: Accessory;
  /** cor do acessório (capa/lenço) — se ausente, usa a cor de UI do personagem */
  accessoryColor?: string;
  /** manchas tartaruga (Zoe) */
  patches?: boolean;
}

/** Aparência por personagem (ver public/assets/models/characters/*.reference.md). */
const LOOKS: Record<CharId, PetLook> = {
  sirius: {
    species: "dog",
    fur: "#2B2B33", // pelagem preta
    furDark: "#3D2A2A", // reflexos castanho-avermelhados
    belly: "#4A4A55",
    eye: "#8B5A2B", // castanho quente
    ears: "floppy",
    tail: "plume", // cauda em plumacho
    accessory: "cape",
    accessoryColor: "#E63946", // capa vermelha de herói
  },
  belatriz: {
    species: "dog",
    fur: "#D9A441", // dourado / loiro acaramelado
    furDark: "#A8732B", // castanho ao redor dos olhos/focinho
    belly: "#F0D9A8",
    eye: "#2E2018", // olhos escuros
    ears: "floppy",
    tail: "short",
    accessory: "none",
  },
  minerva: {
    species: "cat",
    fur: "#2B2B33", // preta curta e lustrosa
    furDark: "#3A3A44",
    belly: "#3A3A44",
    eye: "#C6D63C", // verde-amarelado
    ears: "pointed",
    tail: "slim",
    accessory: "scarf", // lenço de aventureira
  },
  zoe: {
    species: "cat",
    fur: "#3A2A26", // base escura (tartaruga)
    furDark: "#C46A2E", // manchas ferrugem / laranja
    belly: "#5A3A2E",
    eye: "#E8B83C", // amarelo-dourado
    ears: "pointed",
    tail: "slim",
    accessory: "none",
    patches: true,
  },
};

export interface PetModelResult {
  /** todos os meshes (para sombras, alpha, dispose) */
  parts: Mesh[];
  /** mesh principal (cabeça) — usado p/ flash de atordoamento */
  main: Mesh;
}

/** Constrói o pet procedural sob `parent` e devolve as partes. */
export function buildPetModel(
  scene: Scene,
  parent: TransformNode,
  def: CharacterDef,
): PetModelResult {
  const look = LOOKS[def.id];
  const parts: Mesh[] = [];
  let counter = 0;

  const piece = (
    mesh: Mesh,
    hex: string,
    pos: Vector3,
    outline = 0.03,
  ): Mesh => {
    mesh.material = createToonMaterial(scene, hex, `${def.id}_p${counter++}`);
    if (outline > 0) applyOutline(mesh, outline);
    mesh.parent = parent;
    mesh.position.copyFrom(pos);
    parts.push(mesh);
    return mesh;
  };

  const sphere = (name: string, diameter: number): Mesh =>
    MeshBuilder.CreateSphere(`${def.id}_${name}`, { diameter, segments: 10 }, scene);

  // ── corpo ───────────────────────────────────────────────────────────────
  const bodyLen = look.species === "dog" ? 1.3 : 1.15;
  const body = piece(sphere("body", 0.95), look.fur, new Vector3(0, -0.2, -0.05));
  body.scaling = new Vector3(1, 0.85, bodyLen);

  // barriga / peito (tom claro)
  const chest = piece(sphere("chest", 0.6), look.belly, new Vector3(0, -0.32, 0.3), 0);
  chest.scaling = new Vector3(0.85, 0.85, 0.9);

  // ── cabeça (chibi: grande) ────────────────────────────────────────────────
  const head = piece(sphere("head", 0.98), look.fur, new Vector3(0, 0.52, 0.2));

  // máscara escura ao redor dos olhos/focinho (Belatriz) ou só focinho claro
  const snoutDia = look.species === "dog" ? 0.42 : 0.3;
  const snout = piece(
    sphere("snout", snoutDia),
    look.belly,
    new Vector3(0, 0.42, 0.62),
  );
  snout.scaling = new Vector3(1, 0.85, 1);

  // nariz
  piece(sphere("nose", 0.15), "#15151C", new Vector3(0, 0.47, 0.78), 0.02);

  // olhos + pupilas (espelhados)
  for (const s of [-1, 1]) {
    piece(sphere("eye", 0.2), look.eye, new Vector3(0.18 * s, 0.62, 0.56), 0.02);
    piece(sphere("pupil", 0.1), "#15151C", new Vector3(0.19 * s, 0.62, 0.65), 0);
  }

  // ── orelhas ────────────────────────────────────────────────────────────────
  for (const s of [-1, 1]) {
    if (look.ears === "floppy") {
      const ear = piece(
        sphere("ear", 0.34),
        look.furDark,
        new Vector3(0.34 * s, 0.62, 0.08),
      );
      ear.scaling = new Vector3(0.55, 1.25, 0.4);
      ear.rotation.z = -0.5 * s; // caídas para os lados
    } else {
      // gata: orelhas pontudas (cones)
      const ear = MeshBuilder.CreateCylinder(
        `${def.id}_ear${s}`,
        { diameterTop: 0, diameterBottom: 0.3, height: 0.42, tessellation: 12 },
        scene,
      );
      piece(ear, look.fur, new Vector3(0.26 * s, 0.98, 0.1));
      ear.rotation.z = -0.18 * s;
    }
  }

  // ── patas (4) ───────────────────────────────────────────────────────────────
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = MeshBuilder.CreateCapsule(
        `${def.id}_leg`,
        { radius: 0.13, height: 0.5 },
        scene,
      );
      piece(leg, look.belly, new Vector3(0.24 * sx, -0.62, 0.26 * sz));
    }
  }

  // ── cauda ────────────────────────────────────────────────────────────────
  if (look.tail === "plume") {
    const tail = piece(
      sphere("tail", 0.6),
      look.fur,
      new Vector3(0, 0.1, -0.6),
    );
    tail.scaling = new Vector3(0.55, 1.0, 0.55);
    tail.rotation.x = 0.7; // levantada
  } else if (look.tail === "short") {
    const tail = piece(sphere("tail", 0.32), look.fur, new Vector3(0, -0.05, -0.62));
    tail.scaling = new Vector3(0.9, 0.9, 1.1);
  } else {
    const tail = MeshBuilder.CreateCapsule(
      `${def.id}_tail`,
      { radius: 0.06, height: 0.75 },
      scene,
    );
    piece(tail, look.fur, new Vector3(0, 0.05, -0.6));
    tail.rotation.x = 0.9; // ergue a ponta (vibe felina)
  }

  // ── manchas tartaruga (Zoe) ────────────────────────────────────────────────
  if (look.patches) {
    const spots: Array<[number, number, number, number]> = [
      [0.22, -0.1, 0.15, 0.4],
      [-0.25, -0.35, -0.1, 0.5],
      [0.15, 0.55, -0.1, 0.32],
      [-0.2, 0.45, 0.3, 0.28],
    ];
    for (const [x, y, z, d] of spots) {
      const spot = piece(sphere("spot", d), look.furDark, new Vector3(x, y, z), 0);
      spot.scaling = new Vector3(1, 1, 0.5); // achatadas sobre a superfície
    }
  }

  // ── acessório ──────────────────────────────────────────────────────────────
  const accColor = look.accessoryColor ?? def.color;
  if (look.accessory === "cape") {
    const cape = MeshBuilder.CreateBox(
      `${def.id}_cape`,
      { width: 0.7, height: 0.85, depth: 0.06 },
      scene,
    );
    piece(cape, accColor, new Vector3(0, -0.1, -0.42), 0.04);
    cape.rotation.x = -0.2;
  } else if (look.accessory === "scarf") {
    const scarf = MeshBuilder.CreateTorus(
      `${def.id}_scarf`,
      { diameter: 0.62, thickness: 0.16, tessellation: 16 },
      scene,
    );
    piece(scarf, accColor, new Vector3(0, 0.12, 0.12), 0.03);
    scarf.scaling = new Vector3(1, 0.7, 1);
  }

  return { parts, main: head };
}
