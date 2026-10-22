import * as THREE from '../lib/three.module.min.js';
import { StickFigureRenderer } from '../../js/entities/stickman.js?v=9.8';
import { getVoxelTexture } from './textures3d.js';

const LINE_RADIUS = 0.052;
const BONE_SCALE = 1 / 30; // Maps 2D bone units (-62..0) to ~2.1 units tall in 3D

const SHARED_GEOS = {
  segment: new THREE.CylinderGeometry(LINE_RADIUS, LINE_RADIUS, 1.0, 12),
  solidHead: new THREE.SphereGeometry(0.35, 18, 16),
  hollowHead: new THREE.TorusGeometry(0.34, 0.058, 14, 32),
  eye: new THREE.SphereGeometry(0.05, 8, 8)
};

const POSE_HELPER = new StickFigureRenderer('#ff7700', 5, 1.0, true);
const UP_VEC = new THREE.Vector3(0, 1, 0);
const TEMP_A = new THREE.Vector3();
const TEMP_B = new THREE.Vector3();
const TEMP_DIR = new THREE.Vector3();

function setCylinderBetween(mesh, x1, y1, z1, x2, y2, z2) {
  TEMP_A.set(x1, y1, z1);
  TEMP_B.set(x2, y2, z2);
  TEMP_DIR.subVectors(TEMP_B, TEMP_A);
  const len = TEMP_DIR.length();
  if (len < 0.0001) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  mesh.position.copy(TEMP_A).addScaledVector(TEMP_DIR, 0.5);
  // Slight endpoint overlap (LINE_RADIUS * 0.85) closes angled bends without joint spheres
  mesh.scale.set(1, len + LINE_RADIUS * 0.85, 1);
  mesh.quaternion.setFromUnitVectors(UP_VEC, TEMP_DIR.normalize());
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

    this.root = new THREE.Group();
    this.root.scale.setScalar(scale);

    this.material = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.32,
      metalness: 0.08,
      emissive: this.color.clone().multiplyScalar(isZombie ? 0.18 : 0.32),
      emissiveIntensity: 1.0
    });

    // Simple, joint-free stick figure segments (9 narrow line segments + head)
    const makeSeg = () => {
      const m = new THREE.Mesh(SHARED_GEOS.segment, this.material);
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
      this.weaponMeshR = null;
    }
    if (this.weaponMeshL) {
      this.handL.remove(this.weaponMeshL);
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

    this.auraMesh.visible = Boolean(isAwakened);
    if (isAwakened) {
      this.auraMesh.rotation.y = animTimer * 4;
    }
    if (this.glitchShards) {
      this.glitchShards.rotation.y = animTimer * 5;
    }
    if (this.boomCore) {
      this.boomCore.scale.setScalar(1 + Math.sin(animTimer * 16) * 0.14);
    }

    const target = this.computeNaturalPoseAngles(pose, animTimer, isGrounded, isHurt, actionKind, actionPhase);
    if (!this.poseAngles || pose === 'roll') {
      this.poseAngles = { ...target };
    } else {
      const isAttack = pose.startsWith('attack') || pose === 'weapon_slash' || pose === 'dive_kick';
      const rate = isAttack ? 28 : 18;
      const alpha = Math.min(1, 1 - Math.exp(-rate * Math.max(0.004, Math.min(0.05, dt))));
      for (const k of Object.keys(target)) {
        this.poseAngles[k] += (target[k] - this.poseAngles[k]) * alpha;
      }
    }

    const a = this.poseAngles;
    const SPINE_LEN = 0.80;
    const THIGH_LEN = 0.49;
    const SHIN_LEN = 0.49;
    const UARM_LEN = 0.41;
    const FARM_LEN = 0.39;
    const HEAD_RADIUS = 0.34;
    const zSep = 0.022;

    // Compute leg positions relative to hip = (0, 0, hipZ) first so we can plant the stance foot on the floor
    const hipZ = a.hipZ;
    const relKneeLY = -Math.cos(a.thighL) * THIGH_LEN;
    const relKneeLZ = hipZ + Math.sin(a.thighL) * THIGH_LEN;
    const shinAngleL = a.thighL - a.kneeL; // Knee always bends backward (kneeL >= 0)
    const relFootLY = relKneeLY - Math.cos(shinAngleL) * SHIN_LEN;
    const relFootLZ = relKneeLZ + Math.sin(shinAngleL) * SHIN_LEN;

    const relKneeRY = -Math.cos(a.thighR) * THIGH_LEN;
    const relKneeRZ = hipZ + Math.sin(a.thighR) * THIGH_LEN;
    const shinAngleR = a.thighR - a.kneeR;
    const relFootRY = relKneeRY - Math.cos(shinAngleR) * SHIN_LEN;
    const relFootRZ = relKneeRZ + Math.sin(shinAngleR) * SHIN_LEN;

    const minRelFootY = Math.min(relFootLY, relFootRY);
    const hipY = (pose === 'roll')
      ? 0.72
      : Math.max(0.28, -minRelFootY + 0.03 + a.liftY);

    const kLY = hipY + relKneeLY, kLZ = relKneeLZ;
    const fLY = hipY + relFootLY, fLZ = relFootLZ;
    const kRY = hipY + relKneeRY, kRZ = relKneeRZ;
    const fRY = hipY + relFootRY, fRZ = relFootRZ;

    // 1. Spine: from hip (0, hipY, hipZ) up to neck (0, neckY, neckZ)
    const neckY = hipY + Math.cos(a.torsoLean) * SPINE_LEN;
    const neckZ = hipZ + Math.sin(a.torsoLean) * SPINE_LEN;
    setCylinderBetween(this.spineSeg, 0, hipY, hipZ, 0, neckY, neckZ);
    this.chest.position.set(0, (hipY + neckY) * 0.55, (hipZ + neckZ) * 0.55);

    // 2. Head: bottom of head connects directly to the neck (0, neckY, neckZ)
    const headAngle = a.torsoLean * 0.65 + a.headTilt;
    const headCenterDist = HEAD_RADIUS + 0.02;
    this.headGroup.position.set(
      0,
      neckY + Math.cos(headAngle) * headCenterDist,
      neckZ + Math.sin(headAngle) * headCenterDist
    );

    // 3. Legs: both thighs ALWAYS start at the hip (0, hipY, hipZ)
    setCylinderBetween(this.thighLSeg, 0, hipY, hipZ, -zSep, kLY, kLZ);
    setCylinderBetween(this.shinLSeg, -zSep, kLY, kLZ, -zSep * 1.4, fLY, fLZ);

    setCylinderBetween(this.thighRSeg, 0, hipY, hipZ, zSep, kRY, kRZ);
    setCylinderBetween(this.shinRSeg, zSep, kRY, kRZ, zSep * 1.4, fRY, fRZ);

    // 4. Arms: both upper arms ALWAYS start from the exact neck point (0, neckY, neckZ)
    const eLY = neckY - Math.cos(a.uArmL) * UARM_LEN;
    const eLZ = neckZ + Math.sin(a.uArmL) * UARM_LEN;
    const fAngleL = a.uArmL + a.elbowL; // Elbow always bends forward (elbowL >= 0)
    const hLY = eLY - Math.cos(fAngleL) * FARM_LEN;
    const hLZ = eLZ + Math.sin(fAngleL) * FARM_LEN;
    setCylinderBetween(this.uArmLSeg, 0, neckY, neckZ, -zSep * 1.4, eLY, eLZ);
    setCylinderBetween(this.fArmLSeg, -zSep * 1.4, eLY, eLZ, -zSep * 2.0, hLY, hLZ);

    const eRY = neckY - Math.cos(a.uArmR) * UARM_LEN;
    const eRZ = neckZ + Math.sin(a.uArmR) * UARM_LEN;
    const fAngleR = a.uArmR + a.elbowR;
    const hRY = eRY - Math.cos(fAngleR) * FARM_LEN;
    const hRZ = eRZ + Math.sin(fAngleR) * FARM_LEN;
    setCylinderBetween(this.uArmRSeg, 0, neckY, neckZ, zSep * 1.4, eRY, eRZ);
    setCylinderBetween(this.fArmRSeg, zSep * 1.4, eRY, eRZ, zSep * 2.0, hRY, hRZ);

    // 5. Hand Weapon Mounts follow the hand position and forearm angle naturally
    this.handL.position.set(-zSep * 2.0, hLY, hLZ);
    this.handR.position.set(zSep * 2.0, hRY, hRZ);

    let weaponPitch = fAngleR * 0.65 + 0.15;
    if (pose === 'weapon_slash') {
      weaponPitch = -0.95 + (actionPhase || 0.5) * 2.45;
    } else if (pose.startsWith('attack')) {
      weaponPitch = fAngleR * 0.75 + 0.35;
    }
    this.handR.rotation.set(weaponPitch, 0, 0);
    this.handL.rotation.set(fAngleL * 0.65 + 0.15, 0, 0);
  }

  computeNaturalPoseAngles(pose, timer, isGrounded, isHurt, actionKind, actionPhase) {
    const p = Math.max(0, Math.min(1, Number(actionPhase) || 0));
    const swing = Math.sin(p * Math.PI); // 0 -> 1 -> 0 strike arc
    const drive = p < 0.45 ? (p / 0.45) : 1 - (p - 0.45) * 0.35; // fast windup to full extension

    const out = {
      torsoLean: this.isHunched ? 0.28 : 0.06,
      headTilt: 0.0,
      hipZ: 0.0,
      liftY: 0.0,
      thighL: -0.16,
      kneeL: 0.14,
      thighR: 0.20,
      kneeR: 0.18,
      uArmL: -0.18,
      elbowL: 0.68,
      uArmR: 0.24,
      elbowR: 0.88
    };

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
        out.kneeL = 0.22 + Math.max(0, c * 0.65 + 0.35) * 0.58;
        out.thighR = -s * 0.54 + 0.04;
        out.kneeR = 0.22 + Math.max(0, -c * 0.65 + 0.35) * 0.58;
        out.uArmL = 0.92 - s * 0.24;
        out.elbowL = 0.40 + Math.max(0, s) * 0.22;
        out.uArmR = 0.84 + s * 0.24;
        out.elbowR = 0.46 + Math.max(0, -s) * 0.22;
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
        out.kneeL = 0.14 + Math.max(0, -b) * 0.05;
        out.thighR = 0.20 - b2 * 0.02;
        out.kneeR = 0.18 + Math.max(0, b) * 0.05;
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
        out.liftY = Math.max(0, Math.sin(t * 2 - 0.5) * 0.065);
        // Natural sprint cycle: knee flexes during forward swing-through and extends on push-off
        out.thighL = s * 0.78 + 0.08;
        out.kneeL = 0.14 + Math.max(0, c * 0.72 + 0.28) * 0.82;
        out.thighR = -s * 0.78 + 0.08;
        out.kneeR = 0.14 + Math.max(0, -c * 0.72 + 0.28) * 0.82;
        // Opposite arm pump starting from the neck with bent elbows
        out.uArmL = -s * 0.68 - 0.06;
        out.elbowL = 1.02 + Math.max(0, -s) * 0.42;
        out.uArmR = s * 0.68 - 0.06;
        out.elbowR = 1.02 + Math.max(0, s) * 0.42;
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
        const spin = Math.sin(timer * 18);
        out.torsoLean = 0.08;
        out.liftY = 0.18;
        out.thighL = spin * 1.35;
        out.kneeL = 0.18;
        out.thighR = -spin * 1.15;
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
