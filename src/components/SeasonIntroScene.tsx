import { useEffect, useRef } from "react";
import type * as ThreeNS from "three";

interface SeasonIntroSceneProps {
  className?: string;
  accent?: string;
}

/**
 * Lightweight Three.js presentation layer for a cinematic season wrapper.
 *
 * This stays entirely within the visual shell: it renders decorative motion,
 * floating fighter cards, and atmospheric haze behind the app UI without
 * participating in game rules, wallet state, or server-side combat logic.
 */
export function SeasonIntroScene({
  className = "",
  accent = "#5fd6ff",
}: SeasonIntroSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    let raf = 0;
    let dispose: (() => void) | undefined;

    const init = async () => {
      const THREE = await import("three");
      if (cancelled || !mount.isConnected) return;

      const reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const width = mount.clientWidth || window.innerWidth;
      const height = mount.clientHeight || window.innerHeight;

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x080d18, 0.075);

      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
      camera.position.set(0, 1.2, 9.5);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      const ambient = new THREE.AmbientLight(0xffffff, 0.9);
      scene.add(ambient);

      const rim = new THREE.PointLight(new THREE.Color(accent), 18, 32, 2);
      rim.position.set(-4, 2.5, 4);
      scene.add(rim);

      const fill = new THREE.PointLight(0xc0fffb, 10, 26, 2);
      fill.position.set(4, -1.5, 3);
      scene.add(fill);

      const aura = new THREE.Mesh(
        new THREE.SphereGeometry(5.3, 42, 24),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(accent),
          transparent: true,
          opacity: 0.08,
          side: THREE.BackSide,
        }),
      );
      scene.add(aura);

      const orbit = new THREE.Group();
      scene.add(orbit);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.8, 0.07, 14, 180),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(accent),
          emissive: new THREE.Color(accent),
          emissiveIntensity: 0.85,
          metalness: 0.75,
          roughness: 0.25,
        }),
      );
      ring.rotation.x = Math.PI / 2.4;
      orbit.add(ring);

      const palette = ["#5fd6ff", "#7fdc8f", "#ff4fa3", "#b98dff", "#ffd166"];
      const cards: Array<{ mesh: ThreeNS.Mesh; phase: number; baseY: number; drift: number }> = [];

      for (let i = 0; i < palette.length; i += 1) {
        const angle = (i / palette.length) * Math.PI * 2;
        const radius = 3.1;
        const card = new THREE.Mesh(
          new THREE.BoxGeometry(1.25, 1.8, 0.16),
          new THREE.MeshStandardMaterial({
            color: 0x0b1220,
            emissive: new THREE.Color(palette[i]),
            emissiveIntensity: 0.82,
            metalness: 0.6,
            roughness: 0.3,
          }),
        );

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        card.position.set(x, Math.sin(i) * 0.6, z - 0.8);
        card.rotation.set(0.7, angle * 0.9, 0.15 + i * 0.22);
        card.scale.setScalar(0.92 + (i % 2) * 0.08);
        orbit.add(card);

        cards.push({
          mesh: card,
          phase: i * 0.9,
          baseY: card.position.y,
          drift: 0.7 + i * 0.18,
        });
      }

      const particleCount = 220;
      const particlePositions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i += 1) {
        const idx = i * 3;
        particlePositions[idx] = (Math.random() - 0.5) * 16;
        particlePositions[idx + 1] = (Math.random() - 0.5) * 7;
        particlePositions[idx + 2] = (Math.random() - 0.5) * 12;
      }
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(particlePositions, 3));
      const particles = new THREE.Points(
        particleGeometry,
        new THREE.PointsMaterial({
          color: 0xd8f6ff,
          size: 0.045,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        }),
      );
      scene.add(particles);

      const renderFrame = () => {
        const widthNow = mount.clientWidth || window.innerWidth;
        const heightNow = mount.clientHeight || window.innerHeight;
        camera.aspect = widthNow / heightNow;
        camera.updateProjectionMatrix();
        renderer.setSize(widthNow, heightNow);
      };

      const start = performance.now();
      const animate = (now: number) => {
        const elapsed = (now - start) * 0.001;

        if (!reduceMotion) {
          orbit.rotation.y = elapsed * 0.32;
          orbit.rotation.z = Math.sin(elapsed * 0.6) * 0.18;
          ring.rotation.z = elapsed * 0.75;
          particles.rotation.y = elapsed * 0.13;
          particles.rotation.x = elapsed * 0.08;

          for (const card of cards) {
            const swing = Math.sin(elapsed * 1.5 + card.phase) * card.drift;
            card.mesh.position.y = card.baseY + swing;
            card.mesh.rotation.y += 0.0025;
            card.mesh.rotation.x = 0.7 + Math.sin(elapsed * 1.2 + card.phase) * 0.25;
          }
        }

        aura.rotation.y = elapsed * 0.2;
        aura.rotation.x = elapsed * 0.15;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };

      renderFrame();
      raf = requestAnimationFrame(animate);

      const onResize = () => renderFrame();
      window.addEventListener("resize", onResize);

      dispose = () => {
        cancelled = true;
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((material) => material.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
        particleGeometry.dispose();
        renderer.dispose();
        if (renderer.domElement.parentElement === mount) {
          mount.removeChild(renderer.domElement);
        }
      };
    };

    void init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      dispose?.();
    };
  }, [accent]);

  return <div ref={mountRef} aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} />;
}
