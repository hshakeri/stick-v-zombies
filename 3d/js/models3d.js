import * as THREE from '../lib/three.module.min.js';
import { getVoxelTexture } from './textures3d.js';

export const SHOULDER_Y = 1.60;
export const LINE_RADIUS = 0.052;

export const SHARED_GEOS = {
  segment: new THREE.CylinderGeometry(LINE_RADIUS, LINE_RADIUS, 1.0, 12),
  solidHead: new THREE.SphereGeometry(0.35, 18, 16),
  hollowHead: new THREE.TorusGeometry(0.34, 0.058, 14, 32),
  eye: new THREE.SphereGeometry(0.05, 8, 8)
};
for (const geo of Object.values(SHARED_GEOS)) {
  geo.isShared = true;
  geo.userData = geo.userData || {};
  geo.userData.isShared = true;
}

export const POSE_KEYS = Object.freeze([
  'torsoLean',
  'headTilt',
  'hipZ',
  'liftY',
  'thighL',
  'kneeL',
  'thighR',
  'kneeR',
  'uArmL',
  'elbowL',
  'uArmR',
  'elbowR'
]);
const UP_VEC = new THREE.Vector3(0, 1, 0);
const TEMP_A = new THREE.Vector3();
const TEMP_B = new THREE.Vector3();
const TEMP_DIR = new THREE.Vector3();

export function disposeHierarchy(root, keepShared = true) {
  if (!root) return;
  root.traverse((child) => {
    if (child.geometry) {
      if (!keepShared || (!child.geometry.isShared && !child.geometry.userData?.isShared)) {
        child.geometry.dispose?.();
      }
    }
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (!m) continue;
        if (!keepShared || (!m.isShared && !m.userData?.isShared)) {
          m.dispose?.();
        }
      }
    }
  });
}

export function setCylinderBetween(mesh, x1, y1, z1, x2, y2, z2) {
  if (mesh.setCyl) {
    mesh.setCyl(x1, y1, z1, x2, y2, z2);
    return;
  }
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const lenSq = dx * dx + dy * dy + dz * dz;
  if (lenSq < 1e-8) { mesh.visible = false; return; }
  mesh.visible = true;
  mesh.position.set((x1 + x2) * 0.5, (y1 + y2) * 0.5, (z1 + z2) * 0.5);
  const len = Math.sqrt(lenSq);
  mesh.scale.set(1.0, len + LINE_RADIUS * 0.85, 1.0);
  const invLen = 1.0 / len;
  const ex = dx * invLen, ey = dy * invLen, ez = dz * invLen;
  const n = ey + 1.0;
  if (n < 1e-6) {
    mesh.quaternion.set(0.0, 0.0, 1.0, 0.0);
  } else {
    const qx = ez, qz = -ex, qw = n;
    const qLen = 1.0 / Math.sqrt(qx * qx + qz * qz + qw * qw);
    mesh.quaternion.set(qx * qLen, 0.0, qz * qLen, qw * qLen);
  }
}

export function buildVoxelWeaponMesh(weaponType) {
  const group = new THREE.Group();
  if (weaponType === 'pencil') {
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xff9800, roughness: 0.4 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffb74d, roughness: 0.4 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xffcc80, roughness: 0.6 });
    const leadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
    const ferruleMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.7, roughness: 0.25 });
    const eraserMat = new THREE.MeshStandardMaterial({ color: 0xff80ab, roughness: 0.5 });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.0, 6), shaftMat);
    shaft.position.y = 0.6;
    shaft.castShadow = true;

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.02, 0.23), stripeMat);
    stripe.position.y = 0.6;

    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 6), woodMat);
    cone.position.y = 1.82;

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 6), leadMat);
    tip.position.y = 1.98;

    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.2, 8), ferruleMat);
    ferrule.position.y = -0.48;

    const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 8), eraserMat);
    eraser.position.y = -0.72;

    group.add(shaft, stripe, cone, tip, ferrule, eraser);
  } else if (weaponType === 'staff') {
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.55, roughness: 0.3 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.7, roughness: 0.2, emissive: 0x553300 });
    const cmdMat = new THREE.MeshStandardMaterial({
      map: getVoxelTexture('command_block'),
      emissive: 0xff8800,
      emissiveIntensity: 0.35
    });

    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.11, 2.5, 0.11), rodMat);
    rod.position.y = 0.55;
    rod.castShadow = true;

    const ringBot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), goldMat);
    ringBot.position.y = -0.65;

    const prongBase = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.16), goldMat);
    prongBase.position.y = 1.8;

    const prongL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.16), goldMat);
    prongL.position.set(-0.25, 2.12, 0);

    const prongR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.16), goldMat);
    prongR.position.set(0.25, 2.12, 0);

    const cmdBlock = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), cmdMat);
    cmdBlock.position.set(0, 2.15, 0);
    cmdBlock.name = 'cmdCore';

    group.add(rod, ringBot, prongBase, prongL, prongR, cmdBlock);
  } else if (weaponType === 'eraser') {
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xff80ab, roughness: 0.45 });
    const darkPinkMat = new THREE.MeshStandardMaterial({ color: 0xf50057, roughness: 0.45 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.35 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.54, 1.15, 0.3), pinkMat);
    body.position.y = 0.55;
    body.castShadow = true;

    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.17, 0.32), darkPinkMat);
    edge.position.set(0.24, 0.55, 0);

    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.45, 0.34), sleeveMat);
    sleeve.position.y = 0.28;

    group.add(body, edge, sleeve);
  } else if (weaponType === 'vira_blades') {
    const hiltMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xff1744,
      emissive: 0xff0033,
      emissiveIntensity: 0.85,
      roughness: 0.2
    });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.14), hiltMat);
    hilt.position.y = 0.08;

    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1.85, 4), bladeMat);
    blade.position.y = 1.02;

    const core = new THREE.Mesh(new THREE.ConeGeometry(0.06, 1.65, 4), coreMat);
    core.position.y = 0.98;

    group.add(hilt, blade, core);
  } else if (weaponType === 'toolbar_staff') {
    // Agent's Adobe/Media UI Toolbar Staff (AvA Season 3)
    const barMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.25 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const pauseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 0.12), barMat);
    rod.position.y = 0.65;
    const uiPanel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.95, 0.16), barMat);
    uiPanel.position.y = 1.65;
    const pauseL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.32, 0.18), pauseMat);
    pauseL.position.set(-0.07, 1.82, 0);
    const pauseR = pauseL.clone();
    pauseR.position.x = 0.07;
    const slider = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.18), glowMat);
    slider.position.set(0, 1.42, 0);
    group.add(rod, uiPanel, pauseL, pauseR, slider);
  } else if (weaponType === 'pixel_bazooka') {
    // Ballista's 8-Bit Pixel Bazooka / Heavy Blaster
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const muzzleMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });

    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.85, 0.38), gunMat);
    barrel.position.y = 0.75;
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.45, 0.44), darkMat);
    vent.position.y = 1.35;
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.3), muzzleMat);
    muzzle.position.y = 1.72;
    group.add(barrel, vent, muzzle);
  } else if (weaponType === 'stone_spear') {
    // Primal's Prehistoric Stone Spear
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 });
    const wrapMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.2 });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.5, 6), woodMat);
    shaft.position.y = 0.65;
    const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.2), wrapMat);
    wrap.position.y = 1.75;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.72, 4), stoneMat);
    tip.position.y = 2.18;
    group.add(shaft, wrap, tip);
  } else if (weaponType === 'hazard_sign') {
    // Hazard's High-Voltage Caution Triangle Gadget
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
    const signMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.35,
      roughness: 0.3
    });
    const bangMat = new THREE.MeshBasicMaterial({ color: 0x111827 });

    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), poleMat);
    pole.position.y = 0.45;
    const triangle = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.75, 3), signMat);
    triangle.position.y = 1.45;
    triangle.rotation.y = Math.PI / 2;
    const bang = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.32), bangMat);
    bang.position.y = 1.42;
    group.add(pole, triangle, bang);
  }
  return group;
}

