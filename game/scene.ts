import * as THREE from "three";
import { classifyPass } from "./rules.ts";
import { smoothSteering } from "./steering.ts";
import type { HitBox } from "./types.ts";

const ROAD_LENGTH = 18;
const ROAD_SEGMENTS = 12;
const LANE_CENTRES = [-4.5, -1.5, 1.5, 4.5] as const;
const PLAYER_BOX: HitBox = { x: 0, z: 0, width: 0.9, length: 2.1 };

interface TrafficEntry {
  group: THREE.Group;
  width: number;
  length: number;
  cruiseSpeed: number;
  scored: boolean;
  active: boolean;
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

export interface SceneEvents {
  collision: boolean;
  nearMisses: number;
  thread: boolean;
}

export class GameScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 340);
  private readonly road = new THREE.Group();
  private readonly bike = createBike();
  private readonly traffic: TrafficEntry[] = [];
  private readonly particles: Particle[] = [];
  private readonly streaks: THREE.Mesh[] = [];
  private readonly finishGate = createFinishGate();
  private readonly ambient = new THREE.HemisphereLight(0xffad8f, 0x09152b, 2.3);
  private readonly keyLight = new THREE.DirectionalLight(0xff8766, 3.8);
  private rngState = 0x48314e44;
  private spawnClock = 0;
  private playerX = 0;
  private steering = 0;
  private cameraX = 0;
  private crashTime = 0;
  private frameWindow: number[] = [];
  private pixelRatioCap = 1.5;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;

    this.scene.fog = new THREE.FogExp2(0x182448, 0.012);
    this.scene.add(this.ambient);
    this.keyLight.position.set(-8, 16, 7);
    this.scene.add(this.keyLight);

    this.buildRoad();
    this.scene.add(this.road);
    this.bike.position.set(0, 0.56, 0);
    this.scene.add(this.bike);

    for (let index = 0; index < 16; index += 1) {
      const dimensions = index % 5 === 0
        ? { width: 2.25, length: 6.2, truck: true }
        : { width: 1.72, length: 3.7, truck: false };
      const entry: TrafficEntry = {
        group: createVehicle(index, dimensions.truck),
        width: dimensions.width,
        length: dimensions.length,
        cruiseSpeed: 13,
        scored: false,
        active: false,
      };
      entry.group.visible = false;
      this.traffic.push(entry);
      this.scene.add(entry.group);
    }

    this.finishGate.visible = false;
    this.scene.add(this.finishGate);
    this.buildStreaks();

    this.camera.position.set(0, 3.2, 7.3);
    this.camera.lookAt(0, 0.7, -13);
    this.resize();
  }

  resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioCap));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = width < 600 ? 72 : 62;
    this.camera.updateProjectionMatrix();
  }

  reset(): void {
    this.rngState = 0x48314e44;
    this.spawnClock = -0.8;
    this.playerX = 0;
    this.steering = 0;
    this.cameraX = 0;
    this.crashTime = 0;
    this.bike.position.set(0, 0.56, 0);
    this.bike.rotation.set(0, 0, 0);
    this.finishGate.visible = false;
    this.traffic.forEach((entry) => {
      entry.active = false;
      entry.scored = false;
      entry.group.visible = false;
    });
    this.clearParticles();
  }

  update(
    deltaSeconds: number,
    elapsed: number,
    targetSteering: number,
    started: boolean,
    crashed: boolean,
  ): SceneEvents {
    this.recordPerformance(deltaSeconds);
    this.steering = smoothSteering(
      this.steering,
      crashed ? 0 : targetSteering,
      deltaSeconds,
    );
    const progress = Math.min(1, elapsed / 150);
    const worldSpeed = started && !crashed ? 24 + progress * 18 : crashed ? 0 : 3.2;

    if (!crashed) {
      this.playerX = THREE.MathUtils.clamp(
        this.playerX + this.steering * deltaSeconds * (7.7 + progress * 1.5),
        -5.75,
        5.75,
      );
      this.bike.position.x = this.playerX;
      this.bike.rotation.z = -this.steering * 0.48;
      this.bike.rotation.y = -this.steering * 0.06;
    } else {
      this.crashTime += deltaSeconds;
      this.bike.rotation.z += deltaSeconds * 1.9;
      this.bike.position.y = Math.max(0.2, this.bike.position.y - deltaSeconds * 0.5);
    }

    this.cameraX += (this.playerX * 0.24 - this.cameraX) * Math.min(1, deltaSeconds * 4);
    this.camera.position.x = this.cameraX;
    this.camera.rotation.z +=
      (-this.steering * 0.035 - this.camera.rotation.z) *
      Math.min(1, deltaSeconds * 4);
    this.camera.lookAt(this.playerX * 0.2, 0.65, -13);

    this.moveRoad(deltaSeconds, worldSpeed);
    this.updateStreaks(deltaSeconds, worldSpeed, progress);
    this.updateAtmosphere(progress);
    this.updateParticles(deltaSeconds);

    const events: SceneEvents = {
      collision: false,
      nearMisses: 0,
      thread: false,
    };

    if (started && !crashed && elapsed < 140) {
      this.spawnClock += deltaSeconds;
      const interval = Math.max(0.82, 2.55 - progress * 1.6);
      if (this.spawnClock >= interval) {
        this.spawnClock = 0;
        this.spawnTraffic(elapsed);
      }
    }

    for (const entry of this.traffic) {
      if (!entry.active) continue;
      entry.group.position.z +=
        (worldSpeed - entry.cruiseSpeed) * deltaSeconds;
      const box: HitBox = {
        x: entry.group.position.x,
        z: entry.group.position.z,
        width: entry.width,
        length: entry.length,
      };
      const player = { ...PLAYER_BOX, x: this.playerX };
      const outcome = classifyPass(
        player,
        box,
        entry.group.position.z > 2.7,
        entry.scored,
      );

      if (outcome === "collision") {
        events.collision = true;
        this.explode(this.playerX, 0xff714a, 28);
        break;
      }
      if (outcome === "near-miss") {
        entry.scored = true;
        events.nearMisses += 1;
        this.explode(entry.group.position.x, 0x58e6ff, 8);
      }
      if (entry.group.position.z > 14) this.deactivate(entry);
    }

    events.thread = events.nearMisses >= 2;

    if (elapsed >= 138 && !crashed) {
      this.finishGate.visible = true;
      this.finishGate.position.z = -120 + (elapsed - 138) * 10;
      const pulse = 1 + Math.sin(elapsed * 7) * 0.08;
      this.finishGate.scale.setScalar(pulse);
    }

    this.renderer.render(this.scene, this.camera);
    return events;
  }

  private buildRoad(): void {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x101827,
      roughness: 0.34,
      metalness: 0.4,
    });
    const barrierMaterial = new THREE.MeshStandardMaterial({
      color: 0x263752,
      roughness: 0.52,
      metalness: 0.5,
    });
    const lineMaterial = new THREE.MeshStandardMaterial({
      color: 0xdff8ff,
      emissive: 0x82d9ff,
      emissiveIntensity: 1.35,
      roughness: 0.25,
    });

    for (let index = 0; index < ROAD_SEGMENTS; index += 1) {
      const segment = new THREE.Group();
      segment.position.z = -index * ROAD_LENGTH;

      const surface = new THREE.Mesh(
        new THREE.BoxGeometry(14.4, 0.16, ROAD_LENGTH + 0.12),
        roadMaterial,
      );
      surface.position.y = -0.1;
      segment.add(surface);

      for (const laneX of [-3, 0, 3]) {
        for (const z of [-6, 0, 6]) {
          const dash = new THREE.Mesh(
            new THREE.BoxGeometry(0.07, 0.025, 3.2),
            lineMaterial,
          );
          dash.position.set(laneX, 0.005, z);
          segment.add(dash);
        }
      }

      for (const side of [-1, 1]) {
        const barrier = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.72, ROAD_LENGTH),
          barrierMaterial,
        );
        barrier.position.set(side * 7.25, 0.3, 0);
        segment.add(barrier);

        if (index % 2 === 0) {
          const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.055, 0.07, 4.8, 8),
            barrierMaterial,
          );
          pole.position.set(side * 6.85, 2.35, -4);
          segment.add(pole);
          const lamp = new THREE.Mesh(
            new THREE.BoxGeometry(0.85, 0.12, 0.26),
            new THREE.MeshStandardMaterial({
              color: 0xdaf6ff,
              emissive: 0x8adfff,
              emissiveIntensity: 5,
            }),
          );
          lamp.position.set(side * 6.5, 4.7, -4);
          segment.add(lamp);
        }
      }
      this.road.add(segment);
    }
  }

  private buildStreaks(): void {
    const material = new THREE.MeshBasicMaterial({
      color: 0x65dfff,
      transparent: true,
      opacity: 0.24,
    });
    for (let index = 0; index < 36; index += 1) {
      const streak = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.025, 2.2 + this.random() * 5),
        material.clone(),
      );
      const side = index % 2 === 0 ? -1 : 1;
      streak.position.set(
        side * (6.2 + this.random() * 3.4),
        0.25 + this.random() * 2.5,
        -this.random() * 150,
      );
      this.streaks.push(streak);
      this.scene.add(streak);
    }
  }

  private moveRoad(deltaSeconds: number, speed: number): void {
    for (const segment of this.road.children) {
      segment.position.z += speed * deltaSeconds;
      if (segment.position.z > ROAD_LENGTH) {
        segment.position.z -= ROAD_LENGTH * ROAD_SEGMENTS;
      }
    }
  }

  private updateStreaks(
    deltaSeconds: number,
    speed: number,
    progress: number,
  ): void {
    for (const streak of this.streaks) {
      streak.position.z += speed * deltaSeconds * 1.18;
      if (streak.position.z > 12) streak.position.z -= 165;
      const material = streak.material as THREE.MeshBasicMaterial;
      material.opacity = 0.08 + progress * 0.28;
    }
  }

  private spawnTraffic(elapsed: number): void {
    const available = this.traffic.filter((entry) => !entry.active);
    if (available.length === 0) return;

    const count = elapsed > 58 && this.random() > 0.58 ? 2 : 1;
    const shuffled = [...LANE_CENTRES].sort(() => this.random() - 0.5);
    for (let index = 0; index < Math.min(count, available.length); index += 1) {
      const entry = available[index]!;
      entry.active = true;
      entry.scored = false;
      entry.group.visible = true;
      entry.group.position.set(shuffled[index]!, entry.width > 2 ? 0.65 : 0.48, -92);
      entry.cruiseSpeed = 10 + this.random() * 11;
    }
  }

  private deactivate(entry: TrafficEntry): void {
    entry.active = false;
    entry.scored = false;
    entry.group.visible = false;
  }

  private updateAtmosphere(progress: number): void {
    const warm = new THREE.Color(0x70466c);
    const night = new THREE.Color(0x07142f);
    const fog = new THREE.Color().lerpColors(warm, night, progress);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(fog);
      this.scene.fog.density = 0.011 + progress * 0.006;
    }
    this.ambient.color.lerpColors(
      new THREE.Color(0xffb08f),
      new THREE.Color(0x658dff),
      progress,
    );
    this.keyLight.intensity = 3.8 - progress * 2.2;
  }

  private explode(x: number, color: number, count: number): void {
    for (let index = 0; index < count; index += 1) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.025 + this.random() * 0.05, 5, 4),
        new THREE.MeshBasicMaterial({ color }),
      );
      mesh.position.set(x, 0.4 + this.random() * 0.8, this.random() * 1.2);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (this.random() - 0.5) * 5,
          this.random() * 3.5,
          2 + this.random() * 5,
        ),
        life: 0.35 + this.random() * 0.45,
      });
    }
  }

  private updateParticles(deltaSeconds: number): void {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index]!;
      particle.life -= deltaSeconds;
      particle.velocity.y -= deltaSeconds * 4;
      particle.mesh.position.addScaledVector(particle.velocity, deltaSeconds);
      particle.mesh.scale.setScalar(Math.max(0.01, particle.life * 1.5));
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        (particle.mesh.material as THREE.Material).dispose();
        this.particles.splice(index, 1);
      }
    }
  }

  private clearParticles(): void {
    for (const particle of this.particles) {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      (particle.mesh.material as THREE.Material).dispose();
    }
    this.particles.length = 0;
  }

  private recordPerformance(deltaSeconds: number): void {
    if (deltaSeconds <= 0 || deltaSeconds > 0.2) return;
    this.frameWindow.push(1 / deltaSeconds);
    if (this.frameWindow.length < 120) return;
    const average =
      this.frameWindow.reduce((total, fps) => total + fps, 0) /
      this.frameWindow.length;
    this.frameWindow = [];
    if (average < 38 && this.pixelRatioCap > 1) {
      this.pixelRatioCap = 1;
      this.resize();
      for (let index = 0; index < this.streaks.length; index += 2) {
        this.streaks[index]!.visible = false;
      }
    }
  }

  private random(): number {
    this.rngState = (1664525 * this.rngState + 1013904223) >>> 0;
    return this.rngState / 0x1_0000_0000;
  }
}

