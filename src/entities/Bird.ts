import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { createToonMaterial, applyOutline } from "../utils/Visual";

let counter = 0;

export type BirdState = "flying" | "perched" | "diving" | "returning" | "leaving";

/**
 * Pássaro invasor (Fase 2). Voa até um ninho, pousa e o constrói; mergulha
 * em pets que se aproximam; foge se assustado (Latido do Sirius). O movimento
 * é dirigido pela fase; a classe guarda estado e visual (placeholder).
 */
export class Bird {
  readonly mesh: Mesh;
  private beak: Mesh;
  private wingL: Mesh;
  private wingR: Mesh;
  state: BirdState = "flying";
  /** índice do ninho-alvo */
  nestIndex: number;
  /** índice do player sendo atacado (no estado diving) */
  diveTarget = -1;

  // animação de voo
  private flapPhase = Math.random() * Math.PI * 2;
  private yaw = 0;
  private bank = 0;
  private bankTarget = 0;

  constructor(scene: Scene, spawn: Vector3, nestIndex: number) {
    counter++;
    this.nestIndex = nestIndex;

    this.mesh = MeshBuilder.CreateSphere(
      `bird_${counter}`,
      { diameterX: 0.5, diameterY: 0.45, diameterZ: 0.7 },
      scene,
    );
    this.mesh.position.copyFrom(spawn);
    this.mesh.material = createToonMaterial(scene, "#4A4A5A", `bird_${counter}`);
    applyOutline(this.mesh, 0.04);

    this.beak = MeshBuilder.CreateCylinder(
      `beak_${counter}`,
      { diameterTop: 0, diameterBottom: 0.18, height: 0.3, tessellation: 8 },
      scene,
    );
    this.beak.material = createToonMaterial(scene, "#FFD166", `beak_${counter}`);
    this.beak.parent = this.mesh;
    this.beak.rotation.x = Math.PI / 2;
    this.beak.position = new Vector3(0, 0, 0.4);

    // asas (batem durante o voo) — pivô deslocado para girar pela base
    const mkWing = (sign: number): Mesh => {
      const pivot = MeshBuilder.CreateBox(`wing_${counter}_${sign}`, { size: 1 }, scene);
      pivot.scaling = new Vector3(0.5, 0.06, 0.32);
      pivot.material = createToonMaterial(scene, "#3A3A48", `wingm_${counter}_${sign}`);
      pivot.parent = this.mesh;
      pivot.position = new Vector3(0.28 * sign, 0.05, -0.02);
      pivot.setPivotPoint(new Vector3(-0.5 * sign, 0, 0)); // gira a partir do corpo
      return pivot;
    };
    this.wingL = mkWing(-1);
    this.wingR = mkWing(1);
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  /** Move em direção a um ponto. Retorna a distância restante. */
  moveTowards(target: Vector3, speed: number, dt: number): number {
    const dir = target.subtract(this.mesh.position);
    const dist = dir.length();
    if (dist > 0.001) {
      dir.normalize();
      const step = Math.min(speed * dt, dist);
      this.mesh.position.addInPlace(dir.scale(step));
      const newYaw = Math.atan2(dir.x, dir.z);
      // inclina (banca) na direção da curva
      let dYaw = newYaw - this.yaw;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      this.bankTarget = Math.max(-0.5, Math.min(0.5, -dYaw * 3));
      this.yaw = newYaw;
      this.mesh.rotation.y = newYaw;
    }
    return dist - speed * dt;
  }

  /** Animação de voo: bate as asas, banca nas curvas, cabeceia de leve. */
  animate(flying: boolean): void {
    const t = performance.now() * 0.001;
    const flapSpeed = flying ? 16 : 5;
    const amp = flying ? 1.0 : 0.22;
    const f = Math.sin(t * flapSpeed + this.flapPhase) * amp;
    this.wingL.rotation.z = 0.15 + f;
    this.wingR.rotation.z = -(0.15 + f);

    const targetBank = flying ? this.bankTarget : 0;
    this.bank += (targetBank - this.bank) * 0.12;
    this.mesh.rotation.z = this.bank;
    this.mesh.rotation.x = Math.sin(t * flapSpeed * 0.5 + this.flapPhase) * 0.05;
  }

  dispose(): void {
    this.beak.dispose();
    this.wingL.dispose();
    this.wingR.dispose();
    this.mesh.dispose();
  }
}
