import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  ExtrudeGeometry,
  Mesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Scene,
  Shape,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * The preloader's 3D star: a four-pointed, bevelled, glassy sparkle that
 * spins while the planets download. `boost` (0 → 1) spins it faster and
 * brightens it for the slash across the screen.
 */
export class LoaderStar {
  readonly state = { boost: 0 };

  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(35, 1, 0.1, 50);
  private readonly star: Mesh<ExtrudeGeometry, MeshPhysicalMaterial>;
  private readonly light = new PointLight("#ffffff", 30, 20);
  private frame = 0;
  private last = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    const { width, height } = canvas.getBoundingClientRect();
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height || 1;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 0, 5.2);
    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const shape = new Shape();
    const points = 4;
    for (let i = 0; i <= points * 2; i += 1) {
      const angle = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
      const radius = i % 2 === 0 ? 1.25 : 0.2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    const geometry = new ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 5, curveSegments: 4 });
    geometry.center();
    // Polished silver: it reads by its highlights, not by glowing.
    const material = new MeshPhysicalMaterial({
      color: new Color("#f2f4f7"),
      emissive: new Color("#ffffff"),
      emissiveIntensity: 0.04,
      metalness: 0.9,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
    this.star = new Mesh(geometry, material);
    this.scene.add(this.star, new AmbientLight("#8fb6ff", 0.6));
    this.light.position.set(2, 2, 4);
    const back = new PointLight("#c9d6ff", 12, 20);
    back.position.set(-3, -2, 2);
    this.scene.add(this.light, back);
  }

  start(): void {
    this.last = performance.now();
    const loop = (now: number) => {
      this.frame = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      const t = now / 1000;
      const boost = this.state.boost;
      this.star.rotation.y += dt * (0.9 + boost * 7);
      this.star.rotation.x = Math.sin(t * 0.8) * 0.35;
      this.star.rotation.z = Math.sin(t * 0.5) * 0.15 - boost * 0.6;
      this.light.intensity = 30 + boost * 25;
      this.renderer.render(this.scene, this.camera);
    };
    this.frame = requestAnimationFrame(loop);
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.star.geometry.dispose();
    this.star.material.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }
}
