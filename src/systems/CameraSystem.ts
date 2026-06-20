import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scalar } from "@babylonjs/core/Maths/math.scalar";
import { Viewport } from "@babylonjs/core/Maths/math.viewport";
import type { Scene } from "@babylonjs/core/scene";
import { CAMERA, UI_LAYER } from "../utils/Constants";

const FULL_VIEWPORT = new Viewport(0, 0, 1, 1);
const LEFT_VIEWPORT = new Viewport(0, 0, 0.5, 1);
const RIGHT_VIEWPORT = new Viewport(0.5, 0, 0.5, 1);

/** Distância de espalhamento para ENTRAR em split. */
const SPLIT_ON = 11;
/** Distância para VOLTAR a tela única (histerese, evita piscar). */
const SPLIT_OFF = 8;

/**
 * Câmera isométrica fixa (ArcRotateCamera com ângulo travado).
 *
 * - Tela única: segue o centroide e dá zoom-out conforme os pets se afastam.
 * - Split-view automático: quando o espalhamento passa de SPLIT_ON, divide a
 *   tela em duas viewports; cada uma segue um grupo de pets próximos entre si.
 *   Ambas as câmeras compartilham a orientação, então a direção de movimento
 *   continua a mesma nos dois lados.
 */
export class CameraSystem {
  readonly camera: ArcRotateCamera; // câmera A (esquerda / tela cheia)
  private camB: ArcRotateCamera; // câmera B (direita, no split)
  /** câmera dedicada à UI — sempre em tela cheia, renderiza só o HUD */
  readonly uiCamera: ArcRotateCamera;
  private scene: Scene;
  private split = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.camera = this.makeCamera("isoCamA");
    this.camB = this.makeCamera("isoCamB");
    this.uiCamera = this.makeCamera("uiCam");
    this.uiCamera.layerMask = UI_LAYER;
    this.uiCamera.viewport = FULL_VIEWPORT;
    this.camera.viewport = FULL_VIEWPORT;
    this.scene.activeCameras = [this.camera, this.uiCamera];
    // activeCamera fixa na câmera de gameplay (projeção de textos ancorados)
    this.scene.activeCamera = this.camera;
  }

  private makeCamera(name: string): ArcRotateCamera {
    const cam = new ArcRotateCamera(
      name,
      CAMERA.alpha,
      CAMERA.beta,
      CAMERA.radius,
      Vector3.Zero(),
      this.scene,
    );
    cam.lowerBetaLimit = CAMERA.beta;
    cam.upperBetaLimit = CAMERA.beta;
    cam.lowerAlphaLimit = CAMERA.alpha;
    cam.upperAlphaLimit = CAMERA.alpha;
    cam.minZ = 0.1;
    cam.maxZ = 200;
    return cam;
  }

  get isSplit(): boolean {
    return this.split;
  }

  /** Direção "frente" projetada no chão — base para o movimento dos pets. */
  getGroundForward(): Vector3 {
    const fwd = this.camera.getTarget().subtract(this.camera.position);
    fwd.y = 0;
    if (fwd.lengthSquared() < 0.0001) return new Vector3(0, 0, 1);
    return fwd.normalize();
  }

  update(dt: number, points: Vector3[]): void {
    if (points.length === 0) return;

    const spread = this.maxPairwiseDistance(points);

    // histerese de transição
    if (!this.split && spread > SPLIT_ON && points.length >= 2) {
      this.setSplit(true);
    } else if (this.split && spread < SPLIT_OFF) {
      this.setSplit(false);
    }

    if (!this.split) {
      this.follow(this.camera, points, dt);
      return;
    }

    // divide em 2 grupos pelos dois pets mais distantes (seeds)
    const [groupA, groupB] = this.cluster(points);
    this.follow(this.camera, groupA, dt);
    this.follow(this.camB, groupB, dt);
  }

  private setSplit(on: boolean): void {
    this.split = on;
    if (on) {
      this.camera.viewport = LEFT_VIEWPORT;
      this.camB.viewport = RIGHT_VIEWPORT;
      // câmera de UI sempre por último, em tela cheia
      this.scene.activeCameras = [this.camera, this.camB, this.uiCamera];
    } else {
      this.camera.viewport = FULL_VIEWPORT;
      this.scene.activeCameras = [this.camera, this.uiCamera];
    }
  }

  /** Aproxima a câmera do centroide do grupo, com zoom pelo espalhamento. */
  private follow(cam: ArcRotateCamera, group: Vector3[], dt: number): void {
    if (group.length === 0) return;
    const c = new Vector3(0, 0, 0);
    for (const p of group) c.addInPlace(p);
    c.scaleInPlace(1 / group.length);

    let maxSpread = 0;
    for (const p of group) {
      const d = Vector3.Distance(p, c);
      if (d > maxSpread) maxSpread = d;
    }
    const targetRadius = Scalar.Clamp(CAMERA.radius + maxSpread * 1.4, CAMERA.radius, 40);

    const k = Math.min(1, dt * 4);
    cam.setTarget(Vector3.Lerp(cam.getTarget(), c, k));
    cam.radius = Scalar.Lerp(cam.radius, targetRadius, k);
  }

  private maxPairwiseDistance(points: Vector3[]): number {
    let max = 0;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const d = Vector3.Distance(points[i], points[j]);
        if (d > max) max = d;
      }
    }
    return max;
  }

  /** Particiona em 2 grupos: seeds = par mais distante; resto vai ao mais perto. */
  private cluster(points: Vector3[]): [Vector3[], Vector3[]] {
    let si = 0;
    let sj = 1;
    let max = -1;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const d = Vector3.Distance(points[i], points[j]);
        if (d > max) {
          max = d;
          si = i;
          sj = j;
        }
      }
    }
    const seedA = points[si];
    const seedB = points[sj];
    const groupA: Vector3[] = [];
    const groupB: Vector3[] = [];
    points.forEach((p) => {
      if (Vector3.Distance(p, seedA) <= Vector3.Distance(p, seedB)) groupA.push(p);
      else groupB.push(p);
    });
    return [groupA, groupB];
  }
}