export class StickRig3D {
  constructor(options = {}) {
    const {
      color = '#ff7700',
      scale = 1.0,
      isHollowHead = false,
      isZombie = false,
      isHunched = false,
      hasCrown = false,
      zombieType = null,
      weaponType = null
    } = options;

    this.color = new THREE.Color(color);
    this.baseScale = scale;
    this.isHollowHead = isHollowHead;
    this.isZombie = isZombie;
    this.isHunched = isHunched;
    this.zombieType = zombieType;
    this.shoulderY = SHOULDER_Y;
    this.lastPose = null;
    this._emissiveKey = -1;

    this._targetPose = {
      torsoLean: 0.0,
      headTilt: 0.0,
      hipZ: 0.0,
      liftY: 0.0,
      thighL: 0.0,
      kneeL: 0.0,
      thighR: 0.0,
      kneeR: 0.0,
      uArmL: 0.0,
      elbowL: 0.0,
      uArmR: 0.0,
      elbowR: 0.0
    };
    this.poseAngles = {
      torsoLean: 0.0,
      headTilt: 0.0,
      hipZ: 0.0,
      liftY: 0.0,
      thighL: 0.0,
      kneeL: 0.0,
      thighR: 0.0,
      kneeR: 0.0,
      uArmL: 0.0,
      elbowL: 0.0,
      uArmR: 0.0,
      elbowR: 0.0
    };

    this.root = new THREE.Group();
    this.root.scale.setScalar(scale);

    this.material = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.32,
      metalness: 0.08,
      emissive: this.color.clone().multiplyScalar(isZombie ? 0.18 : 0.32),
      emissiveIntensity: 1.0
    });

    // Simple, joint-free stick figure segments with monomorphic zero-allocation setCyl method
    const makeSeg = () => {
      const m = new THREE.Mesh(SHARED_GEOS.segment, this.material);
      m.quaternion._onChangeCallback = () => {};
      m.rotation._onChangeCallback = () => {};
      m.setCyl = function(x1, y1, z1, x2, y2, z2) {
        const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
        const lenSq = dx * dx + dy * dy + dz * dz;
        if (lenSq < 1e-8) { this.visible = false; return; }
        this.visible = true;
        const p = this.position;
        p.x = (x1 + x2) * 0.5;
        p.y = (y1 + y2) * 0.5;
        p.z = (z1 + z2) * 0.5;
        const len = Math.sqrt(lenSq);
        this.scale.y = len + LINE_RADIUS * 0.85;
        const invLen = 1.0 / len;
        const ex = dx * invLen, ey = dy * invLen, ez = dz * invLen;
        const n = ey + 1.0;
        const q = this.quaternion;
        if (n < 1e-6) {
          q._x = 0.0; q._y = 0.0; q._z = 1.0; q._w = 0.0;
        } else {
          const qx = ez, qz = -ex, qw = n;
          const qLen = 1.0 / Math.sqrt(qx * qx + qz * qz + qw * qw);
          q._x = qx * qLen; q._y = 0.0; q._z = qz * qLen; q._w = qw * qLen;
        }
      };
      m.castShadow = true;
      this.root.add(m);
      return m;
    };

    this.spineSeg = makeSeg();
    this.thighLSeg = makeSeg();
    this.shinLSeg = makeSeg();
    this.thighRSeg = makeSeg();
    this.shinRSeg = makeSeg();
    this.uArmLSeg = makeSeg();
    this.fArmLSeg = makeSeg();
    this.uArmRSeg = makeSeg();
    this.fArmRSeg = makeSeg();

    this._segments = [
      this.spineSeg, this.thighLSeg, this.shinLSeg,
      this.thighRSeg, this.shinRSeg, this.uArmLSeg,
      this.fArmLSeg, this.uArmRSeg, this.fArmRSeg
    ];
    this._segEndpoints = new Float64Array(54);

    // Chest anchor for props
    this.chest = new THREE.Group();
    this.chest.position.set(0, 1.25, 0);
    this.root.add(this.chest);

    // Head group
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 2.06, 0);
    this.root.add(this.headGroup);

    if (isHollowHead) {
      this.headMesh = new THREE.Mesh(SHARED_GEOS.hollowHead, this.material);
      // Rotate torus 90 deg around Y so when character faces +X/-X (rotation.y = ±PI/2),
      // the hollow ring faces the camera cleanly!
      this.headMesh.rotation.y = Math.PI / 2;
      this.headMesh.castShadow = true;
      this.headGroup.add(this.headMesh);
    } else {
      this.headMesh = new THREE.Mesh(SHARED_GEOS.solidHead, this.material);
      this.headMesh.castShadow = true;
      this.headGroup.add(this.headMesh);
    }

    if (hasCrown) {
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.7,
        roughness: 0.2,
        emissive: 0x664400
      });
      const crownGroup = new THREE.Group();
      crownGroup.position.y = 0.34;
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.56), crownMat);
      crownGroup.add(band);
      for (let sx = -1; sx <= 1; sx++) {
        for (let sz = -1; sz <= 1; sz++) {
          if (sx === 0 && sz === 0) continue;
          const spike = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), crownMat);
          spike.position.set(sx * 0.2, 0.16, sz * 0.2);
          crownGroup.add(spike);
        }
      }
      this.headGroup.add(crownGroup);
    }

    // Eyes for solid-headed zombies
    this.eyeGroup = new THREE.Group();
    const eyeMat = new THREE.MeshBasicMaterial({ color: isZombie ? 0xff1744 : 0xffffff });
    const eyeL = new THREE.Mesh(SHARED_GEOS.eye, eyeMat);
    const eyeR = new THREE.Mesh(SHARED_GEOS.eye, eyeMat);
    eyeL.position.set(-0.12, 0.04, 0.33);
    eyeR.position.set(0.12, 0.04, 0.33);
    this.eyeGroup.add(eyeL, eyeR);
    this.eyeGroup.visible = isZombie && !isHollowHead;
    this.headGroup.add(this.eyeGroup);

    // Hand mounts for weapons
    this.handL = new THREE.Group();
    this.handR = new THREE.Group();
    this.root.add(this.handL, this.handR);

    // Awakened Aura Shell
    this.auraMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.85, 3.1, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe600,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    this.auraMesh.position.y = 1.45;
    this.auraMesh.visible = false;
    this.root.add(this.auraMesh);

    this.currentWeaponType = null;
    this.weaponMeshR = null;
    this.weaponMeshL = null;
    if (weaponType) {
      this.setWeapon(weaponType);
    }

    if (zombieType) {
      this.attachZombieVoxelProps(zombieType);
    }

    this.update({ pose: 'idle', animTimer: 0 });
  }

  setWeapon(weaponType) {
    if (this.currentWeaponType === weaponType) return;
    this.currentWeaponType = weaponType;
    if (this.weaponMeshR) {
      this.handR.remove(this.weaponMeshR);
      disposeHierarchy(this.weaponMeshR, true);
      this.weaponMeshR = null;
    }
    if (this.weaponMeshL) {
      this.handL.remove(this.weaponMeshL);
      disposeHierarchy(this.weaponMeshL, true);
      this.weaponMeshL = null;
    }
    if (!weaponType) return;
    this.weaponMeshR = buildVoxelWeaponMesh(weaponType);
    this.handR.add(this.weaponMeshR);

    if (weaponType === 'vira_blades') {
      this.weaponMeshL = buildVoxelWeaponMesh('vira_blades');
      this.handL.add(this.weaponMeshL);
    }
  }

  attachZombieVoxelProps(type) {
    if (type === 'shieldbearer' || type === 'warden') {
      const isWarden = type === 'warden';
      const shieldMat = new THREE.MeshStandardMaterial({
        color: isWarden ? 0x1d3b32 : 0x263845,
        metalness: 0.5,
        roughness: 0.3,
        emissive: isWarden ? 0x0d9488 : 0x0284c7,
        emissiveIntensity: 0.25
      });
      const rimMat = new THREE.MeshStandardMaterial({
        color: isWarden ? 0x5eead4 : 0x7dd3fc,
        emissive: isWarden ? 0x2dd4bf : 0x38bdf8,
        emissiveIntensity: 0.4
      });
      const shieldGroup = new THREE.Group();
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(isWarden ? 1.05 : 0.85, isWarden ? 1.85 : 1.45, 0.16),
        shieldMat
      );
      const rim = new THREE.Mesh(
        new THREE.BoxGeometry(isWarden ? 1.12 : 0.92, 0.12, 0.2),
        rimMat
      );
      rim.position.y = isWarden ? 0.8 : 0.62;
      shieldGroup.add(plate, rim);
      shieldGroup.position.set(0, -0.1, 0.48);
      this.chest.add(shieldGroup);
    } else if (type === 'spitter') {
      const sacMat = new THREE.MeshStandardMaterial({
        color: 0x64dd17,
        emissive: 0x76ff03,
        emissiveIntensity: 0.6,
        roughness: 0.25
      });
      const sac = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), sacMat);
      sac.position.set(0, 0.05, -0.25);
      this.chest.add(sac);
    } else if (type === 'boom_bug') {
      const tntMat = new THREE.MeshStandardMaterial({
        map: getVoxelTexture('tnt_block'),
        emissive: 0xff5500,
        emissiveIntensity: 0.35
      });
      const tnt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), tntMat);
      tnt.position.set(0, -0.05, 0.05);
      this.chest.add(tnt);
      this.boomCore = tnt;
    } else if (type === 'stalker') {
      const glitchMat = new THREE.MeshBasicMaterial({ color: 0xd946ef });
      this.glitchShards = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const shard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.16), glitchMat);
        shard.position.set(Math.cos(i * 1.57) * 0.48, (i - 1.5) * 0.22, Math.sin(i * 1.57) * 0.48);
        this.glitchShards.add(shard);
      }
      this.chest.add(this.glitchShards);
    } else if (type === 'titan_boss') {
      const hornMat = new THREE.MeshStandardMaterial({
        color: 0xff1744,
        emissive: 0xd50000,
        emissiveIntensity: 0.7
      });
      const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.65, 5), hornMat);
      hornL.position.set(-0.32, 0.42, 0.05);
      hornL.rotation.z = 0.45;
      const hornR = hornL.clone();
      hornR.position.x = 0.32;
      hornR.rotation.z = -0.45;
      this.headGroup.add(hornL, hornR);

      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), hornMat);
      core.position.set(0, 0.0, 0.18);
      this.chest.add(core);
    } else if (type === 'h4c3r') {
      const handleMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
      this.hackerHandles = new THREE.Group();
      const corners = [
        [-0.55, 0.55], [0.55, 0.55], [-0.55, -0.55], [0.55, -0.55]
      ];
      for (const [cx, cy] of corners) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), handleMat);
        box.position.set(0, cy, cx);
        this.hackerHandles.add(box);
      }
      this.chest.add(this.hackerHandles);
    } else if (type === 'mercenary_agent') {
      // Agent's signature dark sunglasses (AvA Season 3)
      const shadeMat = new THREE.MeshStandardMaterial({ color: 0x05070b, roughness: 0.15, metalness: 0.85 });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.6 });
      const shades = new THREE.Group();
      const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.12), shadeMat);
      lensL.position.set(-0.15, 0.05, 0.33);
      const lensR = lensL.clone();
      lensR.position.x = 0.15;
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.11), rimMat);
      bridge.position.set(0, 0.11, 0.33);
      shades.add(lensL, lensR, bridge);
      this.headGroup.add(shades);
      this.eyeGroup.visible = false;
    } else if (type === 'mercenary_ballista') {
      // Ballista's boxy 8-bit pixel-art head & visor (AvA Season 3)
      this.headMesh.visible = false;
      this.eyeGroup.visible = false;
      const pixMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
      const bandMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.4 });
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
      const pixHead = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.66, 0.66), pixMat);
      const headband = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.7), bandMat);
      headband.position.y = 0.16;
      const pEyeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.08), eyeMat);
      pEyeL.position.set(-0.15, 0.0, 0.34);
      const pEyeR = pEyeL.clone();
      pEyeR.position.x = 0.15;
      this.headGroup.add(pixHead, headband, pEyeL, pEyeR);
    } else if (type === 'mercenary_primal') {
      // Primal's prehistoric animal skull / horned pelt hood & shoulder fur (AvA Season 3)
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.55 });
      const furMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85 });
      const skull = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.36, 0.68), boneMat);
      skull.position.set(0, 0.24, 0.04);
      const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.52, 5), boneMat);
      hornL.position.set(-0.34, 0.38, 0.08);
      hornL.rotation.z = 0.55;
      const hornR = hornL.clone();
      hornR.position.x = 0.34;
      hornR.rotation.z = -0.55;
      this.headGroup.add(skull, hornL, hornR);
      const pelt = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.45, 0.38), furMat);
      pelt.position.set(0, 0.18, -0.06);
      this.chest.add(pelt);
      this.eyeGroup.visible = false;
    } else if (type === 'mercenary_hazard') {
      // Hazard's Caution-Sign / Bathroom-Pictogram flat wide shoulders & warning vest (AvA Season 3)
      const signBlack = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35 });
      const signYellow = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xca8a04,
        emissiveIntensity: 0.35,
        roughness: 0.3
      });
      const signPlate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.72), signBlack);
      signPlate.position.set(0, 0.08, 0);
      const borderFrame = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.78, 0.78), signYellow);
      borderFrame.position.set(0, 0.08, 0);
      this.chest.add(borderFrame, signPlate);
      this.eyeGroup.visible = false;
    }

    // Warm up V8 inline caches and polymorphic feedback vectors across poses and float fields
    const _warmupState = {
      pose: 'idle',
      animTimer: 0.016,
      dt: 0.016,
      isGrounded: true,
      isHurt: false,
      actionKind: null,
      actionPhase: 0.5
    };
    for (let j = 0; j < 60; j++) {
      _warmupState.pose = (j % 2 === 0) ? 'idle' : 'run';
      _warmupState.animTimer = j * 0.016;
      _warmupState.actionPhase = (j % 60) / 60;
      this.update(_warmupState);
    }
    this.shoulderY = SHOULDER_Y;
    this.lastPose = null;
  }

  _applySegments() {
    const b = this._segEndpoints;
    const segs = this._segments;
    for (let m = 0; m < 9; m++) {
      const idx = m * 6;
      const x1 = b[idx], y1 = b[idx + 1], z1 = b[idx + 2];
      const x2 = b[idx + 3], y2 = b[idx + 4], z2 = b[idx + 5];
      const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
      const lenSq = dx * dx + dy * dy + dz * dz;
      const mesh = segs[m];
      if (lenSq < 1e-8) { mesh.visible = false; continue; }
      mesh.visible = true;
      const p = mesh.position;
      p.x = (x1 + x2) * 0.5; p.y = (y1 + y2) * 0.5; p.z = (z1 + z2) * 0.5;
      const len = Math.sqrt(lenSq);
      mesh.scale.y = len + LINE_RADIUS * 0.85;
      const invLen = 1.0 / len;
      const ex = dx * invLen, ey = dy * invLen, ez = dz * invLen;
      const n = ey + 1.0;
      const q = mesh.quaternion;
      if (n < 1e-6) {
        q._x = 0.0; q._y = 0.0; q._z = 1.0; q._w = 0.0;
      } else {
        const qx = ez, qz = -ex, qw = n;
        const qLen = 1.0 / Math.sqrt(qx * qx + qz * qz + qw * qw);
        q._x = qx * qLen; q._y = 0.0; q._z = qz * qLen; q._w = qw * qLen;
      }
    }
  }

  update(state = {}) {
    const {
      pose = 'idle',
      animTimer = 0,
      isGrounded = true,
      isHurt = false,
      isAwakened = false,
      isFrozen = false,
      weaponType = this.currentWeaponType,
      actionKind = null,
      actionPhase = 0,
      dt = 0.016
    } = state;

    if (weaponType !== undefined && weaponType !== this.currentWeaponType) {
      this.setWeapon(weaponType);
    }

    const emissiveKey = isHurt ? 1 : (isFrozen ? 2 : (isAwakened ? 3 : 0));
    if (this._emissiveKey !== emissiveKey) {
      this._emissiveKey = emissiveKey;
      if (isHurt) {
        this.material.emissive.setHex(0xffffff);
        this.material.emissiveIntensity = 0.85;
      } else if (isFrozen) {
        this.material.emissive.setHex(0x38bdf8);
        this.material.emissiveIntensity = 0.65;
      } else if (isAwakened) {
        this.material.emissive.setHex(0xffd700);
        this.material.emissiveIntensity = 0.8;
      } else {
        this.material.emissive.copy(this.color).multiplyScalar(this.isZombie ? 0.22 : 0.35);
        this.material.emissiveIntensity = 1.0;
      }
    }

    if (this.auraMesh.visible !== Boolean(isAwakened)) {
      this.auraMesh.visible = Boolean(isAwakened);
    }
    if (isAwakened) {
      this.auraMesh.rotation.y = animTimer * 4;
    }
    if (this.glitchShards) {
      this.glitchShards.rotation.y = animTimer * 5;
    }
    if (this.boomCore) {
      this.boomCore.scale.setScalar(1 + Math.sin(animTimer * 16) * 0.14);
    }

    const safeDt = (dt >= 0.004 && dt <= 0.05) ? dt : (Number.isFinite(dt) ? (dt < 0.004 ? 0.004 : 0.05) : 0.016);
    const target = this.computeNaturalPoseAngles(pose, animTimer, isGrounded, isHurt, actionKind, actionPhase);
    const isExitingRoll = (this.lastPose === 'roll' && pose !== 'roll');
    if (!this.poseAngles) {
      this.poseAngles = {
        torsoLean: 0.0, headTilt: 0.0, hipZ: 0.0, liftY: 0.0,
        thighL: 0.0, kneeL: 0.0, thighR: 0.0, kneeR: 0.0,
        uArmL: 0.0, elbowL: 0.0, uArmR: 0.0, elbowR: 0.0
      };
    }
    const a = this.poseAngles;

    if (pose === 'roll' || isExitingRoll) {
      a.torsoLean = target.torsoLean;
      a.headTilt  = target.headTilt;
      a.hipZ      = target.hipZ;
      a.liftY     = target.liftY;
      a.thighL    = target.thighL;
      a.kneeL     = target.kneeL;
      a.thighR    = target.thighR;
      a.kneeR     = target.kneeR;
      a.uArmL     = target.uArmL;
      a.elbowL    = target.elbowL;
      a.uArmR     = target.uArmR;
      a.elbowR    = target.elbowR;
    } else {
      const isAttack = (pose[0] === 'a' && pose[1] === 't') || pose === 'weapon_slash' || pose === 'dive_kick';
      const isFlinch = Boolean(isHurt || pose === 'hurt');
      const rate = isFlinch ? 36 : (isAttack ? 28 : 18);
      const rawAlpha = 1.0 - Math.exp(-rate * safeDt);
      const alpha = rawAlpha < 1.0 ? rawAlpha : 1.0;

      a.torsoLean += (target.torsoLean - a.torsoLean) * alpha;
      a.headTilt  += (target.headTilt - a.headTilt) * alpha;
      a.hipZ      += (target.hipZ - a.hipZ) * alpha;
      a.liftY     += (target.liftY - a.liftY) * alpha;
      a.thighL    += (target.thighL - a.thighL) * alpha;
      a.kneeL     += (target.kneeL - a.kneeL) * alpha;
      a.thighR    += (target.thighR - a.thighR) * alpha;
      a.kneeR     += (target.kneeR - a.kneeR) * alpha;
      a.uArmL     += (target.uArmL - a.uArmL) * alpha;
      a.elbowL    += (target.elbowL - a.elbowL) * alpha;
      a.uArmR     += (target.uArmR - a.uArmR) * alpha;
      a.elbowR    += (target.elbowR - a.elbowR) * alpha;
    }
    this.lastPose = pose;

    const SPINE_LEN = 0.80;
    const THIGH_LEN = 0.40;
    const SHIN_LEN = 0.40;
    const UARM_LEN = 0.41;
    const FARM_LEN = 0.39;
    const HEAD_RADIUS = 0.34;
    const zSep = 0.022;

    // Compute leg positions relative to hip = (0, 0, hipZ) first so we can plant the stance foot on the floor
    const hipZ = a.hipZ;
    const relKneeLY = -Math.cos(a.thighL) * THIGH_LEN;
    const relKneeLZ = hipZ + Math.sin(a.thighL) * THIGH_LEN;
    const shinAngleL = a.thighL - a.kneeL;
    const relFootLY = relKneeLY - Math.cos(shinAngleL) * SHIN_LEN;
    const relFootLZ = relKneeLZ + Math.sin(shinAngleL) * SHIN_LEN;

    const relKneeRY = -Math.cos(a.thighR) * THIGH_LEN;
    const relKneeRZ = hipZ + Math.sin(a.thighR) * THIGH_LEN;
    const shinAngleR = a.thighR - a.kneeR;
    const relFootRY = relKneeRY - Math.cos(shinAngleR) * SHIN_LEN;
    const relFootRZ = relKneeRZ + Math.sin(shinAngleR) * SHIN_LEN;

    const minRelFootY = relFootLY < relFootRY ? relFootLY : relFootRY;
    const torsoH = Math.cos(a.torsoLean) * SPINE_LEN;

    let hipY;
    if (pose === 'roll') {
      hipY = 0.72;
    } else if (pose === 'crouch' || this.zombieType === 'crawler') {
      const cHip = -minRelFootY + 0.03 + a.liftY;
      hipY = cHip > 0.28 ? cHip : 0.28;
    } else {
      // Aerial IK & root elevation: decouple pelvis height from kicking leg angles while
      // respecting floor clearance and bounding shoulderY strictly to [1.45, 1.75]
      const rootHipY = 0.82 + a.liftY * 0.2;
      const footClearance = -minRelFootY + 0.03;
      hipY = rootHipY > footClearance ? rootHipY : footClearance;
      const minH = 1.45 - torsoH;
      const maxH = 1.75 - torsoH;
      if (hipY < minH) hipY = minH;
      else if (hipY > maxH) hipY = maxH;
    }

    const kLY = hipY + relKneeLY, kLZ = relKneeLZ;
    const fLY = hipY + relFootLY, fLZ = relFootLZ;
    const kRY = hipY + relKneeRY, kRZ = relKneeRZ;
    const fRY = hipY + relFootRY, fRZ = relFootRZ;

    // 1. Spine: from hip (0, hipY, hipZ) up to neck (0, neckY, neckZ)
    const neckY = hipY + torsoH;
    const neckZ = hipZ + Math.sin(a.torsoLean) * SPINE_LEN;
    const shoulderY = neckY;
    this.shoulderY = shoulderY;
    const cp = this.chest.position;
    cp.x = 0; cp.y = (hipY + neckY) * 0.55; cp.z = (hipZ + neckZ) * 0.55;

    // 2. Head: bottom of head connects directly to the neck (0, neckY, neckZ)
    const headAngle = a.torsoLean * 0.65 + a.headTilt;
    const headCenterDist = HEAD_RADIUS + 0.02;
    const hp = this.headGroup.position;
    hp.x = 0;
    hp.y = neckY + Math.cos(headAngle) * headCenterDist;
    hp.z = neckZ + Math.sin(headAngle) * headCenterDist;

    // 3. Arms: both upper arms ALWAYS start from the exact neck point (0, neckY, neckZ)
    const eLY = neckY - Math.cos(a.uArmL) * UARM_LEN;
    const eLZ = neckZ + Math.sin(a.uArmL) * UARM_LEN;
    const fAngleL = a.uArmL + a.elbowL; // Elbow always bends forward (elbowL >= 0)
    const hLY = eLY - Math.cos(fAngleL) * FARM_LEN;
    const hLZ = eLZ + Math.sin(fAngleL) * FARM_LEN;

    const eRY = neckY - Math.cos(a.uArmR) * UARM_LEN;
    const eRZ = neckZ + Math.sin(a.uArmR) * UARM_LEN;
    const fAngleR = a.uArmR + a.elbowR;
    const hRY = eRY - Math.cos(fAngleR) * FARM_LEN;
    const hRZ = eRZ + Math.sin(fAngleR) * FARM_LEN;

    // 4. Pack segment endpoints into typed array and update segment meshes in unified pass
    const b = this._segEndpoints;
    // 0: Spine
    b[0] = 0; b[1] = hipY; b[2] = hipZ; b[3] = 0; b[4] = neckY; b[5] = neckZ;
    // 1: ThighL
    b[6] = 0; b[7] = hipY; b[8] = hipZ; b[9] = -zSep; b[10] = kLY; b[11] = kLZ;
    // 2: ShinL
    b[12] = -zSep; b[13] = kLY; b[14] = kLZ; b[15] = -zSep * 1.4; b[16] = fLY; b[17] = fLZ;
    // 3: ThighR
    b[18] = 0; b[19] = hipY; b[20] = hipZ; b[21] = zSep; b[22] = kRY; b[23] = kRZ;
    // 4: ShinR
    b[24] = zSep; b[25] = kRY; b[26] = kRZ; b[27] = zSep * 1.4; b[28] = fRY; b[29] = fRZ;
    // 5: UArmL
    b[30] = 0; b[31] = neckY; b[32] = neckZ; b[33] = -zSep * 1.4; b[34] = eLY; b[35] = eLZ;
    // 6: FArmL
    b[36] = -zSep * 1.4; b[37] = eLY; b[38] = eLZ; b[39] = -zSep * 2.0; b[40] = hLY; b[41] = hLZ;
    // 7: UArmR
    b[42] = 0; b[43] = neckY; b[44] = neckZ; b[45] = zSep * 1.4; b[46] = eRY; b[47] = eRZ;
    // 8: FArmR
    b[48] = zSep * 1.4; b[49] = eRY; b[50] = eRZ; b[51] = zSep * 2.0; b[52] = hRY; b[53] = hRZ;

    this._applySegments();

    // 5. Hand Weapon Mounts follow the hand position and forearm angle naturally
    const lp = this.handL.position;
    lp.x = -zSep * 2.0; lp.y = hLY; lp.z = hLZ;
    const rp = this.handR.position;
    rp.x = zSep * 2.0; rp.y = hRY; rp.z = hRZ;

    let weaponPitch = fAngleR * 0.65 + 0.15;
    if (pose === 'weapon_slash') {
      weaponPitch = -0.95 + (actionPhase || 0.5) * 2.45;
    } else if (pose[0] === 'a' && pose[1] === 't') {
      weaponPitch = fAngleR * 0.75 + 0.35;
    }
    this.handR.rotation.x = weaponPitch;
    this.handL.rotation.x = fAngleL * 0.65 + 0.15;
  }

  computeNaturalPoseAngles(pose, timer, isGrounded, isHurt, actionKind, actionPhase) {
    let p = typeof actionPhase === 'number' ? actionPhase : 0.0;
    if (p < 0.0) p = 0.0;
    else if (p > 1.0) p = 1.0;
    const isCombatPose = (pose[0] === 'a' && pose[1] === 't') || pose === 'weapon_slash' || pose === 'dive_kick' || Boolean(actionKind);
    const swing = isCombatPose ? Math.sin(p * Math.PI) : 0.0;
    const drive = isCombatPose ? (p < 0.45 ? (p / 0.45) : 1.0 - (p - 0.45) * 0.35) : 0.0;

    if (!this._targetPose) {
      this._targetPose = {
        torsoLean: 0.0,
        headTilt: 0.0,
        hipZ: 0.0,
        liftY: 0.0,
        thighL: 0.0,
        kneeL: 0.0,
        thighR: 0.0,
        kneeR: 0.0,
        uArmL: 0.0,
        elbowL: 0.0,
        uArmR: 0.0,
        elbowR: 0.0
      };
    }
    const out = this._targetPose;
    out.torsoLean = this.isHunched ? 0.28 : 0.06;
    out.headTilt = 0.0;
    out.hipZ = 0.0;
    out.liftY = 0.0;
    out.thighL = -0.16;
    out.kneeL = 0.14;
    out.thighR = 0.20;
    out.kneeR = 0.18;
    out.uArmL = -0.18;
    out.elbowL = 0.68;
    out.uArmR = 0.24;
    out.elbowR = 0.88;

    if (isHurt) {
      out.torsoLean = -0.28;
      out.headTilt = -0.22;
      out.hipZ = -0.08;
      out.thighL = -0.25;
      out.kneeL = 0.35;
      out.thighR = 0.32;
      out.kneeR = 0.42;
      out.uArmL = -0.55;
      out.elbowL = 0.95;
      out.uArmR = 0.45;
      out.elbowR = 1.05;
      return out;
    }

    if (this.zombieType === 'crawler') {
      const t = timer * 9.0;
      const s = Math.sin(t);
      out.torsoLean = 1.18 + Math.sin(t * 2) * 0.05;
      out.headTilt = -0.45;
      out.thighL = -0.75 + s * 0.35;
      out.kneeL = 0.85;
      out.thighR = -0.75 - s * 0.35;
      out.kneeR = 0.85;
      out.uArmL = 0.95 + s * 0.48;
      out.elbowL = 0.65;
      out.uArmR = 0.95 - s * 0.48;
      out.elbowR = 0.65;
      return out;
    }

    switch (pose) {
      case 'zombie_idle': {
        const b = Math.sin(timer * 2.8);
        out.torsoLean = 0.34 + b * 0.05;
        out.headTilt = 0.10 + b * 0.06;
        out.thighL = -0.20;
        out.kneeL = 0.32;
        out.thighR = 0.24;
        out.kneeR = 0.36;
        out.uArmL = 0.96 + b * 0.08;
        out.elbowL = 0.38;
        out.uArmR = 0.82 - b * 0.08;
        out.elbowR = 0.48;
        break;
      }
      case 'zombie_walk': {
        const t = timer * 6.8;
        const s = Math.sin(t);
        const c = Math.cos(t);
        out.torsoLean = 0.36 + Math.sin(t * 2) * 0.05;
        out.headTilt = 0.08 + Math.cos(t) * 0.06;
        out.thighL = s * 0.54 + 0.04;
        const c1 = c * 0.65 + 0.35;
        out.kneeL = 0.22 + (c1 > 0 ? c1 : 0) * 0.58;
        out.thighR = -s * 0.54 + 0.04;
        const c2 = -c * 0.65 + 0.35;
        out.kneeR = 0.22 + (c2 > 0 ? c2 : 0) * 0.58;
        out.uArmL = 0.92 - s * 0.24;
        out.elbowL = 0.40 + (s > 0 ? s : 0) * 0.22;
        out.uArmR = 0.84 + s * 0.24;
        out.elbowR = 0.46 + (-s > 0 ? -s : 0) * 0.22;
        if (actionKind) {
          out.torsoLean += swing * 0.22;
          out.uArmL += swing * 0.55;
          out.uArmR += swing * 0.65;
        }
        break;
      }
      case 'idle': {
        const b = Math.sin(timer * 3.2);
        const b2 = Math.cos(timer * 1.6);
        out.torsoLean = 0.06 + b * 0.025;
        out.headTilt = -b * 0.03;
        out.thighL = -0.16 + b2 * 0.02;
        out.kneeL = 0.14 + (-b > 0 ? -b : 0) * 0.05;
        out.thighR = 0.20 - b2 * 0.02;
        out.kneeR = 0.18 + (b > 0 ? b : 0) * 0.05;
        out.uArmL = -0.18 + b * 0.04;
        out.elbowL = 0.68 + b * 0.05;
        out.uArmR = 0.24 - b * 0.04;
        out.elbowR = 0.88 - b * 0.05;
        break;
      }
      case 'run': {
        const t = timer * 11.5;
        const s = Math.sin(t);
        const c = Math.cos(t);
        out.torsoLean = 0.25 + Math.sin(t * 2) * 0.035;
        out.headTilt = -0.07 + Math.cos(t * 2) * 0.03;
        const lVal = Math.sin(t * 2 - 0.5) * 0.065;
        out.liftY = lVal > 0 ? lVal : 0;
        out.thighL = s * 0.78 + 0.08;
        const k1 = c * 0.72 + 0.28;
        out.kneeL = 0.14 + (k1 > 0 ? k1 : 0) * 0.82;
        out.thighR = -s * 0.78 + 0.08;
        const k2 = -c * 0.72 + 0.28;
        out.kneeR = 0.14 + (k2 > 0 ? k2 : 0) * 0.82;
        out.uArmL = -s * 0.68 - 0.06;
        out.elbowL = 1.02 + (-s > 0 ? -s : 0) * 0.42;
        out.uArmR = s * 0.68 - 0.06;
        out.elbowR = 1.02 + (s > 0 ? s : 0) * 0.42;
        break;
      }
      case 'jump_rise': {
        out.torsoLean = 0.12;
        out.headTilt = -0.14;
        out.thighL = -0.32;
        out.kneeL = 0.42;
        out.thighR = 0.78;
        out.kneeR = 1.15;
        out.uArmL = -0.42;
        out.elbowL = 0.85;
        out.uArmR = 0.82;
        out.elbowR = 0.95;
        break;
      }
      case 'jump_fall': {
        out.torsoLean = 0.18;
        out.headTilt = 0.10;
        out.thighL = 0.24;
        out.kneeL = 0.68;
        out.thighR = 0.52;
        out.kneeR = 0.82;
        out.uArmL = -0.52;
        out.elbowL = 0.58;
        out.uArmR = 0.62;
        out.elbowR = 0.68;
        break;
      }
      case 'wall_slide': {
        out.torsoLean = -0.12;
        out.thighL = 0.65;
        out.kneeL = 0.95;
        out.thighR = -0.15;
        out.kneeR = 0.25;
        out.uArmL = 1.25;
        out.elbowL = 0.45;
        out.uArmR = -0.35;
        out.elbowR = 0.75;
        break;
      }
      case 'crouch': {
        out.torsoLean = 0.34;
        out.headTilt = -0.16;
        out.thighL = 0.68;
        out.kneeL = 1.32;
        out.thighR = 0.82;
        out.kneeR = 1.38;
        out.uArmL = 0.55;
        out.elbowL = 1.35;
        out.uArmR = 0.75;
        out.elbowR = 1.45;
        break;
      }
      case 'roll': {
        const rot = timer * Math.PI * 5.5;
        out.torsoLean = rot;
        out.headTilt = 0.35;
        out.thighL = rot + 1.15;
        out.kneeL = 1.55;
        out.thighR = rot + 1.35;
        out.kneeR = 1.55;
        out.uArmL = rot + 0.85;
        out.elbowL = 1.45;
        out.uArmR = rot + 1.05;
        out.elbowR = 1.45;
        break;
      }
      case 'hurt': {
        out.torsoLean = -0.28;
        out.headTilt = -0.22;
        out.hipZ = -0.08;
        out.thighL = -0.25;
        out.kneeL = 0.35;
        out.thighR = 0.32;
        out.kneeR = 0.42;
        out.uArmL = -0.55;
        out.elbowL = 0.95;
        out.uArmR = 0.45;
        out.elbowR = 1.05;
        break;
      }
      case 'attack_jab': {
        out.torsoLean = 0.14 + drive * 0.12;
        out.hipZ = drive * 0.08;
        out.thighL = -0.28;
        out.kneeL = 0.22;
        out.thighR = 0.38;
        out.kneeR = 0.32;
        out.uArmL = 0.45 + drive * 1.05;
        out.elbowL = Math.max(0.08, 1.15 - drive * 1.02);
        out.uArmR = 0.18;
        out.elbowR = 1.25;
        break;
      }
      case 'attack_cross': {
        out.torsoLean = 0.18 + drive * 0.18;
        out.hipZ = drive * 0.12;
        out.thighL = -0.34;
        out.kneeL = 0.26;
        out.thighR = 0.44;
        out.kneeR = 0.38;
        out.uArmL = 0.22;
        out.elbowL = 1.25;
        out.uArmR = 0.35 + drive * 1.22;
        out.elbowR = Math.max(0.08, 1.20 - drive * 1.08);
        break;
      }
      case 'attack_kick': {
        out.torsoLean = -0.18 * drive;
        out.headTilt = 0.12;
        out.thighL = 0.45 + drive * 1.18;
        out.kneeL = Math.max(0.10, 0.85 - drive * 0.72);
        out.thighR = -0.12;
        out.kneeR = 0.16;
        out.uArmL = -0.45;
        out.elbowL = 0.85;
        out.uArmR = 0.55;
        out.elbowR = 0.95;
        break;
      }
      case 'attack_axe_kick': {
        const sweep = p < 0.5 ? (p / 0.5) * 2.15 : 2.15 - ((p - 0.5) / 0.5) * 1.05;
        out.torsoLean = 0.12;
        out.thighL = sweep;
        out.kneeL = 0.12;
        out.thighR = -0.18;
        out.kneeR = 0.20;
        out.uArmL = -0.55;
        out.elbowL = 0.75;
        out.uArmR = 0.65;
        out.elbowR = 0.85;
        break;
      }
      case 'attack_spin': {
        const spinPhase = p > 0 ? (p * Math.PI * 2) : ((timer || 0) * 18);
        const spin = Math.sin(spinPhase);
        out.torsoLean = 0.08;
        out.liftY = 0.18;
        out.thighL = (p > 0 ? (0.65 + swing * 0.70) : spin * 1.35);
        out.kneeL = 0.18;
        out.thighR = (p > 0 ? (-0.55 - swing * 0.60) : -spin * 1.15);
        out.kneeR = 0.35;
        out.uArmL = -spin * 0.95;
        out.elbowL = 0.65;
        out.uArmR = spin * 0.95;
        out.elbowR = 0.65;
        break;
      }
      case 'attack_uppercut': {
        out.torsoLean = -0.08;
        out.headTilt = -0.18;
        out.liftY = drive * 0.16;
        out.thighL = -0.22;
        out.kneeL = 0.25;
        out.thighR = 0.68;
        out.kneeR = 0.95;
        out.uArmL = -0.35;
        out.elbowL = 0.85;
        out.uArmR = 0.65 + drive * 1.55;
        out.elbowR = 0.38;
        break;
      }
      case 'attack_drill_thrust': {
        out.torsoLean = 0.36;
        out.hipZ = drive * 0.16;
        out.thighL = -0.42;
        out.kneeL = 0.22;
        out.thighR = 0.52;
        out.kneeR = 0.48;
        out.uArmL = 0.75;
        out.elbowL = 0.65;
        out.uArmR = 1.48;
        out.elbowR = 0.08;
        break;
      }
      case 'attack_vault_kick': {
        out.torsoLean = -0.28;
        out.liftY = 0.24;
        out.thighL = 1.38;
        out.kneeL = 0.14;
        out.thighR = 1.22;
        out.kneeR = 0.22;
        out.uArmL = -0.65;
        out.elbowL = 0.45;
        out.uArmR = -0.45;
        out.elbowR = 0.55;
        break;
      }
      case 'attack_air_flurry': {
        const alt = Math.sin(timer * 22);
        out.torsoLean = 0.14;
        out.liftY = 0.18;
        out.thighL = 0.95 + alt * 0.45;
        out.kneeL = 0.22;
        out.thighR = 0.85 - alt * 0.45;
        out.kneeR = 0.28;
        out.uArmL = -0.45;
        out.elbowL = 0.85;
        out.uArmR = 0.65;
        out.elbowR = 0.75;
        break;
      }
      case 'attack_slide': {
        out.torsoLean = -0.42;
        out.thighL = 1.32;
        out.kneeL = 0.12;
        out.thighR = 0.25;
        out.kneeR = 1.25;
        out.uArmL = -0.55;
        out.elbowL = 0.45;
        out.uArmR = 0.45;
        out.elbowR = 0.65;
        break;
      }
      case 'dive_kick': {
        out.torsoLean = 0.42;
        out.liftY = 0.15;
        out.thighL = 1.18;
        out.kneeL = 0.08;
        out.thighR = -0.25;
        out.kneeR = 1.15;
        out.uArmL = -0.65;
        out.elbowL = 0.55;
        out.uArmR = -0.45;
        out.elbowR = 0.65;
        break;
      }
      case 'weapon_slash': {
        const slashArc = 2.05 - p * 1.45;
        out.torsoLean = 0.12 + p * 0.22;
        out.hipZ = p * 0.10;
        out.thighL = -0.26;
        out.kneeL = 0.22;
        out.thighR = 0.38;
        out.kneeR = 0.34;
        out.uArmL = 0.65;
        out.elbowL = 0.75;
        out.uArmR = slashArc;
        out.elbowR = 0.24;
        break;
      }
      case 'awakening_god': {
        const fl = Math.sin(timer * 5.0);
        out.torsoLean = -0.06;
        out.headTilt = -0.10;
        out.liftY = 0.32 + fl * 0.08;
        out.thighL = -0.12;
        out.kneeL = 0.35;
        out.thighR = 0.18;
        out.kneeR = 0.42;
        out.uArmL = 1.15 + fl * 0.08;
        out.elbowL = 0.45;
        out.uArmR = 1.25 - fl * 0.08;
        out.elbowR = 0.45;
        break;
      }
      default:
        break;
    }
    return out;
  }
}