function createBike(): THREE.Group {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({
    color: 0x10131b,
    roughness: 0.26,
    metalness: 0.8,
  });
  const body = new THREE.MeshStandardMaterial({
    color: 0x4d49ff,
    emissive: 0x1a176e,
    emissiveIntensity: 1.4,
    roughness: 0.28,
    metalness: 0.62,
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x07090d,
    roughness: 0.9,
  });

  for (const z of [-0.78, 0.76]) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.43, 0.43, 0.22, 20),
      rubber,
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0, 0.42, z);
    group.add(wheel);
  }

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.35, 1.48), dark);
  frame.position.y = 0.65;
  group.add(frame);

  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 12), body);
  tank.scale.set(0.75, 0.62, 1.15);
  tank.position.set(0, 0.94, -0.22);
  group.add(tank);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.62), body);
  tail.position.set(0, 0.9, 0.72);
  group.add(tail);

  const light = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.1, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0xff325b,
      emissive: 0xff164f,
      emissiveIntensity: 7,
    }),
  );
  light.position.set(0, 0.92, 1.05);
  group.add(light);

  const rider = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.24, 0.62, 5, 10),
    new THREE.MeshStandardMaterial({
      color: 0x171b27,
      roughness: 0.6,
      metalness: 0.25,
    }),
  );
  rider.rotation.x = -0.42;
  rider.position.set(0, 1.35, 0.15);
  group.add(rider);

  return group;
}

