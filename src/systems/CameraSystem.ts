import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scalar } from "@babylonjs/core/Maths/math.scalar";
import type { Scene } from "@babylonjs/core/scene";
import { CAMERA } from "../utils/Constants";

/**
 * Câmera isométrica fixa (ArcRotateCamera com ângulo travado). Segue o
 * centroide dos alvos e dá zoom-out suave quando eles se afastam.
 * (Split-view fica como evolução futura — ver README.)
 */
export class CameraSystem {
  readonly camera: ArcRotateCamera;
  private targetCentroid = new Vector3(0, 0, 0);
  private targetRadius: number = CAMERA.radius;

  constructor(scene: Scene) {
    this.camera = new ArcRotateCamera(
      "isoCam",
      CAMERA.alpha,
      CAMERA.beta,
      CAMERA.radius,
      Vector3.Zero(),
      scene,
    );
    // câmera fixa: sem controle do usuário
    this.camera.lowerBetaLimit = CAMERA.beta;
    this.camera.upperBetaLimit = CAMERA.beta;
    this.camera.lowerAlphaLimit = CAMERA.alpha;
    this.camera.upperAlphaLimit = CAMERA.alpha;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 200;
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

    // centroide
    const c = new Vector3(0, 0, 0);
    for (const p of points) c.addInPlace(p);
    c.scaleInPlace(1 / points.length);
    this.targetCentroid.copyFrom(c);

    // espalhamento máximo entre alvos → zoom
    let maxSpread = 0;
    for (const p of points) {
      const d = Vector3.Distance(p, c);
      if (d > maxSpread) maxSpread = d;
    }
    this.targetRadius = Scalar.Clamp(CAMERA.radius + maxSpread * 1.4, CAMERA.radius, 40);

    // suaviza
    const k = Math.min(1, dt * 4);
    this.camera.setTarget(Vector3.Lerp(this.camera.getTarget(), this.targetCentroid, k));
    this.camera.radius = Scalar.Lerp(this.camera.radius, this.targetRadius, k);
  }
}
