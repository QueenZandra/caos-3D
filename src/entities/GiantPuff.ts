import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { createToonMaterial, applyOutline } from "../utils/Visual";

const RADIUS = 1.5;

/**
 * Puff gigante (Fase 3). Rola pelo cenário com física; após "ganhar vida",
 * persegue o pet mais próximo. Repelido pelo Latido do Sirius.
 */
export class GiantPuff {
  readonly mesh: Mesh;
  readonly aggregate: PhysicsAggregate;
  readonly radius = RADIUS;
  alive = false;

  constructor(scene: Scene, spawn: Vector3, color: string) {
    this.mesh = MeshBuilder.CreateSphere("giantPuff", { diameter: RADIUS * 2, segments: 12 }, scene);
    this.mesh.position.copyFrom(spawn);
    this.mesh.material = createToonMaterial(scene, color, "giantPuff");
    applyOutline(this.mesh, 0.07);

    this.aggregate = new PhysicsAggregate(
      this.mesh,
      PhysicsShapeType.SPHERE,
      { mass: 5, friction: 0.4, restitution: 0.5 },
      scene,
    );
  }

  get position(): Vector3 {
    return this.mesh.position;
  }
  get speed(): number {
    return this.aggregate.body.getLinearVelocity().length();
  }

  /** Empurrão lateral (rajada / repelido pelo latido). */
  shove(dir: Vector3, force: number): void {
    this.aggregate.body.applyImpulse(dir.scale(force), this.mesh.position);
  }

  /** Desliza em direção a um alvo no plano (mantém a componente vertical). */
  glideToward(target: Vector3, speed: number): void {
    const dir = target.subtract(this.mesh.position);
    dir.y = 0;
    if (dir.lengthSquared() < 0.0001) return;
    dir.normalize();
    const vy = this.aggregate.body.getLinearVelocity().y;
    this.aggregate.body.setLinearVelocity(new Vector3(dir.x * speed, vy, dir.z * speed));
  }

  dispose(): void {
    this.aggregate.dispose();
    this.mesh.dispose();
  }
}