function createVehicle(index: number, truck: boolean): THREE.Group {
  const group = new THREE.Group();
  const palette = [0x28a9ff, 0xef425f, 0xf4b340, 0x9a7bff, 0xe7edf7];
  const body = new THREE.MeshStandardMaterial({
    color: palette[index % palette.length],
    roughness: 0.28,
    metalness: 0.7,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x14233b,
    roughness: 0.16,
    metalness: 0.45,
  });

  const lower = new THREE.Mesh(
    new THREE.BoxGeometry(truck ? 2.25 : 1.72, truck ? 1.1 : 0.55, truck ? 6.2 : 3.7),
    body,
  );
  lower.position.y = truck ? 1 : 0.6;
  group.add(lower);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(truck ? 2.1 : 1.5, truck ? 1.4 : 0.6, truck ? 1.35 : 1.8),
    glass,
  );
  cabin.position.set(0, truck ? 1.95 : 1.05, truck ? 2.15 : -0.1);
  group.add(cabin);

  for (const x of [-0.55, 0.55]) {
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.15, 0.08),
      new THREE.MeshStandardMaterial({
        color: 0xff2f4f,
        emissive: 0xff173f,
        emissiveIntensity: 6,
      }),
    );
    tail.position.set(x * (truck ? 1.45 : 1), truck ? 1 : 0.68, (truck ? 3.12 : 1.88));
    group.add(tail);
  }

  return group;
}

function createFinishGate(): THREE.Group {
  const gate = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x86f5ff,
    emissive: 0x35e8ff,
    emissiveIntensity: 6,
    metalness: 0.5,
    roughness: 0.2,
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(14, 0.22, 0.28), material);
  top.position.y = 6.4;
  gate.add(top);
  for (const x of [-6.5, 6.5]) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 6.4, 0.28),
      material,
    );
    pillar.position.set(x, 3.2, 0);
    gate.add(pillar);
  }
  return gate;
}