export class CreeperLordRig3D {
  constructor() {
    this.root = new THREE.Group();
    const mossMat = new THREE.MeshStandardMaterial({ map: getVoxelTexture('creeper_moss'), roughness: 0.6 });
    const robeMat = new THREE.MeshStandardMaterial({ color: 0x6d4724, roughness: 0.7 });
    const goldMat = new THREE.MeshStandardMaterial({ map: getVoxelTexture('gold_block'), metalness: 0.6, roughness: 0.25 });
    const rubyMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0x991b1b, roughness: 0.2 });
    const darkMat = new THREE.MeshBasicMaterial({ color: 0x111814 });

    this.footFL = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), mossMat);
    this.footFL.position.set(-0.75, 0.45, 0.65);
    this.footFR = this.footFL.clone();
    this.footFR.position.set(0.75, 0.45, 0.65);
    this.footBL = this.footFL.clone();
    this.footBL.position.set(-0.75, 0.45, -0.65);
    this.footBR = this.footFL.clone();
    this.footBR.position.set(0.75, 0.45, -0.65);
    this.root.add(this.footFL, this.footFR, this.footBL, this.footBR);

    this.body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 2.7, 1.35), robeMat);
    this.body.position.y = 2.15;
    this.body.castShadow = true;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.35, 1.42), goldMat);
    trim.position.y = 1.1;
    this.root.add(this.body, trim);

    this.head = new THREE.Group();
    this.head.position.y = 4.35;
    const headBox = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.95, 1.95), mossMat);
    headBox.castShadow = true;
    this.head.add(headBox);

    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.1), darkMat);
    eyeL.position.set(-0.45, 0.25, 0.98);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.45;
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 0.1), darkMat);
    mouth.position.set(0, -0.35, 0.98);
    this.head.add(eyeL, eyeR, mouth);

    const crownBand = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.36, 2.1), goldMat);
    crownBand.position.y = 1.12;
    const ruby = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.26, 0.2), rubyMat);
    ruby.position.set(0, 1.12, 1.02);
    this.head.add(crownBand, ruby);
    for (let i = -2; i <= 2; i++) {
      const spike = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.65, 0.28), goldMat);
      spike.position.set(i * 0.42, 1.55, 0.9);
      this.head.add(spike);
    }
    this.root.add(this.head);

    this.staffGroup = new THREE.Group();
    this.staffGroup.position.set(1.35, 2.2, 0.3);
    const staffRod = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 4.4, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x9a7438, roughness: 0.7 })
    );
    this.staffOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.48, 0),
      new THREE.MeshStandardMaterial({ color: 0xb8ef58, emissive: 0x84cc16, emissiveIntensity: 0.8 })
    );
    this.staffOrb.position.y = 2.35;
    this.staffGroup.add(staffRod, this.staffOrb);
    this.root.add(this.staffGroup);
  }

  update(state = {}) {
    const t = state.animTimer || 0;
    const step = Math.sin(t * 6) * 0.25;
    this.footFL.position.z = 0.65 + step;
    this.footBR.position.z = -0.65 + step;
    this.footFR.position.z = 0.65 - step;
    this.footBL.position.z = -0.65 - step;
    this.head.rotation.y = Math.sin(t * 2.2) * 0.14;
    this.staffOrb.rotation.y = t * 4;
    this.staffGroup.rotation.x = state.actionPhase ? -0.45 + state.actionPhase * 0.9 : Math.sin(t * 3) * 0.1;
  }
}

