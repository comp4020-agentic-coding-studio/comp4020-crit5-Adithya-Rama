import * as THREE from "three";
import {
  FINISH_SEQUENCE_SECONDS,
  RUN_DURATION_SECONDS,
  classifyPass,
  difficultyAt,
  type DifficultyProfile,
} from "./rules.ts";
import { smoothSteering } from "./steering.ts";
import type { HitBox } from "./types.ts";

const ROAD_LENGTH = 18;
const ROAD_SEGMENTS = 10;
const LANE_CENTRES = [-4.5, -1.5, 1.5, 4.5] as const;
const PLAYER_BOX: HitBox = { x: 0, z: 0, width: 0.9, length: 2.1 };

interface TrafficEntry {
  group: THREE.Group;
  width: number;
  length: number;
  cruiseSpeed: number;
  scored: boolean;
  active: boolean;
  truck: boolean;
  oncoming: boolean;
  laneX: number;
  driftPhase: number;
  driftAmount: number;
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
  private readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 300);
  private readonly road = new THREE.Group();
  private readonly bike = createBike();
  private readonly traffic: TrafficEntry[] = [];
  private readonly particles: Particle[] = [];
  private readonly streaks: THREE.Mesh[] = [];
  private readonly finishGate = createFinishGate();
  private readonly ambient = new THREE.HemisphereLight(0xffad8f, 0x09152b, 2.3);
  private readonly keyLight = new THREE.DirectionalLight(0xff8766, 3.8);
  private readonly rimLight = new THREE.PointLight(0x4fdcff, 18, 34, 1.7);
  private readonly stars = createStars();
  private readonly horizon = createHorizon();
  private rngState = 0x48314e44;
  private spawnClock = 0;
  private playerX = 0;
  private lateralVelocity = 0;
  private steering = 0;
  private roadTime = 0;
  private cameraX = 0;
  private crashTime = 0;
  private frameWindow: number[] = [];
  private pixelRatioCap = 1.25;

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
    this.rimLight.position.set(0, 4, 4);
    this.scene.add(this.keyLight, this.rimLight, this.stars, this.horizon);

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
        truck: dimensions.truck,
        oncoming: false,
        laneX: 0,
        driftPhase: this.random() * Math.PI * 2,
        driftAmount: 0,
      };
      entry.group.visible = false;
      this.traffic.push(entry);
      this.scene.add(entry.group);
    }

    this.finishGate.visible = false;
    this.scene.add(this.finishGate);
    this.buildStreaks();

    this.camera.position.set(0, 2.72, 6.45);
    this.camera.lookAt(0, 0.88, -15);
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
    this.lateralVelocity = 0;
    this.steering = 0;
    this.roadTime = 0;
    this.cameraX = 0;
    this.crashTime = 0;
    this.bike.position.set(0, 0.56, 0);
    this.bike.rotation.set(0, 0, 0);
    const riderRig = this.bike.userData.riderRig as THREE.Group;
    riderRig.rotation.set(0, 0, 0);
    riderRig.position.x = 0;
    this.finishGate.visible = false;
    this.traffic.forEach((entry) => {
      entry.active = false;
      entry.scored = false;
      entry.oncoming = false;
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
    const difficulty = difficultyAt(elapsed);
    this.steering = smoothSteering(
      this.steering,
      crashed ? 0 : targetSteering,
      deltaSeconds,
    );
    const worldSpeed = started && !crashed
      ? difficulty.worldSpeed
      : crashed
        ? 0
        : 3.2;
    this.roadTime += deltaSeconds * worldSpeed;

    if (!crashed) {
      const targetVelocity =
        this.steering * (6.7 + difficulty.progress * 2.35);
      const traction = 3.65 + difficulty.progress * 1.45;
      this.lateralVelocity +=
        (targetVelocity - this.lateralVelocity) *
        Math.min(1, deltaSeconds * traction);
      this.playerX += this.lateralVelocity * deltaSeconds;
      if (Math.abs(this.playerX) > 5.72) {
        this.playerX = THREE.MathUtils.clamp(this.playerX, -5.72, 5.72);
        this.lateralVelocity *= 0.28;
      }

      const suspension = started ? Math.sin(this.roadTime * 0.42) * 0.018 : 0;
      this.bike.position.set(this.playerX, 0.56 + suspension, 0);
      this.bike.rotation.z +=
        (-this.steering * 0.62 - this.bike.rotation.z) *
        Math.min(1, deltaSeconds * 8);
      this.bike.rotation.y = -this.lateralVelocity * 0.016;
      this.bike.rotation.x = Math.sin(this.roadTime * 0.16) * 0.01;
      const riderRig = this.bike.userData.riderRig as THREE.Group;
      riderRig.rotation.z +=
        (-this.steering * 0.24 - riderRig.rotation.z) *
        Math.min(1, deltaSeconds * 9);
      riderRig.rotation.y =
        -this.steering * 0.08 + Math.sin(this.roadTime * 0.2) * 0.008;
      riderRig.position.x = this.steering * 0.055;
      const handlebar = this.bike.userData.handlebar as THREE.Object3D;
      handlebar.rotation.y = -this.steering * 0.22;
      for (const wheel of this.bike.userData.wheels as THREE.Object3D[]) {
        wheel.rotation.x -= (worldSpeed * deltaSeconds) / 0.43;
      }
    } else {
      this.crashTime += deltaSeconds;
      this.lateralVelocity *= Math.exp(-deltaSeconds * 1.8);
      this.bike.position.x += this.lateralVelocity * deltaSeconds;
      this.bike.rotation.z += deltaSeconds * (1.8 + Math.abs(this.lateralVelocity) * 0.12);
      this.bike.rotation.x -= deltaSeconds * 0.45;
      this.bike.position.y = Math.max(0.2, this.bike.position.y - deltaSeconds * 0.55);
    }

    this.cameraX +=
      (this.playerX * 0.22 - this.cameraX) * Math.min(1, deltaSeconds * 4.5);
    this.camera.position.x = this.cameraX;
    this.camera.position.y =
      2.72 +
      Math.sin(this.roadTime * 0.14) * 0.035 +
      Math.abs(this.steering) * 0.06;
    this.camera.rotation.z +=
      (-this.steering * 0.035 - this.camera.rotation.z) *
      Math.min(1, deltaSeconds * 4.5);
    const baseFov = this.canvas.clientWidth < 600 ? 74 : 64;
    const targetFov = baseFov + difficulty.progress * 6 + Math.abs(this.steering) * 1.5;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, deltaSeconds * 2.8);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(
      this.playerX * 0.2 + this.steering * 0.24,
      0.86,
      -15.5,
    );

    this.moveRoad(deltaSeconds, worldSpeed);
    this.updateStreaks(deltaSeconds, worldSpeed, difficulty.progress);
    this.updateAtmosphere(difficulty.progress);
    this.updateParticles(deltaSeconds);

    const events: SceneEvents = {
      collision: false,
      nearMisses: 0,
      thread: false,
    };

    if (
      started &&
      !crashed &&
      elapsed < RUN_DURATION_SECONDS - FINISH_SEQUENCE_SECONDS
    ) {
      this.spawnClock += deltaSeconds;
      if (this.spawnClock >= difficulty.spawnInterval) {
        this.spawnClock = 0;
        this.spawnTraffic(elapsed, difficulty);
      }
    }

    for (const entry of this.traffic) {
      if (!entry.active) continue;
      const previousZ = entry.group.position.z;
      const relativeSpeed = entry.oncoming
        ? worldSpeed + entry.cruiseSpeed
        : worldSpeed - entry.cruiseSpeed;
      entry.group.position.z += relativeSpeed * deltaSeconds;
      const drift =
        Math.sin(elapsed * 0.7 + entry.driftPhase) * entry.driftAmount;
      entry.group.position.x = entry.laneX + drift;
      entry.group.rotation.y =
        (entry.oncoming ? Math.PI : 0) + drift * 0.018;
      entry.group.position.y +=
        (Math.sin(elapsed * 5 + entry.driftPhase) * 0.012 -
          (entry.group.position.y - (entry.truck ? 0.65 : 0.48))) *
        Math.min(1, deltaSeconds * 8);
      for (const wheel of entry.group.userData.wheels as THREE.Object3D[]) {
        wheel.rotation.x +=
          (relativeSpeed * deltaSeconds * (entry.oncoming ? -1 : 1)) / 0.38;
      }
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
        previousZ,
      );

      if (outcome === "collision") {
        events.collision = true;
        this.explode(this.playerX, 0xff714a, 28);
        break;
      }
      if (outcome === "near-miss") {
        entry.scored = true;
        events.nearMisses += 1;
        this.explode(
          entry.group.position.x,
          entry.oncoming ? 0xffc451 : 0x58e6ff,
          entry.oncoming ? 12 : 8,
        );
      }
      if (entry.group.position.z > 14) this.deactivate(entry);
    }

    events.thread = events.nearMisses >= 2;

    const finishStart = RUN_DURATION_SECONDS - FINISH_SEQUENCE_SECONDS;
    if (elapsed >= finishStart && !crashed) {
      this.finishGate.visible = true;
      const finishProgress = (elapsed - finishStart) / FINISH_SEQUENCE_SECONDS;
      this.finishGate.position.z = -132 + finishProgress * 140;
      const pulse = 1 + Math.sin(elapsed * 7) * 0.08;
      this.finishGate.scale.setScalar(pulse);
    }

    this.renderer.render(this.scene, this.camera);
    return events;
  }

  private buildRoad(): void {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b1422,
      roughness: 0.24,
      metalness: 0.52,
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
    const shoulderMaterial = new THREE.MeshStandardMaterial({
      color: 0x17243a,
      roughness: 0.3,
      metalness: 0.58,
    });
    const reflectorMaterial = new THREE.MeshStandardMaterial({
      color: 0xbff8ff,
      emissive: 0x55dfff,
      emissiveIntensity: 4.5,
      roughness: 0.18,
    });
    const rumbleMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4d73,
      emissive: 0x7a102e,
      emissiveIntensity: 1.8,
      roughness: 0.38,
    });
    const vergeMaterial = new THREE.MeshStandardMaterial({
      color: 0x101d2b,
      roughness: 0.96,
      metalness: 0.02,
    });
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2022,
      roughness: 1,
    });
    const foliageMaterial = new THREE.MeshStandardMaterial({
      color: 0x123b42,
      emissive: 0x06171e,
      emissiveIntensity: 0.55,
      roughness: 0.9,
    });
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5064,
      roughness: 0.88,
      metalness: 0.08,
    });

    for (let index = 0; index < ROAD_SEGMENTS; index += 1) {
      const segment = new THREE.Group();
      segment.position.z = -index * ROAD_LENGTH;

      const surface = new THREE.Mesh(
        new THREE.BoxGeometry(14.4, 0.16, ROAD_LENGTH + 0.12),
        roadMaterial,
      );
      surface.position.y = -0.1;
      surface.receiveShadow = true;
      segment.add(surface);

      for (const side of [-1, 1]) {
        const verge = new THREE.Mesh(
          new THREE.BoxGeometry(8, 0.12, ROAD_LENGTH + 0.1),
          vergeMaterial,
        );
        verge.position.set(side * 11.35, -0.12, 0);
        verge.receiveShadow = true;
        segment.add(verge);

        for (let treeIndex = 0; treeIndex < 1; treeIndex += 1) {
          const tree = createPine(trunkMaterial, foliageMaterial);
          const spread = 8.25 + this.random() * 6.2;
          tree.position.set(
            side * spread,
            0,
            -6.5 + treeIndex * 10 + this.random() * 3,
          );
          tree.scale.setScalar(0.7 + this.random() * 0.8);
          tree.rotation.y = this.random() * Math.PI;
          segment.add(tree);
        }

        if ((index + (side > 0 ? 1 : 0)) % 3 === 0) {
          const rock = createRock(rockMaterial);
          rock.position.set(side * (9.1 + this.random() * 3.6), 0.4, 4);
          rock.scale.set(
            1.2 + this.random() * 1.7,
            0.75 + this.random() * 1.25,
            1.1 + this.random() * 1.6,
          );
          segment.add(rock);
        }
        const shoulder = new THREE.Mesh(
          new THREE.BoxGeometry(1.05, 0.1, ROAD_LENGTH),
          shoulderMaterial,
        );
        shoulder.position.set(side * 6.68, -0.015, 0);
        shoulder.receiveShadow = true;
        segment.add(shoulder);

        for (const z of [-7.2, -3.6, 0, 3.6, 7.2]) {
          const reflector = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.04, 0.32),
            reflectorMaterial,
          );
          reflector.position.set(side * 6.08, 0.025, z);
          segment.add(reflector);

          const rumble = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.035, 1.25),
            rumbleMaterial,
          );
          rumble.position.set(side * 6.2, 0.02, z);
          segment.add(rumble);
        }
      }

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
      if (index % 5 === 2) {
        const gantry = new THREE.Group();
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(13.4, 0.16, 0.18),
          barrierMaterial,
        );
        beam.position.y = 5.4;
        gantry.add(beam);
        for (const x of [-6.45, 6.45]) {
          const support = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 5.4, 0.16),
            barrierMaterial,
          );
          support.position.set(x, 2.7, 0);
          gantry.add(support);
        }
        for (const x of [-2.2, 2.2]) {
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(3.6, 1.05, 0.12),
            new THREE.MeshStandardMaterial({
              color: 0x184d61,
              emissive: 0x0d2937,
              emissiveIntensity: 1.5,
              roughness: 0.28,
              metalness: 0.48,
            }),
          );
          sign.position.set(x, 4.82, 0.08);
          gantry.add(sign);
        }
        gantry.position.z = -4;
        segment.add(gantry);
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

  private spawnTraffic(
    elapsed: number,
    difficulty: DifficultyProfile,
  ): void {
    const available = this.traffic.filter((entry) => !entry.active);
    if (available.length === 0) return;

    let count = this.random() < difficulty.burstChance ? 2 : 1;
    if (difficulty.progress > 0.72 && this.random() < 0.32) count = 3;
    count = Math.min(count, available.length, 3);

    const shuffled = [...LANE_CENTRES].sort(() => this.random() - 0.5);
    let spawnedOncoming = false;
    for (let index = 0; index < count; index += 1) {
      const wantsTruck = this.random() < difficulty.truckChance;
      const preferred = available.find(
        (entry) => !entry.active && entry.truck === wantsTruck,
      );
      const entry = preferred ?? available.find((candidate) => !candidate.active);
      if (!entry) break;

      const oncoming: boolean =
        !spawnedOncoming &&
        difficulty.oncomingChance > 0 &&
        this.random() < difficulty.oncomingChance;
      if (oncoming) spawnedOncoming = true;
      entry.active = true;
      entry.scored = false;
      entry.oncoming = oncoming;
      entry.group.visible = true;
      entry.laneX = shuffled[index]!;
      entry.group.rotation.y = oncoming ? Math.PI : 0;
      for (const beam of entry.group.userData.headBeams as THREE.Object3D[]) {
        beam.visible = oncoming;
      }
      entry.driftPhase = this.random() * Math.PI * 2;
      entry.driftAmount =
        difficulty.progress < 0.25 ? 0.025 : 0.04 + this.random() * 0.09;
      entry.group.position.set(
        entry.laneX,
        entry.truck ? 0.65 : 0.48,
        (oncoming ? -148 : -94) - index * (8 + this.random() * 5),
      );
      entry.cruiseSpeed = oncoming
        ? THREE.MathUtils.lerp(
            difficulty.oncomingSpeedMin,
            difficulty.oncomingSpeedMax,
            this.random(),
          )
        : THREE.MathUtils.lerp(
            difficulty.trafficCruiseMin,
            difficulty.trafficCruiseMax,
            this.random(),
          );
    }
  }

  private deactivate(entry: TrafficEntry): void {
    entry.active = false;
    entry.scored = false;
    entry.oncoming = false;
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
    this.keyLight.intensity = 3.8 - progress * 2.35;
    this.rimLight.intensity = 10 + progress * 18;
    this.rimLight.color.lerpColors(
      new THREE.Color(0xff8a6c),
      new THREE.Color(0x4fdcff),
      progress,
    );
    (this.stars.material as THREE.PointsMaterial).opacity =
      Math.pow(progress, 1.45) * 0.82;
    this.renderer.toneMappingExposure = 1.18 - progress * 0.12;
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
    if (average < 46 && this.pixelRatioCap > 1) {
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
    color: 0x0c111a,
    roughness: 0.24,
    metalness: 0.86,
  });
  const body = new THREE.MeshStandardMaterial({
    color: 0x514cff,
    emissive: 0x17135f,
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0.7,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0xb7c4d7,
    roughness: 0.18,
    metalness: 0.94,
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x05070a,
    roughness: 0.96,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x152b45,
    roughness: 0.08,
    metalness: 0.22,
    transparent: true,
    opacity: 0.7,
  });
  const wheels: THREE.Object3D[] = [];

  for (const z of [-0.86, 0.82]) {
    const wheelPivot = new THREE.Group();
    wheelPivot.position.set(0, 0.43, z);
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.44, 0.24, 24),
      rubber,
    );
    tire.rotation.z = Math.PI / 2;
    wheelPivot.add(tire);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.27, 0.255, 18),
      metal,
    );
    rim.rotation.z = Math.PI / 2;
    wheelPivot.add(rim);

    const brake = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.266, 18),
      new THREE.MeshStandardMaterial({
        color: 0x4c5868,
        roughness: 0.3,
        metalness: 0.9,
      }),
    );
    brake.rotation.z = Math.PI / 2;
    wheelPivot.add(brake);
    wheels.push(wheelPivot);
    group.add(wheelPivot);
  }

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 1.5), dark);
  frame.position.y = 0.68;
  group.add(frame);

  const engine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.32, 0.55, 12),
    metal,
  );
  engine.rotation.z = Math.PI / 2;
  engine.position.set(0, 0.7, 0.08);
  group.add(engine);

  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 14), body);
  tank.scale.set(0.76, 0.62, 1.18);
  tank.position.set(0, 1, -0.22);
  group.add(tank);

  const fairing = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 18, 12, 0, Math.PI * 2, 0, Math.PI / 1.8),
    body,
  );
  fairing.scale.set(0.72, 0.7, 0.82);
  fairing.position.set(0, 0.98, -0.76);
  fairing.rotation.x = -0.3;
  group.add(fairing);

  const windshield = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    glass,
  );
  windshield.scale.set(0.72, 0.72, 0.46);
  windshield.position.set(0, 1.28, -0.78);
  windshield.rotation.x = -0.45;
  group.add(windshield);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.68), body);
  tail.position.set(0, 0.92, 0.74);
  tail.rotation.x = -0.1;
  group.add(tail);

  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.12, 0.7),
    dark,
  );
  seat.position.set(0, 1.08, 0.46);
  seat.rotation.x = -0.12;
  group.add(seat);

  for (const side of [-1, 1]) {
    const swingarm = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.1, 0.92),
      metal,
    );
    swingarm.position.set(side * 0.22, 0.5, 0.45);
    swingarm.rotation.x = -0.06;
    group.add(swingarm);
  }

  for (const x of [-0.28, 0.28]) {
    const fork = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 0.88, 8),
      metal,
    );
    fork.position.set(x, 0.73, -0.82);
    fork.rotation.x = -0.18;
    group.add(fork);

    const exhaust = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.085, 1.05, 10),
      metal,
    );
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(x * 1.2, 0.58, 0.58);
    group.add(exhaust);
  }

  const handlebar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.92, 10),
    metal,
  );
  handlebar.rotation.z = Math.PI / 2;
  handlebar.position.set(0, 1.27, -0.52);
  group.add(handlebar);

  const headlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 8),
    new THREE.MeshStandardMaterial({
      color: 0xdffbff,
      emissive: 0xaeeeff,
      emissiveIntensity: 8,
    }),
  );
  headlight.scale.set(1.25, 0.72, 0.42);
  headlight.position.set(0, 1.02, -1.12);
  group.add(headlight);
  const headGlow = new THREE.PointLight(0x8ee8ff, 7, 15, 2);
  headGlow.position.set(0, 1.05, -1.35);
  group.add(headGlow);

  const tailLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.1, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0xff325b,
      emissive: 0xff164f,
      emissiveIntensity: 8,
    }),
  );
  tailLight.position.set(0, 0.94, 1.08);
  group.add(tailLight);

  const riderMaterial = new THREE.MeshStandardMaterial({
    color: 0x111722,
    roughness: 0.42,
    metalness: 0.35,
  });
  const suitAccent = new THREE.MeshStandardMaterial({
    color: 0xe8edf7,
    roughness: 0.38,
    metalness: 0.22,
  });
  const riderRig = new THREE.Group();
  riderRig.position.set(0, 1.22, 0.08);

  const rider = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.25, 0.64, 5, 10),
    riderMaterial,
  );
  rider.rotation.x = -0.47;
  rider.position.set(0, 0.18, -0.04);
  riderRig.add(rider);

  const backPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.45, 0.08),
    suitAccent,
  );
  backPanel.position.set(0, 0.26, 0.2);
  backPanel.rotation.x = -0.45;
  riderRig.add(backPanel);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), body);
  helmet.position.set(0, 0.66, -0.34);
  riderRig.add(helmet);
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    glass,
  );
  visor.scale.set(0.92, 0.66, 0.64);
  visor.rotation.x = -0.55;
  visor.position.set(0, 0.65, -0.54);
  riderRig.add(visor);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.065, 0.45, 4, 8),
      suitAccent,
    );
    arm.position.set(side * 0.25, 0.24, -0.3);
    arm.rotation.x = 0.94;
    arm.rotation.z = side * 0.2;
    riderRig.add(arm);

    const leg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.085, 0.5, 4, 8),
      riderMaterial,
    );
    leg.position.set(side * 0.23, -0.2, 0.28);
    leg.rotation.x = -0.7;
    leg.rotation.z = side * 0.18;
    riderRig.add(leg);
  }
  group.add(riderRig);

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  group.userData.wheels = wheels;
  group.userData.riderRig = riderRig;
  group.userData.handlebar = handlebar;
  return group;
}

