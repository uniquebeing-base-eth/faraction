import { useEffect, useRef } from "react";
import { getArena, type ArenaId } from "@/lib/game/arenas";

interface ArenaStageProps {
  arena: ArenaId;
  /** Overall brightness/particle intensity multiplier, 0–2. Defaults to 1. */
  intensity?: number;
  className?: string;
}

/**
 * Full-bleed, client-only Three.js backdrop for a battle arena. Purely
 * decorative: pointer-events-none, sits behind UI, and never blocks layout.
 * Renders nothing during SSR — geometry is built lazily on mount.
 */
export function ArenaStage({ arena, intensity = 1, className = "" }: ArenaStageProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void buildScene(mount, arena, intensity).then((fn) => {
      if (cancelled) {
        fn?.();
      } else {
        cleanup = fn;
      }
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arena, intensity]);

  return (
    <div
      ref={mountRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}
    />
  );
}

async function buildScene(
  mount: HTMLDivElement,
  arenaId: ArenaId,
  intensity: number,
): Promise<(() => void) | undefined> {
  if (typeof window === "undefined") return undefined;

  const THREE = await import("three");
  if (!mount.isConnected) return undefined;

  const cfg = getArena(arenaId);
  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const width = mount.clientWidth || window.innerWidth;
  const height = mount.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color(cfg.fog).getHex(), 0.045);

  const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 200);
  camera.position.set(0, 3.4, 11);
  camera.lookAt(0, 2, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);
  mount.appendChild(renderer.domElement);

  /* --------------------------------------------------------------- sky */
  const skyGeo = new THREE.SphereGeometry(90, 24, 16);
  const topColor = new THREE.Color(cfg.sky[0]);
  const bottomColor = new THREE.Color(cfg.sky[1]);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    fog: false,
    uniforms: {
      topColor: { value: topColor },
      bottomColor: { value: bottomColor },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y * 0.5 + 0.5;
        vec3 col = mix(bottomColor, topColor, clamp(h, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  /* ------------------------------------------------------------ ground */
  const groundGeo = new THREE.PlaneGeometry(160, 160, 1, 1);
  const groundMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(cfg.ground),
    roughness: 0.85,
    metalness: 0.15,
    fog: true,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.GridHelper(160, 40, new THREE.Color(cfg.accent), new THREE.Color(cfg.ground));
  const gridMat = grid.material as import("three").Material & { opacity: number; transparent: boolean };
  gridMat.opacity = 0.12;
  gridMat.transparent = true;
  grid.position.y = 0.01;
  scene.add(grid);

  // Darken the bottom of the frame so the floor never competes with the UI.
  const vignetteGeo = new THREE.PlaneGeometry(2, 2);
  const vignetteMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {},
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        float d = smoothstep(0.0, 0.55, 1.0 - vUv.y);
        gl_FragColor = vec4(0.0, 0.0, 0.0, d * 0.55);
      }
    `,
  });
  const vignette = new THREE.Mesh(vignetteGeo, vignetteMat);
  vignette.renderOrder = 999;
  vignette.frustumCulled = false;

  /* ------------------------------------------------------------- lights */
  const accent = new THREE.Color(cfg.accent);
  const ambient = new THREE.AmbientLight(0xffffff, 0.28);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 0.5 * intensity);
  key.position.set(6, 10, 4);
  scene.add(key);

  const rim = new THREE.PointLight(accent, 3.2 * intensity, 60, 2);
  rim.position.set(-6, 4.5, -6);
  scene.add(rim);

  const rim2 = new THREE.PointLight(accent, 1.6 * intensity, 40, 2);
  rim2.position.set(4, 3, 4);
  scene.add(rim2);

  /* ---------------------------------------------------------- set piece */
  const group = new THREE.Group();
  scene.add(group);
  const animators: ((t: number, dt: number) => void)[] = [];
  buildSetPiece(THREE, arenaId, group, accent, animators, intensity);

  /* ---------------------------------------------------------------- rig */
  let raf = 0;
  let running = true;
  const start = performance.now();
  const basePos = camera.position.clone();

  const onVisibility = () => {
    running = !document.hidden;
    if (running && !reduceMotion) loop(performance.now());
  };
  document.addEventListener("visibilitychange", onVisibility);

  const render = (t: number, dt: number) => {
    for (const a of animators) a(t, dt);
    if (!reduceMotion) {
      camera.position.x = basePos.x + Math.sin(t * 0.00006) * 1.4;
      camera.position.y = basePos.y + Math.sin(t * 0.00009) * 0.4;
      group.rotation.y = Math.sin(t * 0.00004) * 0.12;
      camera.lookAt(0, 2, 0);
    }
    renderer.autoClear = true;
    renderer.render(scene, camera);
    renderer.autoClearColor = false;
    renderer.clearDepth();
    renderer.render(vignette, camera);
  };

  let last = start;
  const loop = (now: number) => {
    if (!running) return;
    const t = now - start;
    const dt = Math.min(now - last, 50);
    last = now;
    render(t, dt);
    if (!reduceMotion) raf = requestAnimationFrame(loop);
  };

  render(0, 16);
  if (!reduceMotion) raf = requestAnimationFrame(loop);

  const onResize = () => {
    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    render(performance.now() - start, 16);
  };
  window.addEventListener("resize", onResize);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    scene.traverse((obj) => {
      const mesh = obj as import("three").Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = (obj as import("three").Mesh).material as
        | import("three").Material
        | import("three").Material[]
        | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    vignetteGeo.dispose();
    vignetteMat.dispose();
    skyGeo.dispose();
    skyMat.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement === mount) {
      mount.removeChild(renderer.domElement);
    }
  };
}

/** Builds the per-arena procedural set piece into `group`, registering any
 * per-frame animator callbacks that should run on the RAF loop. */
function buildSetPiece(
  THREE: typeof import("three"),
  arenaId: ArenaId,
  group: import("three").Group,
  accent: import("three").Color,
  animators: ((t: number, dt: number) => void)[],
  intensity: number,
) {
  const rand = mulberry32(hashId(arenaId));

  switch (arenaId) {
    case "nexus": {
      for (let i = 0; i < 5; i++) {
        const radius = 3 + i * 1.6;
        const geo = new THREE.TorusGeometry(radius, 0.05, 8, 64);
        const mat = new THREE.MeshBasicMaterial({
          color: accent,
          transparent: true,
          opacity: 0.35 - i * 0.05,
        });
        const ring = new THREE.Mesh(geo, mat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.05 + i * 0.02;
        group.add(ring);
        animators.push((t) => {
          ring.rotation.z = t * 0.00005 * (i % 2 === 0 ? 1 : -1);
        });
      }
      const dais = new THREE.Mesh(
        new THREE.CylinderGeometry(2.4, 2.6, 0.3, 48),
        new THREE.MeshStandardMaterial({ color: 0x222633, metalness: 0.4, roughness: 0.5 }),
      );
      dais.position.y = 0.15;
      group.add(dais);
      break;
    }

    case "mountain": {
      for (let i = 0; i < 9; i++) {
        const h = 4 + rand() * 7;
        const geo = new THREE.ConeGeometry(1.2 + rand() * 1.2, h, 5);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x2e3a48,
          roughness: 0.95,
          flatShading: true,
        });
        const peak = new THREE.Mesh(geo, mat);
        const angle = (i / 9) * Math.PI * 2;
        const dist = 16 + rand() * 8;
        peak.position.set(Math.cos(angle) * dist, h / 2 - 1, Math.sin(angle) * dist - 6);
        peak.rotation.y = rand() * Math.PI;
        group.add(peak);
      }
      break;
    }

    case "volcano": {
      for (let i = 0; i < 4; i++) {
        const h = 5 + rand() * 4;
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(2 + rand(), h, 6),
          new THREE.MeshStandardMaterial({ color: 0x1c1210, roughness: 1, flatShading: true }),
        );
        const angle = (i / 4) * Math.PI * 2 + 0.6;
        const dist = 12 + rand() * 6;
        cone.position.set(Math.cos(angle) * dist, h / 2 - 1, Math.sin(angle) * dist - 4);
        group.add(cone);
      }
      const lava = new THREE.Mesh(
        new THREE.CircleGeometry(3.2, 32),
        new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.6 }),
      );
      lava.rotation.x = -Math.PI / 2;
      lava.position.y = 0.02;
      group.add(lava);
      animators.push((t) => {
        (lava.material as import("three").MeshBasicMaterial).opacity =
          0.5 + Math.sin(t * 0.002) * 0.1;
      });

      const emberCount = Math.round(120 * intensity);
      const positions = new Float32Array(emberCount * 3);
      for (let i = 0; i < emberCount; i++) {
        positions[i * 3] = (rand() - 0.5) * 10;
        positions[i * 3 + 1] = rand() * 6;
        positions[i * 3 + 2] = (rand() - 0.5) * 10 - 2;
      }
      const emberGeo = new THREE.BufferGeometry();
      emberGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const embers = new THREE.Points(
        emberGeo,
        new THREE.PointsMaterial({ color: 0xffa04d, size: 0.08, transparent: true, opacity: 0.85 }),
      );
      group.add(embers);
      animators.push((_t, dt) => {
        const pos = emberGeo.attributes["position"] as import("three").BufferAttribute;
        for (let i = 0; i < emberCount; i++) {
          let y = pos.getY(i) + dt * 0.0009;
          if (y > 6) y = 0;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      });
      break;
    }

    case "city": {
      for (let i = 0; i < 26; i++) {
        const w = 0.8 + rand() * 1.4;
        const h = 3 + rand() * 12;
        const mat = new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 0.6 });
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
        const angle = rand() * Math.PI * 2;
        const dist = 9 + rand() * 14;
        tower.position.set(Math.cos(angle) * dist, h / 2 - 1, Math.sin(angle) * dist - 4);
        group.add(tower);

        if (rand() > 0.4) {
          const windowMat = new THREE.MeshBasicMaterial({
            color: rand() > 0.5 ? accent : 0xffe9a8,
            transparent: true,
            opacity: 0.5 + rand() * 0.4,
          });
          const windows = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, h * 0.9, w * 0.2), windowMat);
          windows.position.copy(tower.position);
          group.add(windows);
        }
      }
      break;
    }

    case "forest": {
      for (let i = 0; i < 22; i++) {
        const h = 2.5 + rand() * 3.5;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.2, h * 0.4, 6),
          new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 }),
        );
        const foliage = new THREE.Mesh(
          new THREE.ConeGeometry(1 + rand() * 0.6, h, 7),
          new THREE.MeshStandardMaterial({ color: 0x1e3722, roughness: 0.9, flatShading: true }),
        );
        const angle = rand() * Math.PI * 2;
        const dist = 6 + rand() * 15;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist - 4;
        trunk.position.set(x, h * 0.2 - 1, z);
        foliage.position.set(x, h * 0.4 + h * 0.5 - 1, z);
        group.add(trunk, foliage);
      }
      const moteCount = Math.round(80 * intensity);
      const positions = new Float32Array(moteCount * 3);
      for (let i = 0; i < moteCount; i++) {
        positions[i * 3] = (rand() - 0.5) * 20;
        positions[i * 3 + 1] = rand() * 5;
        positions[i * 3 + 2] = (rand() - 0.5) * 20 - 4;
      }
      const moteGeo = new THREE.BufferGeometry();
      moteGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const motes = new THREE.Points(
        moteGeo,
        new THREE.PointsMaterial({ color: accent, size: 0.05, transparent: true, opacity: 0.6 }),
      );
      group.add(motes);
      animators.push((t) => {
        motes.rotation.y = t * 0.00002;
      });
      break;
    }

    case "void": {
      const shardCount = 16;
      const shards: import("three").Mesh[] = [];
      for (let i = 0; i < shardCount; i++) {
        const geo = new THREE.OctahedronGeometry(0.4 + rand() * 0.8, 0);
        const mat = new THREE.MeshStandardMaterial({
          color: accent,
          emissive: accent,
          emissiveIntensity: 0.35,
          roughness: 0.3,
          metalness: 0.6,
        });
        const shard = new THREE.Mesh(geo, mat);
        const angle = rand() * Math.PI * 2;
        const dist = 3 + rand() * 12;
        shard.position.set(Math.cos(angle) * dist, 1 + rand() * 5, Math.sin(angle) * dist - 3);
        shard.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
        group.add(shard);
        shards.push(shard);
      }
      animators.push((_t, dt) => {
        for (const s of shards) {
          s.rotation.x += dt * 0.0002;
          s.rotation.y += dt * 0.00015;
        }
      });
      break;
    }
  }
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Deterministic PRNG so each arena's layout is stable across renders. */
function mulberry32(seed: number) {
  let a = seed || 1;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