export class GiantCatRig3D {
  constructor() {
    this.root = new THREE.Group();
    const furMat = new THREE.MeshStandardMaterial({ map: getVoxelTexture('cat_wool'), roughness: 0.65 });
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xe88932, roughness: 0.55 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xfff4df, roughness: 0.5 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x4fba42 });
    const noseMat = new THREE.MeshBasicMaterial({ color: 0xef8fa5 });
    const collarMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });

    this.body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.9, 3.6), furMat);
    this.body.position.set(0, 1.55, -0.2);
    this.body.castShadow = true;
    this.root.add(this.body);

    const collar = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.35, 0.5), collarMat);
    collar.position.set(0, 1.8, 1.55);
    this.root.add(collar);

    this.head = new THREE.Group();
    this.head.position.set(0, 2.75, 1.75);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.85, 1.9), faceMat);
    skull.castShadow = true;
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.55), whiteMat);
    muzzle.position.set(0, -0.32, 1.02);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.15), noseMat);
    nose.position.set(0, -0.12, 1.32);

    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.75, 4), furMat);
    earL.position.set(-0.68, 1.2, 0.1);
    const earR = earL.clone();
    earR.position.x = 0.68;

    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.1), eyeMat);
    eyeL.position.set(-0.52, 0.25, 0.96);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.52;

    this.head.add(skull, muzzle, nose, earL, earR, eyeL, eyeR);
    this.root.add(this.head);

    this.pawFL = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 1.15), whiteMat);
    this.pawFL.position.set(-0.85, 0.45, 1.35);
    this.pawFR = this.pawFL.clone();
    this.pawFR.position.set(0.85, 0.45, 1.35);
    this.pawBL = this.pawFL.clone();
    this.pawBL.position.set(-0.85, 0.45, -1.35);
    this.pawBR = this.pawFL.clone();
    this.pawBR.position.set(0.85, 0.45, -1.35);
    this.root.add(this.pawFL, this.pawFR, this.pawBL, this.pawBR);

    this.tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 2.2), furMat);
    this.tail.position.set(0, 2.35, -2.5);
    this.tail.rotation.x = 0.55;
    this.root.add(this.tail);
  }

  update(state = {}) {
    const t = state.animTimer || 0;
    this.tail.rotation.y = Math.sin(t * 5) * 0.45;
    this.head.rotation.z = Math.sin(t * 2.5) * 0.08;
    const swipe = state.actionKind === 'cat_swipe' ? (state.actionPhase || 0) : 0;
    this.pawFR.position.z = 1.35 + swipe * 1.6;
    this.pawFR.position.y = 0.45 + Math.sin(swipe * Math.PI) * 0.75;
  }
}