function createVehicle(index: number, truck: boolean): THREE.Group {
  const group = new THREE.Group();
  const palette = [0x1797e8, 0xe83658, 0xf4a62f, 0x8465ef, 0xdce5ef];
  const body = new THREE.MeshStandardMaterial({
    color: palette[index % palette.length],
    roughness: 0.22,
    metalness: 0.62,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x0a0e16,
    roughness: 0.72,
    metalness: 0.45,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x10263e,
    roughness: 0.08,
    metalness: 0.28,
  });

  const lower = new THREE.Mesh(
    new THREE.BoxGeometry(
      truck ? 2.25 : 1.72,
      truck ? 1.1 : 0.55,
      truck ? 6.2 : 3.7,
    ),
    body,
  );
  lower.position.y = truck ? 1 : 0.6;
  group.add(lower);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(
      truck ? 2.1 : 1.5,
      truck ? 1.4 : 0.6,
      truck ? 1.35 : 1.8,
    ),
    glass,
  );
  cabin.position.set(0, truck ? 1.95 : 1.05, truck ? 2.15 : -0.1);
  group.add(cabin);

  if (!truck) {
    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(1.58, 0.24, 1.05),
      body,
    );
    hood.position.set(0, 0.83, -1.32);
    hood.rotation.x = -0.05;
    group.add(hood);

    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.24, 0.72),
      body,
    );
    boot.position.set(0, 0.82, 1.48);
    boot.rotation.x = 0.04;
    group.add(boot);
  }

  if (truck) {
    const grille = new THREE.Mesh(
      new THREE.BoxGeometry(1.58, 0.5, 0.06),
      dark,
    );
    grille.position.set(0, 1.35, -3.13);
    group.add(grille);
  }

  const wheels: THREE.Object3D[] = [];
  const wheelZ = truck ? [-2.18, 1.82] : [-1.15, 1.12];
  for (const x of [-1, 1]) {
    for (const z of wheelZ) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.22, 16),
        dark,
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x * (truck ? 1.03 : 0.78), 0.35, z);
      wheels.push(wheel);
      group.add(wheel);
    }
  }

  const lightMaterial = new THREE.MeshStandardMaterial({
    color: 0xff3152,
    emissive: 0xff173f,
    emissiveIntensity: 7,
  });
  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9f7ff,
    emissive: 0x8be9ff,
    emissiveIntensity: 6,
  });
  const headBeams: THREE.Object3D[] = [];
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0x9cecff,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  for (const x of [-0.55, 0.55]) {
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.15, 0.08),
      lightMaterial,
    );
    tail.position.set(
      x * (truck ? 1.45 : 1),
      truck ? 1 : 0.68,
      truck ? 3.12 : 1.88,
    );
    group.add(tail);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.13, 0.08),
      headMaterial,
    );
    head.position.set(
      x * (truck ? 1.45 : 1),
      truck ? 1.12 : 0.72,
      truck ? -3.12 : -1.88,
    );
    group.add(head);

    const beamLength = truck ? 8 : 7;
    const headZ = truck ? -3.12 : -1.88;
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(truck ? 0.75 : 0.58, beamLength, 10, 1, true),
      beamMaterial,
    );
    beam.rotation.x = Math.PI / 2;
    beam.position.set(
      x * (truck ? 0.66 : 0.5),
      truck ? 1.05 : 0.68,
      headZ - beamLength / 2,
    );
    beam.visible = false;
    headBeams.push(beam);
    group.add(beam);
  }

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  group.userData.wheels = wheels;
  group.userData.headBeams = headBeams;
  return group;
}

