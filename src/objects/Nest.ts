import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { createToonMaterial, applyOutline } from "../utils/Visual";

let counter = 0;

export type NestState = "empty" | "building" | "permanent";

/**
 * Ninho com 3 estágios (Fase 2). Um pássaro o constrói ao longo do tempo:
 * gravetos → forrado → ovos (permanente). Os pets podem destruí-lo enquanto
 * estiver em construção. Ninhos altos (requiresCat) só os gatos alcançam.
 */
export class Nest {
  readonly position: Vector3;
  readonly requiresCat: boolean;
  state: NestState = "empty";
  progress = 0;

  private scene: Scene;
  private root: TransformNode;
  private marker: Mesh;
  private twigs?: Mesh;
  private lining?: Mesh;
  private eggs: Mesh[] = [];

  constructor(scene: Scene, position: Vector3, requiresCat: boolean) {
    counter++;
    this.scene = scene;
    this.position = position.clone();
    this.requiresCat = requiresCat;

    this.root = new TransformNode(`nest_${counter}`, scene);
    this.root.position.copyFrom(position);

    // marcador do ponto de ninho (anel fraco sempre visível)
    this.marker = MeshBuilder.CreateTorus(
      `nestmark_${counter}`,
      { diameter: 1.1, thickness: 0.12, tessellation: 16 },
      scene,
    );
    this.marker.material = createToonMaterial(
      scene,
      requiresCat ? "#9B5DE5" : "#06D6A0",
      `nestmark_${counter}`,
    );
    this.marker.parent = this.root;
    this.marker.visibility = 0.35;
  }

  claim(): void {
    if (this.state !== "empty") return;
    this.state = "building";
    this.progress = 0;
    this.twigs = MeshBuilder.CreateTorus(
      `twigs_${counter}`,
      { diameter: 1.0, thickness: 0.28, tessellation: 12 },
      this.scene,
    );
    this.twigs.material = createToonMaterial(this.scene, "#8C5A3C", `twigs_${counter}`);
    applyOutline(this.twigs, 0.03);
    this.twigs.parent = this.root;
    this.twigs.scaling.setAll(0.5);
  }

  /** Avança a construção. Retorna o estado resultante. */
  build(dt: number, rate: number): NestState {
    if (this.state !== "building") return this.state;
    this.progress = Math.min(1, this.progress + rate * dt);
    if (this.twigs) this.twigs.scaling.setAll(0.5 + this.progress * 0.5);

    // estágio 2: forrado
    if (this.progress >= 0.5 && !this.lining) {
      this.lining = MeshBuilder.CreateDisc(
        `lining_${counter}`,
        { radius: 0.4, tessellation: 16 },
        this.scene,
      );
      this.lining.rotation.x = Math.PI / 2;
      this.lining.material = createToonMaterial(this.scene, "#D9B382", `lining_${counter}`);
      this.lining.parent = this.root;
      this.lining.position.y = 0.05;
    }

    // estágio 3: ovos → permanente
    if (this.progress >= 1) {
      this.state = "permanent";
      this.spawnEggs();
      this.marker.visibility = 0.8;
    }
    return this.state;
  }

  private spawnEggs(): void {
    const offsets = [
      new Vector3(-0.18, 0.12, 0),
      new Vector3(0.18, 0.12, 0),
      new Vector3(0, 0.12, 0.18),
    ];
    for (const off of offsets) {
      const egg = MeshBuilder.CreateSphere(
        `egg_${counter}_${this.eggs.length}`,
        { diameterX: 0.22, diameterY: 0.3, diameterZ: 0.22 },
        this.scene,
      );
      egg.material = createToonMaterial(this.scene, "#FFF8F0", `egg_${counter}`);
      applyOutline(egg, 0.02);
      egg.parent = this.root;
      egg.position.copyFrom(off);
      this.eggs.push(egg);
    }
  }

  /** Destrói o ninho em construção, voltando ao estado vazio. */
  reset(): void {
    if (this.state !== "building") return;
    this.twigs?.dispose();
    this.lining?.dispose();
    this.twigs = undefined;
    this.lining = undefined;
    this.state = "empty";
    this.progress = 0;
    this.marker.visibility = 0.35;
  }

  /** Ponto onde o pássaro pousa (logo acima do ninho). */
  get perch(): Vector3 {
    return new Vector3(this.position.x, this.position.y + 0.35, this.position.z);
  }

  dispose(): void {
    this.eggs.forEach((e) => e.dispose());
    this.twigs?.dispose();
    this.lining?.dispose();
    this.marker.dispose();
    this.root.dispose();
  }
}