export class LuckyOrbRig3D {
  constructor() {
    this.root = new THREE.Group();
    this.center = new THREE.Group();
    this.center.position.y = 2.4;
    this.root.add(this.center);

    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffd43b,
      emissiveIntensity: 1.1,
      roughness: 0.1
    });
    this.coreSphere = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 20), coreMat);
    this.center.add(this.coreSphere);

    const cageMat = new THREE.MeshStandardMaterial({
      map: getVoxelTexture('lucky_block'),
      transparent: true,
      opacity: 0.82,
      roughness: 0.3
    });
    this.cage = new THREE.Mesh(new THREE.BoxGeometry(2.15, 2.15, 2.15), cageMat);
    this.center.add(this.cage);

    const wireGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.35, 2.35, 2.35));
    this.wireCage = new THREE.LineSegments(
      wireGeo,
      new THREE.LineBasicMaterial({ color: 0x35e6ff })
    );
    this.center.add(this.wireCage);

    this.orbitRing = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const staff = buildVoxelWeaponMesh('staff');
      staff.scale.setScalar(0.55);
      const angle = (i * Math.PI * 2) / 3;
      staff.position.set(Math.cos(angle) * 2.1, 0, Math.sin(angle) * 2.1);
      staff.rotation.z = 0.4;
      this.orbitRing.add(staff);
    }
    this.center.add(this.orbitRing);
  }

  update(state = {}) {
    const t = state.animTimer || 0;
    this.cage.rotation.x = t * 1.4;
    this.cage.rotation.y = t * 2.1;
    this.wireCage.rotation.x = -t * 1.1;
    this.wireCage.rotation.z = t * 1.6;
    this.orbitRing.rotation.y = -t * 3.2;
  }
}