function createPine(
  trunkMaterial: THREE.Material,
  foliageMaterial: THREE.Material,
): THREE.Group {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.16, 1.5, 7),
    trunkMaterial,
  );
  trunk.position.y = 0.72;
  tree.add(trunk);
  for (let tier = 0; tier < 3; tier += 1) {
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(1.05 - tier * 0.18, 2.1, 8),
      foliageMaterial,
    );
    crown.position.y = 1.55 + tier * 0.72;
    tree.add(crown);
  }
  tree.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return tree;
}

function createRock(material: THREE.Material): THREE.Mesh {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), material);
  rock.rotation.set(0.18, 0.42, -0.12);
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}

function createFinishGate(): THREE.Group {
  const gate = new THREE.Group();
  for (let depth = 0; depth < 7; depth += 1) {
    const material = new THREE.MeshStandardMaterial({
      color: depth % 2 === 0 ? 0x86f5ff : 0xb88cff,
      emissive: depth % 2 === 0 ? 0x35e8ff : 0x704cff,
      emissiveIntensity: 5.5,
      metalness: 0.55,
      roughness: 0.18,
    });
    const arch = new THREE.Group();
    arch.position.z = -depth * 7;
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(14, 0.2, 0.24),
      material,
    );
    top.position.y = 6.4;
    arch.add(top);
    for (const x of [-6.5, 6.5]) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 6.4, 0.24),
        material,
      );
      pillar.position.set(x, 3.2, 0);
      arch.add(pillar);
    }
    gate.add(arch);
  }
  return gate;
}