export function createTurretMesh3D() {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ map: getVoxelTexture('anvil_iron'), roughness: 0.5 });
  const headMat = new THREE.MeshStandardMaterial({ map: getVoxelTexture('command_block'), roughness: 0.4 });
  const redstoneMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });

  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.55, 0.9, 6), baseMat);
  stand.position.y = 0.45;
  const dispenser = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), headMat);
  dispenser.position.y = 1.2;
  dispenser.castShadow = true;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.65, 8), baseMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 1.2, 0.68);
  const torch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.18), redstoneMat);
  torch.position.set(0, 1.9, 0);

  group.add(stand, dispenser, barrel, torch);
  return group;
}

export function createViraBotMesh3D() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a0008,
    emissive: 0xff0033,
    emissiveIntensity: 0.6,
    roughness: 0.3
  });
  const legMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), bodyMat);
  core.position.y = 0.5;
  group.add(core);
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), legMat);
    leg.position.set(Math.cos(angle) * 0.45, 0.28, Math.sin(angle) * 0.45);
    leg.rotation.z = Math.cos(angle) * -0.5;
    leg.rotation.x = Math.sin(angle) * 0.5;
    group.add(leg);
  }
  return group;
}

export class EnderDragonRig3D {
  constructor() {
    this.root = new THREE.Group();
    this.flightGroup = new THREE.Group();
    this.flightGroup.position.y = 3.35;
    this.root.add(this.flightGroup);

    const scaleMat = new THREE.MeshStandardMaterial({
      color: 0x111118,
      roughness: 0.45,
      metalness: 0.2
    });
    const spineMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.5,
      metalness: 0.25
    });
    const wingMembraneMat = new THREE.MeshStandardMaterial({
      color: 0x2e1065,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.35,
      roughness: 0.5,
      side: THREE.DoubleSide
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe879f9 });
    const breathMat = new THREE.MeshBasicMaterial({ color: 0xd946ef });

    // Torso & Dorsal Spine Plates
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.45, 3.6), scaleMat);
    this.torso.castShadow = true;
    this.flightGroup.add(this.torso);

    for (let i = -2; i <= 2; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.42, 0.46), spineMat);
      plate.position.set(0, 0.9, i * 0.65);
      this.flightGroup.add(plate);
    }

    // Neck & Articulated Dragon Head (extending forward along +Z in local space)
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.35, 2.1);
    this.flightGroup.add(this.headPivot);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 1.35), scaleMat);
    neck.position.set(0, 0, -0.35);
    this.headPivot.add(neck);

    const skull = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.05, 1.55), scaleMat);
    skull.position.set(0, 0.18, 0.65);
    skull.castShadow = true;
    const upperSnout = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.48, 1.25), scaleMat);
    upperSnout.position.set(0, 0.08, 1.75);
    const nostrilL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.18), spineMat);
    nostrilL.position.set(-0.28, 0.34, 2.15);
    const nostrilR = nostrilL.clone();
    nostrilR.position.x = 0.28;

    const hornL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.88), spineMat);
    hornL.position.set(-0.42, 0.78, 0.22);
    hornL.rotation.x = 0.38;
    const hornR = hornL.clone();
    hornR.position.x = 0.42;

    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.18), eyeMat);
    eyeL.position.set(-0.66, 0.28, 0.95);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.66;

    this.jaw = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.28, 1.22), scaleMat);
    this.jaw.position.set(0, -0.28, 1.68);
    this.mouthGlow = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), breathMat);
    this.mouthGlow.position.set(0, -0.05, 1.65);
    this.mouthGlow.visible = false;

    this.headPivot.add(skull, upperSnout, nostrilL, nostrilR, hornL, hornR, eyeL, eyeR, this.jaw, this.mouthGlow);

    // Articulated Bat-like Wings (Left & Right)
    const createWing = (side) => {
      const wingRoot = new THREE.Group();
      wingRoot.position.set(side * 1.0, 0.55, 0.4);
      const innerBone = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 0.26), spineMat);
      innerBone.position.set(side * 1.3, 0, 0.6);
      const innerMembrane = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 2.5), wingMembraneMat);
      innerMembrane.position.set(side * 1.3, -0.04, -0.55);

      const outerPivot = new THREE.Group();
      outerPivot.position.set(side * 2.55, 0, 0.6);
      const outerBone = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.22), spineMat);
      outerBone.position.set(side * 1.2, 0, -0.15);
      const outerMembrane = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.07, 2.15), wingMembraneMat);
      outerMembrane.position.set(side * 1.18, -0.04, -0.95);
      outerPivot.add(outerBone, outerMembrane);

      wingRoot.add(innerBone, innerMembrane, outerPivot);
      return { wingRoot, outerPivot };
    };

    this.wingL = createWing(-1);
    this.wingR = createWing(1);
    this.flightGroup.add(this.wingL.wingRoot, this.wingR.wingRoot);

    // Segmented Dragon Tail
    this.tailSegments = [];
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.75 - i * 0.12, 0.65 - i * 0.1, 1.05),
        scaleMat
      );
      seg.position.set(0, 0.05 - i * 0.08, -2.3 - i * 0.98);
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.36), spineMat);
      crest.position.y = 0.4;
      seg.add(crest);
      this.flightGroup.add(seg);
      this.tailSegments.push(seg);
    }
  }

  update(state = {}) {
    const t = state.animTimer || 0;
    const isSwooping = state.actionKind === 'dragon_swoop';
    const isBreathing = state.actionKind === 'dragon_breath';
    const flapSpeed = isSwooping ? 11.0 : 5.2;
    const flap = Math.sin(t * flapSpeed);

    // Wing flap kinematics
    const wingAngle = flap * 0.58;
    const outerAngle = Math.sin(t * flapSpeed - 0.7) * 0.45;
    this.wingL.wingRoot.rotation.z = -wingAngle;
    this.wingL.outerPivot.rotation.z = -outerAngle;
    this.wingR.wingRoot.rotation.z = wingAngle;
    this.wingR.outerPivot.rotation.z = outerAngle;

    // Hover bob or low swoop altitude
    const targetY = isSwooping ? 1.55 : (2.95 + Math.sin(t * 2.6) * 0.35);
    this.flightGroup.position.y += (targetY - this.flightGroup.position.y) * 0.18;
    this.flightGroup.rotation.x = isSwooping ? 0.26 : Math.cos(t * 2.6) * 0.08;

    // Jaw & Dragon's Breath glow
    this.jaw.rotation.x = isBreathing ? 0.48 + Math.sin(t * 16) * 0.1 : (0.12 + Math.max(0, flap) * 0.12);
    this.mouthGlow.visible = Boolean(isBreathing);

    // Whipping tail wave
    for (let i = 0; i < this.tailSegments.length; i++) {
      this.tailSegments[i].position.x = Math.sin(t * 4.5 - i * 0.7) * (0.22 + i * 0.12);
    }
  }
}