function createHorizon(): THREE.Group {
  const horizon = new THREE.Group();
  const nearMaterial = new THREE.MeshStandardMaterial({
    color: 0x172942,
    emissive: 0x081221,
    emissiveIntensity: 0.7,
    roughness: 0.96,
  });
  const farMaterial = new THREE.MeshStandardMaterial({
    color: 0x26324d,
    emissive: 0x0c1121,
    emissiveIntensity: 0.55,
    roughness: 1,
  });
  for (let index = 0; index < 12; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const distance = 30 + (index % 6) * 14;
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(9 + (index % 4) * 3, 16 + (index % 5) * 5, 6),
      index % 3 === 0 ? farMaterial : nearMaterial,
    );
    mountain.position.set(side * (22 + (index % 5) * 11), 5, -75 - distance);
    mountain.rotation.y = index * 0.63;
    mountain.scale.z = 0.65 + (index % 3) * 0.2;
    horizon.add(mountain);
  }
  return horizon;
}

function createStars(): THREE.Points {
  const positions = new Float32Array(220 * 3);
  for (let index = 0; index < 220; index += 1) {
    const pseudoA = Math.abs(Math.sin(index * 91.17) * 43758.5453) % 1;
    const pseudoB = Math.abs(Math.sin(index * 47.77) * 24634.6345) % 1;
    const pseudoC = Math.abs(Math.sin(index * 13.13) * 93217.3451) % 1;
    positions[index * 3] = (pseudoA - 0.5) * 190;
    positions[index * 3 + 1] = 10 + pseudoB * 62;
    positions[index * 3 + 2] = -25 - pseudoC * 270;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xbcd9ff,
    size: 0.16,
    transparent: true,
    opacity: 0,
    sizeAttenuation: true,
  });
  return new THREE.Points(geometry, material);
}