export class WardenBossRig3D {
  constructor() {
    this.root = new THREE.Group();

    const sculkTex = getVoxelTexture('sculk', 2, 2);
    sculkTex.isShared = true;
    const sculkMat = new THREE.MeshStandardMaterial({
      map: sculkTex,
      color: 0x0d3344,
      roughness: 0.55,
      metalness: 0.15
    });
    const darkSculkMat = new THREE.MeshStandardMaterial({
      color: 0x05131c,
      roughness: 0.65
    });
    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3c4,
      roughness: 0.45,
      metalness: 0.1
    });
    this.soulHeartMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: new THREE.Color(0x06b6d4),
      emissiveIntensity: 1.15,
      roughness: 0.2
    });
    this.tendrilTipMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: new THREE.Color(0x06b6d4),
      emissiveIntensity: 0.9,
      roughness: 0.25
    });

    // 1. ThickSculk Legs (pivots at hip y = 1.45, bottoms flush at y = 0.0)
    const createLeg = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.62, 1.45, 0);
      const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.45, 0.92), sculkMat);
      legMesh.position.y = -0.725;
      legMesh.castShadow = true;
      const kneeBone = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.28, 0.22), boneMat);
      kneeBone.position.set(0, -0.58, 0.42);
      const toeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.18), this.tendrilTipMat);
      toeGlow.position.set(0, -1.35, 0.44);
      pivot.add(legMesh, kneeBone, toeGlow);
      return pivot;
    };
    this.legL = createLeg(-1);
    this.legR = createLeg(1);
    this.root.add(this.legL, this.legR);

    // 2. Massive Torso, Glowing Cyan Soul Heart & Curved Bone Ribcage
    this.bodyPivot = new THREE.Group();
    this.bodyPivot.position.set(0, 1.45, 0);
    this.root.add(this.bodyPivot);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.85, 1.32), sculkMat);
    torso.position.y = 0.92;
    torso.castShadow = true;
    this.bodyPivot.add(torso);

    // Recessed chest cavity & pulsing Soul Heart
    const cavity = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.1, 0.22), darkSculkMat);
    cavity.position.set(0, 0.95, 0.58);
    this.soulHeart = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.88, 0.24), this.soulHeartMat);
    this.soulHeart.position.set(0, 0.95, 0.62);
    this.bodyPivot.add(cavity, this.soulHeart);

    // Three bone rib pairs framing the Soul Heart
    for (let i = 0; i < 3; i++) {
      const ry = 0.58 + i * 0.36;
      const ribL = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.26), boneMat);
      ribL.position.set(-0.46, ry, 0.68);
      const ribR = ribL.clone();
      ribR.position.x = 0.46;
      this.bodyPivot.add(ribL, ribR);
    }

    // Dorsal bone spine plates on back
    for (let i = 0; i < 3; i++) {
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.28), boneMat);
      spine.position.set(0, 0.55 + i * 0.48, -0.72);
      this.bodyPivot.add(spine);
    }

    // 3. Blind Warden Skull, Roaring Jaw & Vibrating Sculk Tendril Ears
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 1.88, 0.12);
    this.bodyPivot.add(this.headPivot);

    const skull = new THREE.Mesh(new THREE.BoxGeometry(1.78, 1.28, 1.32), sculkMat);
    skull.position.y = 0.64;
    skull.castShadow = true;
    this.headPivot.add(skull);

    // Blind swirling dark face plate (no eyes!)
    const blindHollow = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.64, 0.16), darkSculkMat);
    blindHollow.position.set(0, 0.72, 0.64);
    const browBone = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.18, 0.22), boneMat);
    browBone.position.set(0, 1.08, 0.64);
    this.headPivot.add(blindHollow, browBone);

    this.jaw = new THREE.Group();
    this.jaw.position.set(0, 0.26, 0.48);
    const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.28, 0.52), boneMat);
    const fangL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.18), boneMat);
    fangL.position.set(-0.44, 0.2, 0.16);
    const fangR = fangL.clone();
    fangR.position.x = 0.44;
    this.jaw.add(lowerJaw, fangL, fangR);
    this.headPivot.add(this.jaw);

    // Curved Sculk Sensor Tendril "Ears" (Left & Right)
    const createTendril = (side) => {
      const earPivot = new THREE.Group();
      earPivot.position.set(side * 0.88, 0.96, 0.05);
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.26, 0.24), sculkMat);
      stem.position.set(side * 0.32, 0.12, 0);
      stem.rotation.z = side * 0.35;
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.56, 0.22), this.tendrilTipMat);
      tip.position.set(side * 0.72, 0.46, 0);
      tip.rotation.z = side * 0.22;
      earPivot.add(stem, tip);
      return earPivot;
    };
    this.tendrilL = createTendril(-1);
    this.tendrilR = createTendril(1);
    this.headPivot.add(this.tendrilL, this.tendrilR);

    // 4. Colossal Gorilla-Style Sculk & Bone Arms
    const createArm = (side) => {
      const armPivot = new THREE.Group();
      armPivot.position.set(side * 1.42, 1.62, 0.05);
      const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.52, 0.94), boneMat);
      pauldron.position.set(0, 0.12, 0);
      const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.15, 0.84), sculkMat);
      upperArm.position.set(0, -0.52, 0);
      upperArm.castShadow = true;
      const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.22, 0.94), sculkMat);
      forearm.position.set(0, -1.55, 0.14);
      forearm.castShadow = true;
      const knuckles = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.32, 0.36), boneMat);
      knuckles.position.set(0, -2.05, 0.42);
      const armVein = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.98), this.tendrilTipMat);
      armVein.position.set(0, -1.45, 0.14);
      armPivot.add(pauldron, upperArm, forearm, knuckles, armVein);
      return armPivot;
    };
    this.armL = createArm(-1);
    this.armR = createArm(1);
    this.bodyPivot.add(this.armL, this.armR);

    // 5. 3D Sonic Boom Concentric Rings (projected along +Z forward axis during warden_sonic)
    this.sonicGroup = new THREE.Group();
    this.sonicGroup.position.set(0, 0.95, 1.2);
    this.sonicGroup.visible = false;
    this.sonicRings = [];
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.85
    });
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55 + i * 0.22, 0.09, 8, 20), ringMat);
      ring.position.z = i * 2.4;
      this.sonicGroup.add(ring);
      this.sonicRings.push(ring);
    }
    this.bodyPivot.add(this.sonicGroup);
  }

  update(state = {}) {
    const t = state.animTimer || 0;
    const phase = typeof state.actionPhase === 'number' ? state.actionPhase : 0;
    const action = state.actionKind || '';
    const isSonic = action === 'warden_sonic';
    const isSlam = action === 'warden_slam';
    const isCharge = action === 'warden_charge';
    const isAwakened = Boolean(state.isAwakened);

    // Pulsing Soul Heartbeat (faster in Phase 2 or during Sonic Boom)
    const heartRate = isSonic ? 18.0 : (isAwakened ? 9.5 : 4.8);
    const beat = 0.5 + 0.5 * Math.sin(t * heartRate);
    this.soulHeartMat.emissiveIntensity = (isSonic ? 1.8 : 0.75) + beat * 0.95;
    const heartScale = 0.94 + beat * 0.14;
    this.soulHeart.scale.set(heartScale, heartScale, 1);

    // Tendril ear vibration when sensing sound / roaring
    const earBuzz = (isSonic || isSlam || isCharge) ? Math.sin(t * 28.0) * 0.24 : Math.sin(t * 3.5) * 0.07;
    this.tendrilL.rotation.z = earBuzz;
    this.tendrilR.rotation.z = -earBuzz;
    this.tendrilTipMat.emissiveIntensity = isSonic ? 1.7 : (0.75 + beat * 0.55);

    // Heavy lumbering walk / charge stride
    const strideSpeed = isCharge ? 13.0 : 5.5;
    const stride = (state.pose === 'zombie_walk' || state.pose === 'run' || isCharge)
      ? Math.sin(t * strideSpeed) * (isCharge ? 0.62 : 0.36)
      : Math.sin(t * 2.2) * 0.05;
    this.legL.rotation.x = stride;
    this.legR.rotation.x = -stride;

    // Torso, Jaw & Arm combat choreography
    if (isSonic) {
      // Throw arms wide back to expose chest Soul Heart & fire Sonic Boom!
      this.bodyPivot.rotation.x = -0.16 + phase * 0.24;
      this.armL.rotation.x = 0.65;
      this.armL.rotation.z = 0.48;
      this.armR.rotation.x = 0.65;
      this.armR.rotation.z = -0.48;
      this.jaw.rotation.x = 0.45 + Math.sin(t * 20) * 0.08;
      this.headPivot.rotation.z = Math.sin(t * 14) * 0.08;
    } else if (isSlam) {
      // Raise both colossal arms high overhead, then smash into the deepslate floor!
      const slamArc = phase < 0.45 ? -2.25 * (phase / 0.45) : -2.25 + 3.25 * ((phase - 0.45) / 0.55);
      this.bodyPivot.rotation.x = phase < 0.45 ? -0.18 : 0.42;
      this.armL.rotation.x = slamArc;
      this.armR.rotation.x = slamArc;
      this.armL.rotation.z = 0.12;
      this.armR.rotation.z = -0.12;
      this.jaw.rotation.x = 0.38;
      this.headPivot.rotation.z = 0;
    } else if (isCharge) {
      // Hunched bull-rush charge
      this.bodyPivot.rotation.x = 0.36;
      this.armL.rotation.x = -0.85 - stride * 0.55;
      this.armR.rotation.x = -0.85 + stride * 0.55;
      this.armL.rotation.z = 0.1;
      this.armR.rotation.z = -0.1;
      this.jaw.rotation.x = 0.32;
      this.headPivot.rotation.z = Math.sin(t * 10) * 0.1;
    } else {
      // Blind sniffing stalk / idle
      this.bodyPivot.rotation.x = 0.12 + Math.sin(t * 2.4) * 0.04;
      this.armL.rotation.x = -stride * 0.85 - 0.18;
      this.armR.rotation.x = stride * 0.85 - 0.18;
      this.armL.rotation.z = 0.08;
      this.armR.rotation.z = -0.08;
      this.jaw.rotation.x = 0.08 + Math.max(0, Math.sin(t * 3.0)) * 0.12;
      this.headPivot.rotation.z = Math.sin(t * 2.1) * 0.11;
    }

    // Animate 3D Sonic Boom expanding wave rings
    this.sonicGroup.visible = isSonic && phase > 0.25;
    if (this.sonicGroup.visible) {
      const waveProg = Math.max(0, (phase - 0.25) / 0.75);
      for (let i = 0; i < this.sonicRings.length; i++) {
        const ring = this.sonicRings[i];
        ring.position.z = 1.0 + i * 3.1 + waveProg * 5.5;
        const sc = 0.85 + waveProg * 0.65 + i * 0.12;
        ring.scale.set(sc, sc, 1);
      }
    }
  }
}


