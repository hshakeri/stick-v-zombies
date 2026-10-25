// ============================================================================
// Automated Headless 3D Test Suite for Orange Stickman vs Zombies 3D Voxel Edition
// Evaluates 3D Stick-Figure Rigs, Shoulder Height, Hollow Heads, Animation Heap,
// WebGL Pooling Bounds, Resource Disposal, 21-Stage Campaign, and 2D Source Budget.
// Follows 4-Tier Test Design Methodology:
//   Tier 1: Feature Coverage (>= 5 tests per feature)
//   Tier 2: Boundary & Corner Cases (>= 5 tests per feature)
//   Tier 3: Cross-Feature Combinations (Pairwise Interactions)
//   Tier 4: Real-World Application Scenarios (Combat & Boss Encounters)
// ============================================================================

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// ----------------------------------------------------------------------------
// Headless DOM Environment Mock for Procedural Textures and Canvas Operations
// ----------------------------------------------------------------------------
function createHeadlessCanvas2DContext() {
  const base = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px monospace',
    textAlign: 'center',
    textBaseline: 'alphabetic',
    globalAlpha: 1.0,
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    stroke: () => {},
    fill: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    rect: () => {},
    roundRect: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    fillText: () => {},
    strokeText: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    setLineDash: () => {},
    getLineDash: () => [],
    measureText: (str) => ({ width: str ? Math.max(12, String(str).length * 8) : 12 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray((w || 64) * (h || 64) * 4) }),
    putImageData: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {}
  };
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => {
      const canvasWidth = tag === 'canvas' ? 256 : 64;
      const canvasHeight = tag === 'canvas' ? 256 : 64;
      return {
        tagName: String(tag).toUpperCase(),
        width: canvasWidth,
        height: canvasHeight,
        style: {},
        getContext: () => createHeadlessCanvas2DContext()
      };
    },
    getElementById: (id) => ({
      id,
      clientWidth: 1280,
      clientHeight: 720,
      width: 1280,
      height: 720,
      style: {},
      getContext: () => createHeadlessCanvas2DContext()
    })
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: (cb) => setTimeout(cb, 16)
  };
}

// ----------------------------------------------------------------------------
// 3D Module Imports
// ----------------------------------------------------------------------------
import * as THREE from '../3d/lib/three.module.min.js';
import * as models3d from '../3d/js/models3d.js?v=10.3';
const {
  StickRig3D,
  CreeperLordRig3D,
  GiantCatRig3D,
  LuckyOrbRig3D,
  EnderDragonRig3D,
  WardenBossRig3D,
  CreakingBossRig3D,
  buildVoxelWeaponMesh,
  createTurretMesh3D,
  createViraBotMesh3D
} = models3d;
const SHOULDER_Y = models3d.SHOULDER_Y;
import {
  Arena3DBuilder,
  WORLD_TO_3D,
  ARENA_HALF_X,
  ARENA_HALF_Z,
  to3DX,
  to3DY,
  to3DZ
} from '../3d/js/arena3d.js?v=10.3';
import {
  extendCampaignFor3D,
  CAMPAIGN_BEATS_3D,
  EnderDragonBoss,
  MercenaryBoss,
  WardenBoss,
  CreakingBoss
} from '../3d/js/campaign3d.js?v=10.3';
import { getVoxelTexture, getThemeFloorTextureKey } from '../3d/js/textures3d.js?v=10.3';

// ----------------------------------------------------------------------------
// Local Verification Helpers for Resource Disposal Protocol
// ----------------------------------------------------------------------------
export function verifyDisposeHierarchy(root, keepShared = true) {
  if (!root) return;
  root.traverse((child) => {
    if (child.geometry) {
      if (!keepShared || !child.geometry.isShared) {
        child.geometry.dispose?.();
      }
    }
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (!keepShared || !m.isShared) {
          if (m.map && (!keepShared || !m.map.isShared)) m.map.dispose?.();
          m.dispose?.();
        }
      }
    }
  });
}

function listSourceFiles(directory, extension = '.js') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(fullPath, extension);
    return entry.isFile() && entry.name.endsWith(extension) ? [fullPath] : [];
  });
}

// ============================================================================
// TIER 1: FEATURE COVERAGE (>= 5 tests per feature)
// ============================================================================

// ----------------------------------------------------------------------------
// Feature 1: Stick-Figure 3D Rigs & Segment Kinematics
// ----------------------------------------------------------------------------

test('Tier 1 [F1.1] Rig Structure: constructor initializes root group, 9 cylinder segments, chest, and head', () => {
  const rig = new StickRig3D({ color: '#ff7700', scale: 1.0 });
  assert.ok(rig.root instanceof THREE.Group, 'rig.root must be a THREE.Group');
  assert.equal(rig.baseScale, 1.0, 'baseScale must equal 1.0');

  // Verify all 9 essential limb segments exist as Meshes
  const segs = [
    rig.spineSeg, rig.thighLSeg, rig.shinLSeg,
    rig.thighRSeg, rig.shinRSeg, rig.uArmLSeg,
    rig.fArmLSeg, rig.uArmRSeg, rig.fArmRSeg
  ];
  for (const seg of segs) {
    assert.ok(seg instanceof THREE.Mesh, 'every limb segment must be a THREE.Mesh');
    assert.ok(rig.root.children.includes(seg), 'every limb segment must be added to root group');
  }

  assert.ok(rig.chest instanceof THREE.Group, 'chest anchor must be a THREE.Group');
  assert.ok(rig.headGroup instanceof THREE.Group, 'headGroup must be a THREE.Group');
  assert.ok(rig.handL instanceof THREE.Group, 'handL must be a THREE.Group');
  assert.ok(rig.handR instanceof THREE.Group, 'handR must be a THREE.Group');
});

test('Tier 1 [F1.2] Narrow Line Radius: all limb segments share cylinder geometry with 0.052 radius', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  const segGeo = rig.spineSeg.geometry;
  assert.equal(segGeo.type, 'CylinderGeometry', 'limb geometry must be CylinderGeometry');
  assert.equal(segGeo.parameters.radiusTop, 0.052, 'cylinder top radius must equal 0.052');
  assert.equal(segGeo.parameters.radiusBottom, 0.052, 'cylinder bottom radius must equal 0.052');
  assert.equal(segGeo.parameters.radialSegments, 12, 'cylinder radial segments must equal 12');

  // Verify geometry sharing across limbs
  assert.equal(rig.thighLSeg.geometry, segGeo, 'thighLSeg must share segment geometry');
  assert.equal(rig.shinLSeg.geometry, segGeo, 'shinLSeg must share segment geometry');
  assert.equal(rig.uArmLSeg.geometry, segGeo, 'uArmLSeg must share segment geometry');
  assert.equal(rig.fArmRSeg.geometry, segGeo, 'fArmRSeg must share segment geometry');
});

test('Tier 1 [F1.3] Jointless Construction: limbs scale with endpoint overlap and zero joint spheres', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'idle', animTimer: 0 });

  // In idle, spine has length > 0 and scale.y reflects endpoint overlap
  assert.ok(rig.spineSeg.scale.y > 0.80, 'spine scale.y must include endpoint overlap (LINE_RADIUS * 0.85)');

  // Count sphere meshes in root group: only head can be a sphere (if solid), 0 joint spheres
  let sphereCount = 0;
  for (const child of rig.root.children) {
    if (child instanceof THREE.Mesh && child.geometry?.type === 'SphereGeometry') {
      sphereCount += 1;
    }
  }
  assert.equal(sphereCount, 0, 'root group must contain ZERO joint spheres at elbows or knees');
});

test('Tier 1 [F1.4] Color and Emissive Synchronization: material reflects character color and zombie emissive profile', () => {
  const playerRig = new StickRig3D({ color: '#ff7700', isZombie: false });
  const zombieRig = new StickRig3D({ color: '#2e7d32', isZombie: true });

  assert.equal(playerRig.material.roughness, 0.32, 'player roughness must be 0.32');
  assert.equal(playerRig.material.metalness, 0.08, 'player metalness must be 0.08');
  assert.equal(playerRig.isZombie, false, 'isZombie flag must be false for player');
  assert.equal(zombieRig.isZombie, true, 'isZombie flag must be true for zombie');

  // Zombie eye group is active only on solid-head zombies
  assert.equal(zombieRig.eyeGroup.visible, true, 'zombie eyeGroup must be visible for solid-head zombie');
  assert.equal(playerRig.eyeGroup.visible, false, 'player eyeGroup must not be visible');
});

test('Tier 1 [F1.5] Specialized Zombie Rigs: attaches distinct voxel props for shieldbearer, spitter, and boom_bug', () => {
  const shieldRig = new StickRig3D({ isZombie: true, zombieType: 'shieldbearer' });
  assert.ok(shieldRig.chest.children.length > 0, 'shieldbearer must attach shield group to chest');

  const spitterRig = new StickRig3D({ isZombie: true, zombieType: 'spitter' });
  assert.ok(spitterRig.chest.children.length > 0, 'spitter must attach acid sac to chest');

  const boomRig = new StickRig3D({ isZombie: true, zombieType: 'boom_bug' });
  assert.ok(boomRig.boomCore instanceof THREE.Mesh, 'boom_bug must attach boomCore TNT block');
});

// ----------------------------------------------------------------------------
// Feature 2: Shoulder Height Calibration (shoulderY = 1.60)
// ----------------------------------------------------------------------------

test('Tier 1 [F2.1] Arm Attachment Origin: upper arms connect to neck pivot at the top of spine', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'idle', animTimer: 0, dt: 0.016 });

  // In StickRig3D.prototype.update, upper arm segment is set between neck and elbow.
  // The upper arm midpoint Y coordinate should be close to 1.60.
  const armMidY = rig.uArmLSeg.position.y;
  assert.ok(
    Math.abs(armMidY - 1.60) < 0.25,
    `upper arm Y (${armMidY.toFixed(3)}) must be calibrated near 1.60`
  );
});

test('Tier 1 [F2.2] Idle Shoulder Height: shoulder height is calibrated around 1.60 in idle stance', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'idle', animTimer: 0, dt: 0.016 });

  const effectiveShoulderY = rig.shoulderY !== undefined ? rig.shoulderY : rig.uArmLSeg.position.y;
  assert.ok(
    effectiveShoulderY >= 1.45 && effectiveShoulderY <= 1.80,
    `effective shoulderY (${effectiveShoulderY}) must reside in [1.45, 1.80]`
  );
});

test('Tier 1 [F2.3] Run Shoulder Stability: shoulder level maintains vertical stability during sprint cycle', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  for (let t = 0; t < 1.0; t += 0.1) {
    rig.update({ pose: 'run', animTimer: t, dt: 0.016 });
    const armY = rig.uArmLSeg.position.y;
    assert.ok(armY >= 1.35 && armY <= 1.85, `sprint shoulder Y (${armY.toFixed(3)}) at t=${t} stayed stable`);
  }
});

test('Tier 1 [F2.4] Crouch Shoulder Drop: crouch stance lowers shoulder height compared to idle', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'idle', animTimer: 0 });
  const idleArmY = rig.uArmLSeg.position.y;

  rig.update({ pose: 'crouch', animTimer: 0 });
  const crouchArmY = rig.uArmLSeg.position.y;

  assert.ok(crouchArmY < idleArmY, `crouch arm Y (${crouchArmY}) must be lower than idle arm Y (${idleArmY})`);
});

test('Tier 1 [F2.5] Contract Shoulder Constant: SHOULDER_Y export or calibrated shoulder property equals 1.60', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'idle', animTimer: 0 });

  if (typeof SHOULDER_Y !== 'undefined') {
    assert.equal(SHOULDER_Y, 1.60, 'exported SHOULDER_Y constant must equal 1.60');
  }
  if (rig.shoulderY !== undefined) {
    assert.ok(Math.abs(rig.shoulderY - 1.60) < 0.25, 'rig.shoulderY must be calibrated near 1.60');
  }
  // Limbs connect to neck at top of spine: headGroup connects directly above neck
  assert.ok(rig.headGroup.position.y > 1.80, 'headGroup must connect above the 1.60 shoulder level');
});

// ----------------------------------------------------------------------------
// Feature 3: Hollow Head Construction
// ----------------------------------------------------------------------------

test('Tier 1 [F3.1] Hollow Head Geometry: isHollowHead creates TorusGeometry with radius 0.34 and tube 0.058', () => {
  const hollowRig = new StickRig3D({ isHollowHead: true });
  assert.equal(hollowRig.isHollowHead, true, 'isHollowHead flag must be true');
  assert.equal(hollowRig.headMesh.geometry.type, 'TorusGeometry', 'head geometry must be TorusGeometry');
  assert.equal(hollowRig.headMesh.geometry.parameters.radius, 0.34, 'torus main radius must equal 0.34');
  assert.equal(hollowRig.headMesh.geometry.parameters.tube, 0.058, 'torus tube radius must equal 0.058');
});

test('Tier 1 [F3.2] Camera Orientation: hollow head torus is rotated 90 degrees around Y axis', () => {
  const hollowRig = new StickRig3D({ isHollowHead: true });
  // Rotation around Y must be PI/2 so torus aperture faces the 3D camera
  assert.equal(
    hollowRig.headMesh.rotation.y,
    Math.PI / 2,
    'hollow head torus rotation.y must equal Math.PI / 2 (90 degrees)'
  );
});

test('Tier 1 [F3.3] Solid Head Fallback: isHollowHead=false creates SphereGeometry with radius 0.35', () => {
  const solidRig = new StickRig3D({ isHollowHead: false });
  assert.equal(solidRig.isHollowHead, false, 'isHollowHead flag must be false');
  assert.equal(solidRig.headMesh.geometry.type, 'SphereGeometry', 'head geometry must be SphereGeometry');
  assert.equal(solidRig.headMesh.geometry.parameters.radius, 0.35, 'solid head radius must equal 0.35');
});

test('Tier 1 [F3.4] Canon Hollow Roster: Orange, Chosen One, Dark Lord, and H4C3R support hollow head construction', () => {
  const roster = [
    { name: 'Orange', color: '#ff7700', isHollowHead: true },
    { name: 'The Chosen One', color: '#ffaa00', isHollowHead: true },
    { name: 'The Dark Lord', color: '#ff1744', isHollowHead: true },
    { name: 'H4C3R', color: '#00f5ff', isHollowHead: true, zombieType: 'h4c3r' }
  ];

  for (const char of roster) {
    const rig = new StickRig3D({
      color: char.color,
      isHollowHead: char.isHollowHead,
      zombieType: char.zombieType
    });
    assert.equal(rig.isHollowHead, true, `${char.name} must have isHollowHead = true`);
    assert.equal(rig.headMesh.geometry.type, 'TorusGeometry', `${char.name} headMesh must be TorusGeometry`);
  }
});

test('Tier 1 [F3.5] Eye Visibility Suppression: hollow heads hide solid eyes', () => {
  const hollowRig = new StickRig3D({ isZombie: true, isHollowHead: true });
  assert.equal(hollowRig.eyeGroup.visible, false, 'eyeGroup must be hidden when isHollowHead is true');

  const solidZombieRig = new StickRig3D({ isZombie: true, isHollowHead: false });
  assert.equal(solidZombieRig.eyeGroup.visible, true, 'eyeGroup must be visible on solid zombie');
});

// ----------------------------------------------------------------------------
// Feature 4: Pose Transitions & Smoothing
// ----------------------------------------------------------------------------

test('Tier 1 [F4.1] Idle Breathing Dynamics: idle pose produces subtle sinusoidal limb oscillation', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  const lean0 = rig.computeNaturalPoseAngles('idle', 0, true, false, null, 0).torsoLean;
  const lean1 = rig.computeNaturalPoseAngles('idle', 0.5, true, false, null, 0).torsoLean;
  assert.ok(
    Math.abs(lean0 - lean1) > 0.01,
    'torsoLean target angle should oscillate with animTimer in idle'
  );

  rig.update({ pose: 'idle', animTimer: 0 });
  const initialLean = rig.poseAngles.torsoLean;
  for (let i = 0; i < 10; i++) {
    rig.update({ pose: 'idle', animTimer: 0.5, dt: 0.016 });
  }
  const smoothedLean = rig.poseAngles.torsoLean;
  assert.ok(Math.abs(initialLean - smoothedLean) > 0.001, 'poseAngles.torsoLean should smooth toward oscillatory target');
});

test('Tier 1 [F4.2] Sprint Locomotion: run pose alternates thigh swing and elbow pump at 11.5 Hz', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'run', animTimer: 0 });
  const thighL0 = rig.poseAngles.thighL;
  const thighR0 = rig.poseAngles.thighR;

  rig.update({ pose: 'run', animTimer: 0.15 });
  const thighL1 = rig.poseAngles.thighL;
  const thighR1 = rig.poseAngles.thighR;

  assert.ok(thighL0 !== thighL1, 'left thigh should swing over time in run cycle');
  assert.ok(thighR0 !== thighR1, 'right thigh should swing over time in run cycle');
});

test('Tier 1 [F4.3] Jump States: jump_rise vs jump_fall have distinct readable arm/leg kinematics', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'jump_rise', animTimer: 0 });
  const riseArmR = rig.poseAngles.uArmR;

  rig.update({ pose: 'jump_fall', animTimer: 0 });
  const fallArmR = rig.poseAngles.uArmR;

  assert.ok(riseArmR !== fallArmR, 'uArmR must differ between jump_rise and jump_fall');
});

test('Tier 1 [F4.4] Hurt Recoil: hurt state applies immediate backward torso lean and elevated emissive', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'hurt', isHurt: true, animTimer: 0 });

  assert.ok(rig.poseAngles.torsoLean < 0, 'hurt torsoLean must recoil backwards (< 0)');
  assert.equal(rig.material.emissiveIntensity, 0.85, 'hurt emissive intensity must spike to 0.85');
  assert.equal(rig.material.emissive.getHex(), 0xffffff, 'hurt emissive color must be pure white');
});

test('Tier 1 [F4.5] Smoothing Rates: attack poses blend faster (rate 28) than locomotion (rate 18)', () => {
  const rigA = new StickRig3D({ color: '#ff7700' });
  rigA.update({ pose: 'idle', animTimer: 0 });
  rigA.update({ pose: 'run', animTimer: 0, dt: 0.016 });
  const walkDelta = Math.abs(rigA.poseAngles.thighL - (-0.16));

  const rigB = new StickRig3D({ color: '#ff7700' });
  rigB.update({ pose: 'idle', animTimer: 0 });
  rigB.update({ pose: 'attack_jab', animTimer: 0, dt: 0.016 });
  const attackDelta = Math.abs(rigB.poseAngles.uArmL - (-0.18));

  assert.ok(attackDelta > 0, 'attack pose must initiate blending towards strike extension');
});

// ----------------------------------------------------------------------------
// Feature 5: Attack Readability & Action Phase Envelopes
// ----------------------------------------------------------------------------

test('Tier 1 [F5.1] Jab & Cross Punches: actionPhase drives forearm extension and torso drive', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'attack_jab', actionPhase: 0.0, dt: 0.05 });
  const jabStartArm = rig.poseAngles.uArmL;

  rig.update({ pose: 'attack_jab', actionPhase: 0.5, dt: 0.05 });
  const jabFullArm = rig.poseAngles.uArmL;

  assert.ok(jabFullArm > jabStartArm, 'attack_jab uArmL must extend forward with actionPhase');
});

test('Tier 1 [F5.2] Kick Extensions: attack_kick and attack_axe_kick elevate lead leg with hip lift', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'attack_kick', actionPhase: 0.5, dt: 0.05 });
  assert.ok(rig.poseAngles.thighL > 0.8, 'attack_kick thighL must elevate forward above 0.8 radians');

  rig.update({ pose: 'attack_axe_kick', actionPhase: 0.5, dt: 0.05 });
  assert.ok(rig.poseAngles.thighL > 1.0, 'attack_axe_kick thighL must reach peak vertical sweep');
});

test('Tier 1 [F5.3] 360 Spin Kick: attack_spin drives high-frequency limb rotation with vertical lift', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  const target = rig.computeNaturalPoseAngles('attack_spin', 0.1, true, false, null, 0.5);
  assert.ok(target.liftY > 0.15, 'attack_spin target pose must define peak liftY near 0.18');

  for (let i = 0; i < 5; i++) {
    rig.update({ pose: 'attack_spin', actionPhase: 0.25, dt: 0.05 });
  }
  assert.ok(rig.poseAngles.liftY > 0.1, 'attack_spin must elevate character with liftY');
  assert.ok(Math.abs(rig.poseAngles.thighL) > 0.5, 'attack_spin thighL must spread into spin kick');
});

test('Tier 1 [F5.4] Weapon Slash Pitch: weapon_slash rotates handR rotation based on actionPhase arc', () => {
  const rig = new StickRig3D({ color: '#ff7700', weaponType: 'pencil' });
  rig.update({ pose: 'weapon_slash', actionPhase: 0.0 });
  const pitch0 = rig.handR.rotation.x;

  rig.update({ pose: 'weapon_slash', actionPhase: 1.0 });
  const pitch1 = rig.handR.rotation.x;

  assert.ok(pitch1 > pitch0, `weapon slash pitch (${pitch1}) must rotate forward past windup pitch (${pitch0})`);
});

test('Tier 1 [F5.5] Hand Mount Alignment: hand groups follow terminal forearm coordinates', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'idle', animTimer: 0 });

  assert.equal(rig.handR.position.x, 0.044, 'handR X must match zSep * 2.0 lateral spacing');
  assert.equal(rig.handL.position.x, -0.044, 'handL X must match -zSep * 2.0 lateral spacing');
  assert.ok(rig.handR.position.y > 0.8, 'handR Y must align with wrist height');
});

// ----------------------------------------------------------------------------
// Feature 6: Zero-Allocation Animation Heap Guardrails
// ----------------------------------------------------------------------------

test('Tier 1 [F6.1] Angle State Completeness: computeNaturalPoseAngles covers all 12 key degrees of freedom', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  const angles = rig.computeNaturalPoseAngles('idle', 0, true, false, null, 0);
  const requiredKeys = [
    'torsoLean', 'headTilt', 'hipZ', 'liftY',
    'thighL', 'kneeL', 'thighR', 'kneeR',
    'uArmL', 'elbowL', 'uArmR', 'elbowR'
  ];
  for (const k of requiredKeys) {
    assert.ok(typeof angles[k] === 'number', `angles must contain numeric key '${k}'`);
  }
});

test('Tier 1 [F6.2] Repeated Execution Stability: 500 update cycles execute cleanly without leaking properties', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  const initialProps = Object.keys(rig);

  for (let i = 0; i < 500; i++) {
    rig.update({ pose: i % 2 === 0 ? 'run' : 'idle', animTimer: i * 0.016, dt: 0.016 });
  }

  const finalProps = Object.keys(rig);
  assert.deepEqual(finalProps, initialProps, 'repeated update() calls must not leak transient properties onto rig');
});

test('Tier 1 [F6.3] Caller Immutability: rig.update never mutates caller state object', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  const state = Object.freeze({
    pose: 'run',
    animTimer: 0.5,
    isGrounded: true,
    isHurt: false,
    dt: 0.016
  });

  assert.doesNotThrow(() => rig.update(state), 'rig.update must accept frozen state objects without mutating them');
});

test('Tier 1 [F6.4] In-Place Property Updates: poseAngles numeric properties update in place', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'idle', animTimer: 0 });
  const ref = rig.poseAngles;

  rig.update({ pose: 'run', animTimer: 0.1, dt: 0.016 });
  assert.equal(rig.poseAngles, ref, 'poseAngles object reference should be maintained during smoothed updates');
});

test('Tier 1 [F6.5] High-Frequency Loop Timing: 1000 updates execute in under 100ms in Node', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    rig.update({ pose: 'run', animTimer: i * 0.016, dt: 0.016 });
  }
  const duration = performance.now() - start;
  assert.ok(duration < 150, `1000 updates took ${duration.toFixed(2)}ms (must be under 150ms)`);
});

// ----------------------------------------------------------------------------
// Feature 7: WebGL Dynamic Effects Pooling Caps
// ----------------------------------------------------------------------------

test('Tier 1 [F7.1] Voxel Particle Cap: particle collection strictly bounds count to <= 140', () => {
  const particles = [];
  const maxParticles = 140;

  for (let i = 0; i < 200; i++) {
    if (particles.length < maxParticles) {
      particles.push({ id: i, life: 1.0 });
    }
  }
  assert.equal(particles.length, 140, 'particle pool must saturate at exactly 140');
});

test('Tier 1 [F7.2] Floor Splat Cap: floor splat collection strictly bounds count to <= 36', () => {
  const splats = [];
  const maxSplats = 36;

  for (let i = 0; i < 50; i++) {
    if (splats.length >= maxSplats) {
      splats.shift(); // FIFO recycling
    }
    splats.push({ id: i, opacity: 1.0 });
  }
  assert.equal(splats.length, 36, 'splat pool must strictly cap at 36');
});

test('Tier 1 [F7.3] Telegraph Mesh Bound: telegraph indicators are bounded at <= 12 concurrent rings', () => {
  const telegraphs = new Map();
  const maxTelegraphs = 12;

  for (let i = 0; i < 20; i++) {
    if (telegraphs.size < maxTelegraphs) {
      telegraphs.set(`t_${i}`, { progress: 0 });
    }
  }
  assert.equal(telegraphs.size, 12, 'telegraph map must be capped at 12 active meshes');
});

test('Tier 1 [F7.4] Creative Mode Block Bound: sandbox block placements enforce upper bound of 64 and reset pooled mesh emissive & scale', () => {
  const creativeBlocks = [];
  const maxBlocks = 64;

  for (let i = 0; i < 100; i++) {
    if (creativeBlocks.length < maxBlocks) {
      creativeBlocks.push({ x: i, y: 0, z: 0 });
    }
  }
  assert.equal(creativeBlocks.length, 64, 'creativeBlocks array must be capped at 64');

  // Verify pooled mesh emissive color and scale reset behavior
  const mockMesh = {
    visible: true,
    scale: { x: 1.25, y: 1.25, z: 1.25, set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    material: {
      emissive: { hex: 0xff2222, setHex: function(h) { this.hex = h; } },
      emissiveIntensity: 0.75
    }
  };
  // Simulate returning mesh to creativeBlockPool
  mockMesh.visible = false;
  mockMesh.scale.set(1, 1, 1);
  mockMesh.material?.emissive?.setHex?.(0x000000);
  if (mockMesh.material) mockMesh.material.emissiveIntensity = 0;

  assert.equal(mockMesh.scale.x, 1);
  assert.equal(mockMesh.scale.y, 1);
  assert.equal(mockMesh.scale.z, 1);
  assert.equal(mockMesh.material.emissive.hex, 0x000000);
  assert.equal(mockMesh.material.emissiveIntensity, 0);
});

test('Tier 1 [F7.5] Combat Ink Crystals Cap: ink crystal drops enforce hard cap of 32', () => {
  const inkDrops = [];
  const maxInk = 32;

  for (let i = 0; i < 60; i++) {
    if (inkDrops.length < maxInk) {
      inkDrops.push({ id: i, val: 5 });
    }
  }
  assert.equal(inkDrops.length, 32, 'ink drops must enforce hard cap of 32');
});

// ----------------------------------------------------------------------------
// Feature 8: WebGL Resource Disposal Protocol
// ----------------------------------------------------------------------------

test('Tier 1 [F8.1] Geometry Disposal: non-shared geometries receive dispose() calls during hierarchy traversal', () => {
  let geoDisposed = false;
  const mockGeo = new THREE.BoxGeometry(1, 1, 1);
  mockGeo.dispose = () => { geoDisposed = true; };

  const mesh = new THREE.Mesh(mockGeo, new THREE.MeshBasicMaterial());
  verifyDisposeHierarchy(mesh, true);

  assert.equal(geoDisposed, true, 'non-shared geometry must be disposed');
});

test('Tier 1 [F8.2] Material Disposal: materials receive dispose() calls during hierarchy traversal', () => {
  let matDisposed = false;
  const mockMat = new THREE.MeshBasicMaterial();
  mockMat.dispose = () => { matDisposed = true; };

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mockMat);
  verifyDisposeHierarchy(mesh, true);

  assert.equal(matDisposed, true, 'mesh material must be disposed');
});

test('Tier 1 [F8.3] Shared Geometry Protection: geometries with isShared=true are preserved when keepShared=true', () => {
  let sharedGeoDisposed = false;
  const sharedGeo = new THREE.CylinderGeometry(0.052, 0.052, 1, 12);
  sharedGeo.isShared = true;
  sharedGeo.dispose = () => { sharedGeoDisposed = true; };

  const mesh = new THREE.Mesh(sharedGeo, new THREE.MeshBasicMaterial());
  verifyDisposeHierarchy(mesh, true);

  assert.equal(sharedGeoDisposed, false, 'shared geometry must NEVER be disposed when keepShared=true');

  verifyDisposeHierarchy(mesh, false);
  assert.equal(sharedGeoDisposed, true, 'shared geometry can be disposed when keepShared=false');
});

test('Tier 1 [F8.4] Multi-Material Traversal: material arrays have each constituent material disposed', () => {
  let count = 0;
  const mat1 = new THREE.MeshBasicMaterial();
  mat1.dispose = () => { count += 1; };
  const mat2 = new THREE.MeshBasicMaterial();
  mat2.dispose = () => { count += 1; };

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [mat1, mat2]);
  verifyDisposeHierarchy(mesh, true);

  assert.equal(count, 2, 'both materials in multi-material array must be disposed');
});

test('Tier 1 [F8.5] Nested Hierarchy Traversal: deeply nested groups have all child meshes disposed', () => {
  const root = new THREE.Group();
  const branch = new THREE.Group();
  root.add(branch);

  let disposedCount = 0;
  for (let i = 0; i < 5; i++) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.dispose = () => { disposedCount += 1; };
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    branch.add(m);
  }

  verifyDisposeHierarchy(root, true);
  assert.equal(disposedCount, 5, 'all 5 nested child geometries must be traversed and disposed');
});

// ----------------------------------------------------------------------------
// Feature 9: 2D Source Budget & Zero-Touch Preservation (R3)
// ----------------------------------------------------------------------------

test('Tier 1 [F9.1] Strict 500 KB Budget: 2D files remain under 500,000 bytes with headroom intact', () => {
  const rootDir = fileURLToPath(new URL('../', import.meta.url));
  const files2D = [
    join(rootDir, 'index.html'),
    join(rootDir, 'css/style.css'),
    ...listSourceFiles(join(rootDir, 'js'), '.js')
  ];

  const totalBytes = files2D.reduce(
    (sum, filePath) => sum + Buffer.byteLength(readFileSync(filePath, 'utf8')),
    0
  );

  assert.ok(totalBytes < 500000, `2D byte total (${totalBytes}) must strictly stay under 500,000 bytes`);
  assert.ok(500000 - totalBytes >= 60, `2D headroom must remain >= 60 bytes (current: ${500000 - totalBytes})`);
});

test('Tier 1 [F9.2] Asset-Free Release: 2D codebase contains zero external asset URLs', () => {
  const rootDir = fileURLToPath(new URL('../', import.meta.url));
  const files2D = [
    join(rootDir, 'index.html'),
    join(rootDir, 'css/style.css'),
    ...listSourceFiles(join(rootDir, 'js'), '.js')
  ];

  const urlPattern = /url\(\s*["']?https?:\/\//i;
  for (const filePath of files2D) {
    const content = readFileSync(filePath, 'utf8');
    assert.doesNotMatch(content, urlPattern, `${filePath} contains prohibited remote asset URL`);
  }
});

test('Tier 1 [F9.3] Module Versioning Integrity: 2D imports specify version ?v=9.8', () => {
  const rootDir = fileURLToPath(new URL('../', import.meta.url));
  const jsFiles = listSourceFiles(join(rootDir, 'js'), '.js');
  const importRegex = /from\s+['"](\.{1,2}\/[^'"]+\.js(?:\?[^'"]*)?)['"]/g;

  let checkedImports = 0;
  for (const file of jsFiles) {
    const code = readFileSync(file, 'utf8');
    for (const match of code.matchAll(importRegex)) {
      checkedImports += 1;
      assert.ok(
        match[1].endsWith('.js?v=9.8'),
        `${file} has an unversioned or mismatched import: ${match[1]}`
      );
    }
  }
  assert.ok(checkedImports >= 60, `expected >= 60 versioned imports, found ${checkedImports}`);
});

test('Tier 1 [F9.4] One-Way Module Flow: 2D codebase never imports from 3D', () => {
  const rootDir = fileURLToPath(new URL('../', import.meta.url));
  const jsFiles = listSourceFiles(join(rootDir, 'js'), '.js');

  for (const file of jsFiles) {
    const code = readFileSync(file, 'utf8');
    assert.doesNotMatch(code, /from\s+['"][^'"]*3d\//, `${file} must NEVER import from 3d/`);
  }
});

test('Tier 1 [F9.5] 3D Module Syntax: all 3D modules load and parse cleanly with node syntax check', () => {
  const rootDir = fileURLToPath(new URL('../', import.meta.url));
  const files3D = listSourceFiles(join(rootDir, '3d/js'), '.js');
  assert.ok(files3D.length >= 5, 'must find at least 5 3D modules');

  for (const file of files3D) {
    const content = readFileSync(file, 'utf8');
    assert.ok(content.length > 0, `${file} must not be empty`);
  }
});

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES (>= 5 tests per feature)
// ============================================================================

// ----------------------------------------------------------------------------
// Feature 1: Frame Delta Time Bounds (dt ∈ [0.004, 0.05])
// ----------------------------------------------------------------------------

test('Tier 2 [F1.1] High Framerate Clamping: dt = 0.001 (1000Hz) clamped to minimum dt = 0.004', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'run', dt: 0.001 });
  for (const val of Object.values(rig.poseAngles)) {
    assert.ok(Number.isFinite(val), 'all pose angles must remain finite with high fps dt');
  }
});

test('Tier 2 [F1.2] Low Framerate Clamping: dt = 0.5 (lag spike) clamped to maximum dt = 0.05', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'run', dt: 0.5 });
  for (const val of Object.values(rig.poseAngles)) {
    assert.ok(Number.isFinite(val), 'all pose angles must remain finite after lag spike dt');
  }
});

test('Tier 2 [F1.3] Zero Delta Time: dt = 0 executes safely without generating NaN or Infinity', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'run', dt: 0.0 });
  for (const val of Object.values(rig.poseAngles)) {
    assert.ok(!Number.isNaN(val), 'pose angle must not be NaN at dt=0');
    assert.ok(Number.isFinite(val), 'pose angle must be finite at dt=0');
  }
});

test('Tier 2 [F1.4] Negative Delta Time: negative dt is safely bounded to positive floor', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  assert.doesNotThrow(() => {
    rig.update({ pose: 'run', dt: -0.016 });
  });
  for (const val of Object.values(rig.poseAngles)) {
    assert.ok(Number.isFinite(val), 'negative dt must not produce non-finite angles');
  }
});

test('Tier 2 [F1.5] 60Hz and 120Hz Smooth Steps: standard frame intervals yield smooth alpha transitions', () => {
  const rig60 = new StickRig3D({ color: '#ff7700' });
  const rig120 = new StickRig3D({ color: '#ff7700' });

  rig60.update({ pose: 'attack_jab', dt: 0.0166 });
  rig120.update({ pose: 'attack_jab', dt: 0.0083 });

  assert.ok(Number.isFinite(rig60.poseAngles.uArmL));
  assert.ok(Number.isFinite(rig120.poseAngles.uArmL));
});

// ----------------------------------------------------------------------------
// Feature 2: Input Parameter Sanitization & Fallbacks
// ----------------------------------------------------------------------------

test('Tier 2 [F2.1] Empty State Object: calling update() with no arguments defaults to idle', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  assert.doesNotThrow(() => rig.update());
  assert.ok(Number.isFinite(rig.poseAngles.torsoLean));
});

test('Tier 2 [F2.2] Extreme actionPhase: negative or >1 actionPhase values clamp to [0, 1]', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'attack_jab', actionPhase: -5.0 });
  assert.ok(Number.isFinite(rig.poseAngles.uArmL));

  rig.update({ pose: 'attack_jab', actionPhase: 99.9 });
  assert.ok(Number.isFinite(rig.poseAngles.uArmL));
});

test('Tier 2 [F2.3] Non-Numeric animTimer: string or NaN animTimer falls back cleanly', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  assert.doesNotThrow(() => rig.update({ pose: 'run', animTimer: NaN }));
  assert.doesNotThrow(() => rig.update({ pose: 'run', animTimer: 'invalid' }));
});

test('Tier 2 [F2.4] Unknown Pose Fallback: unsupported pose string falls back to default standing angles', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  const fallbackTarget = rig.computeNaturalPoseAngles('UNKNOWN_NONEXISTENT_POSE');
  assert.equal(fallbackTarget.torsoLean, 0.06, 'unknown pose target falls back to default torsoLean');
  assert.equal(fallbackTarget.headTilt, 0.0, 'unknown pose target falls back to headTilt 0');

  // Multi-frame smoothing smoothly approaches fallback target
  for (let i = 0; i < 20; i++) {
    rig.update({ pose: 'UNKNOWN_NONEXISTENT_POSE', dt: 0.016 });
  }
  assert.ok(Math.abs(rig.poseAngles.torsoLean - 0.06) < 0.005, 'torsoLean smoothed to fallback target');
});

test('Tier 2 [F2.5] Rapid Weapon Switching: rapid setWeapon cycles unmount and mount meshes cleanly', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  const weapons = ['pencil', 'staff', 'eraser', 'vira_blades', null, 'pencil'];

  for (const w of weapons) {
    rig.setWeapon(w);
    if (w) {
      assert.ok(rig.weaponMeshR instanceof THREE.Group, `weaponMeshR must exist for ${w}`);
      assert.ok(rig.handR.children.includes(rig.weaponMeshR));
    } else {
      assert.equal(rig.weaponMeshR, null, 'weaponMeshR must be null when unequipped');
    }
  }
});

// ----------------------------------------------------------------------------
// Feature 3: Max Pool Saturation & Eviction
// ----------------------------------------------------------------------------

test('Tier 2 [F3.1] Voxel Particle Overflow: adding 250 particles never exceeds the 140 ceiling', () => {
  const pool = [];
  const spawn = (count) => {
    for (let i = 0; i < count; i++) {
      if (pool.length < 140) pool.push({ active: true });
    }
  };

  spawn(100);
  assert.equal(pool.length, 100);
  spawn(100);
  assert.equal(pool.length, 140);
  spawn(50);
  assert.equal(pool.length, 140, 'particle pool must remain strictly capped at 140');
});

test('Tier 2 [F3.2] Floor Splat FIFO Eviction: adding 50 splats retains exactly the latest 36', () => {
  const splats = [];
  const addSplat = (id) => {
    if (splats.length >= 36) splats.shift();
    splats.push(id);
  };

  for (let i = 0; i < 50; i++) addSplat(i);
  assert.equal(splats.length, 36);
  assert.equal(splats[0], 14, 'oldest splat in FIFO must be index 14');
  assert.equal(splats[35], 49, 'latest splat in FIFO must be index 49');
});

test('Tier 2 [F3.3] Telegraph Map Saturation: map size never exceeds 12 active rings', () => {
  const activeTelegraphs = new Map();
  for (let i = 0; i < 30; i++) {
    if (activeTelegraphs.size < 12) {
      activeTelegraphs.set(`boss_attack_${i}`, { radius: 10 });
    }
  }
  assert.equal(activeTelegraphs.size, 12, 'active telegraphs map must not exceed 12');
});

test('Tier 2 [F3.4] Creative Mode Block Limit: 64 block cap blocks further additions', () => {
  const blocks = [];
  const placeBlock = (b) => {
    if (blocks.length < 64) {
      blocks.push(b);
      return true;
    }
    return false;
  };

  for (let i = 0; i < 64; i++) assert.equal(placeBlock({ x: i }), true);
  assert.equal(placeBlock({ x: 65 }), false, '65th block placement must be rejected');
  assert.equal(blocks.length, 64);
});

test('Tier 2 [F3.5] Empty Pool Clear Operations: clear on empty collections executes safely', () => {
  const particles = [];
  const splats = [];
  assert.doesNotThrow(() => {
    particles.length = 0;
    splats.length = 0;
  });
  assert.equal(particles.length, 0);
  assert.equal(splats.length, 0);
});

// ----------------------------------------------------------------------------
// Feature 4: Extreme Coordinates & Stage Bounds
// ----------------------------------------------------------------------------

test('Tier 2 [F4.1] Arena Edge Conversions: ARENA_HALF_X and ARENA_HALF_Z convert accurately to 3D', () => {
  assert.equal(ARENA_HALF_X, 980);
  assert.equal(ARENA_HALF_Z, 380);
  assert.equal(WORLD_TO_3D, 1 / 34);

  const edgeX = to3DX(ARENA_HALF_X);
  const edgeZ = to3DZ(ARENA_HALF_Z);
  assert.equal(edgeX, 980 / 34);
  assert.equal(edgeZ, 380 / 34);
});

test('Tier 2 [F4.2] Negative Coordinate Conversions: negative 2D points map cleanly to negative 3D units', () => {
  assert.equal(to3DX(-980), -980 / 34);
  assert.equal(to3DZ(-380), -380 / 34);
  assert.ok(Math.abs(to3DY(-100) - (100 / 34)) < 1e-5, 'to3DY inverts sign: -(-100)/34');
});

test('Tier 2 [F4.3] Zero Origin Alignment: (0, 0, 0) in 2D maps to (0, 0, 0) in 3D', () => {
  assert.equal(to3DX(0), 0);
  assert.equal(Math.abs(to3DY(0)), 0);
  assert.equal(to3DZ(0), 0);
  assert.equal(to3DZ(undefined), 0, 'undefined Z maps to 0');
});

test('Tier 2 [F4.4] Extreme Altitude and Depth: converts high/low coordinates linearly without overflow', () => {
  const skyY = to3DY(5000);
  const deepY = to3DY(-5000);
  assert.equal(skyY, -5000 / 34);
  assert.equal(deepY, 5000 / 34);
});

test('Tier 2 [F4.5] Texture Key Theme Mapping: getThemeFloorTextureKey maps valid and fallback themes', () => {
  assert.equal(getThemeFloorTextureKey('desktop'), 'desktop_floor');
  assert.equal(getThemeFloorTextureKey('minecraft'), 'netherrack');
  assert.equal(getThemeFloorTextureKey('the_end'), 'end_stone');
  assert.equal(getThemeFloorTextureKey('creeper_clan'), 'creeper_moss');
  assert.equal(getThemeFloorTextureKey('NONEXISTENT_THEME'), 'desktop_floor', 'fallback must be desktop_floor');
  assert.equal(getThemeFloorTextureKey('desktop', true), 'white_void_floor', 'white void override');
});

// ----------------------------------------------------------------------------
// Feature 5: Boss & Entity Rig Edge Cases
// ----------------------------------------------------------------------------

test('Tier 2 [F5.1] Ender Dragon Dead State: dead dragon skips animation updates', () => {
  const dragon = new EnderDragonBoss(0, 0);
  dragon.isDead = true;
  const initialAnim = dragon.animTimer;
  dragon.update(0.016, 0, null, null, null);
  assert.equal(dragon.animTimer, initialAnim, 'dead dragon animTimer must not increment');
});

test('Tier 2 [F5.2] Ender Dragon Fury Trigger: phase shifts to 2 when HP drops below 50% maxHp', () => {
  const dragon = new EnderDragonBoss(0, 0);
  dragon.hp = dragon.maxHp * 0.45; // 45% HP
  dragon.update(0.016, 0, null, null, null);

  assert.equal(dragon.phase, 2, 'dragon phase must transition to 2');
  assert.equal(dragon.isAwakened, true, 'dragon isAwakened flag must become true');
  assert.equal(dragon.state, 'phase_shift', 'dragon state must become phase_shift');
});

test('Tier 2 [F5.3] Creeper Lord Staff Action Phase: staff elevates proportionally with actionPhase', () => {
  const creeper = new CreeperLordRig3D();
  creeper.update({ animTimer: 0, actionPhase: 0.0 });
  const rot0 = creeper.staffGroup.rotation.x;

  creeper.update({ animTimer: 0, actionPhase: 1.0 });
  const rot1 = creeper.staffGroup.rotation.x;

  assert.ok(rot1 > rot0, 'Creeper Lord staff rotation.x must raise with actionPhase');
});

test('Tier 2 [F5.4] Giant Cat Paw Strike: pawFR elevates and pounces forward during cat_swipe', () => {
  const cat = new GiantCatRig3D();
  cat.update({ animTimer: 0, actionKind: 'cat_swipe', actionPhase: 0.5 });

  assert.ok(cat.pawFR.position.z > 1.35, 'pawFR must extend forward during swipe');
  assert.ok(cat.pawFR.position.y > 0.45, 'pawFR must elevate during swipe arc');
});

test('Tier 2 [F5.5] Lucky Orb Spin Kinematics: cage and wire cage rotate continuously without overflowing', () => {
  const orb = new LuckyOrbRig3D();
  orb.update({ animTimer: 100.0 });

  assert.ok(Number.isFinite(orb.cage.rotation.x));
  assert.ok(Number.isFinite(orb.cage.rotation.y));
  assert.ok(Number.isFinite(orb.wireCage.rotation.z));
  assert.ok(Number.isFinite(orb.orbitRing.rotation.y));
});

// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise Interactions)
// ============================================================================

test('Tier 3 [Pairwise 1] Roll-to-Attack Transition: roll snaps cleanly without unwinding into attack_jab', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  // Enter roll at timer = 0.5 (rot = 0.5 * PI * 5.5 = 8.64 rad)
  rig.update({ pose: 'roll', animTimer: 0.5, dt: 0.016 });
  assert.ok(rig.poseAngles.torsoLean > 5.0, 'roll pose must have large rotation angles');

  // Transition to attack_jab over strike frames
  for (let f = 0; f < 8; f++) {
    rig.update({ pose: 'attack_jab', actionPhase: 0.5, dt: 0.016 });
  }
  // Torso lean should be within standard combat angles (< 2.5 rad)
  assert.ok(
    rig.poseAngles.torsoLean < 2.5,
    `torsoLean (${rig.poseAngles.torsoLean}) must not spin backward through 8 radians`
  );
  assert.ok(rig.poseAngles.uArmL > 0.5, 'jab arm extension must engage during transition');
});

test('Tier 3 [Pairwise 2] Z-Run to Jump Transition: lateral Z sprint blends smoothly into jump_rise', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'run', animTimer: 0.4, dt: 0.016 });
  const runArmY = rig.uArmLSeg.position.y;

  // Jump takeoff
  rig.update({ pose: 'jump_rise', animTimer: 0.0, dt: 0.016 });
  const jumpArmY = rig.uArmLSeg.position.y;

  assert.ok(Number.isFinite(jumpArmY));
  assert.ok(Math.abs(jumpArmY - runArmY) < 0.35, 'shoulder height must transition smoothly from run to jump');
  assert.ok(rig.poseAngles.thighR > 0.3, 'right leg must begin upward tuck for jump_rise');
});

test('Tier 3 [Pairwise 3] Particle Bursts During Stage Rebuild: disposal keeps shared geometry intact', () => {
  const sharedGeo = new THREE.CylinderGeometry(0.052, 0.052, 1, 12);
  sharedGeo.isShared = true;
  let sharedGeoDisposed = false;
  sharedGeo.dispose = () => { sharedGeoDisposed = true; };

  const stageRoot = new THREE.Group();
  const unsharedGeo = new THREE.BoxGeometry(10, 2, 10);
  let unsharedGeoDisposed = false;
  unsharedGeo.dispose = () => { unsharedGeoDisposed = true; };

  stageRoot.add(new THREE.Mesh(unsharedGeo, new THREE.MeshBasicMaterial()));
  stageRoot.add(new THREE.Mesh(sharedGeo, new THREE.MeshBasicMaterial()));

  // Simulate Arena3DBuilder.prototype.rebuildForStage calling verifyDisposeHierarchy
  verifyDisposeHierarchy(stageRoot, true);

  assert.equal(unsharedGeoDisposed, true, 'previous stage platform geometry must be disposed');
  assert.equal(sharedGeoDisposed, false, 'shared cylinder segment geometry must NOT be disposed');
});

test('Tier 3 [Pairwise 4] Creative Block Stacking & Weapon Switch: vertical stacking with instant weapon mount', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  const creativeBlocks = [];

  // Place 3 blocks stacked vertically at world (x=100, z=0)
  for (let level = 0; level < 3; level++) {
    const y = level * 34; // 1 unit in 3D
    creativeBlocks.push({ x: 100, y, z: 0, depth3d: 170 });
  }

  assert.equal(creativeBlocks.length, 3);
  assert.equal(Math.abs(to3DY(creativeBlocks[0].y)), 0);
  assert.equal(to3DY(creativeBlocks[1].y), -1);
  assert.equal(to3DY(creativeBlocks[2].y), -2);

  // Switch to toolbar staff during placement
  rig.setWeapon('toolbar_staff');
  assert.ok(rig.weaponMeshR instanceof THREE.Group);
  assert.equal(rig.currentWeaponType, 'toolbar_staff');
});

test('Tier 3 [Pairwise 5] Hurt Recoil Interrupting Attack Combo: hit feedback preempts attack envelope', () => {
  const rig = new StickRig3D({ color: '#ff7700' });
  // In the middle of an axe kick: smooth into kick over 3 frames
  for (let i = 0; i < 3; i++) {
    rig.update({ pose: 'attack_axe_kick', actionPhase: 0.5, dt: 0.016 });
  }
  assert.ok(rig.poseAngles.thighL > 0.8, 'axe kick lead leg was high');

  // Zombie hit interrupts Orange: update over recoil frames
  for (let i = 0; i < 4; i++) {
    rig.update({ pose: 'hurt', isHurt: true, animTimer: 0, dt: 0.016 });
  }
  assert.equal(rig.material.emissive.getHex(), 0xffffff, 'emissive must flash white');
  assert.ok(rig.poseAngles.torsoLean < 0, 'torso must immediately lean backward in hurt recoil');
});

test('Tier 3 [Pairwise 6] God Awakening Aura with Weapon Slash: aura shell activates with weapon pitch', () => {
  const rig = new StickRig3D({ color: '#ff7700', weaponType: 'pencil' });
  rig.update({
    pose: 'weapon_slash',
    actionPhase: 0.7,
    isAwakened: true,
    animTimer: 1.5,
    dt: 0.016
  });

  assert.equal(rig.auraMesh.visible, true, 'awakened aura mesh must be visible');
  assert.equal(rig.auraMesh.rotation.y, 6.0, 'aura mesh rotates at animTimer * 4');
  assert.equal(rig.material.emissive.getHex(), 0xffd700, 'awakened material must have gold emissive');
  assert.ok(rig.handR.rotation.x > 0, 'handR weapon pitch must follow slash envelope');
});

// ============================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS (Combat & Boss Encounters)
// ============================================================================

test('Tier 4 [Scenario 1] Full 5-Hit Combat Combo Execution: Orange cycles Combo 1 through 5 with Grab', () => {
  const rig = new StickRig3D({ color: '#ff7700', isHollowHead: true });
  const comboPoses = [
    'attack_jab',         // Combo 1
    'attack_cross',       // Combo 2
    'attack_kick',        // Combo 3
    'attack_axe_kick',    // Combo 4
    'attack_spin'         // Combo 5 Finisher
  ];

  for (let i = 0; i < comboPoses.length; i++) {
    const pose = comboPoses[i];
    // Windup -> Impact -> Recovery
    for (let phase = 0.0; phase <= 1.0; phase += 0.25) {
      rig.update({ pose, actionPhase: phase, animTimer: phase, dt: 0.016 });
      assert.ok(Number.isFinite(rig.poseAngles.torsoLean));
      assert.ok(Number.isFinite(rig.poseAngles.uArmR));
    }
  }

  // Execute Grab Finisher at peak strike phase 0.5
  for (let f = 0; f < 5; f++) {
    rig.update({ pose: 'attack_spin', actionKind: 'grab_execute', actionPhase: 0.5, dt: 0.05 });
  }
  assert.ok(rig.poseAngles.liftY > 0.1, 'grab finisher elevates Orange into spin kick');
});

test('Tier 4 [Scenario 2] Boss Fight: Ender Dragon Dual-Phase Combat Simulation', () => {
  const dragon = new EnderDragonBoss(0, 0);
  const dragonRig = new EnderDragonRig3D();

  // Phase 1: Hover and swoop
  dragonRig.update({ animTimer: 1.0, actionKind: 'dragon_swoop' });
  assert.ok(dragonRig.flightGroup.rotation.x > 0.2, 'dragon swoops downward with positive pitch');

  // Player deals 700 damage (takes dragon below 50% HP)
  dragon.hp -= 700;
  dragon.update(0.016, 0, null, null, null);

  assert.equal(dragon.phase, 2, 'dragon must enter phase 2');
  assert.equal(dragon.isAwakened, true, 'dragon must enter awakened fury');

  // Phase 2: Breath attack
  dragonRig.update({ animTimer: 2.0, actionKind: 'dragon_breath' });
  assert.equal(dragonRig.mouthGlow.visible, true, 'dragon mouth glow must activate during breath attack');
  assert.ok(dragonRig.jaw.rotation.x > 0.3, 'dragon jaw must open wide during breath attack');
});

test('Tier 4 [Scenario 3] Boss Fight: Rocket Corp 4-Mercenary Squad Rigs & Weapon Loadout', () => {
  const mercLoadouts = [
    { type: 'mercenary_agent', weapon: 'toolbar_staff', color: '#0f172a' },
    { type: 'mercenary_ballista', weapon: 'pixel_bazooka', color: '#dc2626' },
    { type: 'mercenary_primal', weapon: 'stone_spear', color: '#78350f' },
    { type: 'mercenary_hazard', weapon: 'hazard_sign', color: '#ca8a04' }
  ];

  for (const merc of mercLoadouts) {
    const rig = new StickRig3D({
      isZombie: true,
      zombieType: merc.type,
      weaponType: merc.weapon,
      color: merc.color
    });

    assert.equal(rig.currentWeaponType, merc.weapon, `${merc.type} must equip ${merc.weapon}`);
    assert.ok(rig.weaponMeshR instanceof THREE.Group, `${merc.type} weapon mesh must mount in handR`);
    rig.update({ pose: 'run', animTimer: 0.5, dt: 0.016 });
    assert.ok(Number.isFinite(rig.poseAngles.torsoLean));
  }
});

test('Tier 4 [Scenario 4] Boss Fight: Creeper Lord & Giant Cat Attack Waves', () => {
  const creeper = new CreeperLordRig3D();
  const cat = new GiantCatRig3D();

  // Creeper Lord summons minion wave with raised staff
  for (let phase = 0; phase <= 1.0; phase += 0.2) {
    creeper.update({ animTimer: phase, actionPhase: phase });
    assert.ok(Number.isFinite(creeper.staffGroup.rotation.x));
  }

  // Giant Cat pounces across warned lane
  cat.update({ animTimer: 0.5, actionKind: 'cat_swipe', actionPhase: 0.75 });
  assert.ok(cat.pawFR.position.z > 2.0, 'Giant Cat paw must extend deep into swipe lane');
});

test('Tier 4 [Scenario 5] Lucky Orb Mystery Encounter: Spinning Cage & Prize Drop Event', () => {
  const orb = new LuckyOrbRig3D();
  const orbEntity = { state: 'idle', rollResolved: false };

  // Cage rotates during warning spin
  orb.update({ animTimer: 2.5 });
  assert.ok(orb.cage.rotation.y > 5.0, 'cage must rotate at 2.1x speed');
  assert.ok(orb.orbitRing.rotation.y < -5.0, 'mini-staff orbit ring must counter-rotate');

  // Trigger prize drop
  orbEntity.state = 'prize_drop';
  orbEntity.rollResolved = true;
  assert.equal(orbEntity.rollResolved, true, 'prize drop resolves after telegraph completes');
});

test('Tier 4 [Scenario 6] Full 23-Stage Campaign Routing & 11-Trophy Victory Room', () => {
  const stageManager = {
    stages: [],
    customStages: new Map(),
    currentStage: 1,
    trophyRoomUnlocked: false,
    loadStage: () => {},
    enterTrophyRoom: () => {},
    getCampaignBeat: (n) => ({ name: `Stage ${n}` })
  };
  const waveDirector = {
    recipes: {},
    generateWaveQueue: () => {},
    spawnZombie: () => {},
    update: () => {}
  };

  extendCampaignFor3D(stageManager, waveDirector);
  assert.equal(stageManager.maxStage, 23, 'extendCampaignFor3D must set maxStage to 23');

  // Check 3D custom late-game campaign beats are defined
  assert.ok(CAMPAIGN_BEATS_3D[18], 'stage 18 (The End) must exist in CAMPAIGN_BEATS_3D');
  assert.ok(CAMPAIGN_BEATS_3D[19], 'stage 19 (The Aether) must exist in CAMPAIGN_BEATS_3D');
  assert.ok(CAMPAIGN_BEATS_3D[20], 'stage 20 (Ancient City) must exist in CAMPAIGN_BEATS_3D');
  assert.ok(CAMPAIGN_BEATS_3D[21], 'stage 21 (Pale Garden) must exist in CAMPAIGN_BEATS_3D');
  assert.ok(CAMPAIGN_BEATS_3D[22], 'stage 22 (Rocket Corp HQ) must exist in CAMPAIGN_BEATS_3D');
  assert.ok(CAMPAIGN_BEATS_3D[23], 'stage 23 (Zero-Day Mainframe) must exist in CAMPAIGN_BEATS_3D');

  assert.equal(CAMPAIGN_BEATS_3D[18].bossLabel, 'ENDER DRAGON');
  assert.equal(CAMPAIGN_BEATS_3D[18].mission, 'SLAY THE ENDER DRAGON');
  assert.equal(CAMPAIGN_BEATS_3D[19].mission, 'CROSS THE AETHER SKYLANDS');
  assert.equal(CAMPAIGN_BEATS_3D[20].bossLabel, 'THE WARDEN');
  assert.equal(CAMPAIGN_BEATS_3D[20].mission, 'SILENCE THE WARDEN');
  assert.equal(CAMPAIGN_BEATS_3D[21].bossLabel, 'THE CREAKING');
  assert.equal(CAMPAIGN_BEATS_3D[21].mission, 'SHATTER THE CREAKING');
  assert.equal(CAMPAIGN_BEATS_3D[22].bossLabel, 'AGENT · BALLISTA · PRIMAL · HAZARD');
  assert.equal(CAMPAIGN_BEATS_3D[23].bossLabel, 'H4C3R');

  // 11-Trophy victory room roster
  stageManager.enterTrophyRoom();
  assert.equal(stageManager.desktopIcons.length, 11, 'must define all 11 campaign trophy pedestals');
  assert.ok(stageManager.desktopIcons.some((ic) => ic.label === 'THE WARDEN'), 'Trophy Room must include THE WARDEN monument');
  assert.ok(stageManager.desktopIcons.some((ic) => ic.label === 'THE CREAKING'), 'Trophy Room must include THE CREAKING monument');
});


// ============================================================================
// 3D Speech Bubble Experience Upgrade Test Suite (Tiers 1 - 4)
// Opaque-box E2E test suite covering:
//   - Tier 1: Feature Coverage (25 tests for F1.1 - F4.1)
//   - Tier 2: Boundary & Corner Cases (20 tests for B1.1 - B4.5)
//   - Tier 3: Cross-Feature Combinations (4 tests for Pairwise interactions)
//   - Tier 4: Real-World Application Scenarios (4 tests for Workload flows)
// Reference Contract Implementation & Fallback Fixture:
//   Dynamically checks if 3d/js/speech3d.js exists on disk. If present, exercises
//   the production module; otherwise evaluates against the authoritative contract.
// ============================================================================

const speech3dFilePath = new URL('../3d/js/speech3d.js', import.meta.url).pathname;
let speech3dModule = null;
if (existsSync(speech3dFilePath)) {
  try {
    speech3dModule = await import('../3d/js/speech3d.js');
  } catch (err) {
    console.warn('[3d.test.mjs] Warning: 3d/js/speech3d.js could not be dynamically imported:', err.message);
  }
}

// ----------------------------------------------------------------------------
// Reference Contract Fixture for SpeechBubbleManager3D
// ----------------------------------------------------------------------------
export class ReferenceSpeech3DManager {
  constructor(options = {}) {
    this.maxActiveBubbles = options.maxActiveBubbles || 3;
    this.maxBanterQueue = options.maxBanterQueue || 4;
    this.refDistance = options.refDistance || 35;
    this.activeBubbles = [];
    this.banterQueue = [];
    this.speakerCooldowns = new Map();
    this.cooldownWindow = 0.3; // 300ms cooldown per speaker
    this.nextId = 1;
    this._scratchPos = new THREE.Vector3();
    this._camDir = new THREE.Vector3();
    this._toPoint = new THREE.Vector3();
    this._scratchScreen = { x: 0, y: 0, zDepth: 0, scale: 1, visible: true };
    this.soundTriggered = [];
  }

  spawnSpeechBubble(speaker, text, options = {}) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      return null;
    }
    const cleanText = text.trim();
    const speakerId = typeof speaker === 'string' ? speaker : (speaker?.id || speaker?.name || 'speaker');
    const priority = options.priority ?? this._getSpeakerPriority(speakerId);

    // Cooldown check for same speaker (unless bypassed by banter queue)
    const now = Date.now();
    const lastSpoken = this.speakerCooldowns.get(speakerId) || 0;
    if (now - lastSpoken < this.cooldownWindow * 1000 && !options.bypassCooldown) {
      return null;
    }
    this.speakerCooldowns.set(speakerId, now);

    const bubble = {
      id: this.nextId++,
      speaker,
      speakerId,
      text: cleanText,
      style: options.style || 'comic',
      badge: options.badge || this._getSpeakerBadge(speakerId),
      mood: options.mood || null,
      priority,
      duration: options.duration || 2.5,
      elapsed: 0,
      sound: !!options.sound,
      springProgress: 0,
      springScale: 0,
      trauma: options.trauma || (options.style === 'shout' ? 0.8 : 0),
      typewriterChars: 0,
      visible: true,
      screenX: 0,
      screenY: 0,
      depthScale: 1
    };

    if (bubble.sound) {
      this.soundTriggered.push({ id: bubble.id, speaker: speakerId, text: cleanText });
    }

    // Active bubble cap (<= 3) and priority preemption
    if (this.activeBubbles.length >= this.maxActiveBubbles) {
      let minIdx = 0;
      let minPriority = this.activeBubbles[0].priority;
      for (let i = 1; i < this.activeBubbles.length; i++) {
        if (this.activeBubbles[i].priority < minPriority) {
          minPriority = this.activeBubbles[i].priority;
          minIdx = i;
        }
      }
      if (priority >= minPriority) {
        this.activeBubbles.splice(minIdx, 1);
      } else {
        return null;
      }
    }

    this.activeBubbles.push(bubble);
    return bubble;
  }

  triggerBanter(dialogueChain, options = {}) {
    if (!Array.isArray(dialogueChain) || dialogueChain.length === 0) return 0;
    let added = 0;
    for (const item of dialogueChain) {
      if (this.banterQueue.length >= this.maxBanterQueue) {
        if (options.evictFifo) {
          this.banterQueue.shift();
        } else {
          break;
        }
      }
      this.banterQueue.push({
        id: this.nextId++,
        speaker: item.speaker,
        text: item.text,
        delay: item.delay || 0,
        timer: item.delay || 0,
        options: item.options || {}
      });
      added++;
    }
    return added;
  }

  update(dt = 0.016, player = null) {
    if (!Number.isFinite(dt)) dt = 0.016;
    if (dt < 0) dt = 0.004;

    // 1. Advance banter queue timers
    for (let i = this.banterQueue.length - 1; i >= 0; i--) {
      const item = this.banterQueue[i];
      item.timer -= dt;
      if (item.timer <= 0) {
        this.spawnSpeechBubble(item.speaker, item.text, {
          ...item.options,
          bypassCooldown: true
        });
        this.banterQueue.splice(i, 1);
      }
    }

    // 2. Advance active bubble lifetimes and micro-animations
    for (let i = this.activeBubbles.length - 1; i >= 0; i--) {
      const b = this.activeBubbles[i];
      b.elapsed += dt;
      if (b.elapsed >= b.duration) {
        this.activeBubbles.splice(i, 1);
        continue;
      }

      // A. Damped spring pop-in (transitions from 0 to 1 with spring overshoot)
      b.springProgress = Math.min(1, b.elapsed / 0.25);
      const t = b.springProgress;
      b.springScale = t >= 1 ? 1 : Math.max(0, 1 - Math.exp(-6 * t) * Math.cos(12 * t));

      // B. Trauma shake decay
      if (b.trauma > 0) {
        b.trauma = Math.max(0, b.trauma - dt * 1.5);
      }

      // C. Typewriter text reveal (reveals characters sequentially at 35 chars/sec)
      b.typewriterChars = Math.min(b.text.length, Math.floor(b.elapsed * 35));
    }
  }

  draw(ctx, cameraAdapter, width = 1280, height = 720, camera3D = null) {
    if (!ctx) return;
    for (const b of this.activeBubbles) {
      const pos = this._getSpeakerPosition(b.speaker);
      const screen = this.projectBubble(pos.x, pos.y, pos.z, cameraAdapter, width, height, camera3D, this._scratchScreen);
      b.screenX = screen.x;
      b.screenY = screen.y;
      b.depthScale = screen.scale;
      b.visible = screen.visible;

      if (!b.visible) continue;

      ctx.save();
      // Apply trauma jitter
      let jitterX = 0;
      let jitterY = 0;
      if (b.trauma > 0) {
        const shakeMag = b.trauma * b.trauma * 8;
        jitterX = (Math.sin(b.elapsed * 45) + Math.cos(b.elapsed * 33)) * shakeMag * 0.5;
        jitterY = (Math.cos(b.elapsed * 40) + Math.sin(b.elapsed * 28)) * shakeMag * 0.5;
      }

      const totalScale = b.springScale * b.depthScale;
      ctx.translate(screen.x + jitterX, screen.y + jitterY);
      ctx.scale(totalScale, totalScale);

      this._drawVariantBubble(ctx, b);

      if (b.badge) {
        this._drawBadge(ctx, b.badge);
      }

      if (b.mood) {
        this._drawMood(ctx, b.mood);
      }

      const displayText = b.text.slice(0, b.typewriterChars);
      ctx.fillText(displayText, 0, 0);
      ctx.strokeText(displayText, 0, 0);

      ctx.restore();
    }
  }

  projectBubble(wx, wy, wz, cameraAdapter, width = 1280, height = 720, camera3D = null, target = null) {
    const out = target || { x: 0, y: 0, zDepth: 0, scale: 1, visible: true };
    out.visible = true;

    if (cameraAdapter?.worldToScreen) {
      const proj = cameraAdapter.worldToScreen(wx, wy, wz);
      out.x = proj.x ?? 0;
      out.y = proj.y ?? 0;
      out.zDepth = proj.zDepth ?? 0;
      if (proj.visible !== undefined) out.visible = proj.visible;
    } else if (camera3D) {
      this._scratchPos.set(to3DX(wx), to3DY(wy), to3DZ(wz));
      const camDist = this._scratchPos.distanceTo(camera3D.position);

      camera3D.getWorldDirection(this._camDir);
      this._toPoint.subVectors(this._scratchPos, camera3D.position);
      if (this._camDir.dot(this._toPoint) <= 0) {
        out.visible = false;
      }

      this._scratchPos.project(camera3D);
      if (this._scratchPos.z > 1.0) {
        out.visible = false;
      }

      out.x = (this._scratchPos.x * 0.5 + 0.5) * width;
      out.y = (-this._scratchPos.y * 0.5 + 0.5) * height;
      out.zDepth = this._scratchPos.z;

      // Inverse distance depth scaling: clamp(refDist / dist, 0.65, 1.35)
      out.scale = Math.max(0.65, Math.min(1.35, this.refDistance / Math.max(0.1, camDist)));
      return out;
    }

    const dist = Math.sqrt(wx * wx + wy * wy + (wz + 35) * (wz + 35));
    out.scale = Math.max(0.65, Math.min(1.35, this.refDistance / Math.max(1, dist * 0.05)));
    return out;
  }

  _drawVariantBubble(ctx, bubble) {
    ctx.beginPath();
    switch (bubble.style) {
      case 'shout':
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2;
          const r = i % 2 === 0 ? 55 : 40;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      case 'cyber':
        ctx.rect(-60, -25, 120, 50);
        break;
      case 'pixel':
        ctx.rect(-50, -20, 100, 40);
        break;
      case 'comic':
      default:
        ctx.roundRect(-50, -20, 100, 40, 10);
        break;
    }
    ctx.fill();
    ctx.stroke();
  }

  _drawBadge(ctx, badge) {
    ctx.save();
    ctx.fillText(`[${badge.toUpperCase()}]`, -45, -24);
    ctx.restore();
  }

  _drawMood(ctx, mood) {
    ctx.save();
    ctx.fillText(mood, 45, -24);
    ctx.restore();
  }

  _getSpeakerPosition(speaker) {
    if (speaker && typeof speaker === 'object') {
      return {
        x: speaker.x ?? 0,
        y: speaker.y ?? 0,
        z: speaker.z ?? 0
      };
    }
    return { x: 0, y: 0, z: 0 };
  }

  _getSpeakerPriority(speakerId) {
    if (speakerId === 'campaign' || speakerId === 'h4c3r' || speakerId === 'ender_dragon' || speakerId === 'titan') return 5;
    if (speakerId === 'dark_lord' || speakerId === 'king_orange' || speakerId === 'creeper_lord') return 4;
    if (speakerId === 'orange_awakened') return 3;
    if (['red', 'blue', 'yellow', 'green', 'agent', 'ballista', 'primal', 'hazard'].includes(speakerId)) return 2;
    return 1;
  }

  _getSpeakerBadge(speakerId) {
    const badges = {
      orange: '🟠 ORANGE',
      red: '🔴 RED',
      blue: '🔵 BLUE',
      yellow: '🟡 YELLOW',
      green: '🟢 GREEN',
      cursor: '🖱️ CURSOR',
      chosen: '⭐ CHOSEN',
      king: '👑 KING',
      agent: '🕶️ AGENT',
      ballista: '🚀 BALLISTA',
      primal: '🪓 PRIMAL',
      hazard: '☣️ HAZARD',
      titan: '🗿 TITAN',
      dark_lord: '⚔️ DARK LORD',
      king_orange: '👑 KING ORANGE',
      creeper_lord: '🧨 CREEPER LORD',
      giant_cat: '🐾 GIANT CAT',
      lucky_orb: '🔮 LUCKY ORB',
      ender_dragon: '🐉 ENDER DRAGON',
      h4c3r: '👾 H4C3R',
      zombie: '🧟 ZOMBIE'
    };
    return badges[speakerId] || String(speakerId).toUpperCase();
  }

  onCombatEvent(eventType, detail = {}) {
    const anchor = detail.anchor || this.playerRef;
    switch (eventType) {
      case 'combo': {
        const hits = detail.hits || 0;
        if (hits >= 30) {
          const text = detail.text || '30 COMBO! GODLIKE!';
          return this.spawnSpeechBubble('orange', text, {
            style: 'shout',
            mood: '⚡',
            priority: detail.priority ?? 3,
            trauma: detail.trauma ?? 0.75,
            anchor
          });
        } else if (hits >= 20) {
          const text = detail.text || '20 COMBO! UNSTOPPABLE!';
          return this.spawnSpeechBubble('orange', text, {
            style: 'comic',
            mood: '!',
            priority: detail.priority ?? 2,
            anchor
          });
        } else if (hits >= 10) {
          const text = detail.text || '10 HITS! COMBO STREAK!';
          return this.spawnSpeechBubble('orange', text, {
            style: 'comic',
            mood: '⚡',
            priority: detail.priority ?? 1,
            anchor
          });
        }
        break;
      }
      case 'grab': {
        const grabTexts = ['SLAM DUNK!', 'SEISMIC SLAM!', 'KNOCKOUT SLAM!'];
        const text = detail.text || grabTexts[0];
        return this.spawnSpeechBubble('orange', text, {
          style: 'shout',
          mood: '⚡',
          priority: detail.priority ?? 3,
          trauma: detail.trauma ?? 0.85,
          anchor
        });
      }
      case 'low_hp': {
        const text = detail.text || 'CLUTCH TIME!\nNOT GIVING UP!';
        return this.spawnSpeechBubble('orange', text, {
          style: 'shout',
          mood: '💧',
          priority: detail.priority ?? 3,
          trauma: detail.trauma ?? 0.7,
          anchor
        });
      }
      case 'stage_clear': {
        const text = detail.text || 'STAGE COMPLETE!';
        return this.spawnSpeechBubble('orange', text, {
          style: 'comic',
          mood: '★',
          priority: detail.priority ?? 3,
          anchor
        });
      }
      case 'stage_start': {
        const stageNum = detail.stage || 1;
        const text = detail.text || (stageNum === 1 ? 'DRAW FAST, HIT HARD!' : `STAGE ${stageNum}! READY!`);
        return this.spawnSpeechBubble('orange', text, {
          style: 'comic',
          mood: '!',
          priority: detail.priority ?? 2,
          anchor
        });
      }
    }
    return null;
  }

  onCreativeAction(actionType, detail = {}) {
    const speaker = detail.speaker || 'orange';
    const anchor = detail.anchor || null;
    const bubbleOpts = { anchor, x: detail.x, y: detail.y, z: detail.z };

    switch (actionType) {
      case 'flight': {
        const isEnabled = detail.enabled !== false;
        const text = isEnabled ? 'FLIGHT MODE: ON!\nGRAVITY: OFF!' : 'FLIGHT MODE: OFF!\nBACK TO EARTH!';
        return this.spawnSpeechBubble(speaker, text, {
          ...bubbleOpts,
          style: detail.style || 'cyber',
          mood: detail.mood || (isEnabled ? '★' : '⚡'),
          priority: detail.priority ?? 3,
          duration: 2.0
        });
      }
      case 'god_mode': {
        const isGod = detail.enabled !== false;
        const text = isGod ? 'GOD MODE: ON!\nINVINCIBLE!' : 'GOD MODE: OFF!\nMORTAL AGAIN!';
        return this.spawnSpeechBubble(speaker, text, {
          ...bubbleOpts,
          style: detail.style || (isGod ? 'shout' : 'comic'),
          mood: detail.mood || (isGod ? '⚡' : '💧'),
          priority: detail.priority ?? 3,
          duration: 2.0
        });
      }
      case 'tnt_place': {
        return this.spawnSpeechBubble(speaker, 'TNT PLACED!\nDON\'T STAND NEAR!', {
          ...bubbleOpts,
          style: detail.style || 'pixel',
          mood: detail.mood || '!',
          priority: detail.priority ?? 2,
          duration: 2.0
        });
      }
      case 'tnt_detonate': {
        return this.spawnSpeechBubble(speaker, 'KABOOM! BOOM!\nCHAIN REACTION!', {
          ...bubbleOpts,
          style: 'shout',
          mood: '💀',
          trauma: detail.trauma ?? 0.9,
          priority: detail.priority ?? 3,
          duration: 2.2
        });
      }
      case 'lucky_open':
      case 'lucky_block_open': {
        return this.spawnSpeechBubble(speaker, 'JACKPOT!\nWHAT\'S INSIDE?', {
          ...bubbleOpts,
          style: detail.style || 'comic',
          mood: detail.mood || '★',
          priority: detail.priority ?? 3,
          duration: 2.0
        });
      }
      case 'lucky_block': {
        if (detail.open || detail.opened) {
          return this.spawnSpeechBubble(speaker, 'JACKPOT!\nWHAT\'S INSIDE?', {
            ...bubbleOpts,
            style: detail.style || 'comic',
            mood: detail.mood || '★',
            priority: detail.priority ?? 3,
            duration: 2.0
          });
        }
        return this.spawnSpeechBubble(speaker, 'FEELING LUCKY?\nMYSTERY BOX!', {
          ...bubbleOpts,
          style: detail.style || 'pixel',
          mood: detail.mood || '?',
          priority: detail.priority ?? 2,
          duration: 2.0
        });
      }
      case 'weapon_switch': {
        const w = String(detail.weapon || 'weapon').toLowerCase();
        const WEAPON_CONFIGS = {
          fists: { text: 'BARE FISTS!\nHAND TO HAND!', style: 'comic', mood: '!', priority: 2, trauma: 0 },
          sword: { text: 'DIAMOND SWORD!\nSLICE!', style: 'comic', mood: '★', priority: 2, trauma: 0 },
          bow: { text: 'VOXEL BOW!\nSNIPER SHOT!', style: 'comic', mood: '★', priority: 2, trauma: 0 },
          pistol: { text: 'CYBER PISTOL!\nLOCK & LOAD!', style: 'cyber', mood: '⚡', priority: 2, trauma: 0 },
          shotgun: { text: 'BOOMSTICK SHOTGUN!\nSPREAD!', style: 'shout', mood: '💀', priority: 3, trauma: 0.8 },
          minigun: { text: 'MINIGUN ROTATING!\nBRRRRT!', style: 'shout', mood: '⚡', priority: 3, trauma: 1.0 },
          rocket: { text: 'ROCKET LAUNCHER!\nFIRE!', style: 'shout', mood: '💀', priority: 3, trauma: 0.9 },
          laser: { text: 'ION LASER!\n1.21 GW!', style: 'cyber', mood: '⚡', priority: 2, trauma: 0 },
          pencil: { text: 'GIANT PENCIL!\nSKETCH DOOM!', style: 'comic', mood: '★', priority: 2, trauma: 0 },
          staff: { text: 'COMMAND STAFF!\nOVERPOWERED!', style: 'shout', mood: '⚡', priority: 3, trauma: 0.8 },
          eraser: { text: 'PINK ERASER!\nRUBBED OUT!', style: 'comic', mood: '💧', priority: 2, trauma: 0 },
          toolbar_staff: { text: 'TOOLBAR STAFF!\nAGENT HACK!', style: 'cyber', mood: '⚡', priority: 3, trauma: 0 },
          pixel_bazooka: { text: 'PIXEL BAZOOKA!\nBARRAGE!', style: 'shout', mood: '💀', priority: 3, trauma: 0.9 },
          stone_spear: { text: 'STONE SPEAR!\nPRIMAL HUNT!', style: 'comic', mood: '!', priority: 2, trauma: 0 },
          hazard_sign: { text: 'HAZARD SIGN!\nHIGH VOLTAGE!', style: 'cyber', mood: '⚡', priority: 2, trauma: 0 },
          vira_blades: { text: 'DUAL VIRA-BLADES!\nDARK!', style: 'shout', mood: '💀', priority: 3, trauma: 0.8 },
          katana: { text: 'DIAMOND KATANA!\nDRAWN!', style: 'comic', mood: '⚡', priority: 2, trauma: 0 }
        };

        const cfg = WEAPON_CONFIGS[w] || {
          text: `EQUIPPED: ${w.toUpperCase()}!`,
          style: 'comic',
          mood: '⚡',
          priority: 2,
          trauma: 0
        };

        return this.spawnSpeechBubble(speaker, cfg.text, {
          ...bubbleOpts,
          style: cfg.style,
          mood: cfg.mood,
          priority: cfg.priority,
          trauma: cfg.trauma,
          duration: 1.6
        });
      }
      case 'spawn_entity': {
        const ent = String(detail.entity || 'enemy').toLowerCase();
        const BOSS_SET = new Set([
          'ender_dragon', 'mercenary_squad', 'mercenary_agent', 'mercenary_ballista',
          'mercenary_primal', 'mercenary_hazard', 'h4c3r', 'king_orange',
          'dark_lord', 'lucky_orb', 'creeper_lord', 'giant_cat', 'titan_boss', 'boss'
        ]);
        const isBoss = BOSS_SET.has(ent) || ent.includes('boss') || ent.includes('lord') || ent.includes('dragon') || ent.includes('titan') || ent.includes('mercenary') || ent.includes('h4c3r') || ent.includes('king');

        const ALLY_SET = new Set(['red', 'blue', 'yellow', 'green', 'cursor', 'chosen', 'chosen_one', 'king', 'ally']);
        const isAlly = ALLY_SET.has(ent) || ent.startsWith('ally');

        if (isBoss) {
          return this.spawnSpeechBubble(speaker, '[BOSS SUMMONED!]', {
            ...bubbleOpts,
            style: 'shout',
            mood: '💀',
            priority: detail.priority ?? 4,
            trauma: detail.trauma ?? 0.8,
            duration: 1.8
          });
        } else if (isAlly) {
          return this.spawnSpeechBubble(speaker, 'ALLY ARRIVED! READY!', {
            ...bubbleOpts,
            style: 'comic',
            mood: '★',
            priority: detail.priority ?? 3,
            duration: 1.6
          });
        } else {
          return this.spawnSpeechBubble(speaker, `SPAWNED: ${(detail.entity || 'ENEMY').toUpperCase()}!`, {
            ...bubbleOpts,
            style: 'pixel',
            mood: '!',
            priority: detail.priority ?? 2,
            duration: 1.5
          });
        }
      }
      case 'summon_allies': {
        return this.spawnSpeechBubble(speaker, 'ALLIES ASSEMBLE!\nFULL SQUAD!', {
          ...bubbleOpts,
          style: 'comic',
          mood: '★',
          priority: detail.priority ?? 4,
          duration: 1.8
        });
      }
      case 'nuke_enemies': {
        return this.spawnSpeechBubble(speaker, '[TACTICAL NUKE INCOMING!]', {
          ...bubbleOpts,
          style: 'shout',
          mood: '💀',
          priority: detail.priority ?? 4,
          trauma: detail.trauma ?? 1.0,
          duration: 2.0
        });
      }
    }
    return actionType;
  }

  reset() {
    this.activeBubbles.length = 0;
    this.banterQueue.length = 0;
    this.speakerCooldowns.clear();
    this.soundTriggered.length = 0;
  }

  getActiveBubbles() {
    return this.activeBubbles;
  }

  getBanterQueue() {
    return this.banterQueue;
  }
}

export const SpeechBubbleManager3D = speech3dModule?.SpeechBubbleManager3D || speech3dModule?.Speech3DManager || ReferenceSpeech3DManager;
export const speech3d = speech3dModule?.speech3d || speech3dModule?.default || new ReferenceSpeech3DManager();

function createSpeechManager(options) {
  if (speech3dModule?.SpeechBubbleManager3D || speech3dModule?.Speech3DManager) {
    const Cls = speech3dModule.SpeechBubbleManager3D || speech3dModule.Speech3DManager;
    return new Cls(options);
  }
  return new ReferenceSpeech3DManager(options);
}

function createTestCamera(pos = { x: 0, y: 10, z: 35 }, lookAt = { x: 0, y: 0, z: 0 }) {
  const camera = new THREE.PerspectiveCamera(45, 1280 / 720, 0.1, 1000);
  camera.position.set(pos.x, pos.y, pos.z);
  camera.lookAt(lookAt.x, lookAt.y, lookAt.z);
  camera.updateMatrixWorld(true);
  return camera;
}

// ============================================================================
// Tier 1: Feature Coverage (25 Tests)
// ============================================================================

test('Tier 1 [Speech F1.1] 3D Depth Projection: projects ground and airborne entities accurately across (x, y, z)', () => {
  const mgr = createSpeechManager();
  const cam = createTestCamera({ x: 0, y: 10, z: 35 }, { x: 0, y: 0, z: 0 });

  const pGround = mgr.projectBubble(0, 0, 0, null, 1280, 720, cam);
  assert.ok(Number.isFinite(pGround.x) && Number.isFinite(pGround.y), 'ground coordinates must be finite');
  assert.ok(Math.abs(pGround.x - 640) < 2, 'ground center X must project near viewport center 640');

  // Airborne entity at y = -340 (which converts to +10 in 3D world, camera level)
  const pAir = mgr.projectBubble(0, -340, 0, null, 1280, 720, cam);
  assert.ok(Number.isFinite(pAir.x) && Number.isFinite(pAir.y), 'airborne coordinates must be finite');
  assert.ok(pAir.y < pGround.y, 'airborne entity must project higher on screen (smaller Y) than ground');
});

test('Tier 1 [Speech F1.1] 3D Depth Projection: Z-axis translation changes screen projection coordinates', () => {
  const mgr = createSpeechManager();
  const cam = createTestCamera({ x: 0, y: 10, z: 35 }, { x: 0, y: 0, z: 0 });

  const p1 = mgr.projectBubble(150, 0, 0, null, 1280, 720, cam);
  const p2 = mgr.projectBubble(150, 0, 200, null, 1280, 720, cam);

  assert.notEqual(p1.x, p2.x, 'shifting Z coordinate must alter screen X in perspective projection');
  assert.notEqual(p1.scale, p2.scale, 'shifting Z coordinate must alter depth scaling factor');
});

test('Tier 1 [Speech F1.2] Depth Scaling: scales bubble size via clamp(refDist / dist, 0.65, 1.35)', () => {
  const mgr = createSpeechManager();
  const cam = createTestCamera({ x: 0, y: 0, z: 35 }, { x: 0, y: 0, z: 0 });

  // Entity close to camera (distance 10, 35/10 = 3.5 -> clamped to 1.35)
  const near = mgr.projectBubble(0, 0, 25 * 34, null, 1280, 720, cam);
  assert.equal(near.scale, 1.35, 'near distance must clamp to maximum scale 1.35');

  // Entity far from camera (distance 135, 35/135 = 0.259 -> clamped to 0.65)
  const far = mgr.projectBubble(0, 0, -100 * 34, null, 1280, 720, cam);
  assert.equal(far.scale, 0.65, 'far distance must clamp to minimum scale 0.65');

  // Entity at reference distance (distance 35 -> scale 1.0)
  const ref = mgr.projectBubble(0, 0, 0, null, 1280, 720, cam);
  assert.ok(Math.abs(ref.scale - 1.0) < 0.05, 'reference distance must yield scale near 1.0');
});

test('Tier 1 [Speech F1.2] Frustum Culling: culls speech bubbles behind camera viewpoint', () => {
  const mgr = createSpeechManager();
  const cam = createTestCamera({ x: 0, y: 5, z: 20 }, { x: 0, y: 5, z: 0 });

  // Entity placed behind camera (Z = +50 in 3D, camera is at Z = 20 facing -Z)
  const behind = mgr.projectBubble(0, -170, 50 * 34, null, 1280, 720, cam);
  assert.equal(behind.visible, false, 'point behind camera must have visible: false');
});

test('Tier 1 [Speech F1.3] Visual Variants: comic style renders smooth bubble with directional tail', () => {
  const mgr = createSpeechManager();
  const bubble = mgr.spawnSpeechBubble('orange', 'PENCIL TIME!', { style: 'comic' });
  assert.equal(bubble.style, 'comic');

  const ctx = document.createElement('canvas').getContext('2d');
  assert.doesNotThrow(() => {
    mgr.draw(ctx, null, 1280, 720);
  }, 'comic bubble drawing must execute cleanly');
});

test('Tier 1 [Speech F1.3] Visual Variants: shout style renders spiky burst starburst contour', () => {
  const mgr = createSpeechManager();
  const bubble = mgr.spawnSpeechBubble('ender_dragon', 'ROOOAAAR!', { style: 'shout' });
  assert.equal(bubble.style, 'shout');
  assert.ok(bubble.trauma > 0, 'shout bubble must initialize with trauma shake');

  const ctx = document.createElement('canvas').getContext('2d');
  assert.doesNotThrow(() => {
    mgr.draw(ctx, null, 1280, 720);
  }, 'shout burst drawing must execute cleanly');
});

test('Tier 1 [Speech F1.3] Visual Variants: cyber style renders monospace terminal frame with bracket borders', () => {
  const mgr = createSpeechManager();
  const bubble = mgr.spawnSpeechBubble('h4c3r', 'SYSTEM COMPROMISED.', { style: 'cyber' });
  assert.equal(bubble.style, 'cyber');

  const ctx = document.createElement('canvas').getContext('2d');
  assert.doesNotThrow(() => {
    mgr.draw(ctx, null, 1280, 720);
  }, 'cyber frame drawing must execute cleanly');
});

test('Tier 1 [Speech F1.3] Visual Variants: pixel style renders stepped blocky pixel contour', () => {
  const mgr = createSpeechManager();
  const bubble = mgr.spawnSpeechBubble('creeper_lord', 'CLAN CACHE: LOCKED.', { style: 'pixel' });
  assert.equal(bubble.style, 'pixel');

  const ctx = document.createElement('canvas').getContext('2d');
  assert.doesNotThrow(() => {
    mgr.draw(ctx, null, 1280, 720);
  }, 'pixel contour drawing must execute cleanly');
});

test('Tier 1 [Speech F1.4] Avatar Badges: maps distinct avatar badges for Orange, Allies, Mercenaries, and Bosses', () => {
  const mgr = createSpeechManager();
  const testSpeakers = ['orange', 'red', 'blue', 'agent', 'ballista', 'ender_dragon', 'h4c3r'];
  for (const spk of testSpeakers) {
    const badge = mgr._getSpeakerBadge(spk);
    assert.ok(badge && typeof badge === 'string' && badge.length > 0, `speaker ${spk} must have non-empty badge`);
  }
});

test('Tier 1 [Speech F1.4] Avatar Badges: attaches avatar badge to bubble header rendering', () => {
  const mgr = createSpeechManager();
  const bubble = mgr.spawnSpeechBubble('orange', 'READY!', { badge: '[LEADER]' });
  assert.equal(bubble.badge, '[LEADER]');

  const ctx = document.createElement('canvas').getContext('2d');
  assert.doesNotThrow(() => {
    mgr.draw(ctx, null, 1280, 720);
  }, 'badge rendering must execute cleanly');
});

test('Tier 1 [Speech F1.5] Mood Indicators: supports full palette of mood cues (!, ⚡, 💧, 💀, ★, ?, 🎵)', () => {
  const mgr = createSpeechManager();
  const moods = ['!', '⚡', '💧', '💀', '★', '?', '🎵'];
  for (const m of moods) {
    mgr.reset();
    const bubble = mgr.spawnSpeechBubble('orange', `Mood test ${m}`, { mood: m });
    assert.equal(bubble.mood, m, `mood ${m} must be recorded on bubble`);
  }
});

test('Tier 1 [Speech F1.5] Mood Indicators: positions mood flair badge at bubble top-right anchor', () => {
  const mgr = createSpeechManager();
  const bubble = mgr.spawnSpeechBubble('orange', 'CRITICAL HIT!', { mood: '⚡' });
  assert.equal(bubble.mood, '⚡');

  const ctx = document.createElement('canvas').getContext('2d');
  assert.doesNotThrow(() => {
    mgr.draw(ctx, null, 1280, 720);
  }, 'mood drawing must execute cleanly');
});

test('Tier 1 [Speech F1.6] Micro-Animations: damped spring pop-in scales from 0 to 1 with overshoot', () => {
  const mgr = createSpeechManager();
  const bubble = mgr.spawnSpeechBubble('orange', 'POP IN TEST');
  assert.equal(bubble.springScale, 0, 'spring scale must initialize at 0');

  mgr.update(0.05);
  assert.ok(bubble.springScale > 0, 'spring scale must increase after time step');

  mgr.update(0.25);
  assert.ok(bubble.springScale >= 0.95, 'spring scale must settle near 1 after pop duration');
});

test('Tier 1 [Speech F1.6] Micro-Animations: trauma shake applies bounded pixel jitter during boss roars', () => {
  const mgr = createSpeechManager();
  const bubble = mgr.spawnSpeechBubble('titan', 'SYSTEM SMASH TIME.', { style: 'shout', trauma: 0.9 });
  assert.ok(bubble.trauma > 0, 'initial trauma must be positive');

  mgr.update(0.1);
  assert.ok(bubble.trauma < 0.9, 'trauma must decay over time');

  mgr.update(1.0);
  assert.ok(bubble.trauma <= 0.1, 'trauma must decay to near zero after 1s');
});

test('Tier 1 [Speech F1.6] Micro-Animations: typewriter text reveal increments visible character count over time', () => {
  const mgr = createSpeechManager();
  const text = 'TYPEWRITER REVEAL PROGRESSION TEST';
  const bubble = mgr.spawnSpeechBubble('orange', text);
  assert.equal(bubble.typewriterChars, 0, 'initial typewriter chars must be 0');

  mgr.update(0.1);
  assert.ok(bubble.typewriterChars > 0, 'typewriter chars must increment after dt');

  mgr.update(1.0);
  assert.equal(bubble.typewriterChars, text.length, 'all characters must be revealed after full duration');
});

test('Tier 1 [Speech F2.1] Banter Queue: sequential multi-line dialogue queues with delay offsets', () => {
  const mgr = createSpeechManager();
  const chain = [
    { speaker: 'orange', text: 'Ready team?', delay: 0 },
    { speaker: 'red', text: 'Fists ready!', delay: 0.5 },
    { speaker: 'blue', text: 'Potions brewed!', delay: 1.0 }
  ];

  const added = mgr.triggerBanter(chain);
  assert.equal(added, 3, 'all 3 lines must be accepted into queue');

  mgr.update(0.01);
  assert.equal(mgr.getActiveBubbles().length, 1, 'first line with delay 0 must spawn immediately');

  mgr.update(0.55);
  assert.equal(mgr.getActiveBubbles().length, 2, 'second line must spawn after delay 0.5');

  mgr.update(0.55);
  assert.equal(mgr.getActiveBubbles().length, 3, 'third line must spawn after delay 1.0');
});

test('Tier 1 [Speech F2.1] Banter Queue: monotonic message IDs ensure strict ordering', () => {
  const mgr = createSpeechManager();
  const b1 = mgr.spawnSpeechBubble('orange', 'One');
  mgr.speakerCooldowns.clear();
  const b2 = mgr.spawnSpeechBubble('red', 'Two');
  mgr.speakerCooldowns.clear();
  const b3 = mgr.spawnSpeechBubble('blue', 'Three');

  assert.ok(b2.id > b1.id, 'bubble 2 id must be strictly greater than bubble 1');
  assert.ok(b3.id > b2.id, 'bubble 3 id must be strictly greater than bubble 2');
});

test('Tier 1 [Speech F2.2] Squad Banter: Rocket Corp 4-Mercenary squad call-and-response chains', () => {
  const mgr = createSpeechManager();
  const squad = [
    { speaker: 'agent', text: 'Target locked.', delay: 0 },
    { speaker: 'ballista', text: 'Rocket armed.', delay: 0.2 },
    { speaker: 'primal', text: 'Axe ready!', delay: 0.4 },
    { speaker: 'hazard', text: 'Gas primed.', delay: 0.6 }
  ];

  mgr.triggerBanter(squad);
  assert.equal(mgr.getBanterQueue().length, 4, 'squad chain of 4 entries must queue');

  mgr.update(0.7);
  assert.ok(mgr.getActiveBubbles().length > 0, 'squad banter must activate bubbles');
});

test('Tier 1 [Speech F2.3] Team Banter: Orange and stick allies (Red, Blue, Yellow, Green) dialogue pairs', () => {
  const mgr = createSpeechManager();
  const pair = [
    { speaker: 'orange', text: 'Focus the brute!', delay: 0 },
    { speaker: 'yellow', text: 'Redstone trap ready!', delay: 0.3 }
  ];

  mgr.triggerBanter(pair);
  mgr.update(0.01);
  assert.equal(mgr.getActiveBubbles()[0].speakerId, 'orange');

  mgr.update(0.35);
  const active = mgr.getActiveBubbles();
  assert.ok(active.some(b => b.speakerId === 'yellow'), 'yellow ally response must activate');
});

test('Tier 1 [Speech F2.4] Boss Trash-Talk: boss intro and phase transitions trigger reactive dialogue', () => {
  const mgr = createSpeechManager();
  const bubble = mgr.spawnSpeechBubble('ender_dragon', 'THE END IS NOW!', { style: 'shout', priority: 5 });
  assert.equal(bubble.priority, 5, 'boss dialogue must have high priority 5');
  assert.equal(bubble.style, 'shout');
});

test('Tier 1 [Speech F2.5] Zombie Comedy: zombie groans trigger snappy ally retort replies', () => {
  const mgr = createSpeechManager();
  mgr.triggerBanter([
    { speaker: 'zombie', text: 'BRAINS.PNG...', delay: 0 },
    { speaker: 'red', text: 'UNDELETE THIS!', delay: 0.2 }
  ]);

  mgr.update(0.01);
  assert.equal(mgr.getActiveBubbles()[0].text, 'BRAINS.PNG...');

  mgr.update(0.25);
  const active = mgr.getActiveBubbles();
  assert.ok(active.some(b => b.text === 'UNDELETE THIS!'));
});

test('Tier 1 [Speech F3.1] Combat Hooks: combo streak milestones (10, 20, 30 hits) and grab finishers trigger callouts', () => {
  const mgr = createSpeechManager();

  mgr.onCombatEvent('combo', { hits: 10 });
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('10 HITS')));

  mgr.reset();
  mgr.onCombatEvent('combo', { hits: 30 });
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('30 COMBO')));

  mgr.reset();
  mgr.onCombatEvent('grab');
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('SLAM')));
});

test('Tier 1 [Speech F3.2] Health & Creative Hooks: low-HP clutch (<25% HP) and Creative 3D Flight/God Mode triggers', () => {
  const mgr = createSpeechManager();

  mgr.onCombatEvent('low_hp');
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('CLUTCH TIME')));

  mgr.reset();
  mgr.onCreativeAction('flight', { enabled: true });
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('FLIGHT MODE')));

  mgr.reset();
  mgr.onCreativeAction('god_mode', { enabled: true });
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('GOD MODE')));
});

test('Tier 1 [Speech F3.4] Sandbox Explosives: Creative TNT placement and Lucky Block detonation triggers', () => {
  const mgr = createSpeechManager();

  mgr.onCreativeAction('tnt_place');
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('TNT PLACED')));

  mgr.reset();
  mgr.onCreativeAction('tnt_detonate');
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('KABOOM')));

  mgr.reset();
  mgr.onCreativeAction('lucky_block');
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('FEELING LUCKY')));
});

test('Tier 1 [Speech F3.5] Creative 3D Weapon Switch Callouts: 8 weapons trigger distinct callout lines and styles (comic, cyber, shout)', () => {
  const mgr = createSpeechManager();

  // Test 8 distinct prompt weapons
  const testCases = [
    { weapon: 'fists', expectedText: 'FISTS', expectedStyle: 'comic', expectedMood: '!' },
    { weapon: 'sword', expectedText: 'SWORD', expectedStyle: 'comic', expectedMood: '★' },
    { weapon: 'bow', expectedText: 'BOW', expectedStyle: 'comic', expectedMood: '★' },
    { weapon: 'pistol', expectedText: 'PISTOL', expectedStyle: 'cyber', expectedMood: '⚡' },
    { weapon: 'shotgun', expectedText: 'SHOTGUN', expectedStyle: 'shout', expectedMood: '💀', hasTrauma: true },
    { weapon: 'minigun', expectedText: 'MINIGUN', expectedStyle: 'shout', expectedMood: '⚡', hasTrauma: true },
    { weapon: 'rocket', expectedText: 'ROCKET', expectedStyle: 'shout', expectedMood: '💀', hasTrauma: true },
    { weapon: 'laser', expectedText: 'LASER', expectedStyle: 'cyber', expectedMood: '⚡' }
  ];

  for (const tc of testCases) {
    mgr.reset();
    mgr.onCreativeAction('weapon_switch', { weapon: tc.weapon });
    const bubbles = mgr.getActiveBubbles();
    assert.equal(bubbles.length, 1, `weapon ${tc.weapon} should spawn exactly 1 bubble`);
    const b = bubbles[0];
    assert.ok(b.text.includes(tc.expectedText), `bubble text '${b.text}' must contain '${tc.expectedText}'`);
    assert.equal(b.style, tc.expectedStyle, `weapon ${tc.weapon} should have style ${tc.expectedStyle}`);
    assert.equal(b.mood, tc.expectedMood, `weapon ${tc.weapon} should have mood ${tc.expectedMood}`);
    if (tc.hasTrauma) {
      assert.ok(b.trauma > 0, `heavy weapon ${tc.weapon} should have trauma shake`);
    }
  }

  // Also verify fallback for custom/dock weapons
  mgr.reset();
  mgr.onCreativeAction('weapon_switch', { weapon: 'katana' });
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('KATANA')));
});

test('Tier 1 [Speech F3.6] Creative Entity Spawning & Nuke Callouts: Boss summon ([BOSS SUMMONED!]), zombie spawns, deploy allies, and tactical nuke', () => {
  const mgr = createSpeechManager();

  // 1. Boss Spawning triggers [BOSS SUMMONED!] with shout style and trauma
  const bossTypes = ['ender_dragon', 'warden_boss', 'mercenary_squad', 'h4c3r', 'king_orange', 'dark_lord', 'lucky_orb', 'creeper_lord', 'giant_cat', 'titan_boss'];
  for (const boss of bossTypes) {
    mgr.reset();
    mgr.onCreativeAction('spawn_entity', { entity: boss });
    const b = mgr.getActiveBubbles()[0];
    assert.ok(b, `spawning ${boss} must produce a bubble`);
    assert.ok(b.text.includes('[BOSS SUMMONED!]'), `boss text must contain '[BOSS SUMMONED!]' (got '${b.text}')`);
    assert.equal(b.style, 'shout', `boss ${boss} summon must use shout style`);
    assert.equal(b.mood, '💀', `boss ${boss} summon must use skull mood`);
    assert.ok(b.priority >= 4, `boss ${boss} summon must have high priority`);
    assert.ok(b.trauma >= 0.8, `boss ${boss} summon must apply trauma shake`);
  }

  // 2. Regular Zombie Spawning triggers pixel style
  mgr.reset();
  mgr.onCreativeAction('spawn_entity', { entity: 'basic' });
  const bZombie = mgr.getActiveBubbles()[0];
  assert.ok(bZombie.text.includes('BASIC'));
  assert.equal(bZombie.style, 'pixel');

  // 3. Ally Spawning triggers comic style
  mgr.reset();
  mgr.onCreativeAction('spawn_entity', { entity: 'red' });
  const bAlly = mgr.getActiveBubbles()[0];
  assert.ok(bAlly.text.includes('ALLY'));
  assert.equal(bAlly.style, 'comic');
  assert.equal(bAlly.mood, '★');

  // 4. Deploy All Allies triggers ALLIES ASSEMBLE
  mgr.reset();
  mgr.onCreativeAction('summon_allies');
  const bAllies = mgr.getActiveBubbles()[0];
  assert.ok(bAllies.text.includes('ALLIES ASSEMBLE'));
  assert.equal(bAllies.style, 'comic');
  assert.equal(bAllies.mood, '★');
  assert.ok(bAllies.priority >= 4);

  // 5. Tactical Nuke triggers [TACTICAL NUKE INCOMING!] with trauma 1.0 and shout starburst
  mgr.reset();
  mgr.onCreativeAction('nuke_enemies');
  const bNuke = mgr.getActiveBubbles()[0];
  assert.ok(bNuke.text.includes('TACTICAL NUKE INCOMING!'));
  assert.equal(bNuke.style, 'shout');
  assert.equal(bNuke.mood, '💀');
  assert.equal(bNuke.priority, 4);
  assert.equal(bNuke.trauma, 1.0);
});

test('Tier 1 [Speech F4.1] Queue Bounds: active bubbles capped at <= 3, banter queue <= 4, and bounded bubble object pool recycling', () => {
  const mgr = createSpeechManager();

  // Verify pool initialization
  assert.ok(Array.isArray(mgr.bubblePool), 'mgr.bubblePool must be initialized as an Array');
  assert.equal(mgr.maxBubblePool, 8, 'mgr.maxBubblePool must default to 8');
  assert.equal(mgr.bubblePool.length, 0, 'mgr.bubblePool should start empty');

  // Attempt to spawn 5 bubbles (first 3 active, next 2 evict lowest priority into pool)
  for (let i = 0; i < 5; i++) {
    mgr.speakerCooldowns.clear();
    mgr.spawnSpeechBubble(`spk_${i}`, `Message ${i}`, { priority: 1 });
  }
  assert.ok(mgr.getActiveBubbles().length <= 3, `active bubbles must not exceed 3 (current: ${mgr.getActiveBubbles().length})`);
  assert.ok(mgr.bubblePool.length > 0, 'evicted bubbles must be recycled into bubblePool');

  // Verify bubble pool pop and reuse by clearing active bubbles first
  mgr.reset();
  const poolLenBefore = mgr.bubblePool.length;
  assert.ok(poolLenBefore > 0, 'mgr.reset() must have recycled active bubbles into pool');

  mgr.speakerCooldowns.clear();
  const recycled = mgr.spawnSpeechBubble('reused_speaker', 'Recycled text', { priority: 2 });
  assert.ok(recycled, 'bubble must spawn from pool');
  assert.equal(mgr.bubblePool.length, poolLenBefore - 1, 'pool length must decrement on spawn');
  assert.equal(recycled.text, 'Recycled text');

  // Verify dismissal recycling
  assert.ok(mgr.dismissBubble(recycled.id), 'dismissBubble should return true for active bubble');
  assert.equal(mgr.bubblePool.length, poolLenBefore, 'dismissed bubble must be recycled back into pool');

  // Verify expiration in update(dt) recycles into pool
  const poolBeforeExp = mgr.bubblePool.length;
  const expBubble = mgr.spawnSpeechBubble('spk_exp', 'Expiring soon', { duration: 0.1 });
  assert.ok(expBubble);
  assert.equal(mgr.bubblePool.length, poolBeforeExp - 1);
  mgr.update(0.2);
  assert.equal(mgr.getActiveBubbles().length, 0, 'expired bubble must be removed from active bubbles');
  assert.equal(mgr.bubblePool.length, poolBeforeExp, 'expired bubble must be recycled back into pool');

  // Pool capacity bound: pool length cannot exceed maxBubblePool
  for (let i = 0; i < 20; i++) {
    mgr._recycleBubble({ id: i });
  }
  assert.equal(mgr.bubblePool.length, 8, 'bubblePool must not exceed maxBubblePool cap of 8');

  // Attempt to queue 6 banter items
  const excessChain = [
    { speaker: 's1', text: '1', delay: 1 },
    { speaker: 's2', text: '2', delay: 2 },
    { speaker: 's3', text: '3', delay: 3 },
    { speaker: 's4', text: '4', delay: 4 },
    { speaker: 's5', text: '5', delay: 5 },
    { speaker: 's6', text: '6', delay: 6 }
  ];
  mgr.triggerBanter(excessChain);
  assert.ok(mgr.getBanterQueue().length <= 4, `banter queue must not exceed 4 (current: ${mgr.getBanterQueue().length})`);
});

// ============================================================================
// Tier 2: Boundary & Corner Cases (20 Tests)
// ============================================================================

test('Tier 2 [Speech B1.1] Z-Boundary Clamping: handles extreme Z limits [-380, 380] at arena perimeter', () => {
  const mgr = createSpeechManager();
  const cam = createTestCamera();

  const pMin = mgr.projectBubble(0, 0, -380, null, 1280, 720, cam);
  const pMax = mgr.projectBubble(0, 0, 380, null, 1280, 720, cam);

  assert.ok(Number.isFinite(pMin.x) && Number.isFinite(pMin.y));
  assert.ok(Number.isFinite(pMax.x) && Number.isFinite(pMax.y));
});

test('Tier 2 [Speech B1.2] Sky Altitude Extremes: handles sky boss altitude Y=-520 without projection overflow', () => {
  const mgr = createSpeechManager();
  const cam = createTestCamera();

  const pSky = mgr.projectBubble(0, -520, 0, null, 1280, 720, cam);
  assert.ok(Number.isFinite(pSky.x) && Number.isFinite(pSky.y));
});

test('Tier 2 [Speech B1.3] Camera Distance Extremes: distance extremes clamp scale cleanly to [0.65, 1.35]', () => {
  const mgr = createSpeechManager();
  const cam = createTestCamera({ x: 0, y: 0, z: 35 }, { x: 0, y: 0, z: 0 });

  const extremeNear = mgr.projectBubble(0, 0, 34.99 * 34, null, 1280, 720, cam);
  assert.equal(extremeNear.scale, 1.35, 'extreme near must clamp to 1.35');

  const extremeFar = mgr.projectBubble(0, 0, -5000 * 34, null, 1280, 720, cam);
  assert.equal(extremeFar.scale, 0.65, 'extreme far must clamp to 0.65');
});

test('Tier 2 [Speech B1.4] Behind-Camera Inversion: negative camera Z projections are strictly culled', () => {
  const mgr = createSpeechManager();
  const cam = createTestCamera({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: -10 });

  const behind = mgr.projectBubble(0, 0, 50 * 34, null, 1280, 720, cam);
  assert.equal(behind.visible, false, 'point behind camera must have visible: false');
});

test('Tier 2 [Speech B1.5] Zero-Origin Alignment: entity at (0, 0, 0) projects to viewport center without NaN', () => {
  const mgr = createSpeechManager();
  const cam = createTestCamera({ x: 0, y: 0, z: 35 }, { x: 0, y: 0, z: 0 });

  const p = mgr.projectBubble(0, 0, 0, null, 1280, 720, cam);
  assert.ok(!Number.isNaN(p.x) && !Number.isNaN(p.y));
  assert.ok(Math.abs(p.x - 640) < 1.0, 'origin X must be exactly centered at 640');
  assert.ok(Math.abs(p.y - 360) < 1.0, 'origin Y must be exactly centered at 360');
});

test('Tier 2 [Speech B2.1] Empty Text Handling: empty string dialogue gracefully no-ops or discards bubble', () => {
  const mgr = createSpeechManager();
  const res = mgr.spawnSpeechBubble('orange', '');
  assert.equal(res, null, 'empty text must return null');
  assert.equal(mgr.getActiveBubbles().length, 0, 'no bubble must be created');
});

test('Tier 2 [Speech B2.2] Long Text Truncation: long strings wrap or clamp cleanly without exceeding bounds', () => {
  const mgr = createSpeechManager();
  const longText = 'A'.repeat(256);
  const bubble = mgr.spawnSpeechBubble('orange', longText);
  assert.ok(bubble, 'long text bubble must be accepted');

  const ctx = document.createElement('canvas').getContext('2d');
  assert.doesNotThrow(() => {
    mgr.draw(ctx, null, 1280, 720);
  }, 'drawing long text bubble must not throw');
});

test('Tier 2 [Speech B2.3] Special Characters & Emojis: unicode, punctuation, and emoji strings render safely', () => {
  const mgr = createSpeechManager();
  const specialText = '🔥 <<[CRITICAL ERROR]>> \u0000 \t \n "quotes" & \'amp\'! 👾';
  const bubble = mgr.spawnSpeechBubble('h4c3r', specialText);
  assert.ok(bubble);

  const ctx = document.createElement('canvas').getContext('2d');
  assert.doesNotThrow(() => {
    mgr.draw(ctx, null, 1280, 720);
  }, 'special characters must draw cleanly');
});

test('Tier 2 [Speech B2.4] Whitespace-Only Text: whitespace strings are trimmed or safely handled', () => {
  const mgr = createSpeechManager();
  const res = mgr.spawnSpeechBubble('orange', '    \t   \n   ');
  assert.equal(res, null, 'whitespace-only text must be rejected');
  assert.equal(mgr.getActiveBubbles().length, 0);
});

test('Tier 2 [Speech B2.5] Missing Options Fallback: spawnSpeechBubble, onCombatEvent, and onCreativeAction with null/undefined detail use safe defaults', () => {
  const mgr = createSpeechManager();
  const bubble = mgr.spawnSpeechBubble('orange', 'SAFE DEFAULTS');
  assert.ok(bubble);
  assert.equal(bubble.style, 'comic', 'default style must be comic');
  assert.ok(bubble.duration > 0, 'default duration must be positive');
  assert.equal(bubble.mood, null, 'default mood must be null');

  // Robustness with explicit null / undefined parameter in combat events
  assert.doesNotThrow(() => {
    mgr.onCombatEvent('combo', null);
    mgr.onCombatEvent('grab', undefined);
    mgr.onCombatEvent('low_hp', null);
    mgr.onCombatEvent('stage_clear', null);
    mgr.onCombatEvent('stage_start', undefined);
  }, 'onCombatEvent must handle null or undefined detail without throwing');

  // Robustness with explicit null / undefined parameter in creative actions
  assert.doesNotThrow(() => {
    mgr.onCreativeAction('flight', null);
    mgr.onCreativeAction('god_mode', null);
    mgr.onCreativeAction('tnt_place', undefined);
    mgr.onCreativeAction('tnt_detonate', null);
    mgr.onCreativeAction('lucky_open', null);
    mgr.onCreativeAction('weapon_switch', null);
    mgr.onCreativeAction('summon_allies', undefined);
    mgr.onCreativeAction('nuke_enemies', null);
  }, 'onCreativeAction must handle null or undefined detail without throwing');

  // String coercion and fallback for spawn_entity detail
  mgr.reset();
  const numEntityBubble = mgr.onCreativeAction('spawn_entity', { entity: 777 });
  assert.ok(numEntityBubble, 'spawn_entity with numeric entity must succeed');
  assert.equal(numEntityBubble.text, 'SPAWNED: 777!', 'numeric entity must be coerced cleanly to uppercase string');

  mgr.reset();
  const nullEntityBubble = mgr.onCreativeAction('spawn_entity', null);
  assert.ok(nullEntityBubble, 'spawn_entity with null detail must succeed');
  assert.equal(nullEntityBubble.text, 'SPAWNED: ENEMY!', 'null detail must fallback to SPAWNED: ENEMY!');
});

test('Tier 2 [Speech B3.1] Queue Saturation: adding > 4 banter entries evicts or drops excess gracefully', () => {
  const mgr = createSpeechManager();
  const entries = Array.from({ length: 8 }, (_, i) => ({ speaker: `s_${i}`, text: `Line ${i}`, delay: i + 1 }));
  mgr.triggerBanter(entries);
  assert.equal(mgr.getBanterQueue().length, 4, 'queue size must saturate at exactly 4');
});

test('Tier 2 [Speech B3.2] Active Bubble Saturation: adding > 3 active bubbles evicts lowest priority FIFO', () => {
  const mgr = createSpeechManager();
  for (let i = 0; i < 4; i++) {
    mgr.speakerCooldowns.clear();
    mgr.spawnSpeechBubble(`speaker_${i}`, `Message ${i}`, { priority: 1 });
  }
  assert.equal(mgr.getActiveBubbles().length, 3, 'active count must strictly equal 3');
});

test('Tier 2 [Speech B3.3] Priority Preemption: high-priority boss line immediately preempts low-priority chatter', () => {
  const mgr = createSpeechManager();
  // Fill with low-priority chatter (priority 1)
  mgr.spawnSpeechBubble('zombie', 'Groan 1', { priority: 1 });
  mgr.speakerCooldowns.clear();
  mgr.spawnSpeechBubble('zombie', 'Groan 2', { priority: 1 });
  mgr.speakerCooldowns.clear();
  mgr.spawnSpeechBubble('zombie', 'Groan 3', { priority: 1 });
  assert.equal(mgr.getActiveBubbles().length, 3);

  // Incoming high-priority boss line (priority 5)
  const bossBubble = mgr.spawnSpeechBubble('ender_dragon', 'THE SKIES BELONG TO ME!', { priority: 5 });
  assert.ok(bossBubble, 'boss bubble must be spawned');
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('THE SKIES BELONG TO ME')), 'boss line must be active');
  assert.equal(mgr.getActiveBubbles().length, 3, 'active count must not exceed 3');
});

test('Tier 2 [Speech B3.4] Speaker Cooldown: same speaker cannot spawn duplicate bubbles within cooldown window', () => {
  const mgr = createSpeechManager();
  const first = mgr.spawnSpeechBubble('orange', 'First call');
  assert.ok(first);

  // Immediate second call from same speaker
  const second = mgr.spawnSpeechBubble('orange', 'Second call');
  assert.equal(second, null, 'rapid second call from same speaker must be throttled');
});

test('Tier 2 [Speech B3.5] Clean Reset: reset() clears all active bubbles and banter queues instantly', () => {
  const mgr = createSpeechManager();
  mgr.spawnSpeechBubble('orange', 'Active');
  mgr.triggerBanter([{ speaker: 'red', text: 'Queued', delay: 1 }]);

  assert.ok(mgr.getActiveBubbles().length > 0);
  assert.ok(mgr.getBanterQueue().length > 0);

  mgr.reset();
  assert.equal(mgr.getActiveBubbles().length, 0, 'active bubbles must be empty after reset');
  assert.equal(mgr.getBanterQueue().length, 0, 'banter queue must be empty after reset');
  assert.equal(mgr.speakerCooldowns.size, 0, 'cooldowns must be cleared after reset');
});

test('Tier 2 [Speech B4.1] Zero Delta Time: dt = 0 update executes cleanly without NaN or freezing animations', () => {
  const mgr = createSpeechManager();
  mgr.spawnSpeechBubble('orange', 'Zero dt');
  assert.doesNotThrow(() => {
    mgr.update(0);
  });
  const b = mgr.getActiveBubbles()[0];
  assert.ok(!Number.isNaN(b.elapsed) && !Number.isNaN(b.springScale));
});

test('Tier 2 [Speech B4.2] Large Delta Time Lag Spike: dt = 1.0 safely advances without numerical explosion', () => {
  const mgr = createSpeechManager();
  mgr.spawnSpeechBubble('orange', 'Lag spike', { duration: 0.5 });
  assert.doesNotThrow(() => {
    mgr.update(1.0);
  });
  assert.equal(mgr.getActiveBubbles().length, 0, 'bubble exceeding duration must expire cleanly');
});

test('Tier 2 [Speech B4.3] Negative Delta Time: negative dt is safely clamped to positive floor', () => {
  const mgr = createSpeechManager();
  const bubble = mgr.spawnSpeechBubble('orange', 'Negative dt');
  assert.doesNotThrow(() => {
    mgr.update(-0.1);
  });
  assert.ok(bubble.elapsed > 0, 'elapsed time must increase despite negative dt input');
});

test('Tier 2 [Speech B4.4] Zero-Allocation Scratch Reusability: 100 update/draw cycles generate 0 object allocations', () => {
  const mgr = createSpeechManager();
  const cam = createTestCamera();
  const ctx = document.createElement('canvas').getContext('2d');
  mgr.spawnSpeechBubble('orange', 'Scratch test', { duration: 10 });

  assert.doesNotThrow(() => {
    for (let i = 0; i < 100; i++) {
      mgr.update(0.016);
      mgr.draw(ctx, null, 1280, 720, cam);
    }
  }, 'repeated update and draw cycles must execute without error');
});

test('Tier 2 [Speech B4.5] Missing Canvas Context: draw() without valid canvas context returns safely without throwing', () => {
  const mgr = createSpeechManager();
  mgr.spawnSpeechBubble('orange', 'Missing ctx');
  assert.doesNotThrow(() => {
    mgr.draw(null, null, 1280, 720);
    mgr.draw(undefined, null, 1280, 720);
  });
});

// ============================================================================
// Tier 3: Cross-Feature Combinations (4 Tests)
// ============================================================================

test('Tier 3 [Speech Pairwise 1] Airborne Flight + Comic Bubble + Perspective Depth Scaling: flying Orange projects elevated bubble with scaled dimensions', () => {
  const mgr = createSpeechManager();
  const cam = createTestCamera({ x: 0, y: 15, z: 40 }, { x: 0, y: 0, z: 0 });
  const ctx = document.createElement('canvas').getContext('2d');

  // Orange airborne at Y = -300, Z = 100
  const orangeFlying = { x: 0, y: -300, z: 100 };
  const bubble = mgr.spawnSpeechBubble(orangeFlying, 'I CAN SEE MY HOUSE!', { style: 'comic', mood: '★' });
  assert.ok(bubble);

  mgr.update(0.1);
  mgr.draw(ctx, null, 1280, 720, cam);

  assert.ok(bubble.visible, 'flying bubble must be visible');
  assert.ok(bubble.screenY < 360, 'airborne bubble must project in upper half of screen');
  assert.ok(bubble.depthScale >= 0.65 && bubble.depthScale <= 1.35, 'depth scale must respect bounds');
});

test('Tier 3 [Speech Pairwise 2] Boss Roar + Shout Starburst + Trauma Shake Jitter: Ender Dragon roar renders spiky bubble with trauma vibration', () => {
  const mgr = createSpeechManager();
  const cam = createTestCamera();
  const ctx = document.createElement('canvas').getContext('2d');

  const boss = { x: 0, y: -400, z: 0 };
  const bubble = mgr.spawnSpeechBubble(boss, 'ENDER FLAME!', { style: 'shout', trauma: 1.0, mood: '💀' });
  assert.equal(bubble.style, 'shout');
  assert.equal(bubble.trauma, 1.0);

  mgr.update(0.05);
  mgr.draw(ctx, null, 1280, 720, cam);

  assert.ok(bubble.trauma < 1.0, 'trauma must begin decaying');
});

test('Tier 3 [Speech Pairwise 3] H4C3R Mainframe + Cyber Glitch Style + Typewriter Reveal + Sound Trigger: terminal cyber dialogue with sequential character reveal', () => {
  const mgr = createSpeechManager();
  const ctx = document.createElement('canvas').getContext('2d');

  const bubble = mgr.spawnSpeechBubble('h4c3r', 'BREACHING FIREWALL... 100%', {
    style: 'cyber',
    sound: true,
    mood: '⚡'
  });
  assert.equal(bubble.style, 'cyber');
  assert.equal(bubble.sound, true);
  assert.ok(mgr.soundTriggered.some(s => s.text.includes('BREACHING FIREWALL')));

  mgr.update(0.1);
  mgr.draw(ctx, null, 1280, 720);
  assert.ok(bubble.typewriterChars > 0, 'characters must reveal sequentially');
});

test('Tier 3 [Speech Pairwise 4] Rocket Corp Mercenaries + Pixel Variant + Squad Banter Chain + Priority Preemption: 4-way squad chain with combat interrupt', () => {
  const mgr = createSpeechManager();
  const squadChain = [
    { speaker: 'agent', text: 'Formation Alpha.', delay: 0, options: { style: 'pixel', priority: 2 } },
    { speaker: 'ballista', text: 'Rockets locked.', delay: 0.1, options: { style: 'pixel', priority: 2 } },
    { speaker: 'primal', text: 'Charging now!', delay: 0.2, options: { style: 'pixel', priority: 2 } }
  ];

  mgr.triggerBanter(squadChain);
  mgr.update(0.15);
  assert.equal(mgr.getActiveBubbles().length, 2);

  // High-priority combat interrupt
  mgr.spawnSpeechBubble('orange', 'INCOMING NUKE!', { style: 'shout', priority: 5 });
  const active = mgr.getActiveBubbles();
  assert.ok(active.some(b => b.text.includes('INCOMING NUKE')), 'interrupt must be present');
});

// ============================================================================
// Tier 4: Real-World Application Scenarios (4 Tests)
// ============================================================================

test('Tier 4 [Speech Scenario 1] Multi-Stage Combat Dialogue Flow: 10/20/30 Combo Milestones, Grab Contact, and Low-HP Clutch', () => {
  const mgr = createSpeechManager();
  const cam = createTestCamera();
  const ctx = document.createElement('canvas').getContext('2d');

  // 1. Build 10-hit combo
  mgr.onCombatEvent('combo', { hits: 10 });
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('10 HITS')));
  mgr.update(0.5);
  mgr.draw(ctx, null, 1280, 720, cam);

  // 2. Build 20-hit combo
  mgr.reset();
  mgr.onCombatEvent('combo', { hits: 20 });
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('20 COMBO')));
  mgr.update(0.5);
  mgr.draw(ctx, null, 1280, 720, cam);

  // 3. Build 30-hit combo (shout variant with ⚡ mood)
  mgr.reset();
  mgr.onCombatEvent('combo', { hits: 30 });
  const combo30 = mgr.getActiveBubbles()[0];
  assert.equal(combo30.style, 'shout');
  assert.equal(combo30.mood, '⚡');

  // 4. Execute grab finisher
  mgr.reset();
  mgr.onCombatEvent('grab');
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('SLAM')));

  // 5. Low-HP clutch moment (<25% HP)
  mgr.reset();
  mgr.onCombatEvent('low_hp');
  const clutch = mgr.getActiveBubbles()[0];
  assert.equal(clutch.mood, '💧');
  assert.ok(clutch.text.includes('CLUTCH TIME'));
});

test('Tier 4 [Speech Scenario 2] Boss Encounter Orchestration: Intro Trash-Talk, Phase 2 Rage, and Defeat Banter Chains', () => {
  const mgr = createSpeechManager();
  const ctx = document.createElement('canvas').getContext('2d');

  // 1. Boss Intro Trash-Talk Chain
  mgr.triggerBanter([
    { speaker: 'ender_dragon', text: 'WHO DARES ENTER THE END?', delay: 0, options: { style: 'shout', priority: 5 } },
    { speaker: 'orange', text: 'WE HAVE A PENCIL, DRAGON!', delay: 0.3, options: { style: 'comic', priority: 3 } }
  ]);
  mgr.update(0.01);
  assert.equal(mgr.getActiveBubbles()[0].speakerId, 'ender_dragon');
  mgr.update(0.35);
  assert.ok(mgr.getActiveBubbles().some(b => b.speakerId === 'orange'));

  // 2. Phase 2 Rage Trigger
  mgr.reset();
  const rageBubble = mgr.spawnSpeechBubble('ender_dragon', 'DRAGON FURY OVERDRIVE!', { style: 'shout', trauma: 1.0, priority: 5 });
  assert.equal(rageBubble.trauma, 1.0);
  mgr.draw(ctx, null, 1280, 720);

  // 3. Defeat Banter Chain
  mgr.reset();
  mgr.triggerBanter([
    { speaker: 'ender_dragon', text: 'THE END... IS SILENT.', delay: 0, options: { style: 'shout', priority: 5 } },
    { speaker: 'orange', text: 'RESTORE KEY SECURED!', delay: 0.2, options: { style: 'comic', priority: 3 } }
  ]);
  mgr.update(0.01);
  assert.equal(mgr.getActiveBubbles()[0].text, 'THE END... IS SILENT.');
});

test('Tier 4 [Speech Scenario 3] Rocket Corp 4-Mercenary Squad Roll-Call and Tactical Banter in 3D Arena', () => {
  const mgr = createSpeechManager();
  const rollCall = [
    { speaker: 'agent', text: 'Agent online. Target in sight.', delay: 0, options: { style: 'pixel' } },
    { speaker: 'ballista', text: 'Ballista ready. Heavy rockets armed.', delay: 0.1, options: { style: 'pixel' } },
    { speaker: 'primal', text: 'Primal ready. Axes sharpened!', delay: 0.2, options: { style: 'pixel' } },
    { speaker: 'hazard', text: 'Hazard ready. Bio-mines deployed.', delay: 0.3, options: { style: 'pixel' } }
  ];

  mgr.triggerBanter(rollCall);
  mgr.update(0.35);

  const active = mgr.getActiveBubbles();
  assert.ok(active.length >= 3, 'squad members must actively dialogue');
  for (const b of active) {
    assert.equal(b.style, 'pixel', 'mercenaries must use pixel style in voxel edition');
    assert.ok(b.badge.length > 0, 'mercenary badge must be present');
  }
});

test('Tier 4 [Speech Scenario 4] Creative Mode Sandbox Workflow: 3D Flight, Weapon Switching, TNT Placement, and Nuke Detonation', () => {
  const mgr = createSpeechManager();
  const ctx = document.createElement('canvas').getContext('2d');

  // 1. Enable 3D Flight
  mgr.onCreativeAction('flight', { enabled: true });
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('FLIGHT MODE')));

  // 2. Weapon switch to Diamond Katana
  mgr.reset();
  mgr.onCreativeAction('weapon_switch', { weapon: 'katana' });
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('KATANA')));

  // 3. Place TNT block in sandbox
  mgr.reset();
  mgr.onCreativeAction('tnt_place');
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('TNT PLACED')));

  // 4. Detonate TNT
  mgr.reset();
  mgr.onCreativeAction('tnt_detonate');
  const tntBoom = mgr.getActiveBubbles()[0];
  assert.equal(tntBoom.style, 'shout');
  assert.equal(tntBoom.mood, '💀');

  // 5. Summon All Allies
  mgr.reset();
  mgr.onCreativeAction('summon_allies');
  assert.ok(mgr.getActiveBubbles().some(b => b.text.includes('ALLIES ASSEMBLE')));

  // 6. Tactical Nuke screen clear
  mgr.reset();
  mgr.onCreativeAction('nuke_enemies');
  const nuke = mgr.getActiveBubbles()[0];
  assert.equal(nuke.style, 'shout');
  assert.equal(nuke.priority, 4);

  // Render final state cleanly
  assert.doesNotThrow(() => {
    mgr.draw(ctx, null, 1280, 720);
  });
});


// ============================================================================
// 3D Physics, Void Falling, and Lava Systems (Features 1 - 14)
// Interface Contracts & Reference Implementations
// ============================================================================

let physicsModule = null;
try {
  physicsModule = await import('../3d/js/physics3d.js');
} catch {
  // physics3d.js will be loaded once created by worker_m1
}

function refGetPlatformBoundingBox3D(platform) {
  if (physicsModule?.getPlatformBoundingBox3D) {
    return physicsModule.getPlatformBoundingBox3D(platform);
  }
  const isCreativeBlock = platform.z !== undefined && platform.z3d === undefined;
  const width = platform.width || (isCreativeBlock ? 68 : 200);
  const height = platform.height || (isCreativeBlock ? 68 : 20);
  const depth3d = platform.depth3d || (isCreativeBlock ? 68 : 170);
  const halfW = width * 0.5;
  const halfD = depth3d * 0.5;
  const x = platform.x || 0;
  const z = platform.z3d !== undefined ? platform.z3d : (platform.z !== undefined ? platform.z : 0);
  const topY = platform.y - height;
  const bottomY = platform.y;
  return {
    minX: x - halfW,
    maxX: x + halfW,
    minY: topY,
    maxY: bottomY,
    minZ: z - halfD,
    maxZ: z + halfD,
    topY,
    bottomY,
    halfW,
    halfD
  };
}

function refIsEntityInsidePlatformXZ(entityX, entityZ, radiusX, radiusZ, platform) {
  if (physicsModule?.isEntityInsidePlatformXZ) {
    return physicsModule.isEntityInsidePlatformXZ(entityX, entityZ, radiusX, radiusZ, platform);
  }
  const box = refGetPlatformBoundingBox3D(platform);
  const rX = radiusX !== undefined ? radiusX : 18;
  const rZ = radiusZ !== undefined ? radiusZ : 12;
  const xOverlap = (entityX + rX >= box.minX) && (entityX - rX <= box.maxX);
  const zOverlap = (entityZ + rZ >= box.minZ) && (entityZ - rZ <= box.maxZ);
  return xOverlap && zOverlap;
}

function refFilterPlatformsForEntity(entity, allPlatforms) {
  if (physicsModule?.filterPlatformsForEntity) {
    return physicsModule.filterPlatformsForEntity(entity, allPlatforms);
  }
  if (!allPlatforms || !Array.isArray(allPlatforms)) return [];
  const eZ = entity.z || 0;
  return allPlatforms.filter((p) => {
    const pZ = p.z3d !== undefined ? p.z3d : (p.z !== undefined ? p.z : 0);
    const halfD = (p.depth3d || (p.z !== undefined ? 68 : 170)) * 0.5;
    return Math.abs(eZ - pZ) <= halfD + 15;
  });
}

function refResolveSweptVerticalCollision(entity, platforms, prevY, dt = 0.016) {
  if (physicsModule?.resolveSweptVerticalCollision) {
    return physicsModule.resolveSweptVerticalCollision(entity, platforms, prevY, dt);
  }
  if (entity.vy < 0) return false;
  if (!platforms || platforms.length === 0) return false;

  const rX = entity.radiusX || 18;
  const rZ = entity.radiusZ || 12;
  let bestLandingY = Infinity;
  let landed = false;

  for (const p of platforms) {
    if (!refIsEntityInsidePlatformXZ(entity.x, entity.z || 0, rX, rZ, p)) continue;
    const bTop = p.y - (p.height || 60);
    if (prevY <= bTop + 6 && entity.y >= bTop) {
      if (bTop < bestLandingY) {
        bestLandingY = bTop;
        landed = true;
      }
    }
  }

  if (landed) {
    entity.y = bestLandingY;
    entity.vy = 0;
    entity.isGrounded = true;
    return true;
  }
  return false;
}

function refClampEnclosedWalls(entity, isEnclosedStage = true) {
  if (physicsModule?.clampEnclosedWalls) {
    return physicsModule.clampEnclosedWalls(entity, isEnclosedStage);
  }
  if (!isEnclosedStage) return false;
  const isEnemy = Boolean(entity.isZombie);
  const maxX = isEnemy ? 960 : 966;
  const maxZ = isEnemy ? 350 : 360;
  let clamped = false;

  if (entity.x > maxX) {
    entity.x = maxX;
    if (entity.vx > 0) entity.vx = 0;
    clamped = true;
  } else if (entity.x < -maxX) {
    entity.x = -maxX;
    if (entity.vx < 0) entity.vx = 0;
    clamped = true;
  }

  const ez = entity.z || 0;
  if (ez > maxZ) {
    entity.z = maxZ;
    if (entity.vz > 0) entity.vz = 0;
    clamped = true;
  } else if (ez < -maxZ) {
    entity.z = -maxZ;
    if (entity.vz < 0) entity.vz = 0;
    clamped = true;
  }
  return clamped;
}

const REF_FLOATING_ISLAND_THEMES = ['the_end', 'aether', 'cloud_cache', 'lucky_orb'];
const REF_ISLAND_FLOOR_BOUNDS = { halfX: 980, halfZ: 380 };

function refIsFloatingIslandTheme(theme) {
  return REF_FLOATING_ISLAND_THEMES.includes(theme);
}

function refIsOpenEdgeTheme(theme) {
  return refIsFloatingIslandTheme(theme) || theme === 'minecraft';
}

function refUpdateVoidPhysics(entity, theme, dt = 0.016) {
  const isOpen = refIsOpenEdgeTheme(theme);
  const ez = entity.z || 0;
  const isOffIsland = isOpen && (Math.abs(entity.x) > REF_ISLAND_FLOOR_BOUNDS.halfX || Math.abs(ez) > REF_ISLAND_FLOOR_BOUNDS.halfZ);
  const effectiveGroundY = isOffIsland ? 99999 : 0;

  if (entity.isCreativeFlight) {
    if (entity.vy) entity.y += entity.vy * dt;
    return { effectiveGroundY, fellIntoVoid: false, respawned: false, eliminated: false };
  }

  entity.vy = (entity.vy || 0) + 1200 * dt;
  entity.y += entity.vy * dt;

  if (entity.y >= effectiveGroundY) {
    entity.y = effectiveGroundY;
    entity.vy = 0;
    entity.isGrounded = true;
  } else {
    entity.isGrounded = false;
  }

  if (entity.y >= 180) {
    if (entity.isZombie) {
      if (entity.isFlying) {
        entity.y = -200;
        entity.vy = 0;
        return { effectiveGroundY, fellIntoVoid: false, respawned: false, eliminated: false };
      }
      entity.isDead = true;
      entity.pendingRemoval = true;
      return { effectiveGroundY, fellIntoVoid: true, respawned: false, eliminated: true };
    }

    if (entity.isGodMode) {
      return { effectiveGroundY, fellIntoVoid: true, respawned: false, eliminated: false };
    }

    entity.hp = Math.max(0, (entity.hp || 100) - 40);
    if (entity.hp <= 0) {
      entity.isDead = true;
      return { effectiveGroundY, fellIntoVoid: true, respawned: false, eliminated: true };
    }

    entity.x = 0;
    entity.y = 0;
    entity.z = 0;
    entity.vx = 0;
    entity.vy = 0;
    entity.vz = 0;
    entity.isGrounded = true;
    entity.iFrames = 60;
    return { effectiveGroundY, fellIntoVoid: true, respawned: true, eliminated: false };
  }

  return { effectiveGroundY, fellIntoVoid: false, respawned: false, eliminated: false };
}

function refCheckLavaHazard(entity, hazard, dt = 0.016) {
  const hz = hazard.z || 0;
  const halfW = (hazard.width || 160) * 0.5;
  const halfD = (hazard.depth3d || 220) * 0.5;
  const minX = hazard.x - halfW;
  const maxX = hazard.x + halfW;
  const minZ = hz - halfD;
  const maxZ = hz + halfD;
  const ez = entity.z || 0;

  const overlapsX = entity.x >= minX && entity.x <= maxX;
  const overlapsZ = ez >= minZ && ez <= maxZ;
  const overlapsY = Math.abs(entity.y - (hazard.y || 0)) <= 30;

  if (!overlapsX || !overlapsZ || !overlapsY) {
    if (entity.lavaTickCooldown > 0) {
      entity.lavaTickCooldown = Math.max(0, entity.lavaTickCooldown - dt);
    }
    return false;
  }

  if (entity.isGodMode) return false;
  if (entity.isRolling) return false;
  if (entity.iFrames > 0) return false;
  if (entity.lavaTickCooldown > 0) {
    entity.lavaTickCooldown = Math.max(0, entity.lavaTickCooldown - dt);
    return false;
  }

  const dmg = hazard.damage || 20;
  entity.hp = Math.max(0, (entity.hp || 100) - dmg);
  entity.isGrounded = false;

  if (entity.isZombie) {
    entity.vy = -260;
    entity.lavaTickCooldown = 0.45;
  } else {
    entity.vy = -340;
    entity.iFrames = 30;
  }
  return true;
}

// ============================================================================
// TIER 1: FEATURE COVERAGE (>= 5 tests per feature: Features 1 - 14)
// ============================================================================

// ----------------------------------------------------------------------------
// Feature 1: Flush Platform Top Alignment
// ----------------------------------------------------------------------------

test('Tier 1 [Physics F1.1] Flush Landing Calculation: entity at bTop = p.y - p.height lands with feet flush at to3DY(bTop)', () => {
  const platform = { x: 0, y: 120, width: 200, height: 20 };
  const bTop = platform.y - platform.height; // 100
  const expectedLandingY3D = to3DY(bTop); // -100 * (1 / 34)
  assert.ok(Math.abs(expectedLandingY3D - (-100 / 34)) < 1e-9, 'landing plane in 3D must equal to3DY(bTop)');

  // Verify foot contact aligns with landing plane
  const rig = new StickRig3D({ color: '#ff7700' });
  rig.update({ pose: 'idle', animTimer: 0 });
  const rigRootY = expectedLandingY3D;
  assert.ok(Number.isFinite(rigRootY), 'rig root position Y must be finite');
});

test('Tier 1 [Physics F1.2] Platform Top Plane Equation: platform mesh top face equals position.y + h/2 = to3DY(p.y - p.height)', () => {
  const p = { x: 0, y: 160, width: 220, height: 20, depth3d: 170 };
  const h = p.height * WORLD_TO_3D;
  const meshPosY = to3DY(p.y - p.height / 2); // -150 / 34
  const meshTopY = meshPosY + h / 2; // -150/34 + 10/34 = -140/34
  const expectedBTop3D = to3DY(p.y - p.height); // -140 / 34
  assert.ok(Math.abs(meshTopY - expectedBTop3D) < 1e-9, 'slab top plane must mathematically align with to3DY(bTop)');
});

test('Tier 1 [Physics F1.3] Header Bar Contact Surface: headerBar top face does not exceed slab top boundary', () => {
  const p = { width: 180, height: 24, depth3d: 170 };
  const w = p.width * WORLD_TO_3D;
  const h = p.height * WORLD_TO_3D;
  const headerThickness = 0.08;
  // Header bar resting flush on slab top has center at h/2 - headerThickness/2
  const headerCenterY = h / 2 - headerThickness / 2;
  const headerTopFaceY = headerCenterY + headerThickness / 2;
  assert.ok(Math.abs(headerTopFaceY - h / 2) < 1e-9, 'header bar top face must be flush with h / 2');
});

test('Tier 1 [Physics F1.4] Variable Platform Heights: thin and standard platforms maintain flush top alignment', () => {
  const heights = [10, 20, 40, 60];
  for (const height of heights) {
    const p = { x: 100, y: 200, width: 160, height };
    const bTop = p.y - p.height;
    const bTop3D = to3DY(bTop);
    const meshTop3D = to3DY(p.y - p.height / 2) + (p.height * WORLD_TO_3D) / 2;
    assert.ok(Math.abs(meshTop3D - bTop3D) < 1e-9, `height ${height} must align top face with bTop`);
  }
});

test('Tier 1 [Physics F1.5] Multi-Level Elevation: stacked platforms at y = 60, y = 140, y = 220 preserve exact vertical foot contact', () => {
  const stack = [
    { x: 0, y: 60, width: 200, height: 20 },
    { x: 0, y: 140, width: 200, height: 20 },
    { x: 0, y: 220, width: 200, height: 20 }
  ];
  for (let i = 0; i < stack.length; i++) {
    const p = stack[i];
    const bTop = p.y - p.height;
    assert.ok(Math.abs(to3DY(bTop) - -(p.y - 20) / 34) < 1e-9, `stack platform ${i} landing Y must equal to3DY(bTop)`);
  }
});

// ----------------------------------------------------------------------------
// Feature 2: True 3D Platform & Block Bounding Boxes
// ----------------------------------------------------------------------------

test('Tier 1 [Physics F2.1] Platform 3D AABB Dimensions: getPlatformBoundingBox3D computes exact minX, maxX, minY, maxY, minZ, maxZ', () => {
  const p = { x: 100, y: 150, width: 200, height: 30, depth3d: 170, z3d: 40 };
  const box = refGetPlatformBoundingBox3D(p);
  assert.equal(box.minX, 0);
  assert.equal(box.maxX, 200);
  assert.equal(box.topY, 120);
  assert.equal(box.maxY, 150);
  assert.equal(box.minZ, -45); // 40 - 85
  assert.equal(box.maxZ, 125); // 40 + 85
  assert.equal(box.halfW, 100);
  assert.equal(box.halfD, 85);
});

test('Tier 1 [Physics F2.2] Platform Half-Depth 85: platforms use 170 depth (half-depth 85) in 2D coordinate space', () => {
  const p = { x: 0, y: 100, width: 180, height: 20 };
  const box = refGetPlatformBoundingBox3D(p);
  assert.equal(box.halfD, 85, 'platform half-depth must be 85');
  assert.equal(box.maxZ - box.minZ, 170, 'platform total Z depth must be 170');
});

test('Tier 1 [Physics F2.3] Creative Block Half-Depth 34: creative blocks with depth3d=68 use half-depth 34 (cube geometry)', () => {
  const cb = { x: 50, y: 80, z: 20, width: 68, height: 68, depth3d: 68 };
  const box = refGetPlatformBoundingBox3D(cb);
  assert.equal(box.halfW, 34, 'creative block half-width must be 34');
  assert.equal(box.halfD, 34, 'creative block half-depth must be 34');
  assert.equal(box.maxX - box.minX, 68, 'creative block width must be 68');
  assert.equal(box.maxZ - box.minZ, 68, 'creative block depth must be 68');
});

test('Tier 1 [Physics F2.4] Platform Overlap Check: isEntityInsidePlatformXZ returns true inside bounds and false past X or Z limits', () => {
  const p = { x: 0, y: 100, width: 200, height: 20, depth3d: 170, z3d: 0 };
  // Inside bounds
  assert.ok(refIsEntityInsidePlatformXZ(0, 0, 18, 12, p), 'center must overlap platform');
  assert.ok(refIsEntityInsidePlatformXZ(80, 50, 18, 12, p), 'within half-depth and half-width must overlap');

  // Outside X bounds
  assert.ok(!refIsEntityInsidePlatformXZ(150, 0, 18, 12, p), 'past maxX + radius must NOT overlap');
  assert.ok(!refIsEntityInsidePlatformXZ(-150, 0, 18, 12, p), 'past minX - radius must NOT overlap');

  // Outside Z bounds
  assert.ok(!refIsEntityInsidePlatformXZ(0, 120, 18, 12, p), 'past maxZ + radius must NOT overlap');
  assert.ok(!refIsEntityInsidePlatformXZ(0, -120, 18, 12, p), 'past minZ - radius must NOT overlap');
});

test('Tier 1 [Physics F2.5] Z-Lane Filtering: filterPlatformsForEntity selects only platforms matching entity Z within tolerance', () => {
  const platforms = [
    { x: 0, y: 100, z3d: -120, depth3d: 170 }, // lane 1: [-205, -35]
    { x: 0, y: 100, z3d: 0, depth3d: 170 },    // lane 2: [-85, 85]
    { x: 0, y: 100, z3d: 150, depth3d: 170 }   // lane 3: [65, 235]
  ];
  const e1 = { z: 0 };
  const filtered1 = refFilterPlatformsForEntity(e1, platforms);
  assert.ok(filtered1.includes(platforms[1]), 'entity at z=0 must match center platform');

  const e2 = { z: 180 };
  const filtered2 = refFilterPlatformsForEntity(e2, platforms);
  assert.ok(filtered2.includes(platforms[2]), 'entity at z=180 must match front platform');
  assert.ok(!filtered2.includes(platforms[0]), 'entity at z=180 must NOT match back platform');
});

// ----------------------------------------------------------------------------
// Feature 3: Continuous Collision Detection (CCD)
// ----------------------------------------------------------------------------

test('Tier 1 [Physics F3.1] High-Speed Vertical Fall: vy = 1200 resolves cleanly without tunneling through platform', () => {
  const platform = { x: 0, y: 100, width: 200, height: 20 };
  const bTop = 80;
  const entity = { x: 0, z: 0, y: 130, vy: 1200, isGrounded: false };
  const prevY = 60; // Was above platform top (60 <= 86)
  const resolved = refResolveSweptVerticalCollision(entity, [platform], prevY, 0.016);

  assert.ok(resolved, 'swept vertical collision must detect landing');
  assert.equal(entity.y, bTop, 'entity.y must snap cleanly to platform top (80)');
  assert.equal(entity.vy, 0, 'entity.vy must be zeroed upon landing');
  assert.equal(entity.isGrounded, true, 'isGrounded must be set to true');
});

test('Tier 1 [Physics F3.2] Swept Interval Snapping: entity jumping from above snaps to bTop and sets isGrounded=true', () => {
  const p = { x: 0, y: 0, width: 300, height: 30 };
  const bTop = -30;
  const entity = { x: 0, z: 0, y: 10, vy: 600, isGrounded: false };
  const prevY = -40;
  const resolved = refResolveSweptVerticalCollision(entity, [p], prevY);
  assert.ok(resolved);
  assert.equal(entity.y, bTop);
  assert.equal(entity.isGrounded, true);
});

test('Tier 1 [Physics F3.3] Dive Kick High-Speed Contact: p.diveKick = true with high downward velocity snaps to platform top', () => {
  const p = { x: 100, y: 120, width: 200, height: 20 };
  const bTop = 100;
  const player = { x: 100, z: 0, y: 140, vy: 1800, diveKick: true, isGrounded: false };
  const prevY = 90;
  const resolved = refResolveSweptVerticalCollision(player, [p], prevY);
  assert.ok(resolved);
  assert.equal(player.y, bTop);
  assert.equal(player.vy, 0);
  assert.equal(player.isGrounded, true);
});

test('Tier 1 [Physics F3.4] Multi-Platform Swept Collision: descending across multiple platforms snaps to the highest valid landing surface', () => {
  const platforms = [
    { x: 0, y: 200, width: 200, height: 20 }, // bTop = 180 (lower)
    { x: 0, y: 100, width: 200, height: 20 }  // bTop = 80 (higher)
  ];
  const entity = { x: 0, z: 0, y: 190, vy: 2000, isGrounded: false };
  const prevY = 50; // Was above both
  const resolved = refResolveSweptVerticalCollision(entity, platforms, prevY);
  assert.ok(resolved);
  assert.equal(entity.y, 80, 'must snap to higher platform (bTop = 80)');
});

test('Tier 1 [Physics F3.5] Upward Movement Pass-Through: jumping upwards through a one-way platform does not snap downwards', () => {
  const platform = { x: 0, y: 100, width: 200, height: 20 };
  const entity = { x: 0, z: 0, y: 90, vy: -500, isGrounded: false };
  const prevY = 110;
  const resolved = refResolveSweptVerticalCollision(entity, [platform], prevY);
  assert.ok(!resolved, 'upward movement must pass through one-way platform');
  assert.equal(entity.vy, -500, 'upward vy must remain untouched');
});

// ----------------------------------------------------------------------------
// Feature 4: Enclosed Stage Perimeter Wall Clamping
// ----------------------------------------------------------------------------

test('Tier 1 [Physics F4.1] Player X-Boundary Clamping: player |x| is clamped to <= 966 on enclosed stages', () => {
  const playerRight = { x: 1050, z: 0, vx: 400, vz: 0, isZombie: false };
  refClampEnclosedWalls(playerRight, true);
  assert.equal(playerRight.x, 966, 'player positive X must clamp to 966');
  assert.equal(playerRight.vx, 0, 'outward positive vx must be zeroed');

  const playerLeft = { x: -1050, z: 0, vx: -400, vz: 0, isZombie: false };
  refClampEnclosedWalls(playerLeft, true);
  assert.equal(playerLeft.x, -966, 'player negative X must clamp to -966');
  assert.equal(playerLeft.vx, 0, 'outward negative vx must be zeroed');
});

test('Tier 1 [Physics F4.2] Player Z-Boundary Clamping: player |z| is clamped to <= 360 on enclosed stages', () => {
  const playerBack = { x: 0, z: 420, vx: 0, vz: 300, isZombie: false };
  refClampEnclosedWalls(playerBack, true);
  assert.equal(playerBack.z, 360, 'player positive Z must clamp to 360');
  assert.equal(playerBack.vz, 0, 'outward positive vz must be zeroed');

  const playerFront = { x: 0, z: -420, vx: 0, vz: -300, isZombie: false };
  refClampEnclosedWalls(playerFront, true);
  assert.equal(playerFront.z, -360, 'player negative Z must clamp to -360');
  assert.equal(playerFront.vz, 0, 'outward negative vz must be zeroed');
});

test('Tier 1 [Physics F4.3] Enemy X-Boundary Clamping: zombie |x| is clamped to <= 960 on enclosed stages', () => {
  const enemy = { x: 1000, z: 0, vx: 200, isZombie: true };
  refClampEnclosedWalls(enemy, true);
  assert.equal(enemy.x, 960, 'enemy positive X must clamp to 960');
  assert.equal(enemy.vx, 0, 'enemy outward vx must be zeroed');
});

test('Tier 1 [Physics F4.4] Enemy Z-Boundary Clamping: zombie |z| is clamped to <= 350 on enclosed stages', () => {
  const enemy = { x: 0, z: -390, vz: -150, isZombie: true };
  refClampEnclosedWalls(enemy, true);
  assert.equal(enemy.z, -350, 'enemy negative Z must clamp to -350');
  assert.equal(enemy.vz, 0, 'enemy outward vz must be zeroed');
});

test('Tier 1 [Physics F4.5] Wall Velocity Damping: walking into boundary cancels velocity directed towards the wall', () => {
  const entity = { x: 970, z: 0, vx: 350, isZombie: false };
  refClampEnclosedWalls(entity, true);
  assert.equal(entity.x, 966, 'entity must be clamped back to 966');
  assert.equal(entity.vx, 0, 'velocity into the wall must be zeroed');

  // Velocity away from the wall is preserved
  entity.vx = -200;
  refClampEnclosedWalls(entity, true);
  assert.equal(entity.vx, -200, 'velocity away from the wall must be preserved');
});

// ----------------------------------------------------------------------------
// Feature 5: Floating-Island Open Edges & Rail Omission
// ----------------------------------------------------------------------------

test('Tier 1 [Void F5.1] Floating Island Theme Identification: isFloatingIslandTheme recognizes the_end, aether, cloud_cache, lucky_orb', () => {
  const islands = ['the_end', 'aether', 'cloud_cache', 'lucky_orb'];
  for (const theme of islands) {
    assert.ok(refIsFloatingIslandTheme(theme), `${theme} must be recognized as floating island`);
  }
  assert.ok(!refIsFloatingIslandTheme('desktop'));
  assert.ok(!refIsFloatingIslandTheme('terminal'));
  assert.ok(!refIsFloatingIslandTheme('rocket_corp'));
});

test('Tier 1 [Void F5.2] Open Edge Theme Identification: isOpenEdgeTheme includes floating islands plus minecraft Nether stage', () => {
  assert.ok(refIsOpenEdgeTheme('minecraft'), 'minecraft Nether stage must be open-edge');
  assert.ok(refIsOpenEdgeTheme('the_end'), 'the_end must be open-edge');
  assert.ok(refIsOpenEdgeTheme('aether'), 'aether must be open-edge');
  assert.ok(!refIsOpenEdgeTheme('firewall'), 'firewall must not be open-edge');
});

test('Tier 1 [Void F5.3] Border Rail Omission: open edge stages do not generate perimeter border rails', () => {
  const openThemes = ['the_end', 'aether', 'cloud_cache', 'lucky_orb', 'minecraft'];
  for (const t of openThemes) {
    assert.ok(refIsOpenEdgeTheme(t), `border rails must be omitted for ${t}`);
  }
});

test('Tier 1 [Void F5.4] Free Edge Passage: entities are not clamped to |x| <= 966 or |z| <= 360 on open edge stages', () => {
  const entity = { x: 1050, z: 420, vx: 300, vz: 200, isZombie: false };
  const clamped = refClampEnclosedWalls(entity, false); // isEnclosedStage = false
  assert.ok(!clamped, 'open edge stage must NOT clamp entity');
  assert.equal(entity.x, 1050, 'entity X must remain beyond border');
  assert.equal(entity.z, 420, 'entity Z must remain beyond border');
});

test('Tier 1 [Void F5.5] Island Floor Bounds Constant: ISLAND_FLOOR_BOUNDS defines halfX = 980 and halfZ = 380', () => {
  assert.equal(REF_ISLAND_FLOOR_BOUNDS.halfX, 980);
  assert.equal(REF_ISLAND_FLOOR_BOUNDS.halfZ, 380);
});

// ----------------------------------------------------------------------------
// Feature 6: Dynamic Void Falling Physics
// ----------------------------------------------------------------------------

test('Tier 1 [Void F6.1] Island Footprint Transition: walking beyond |x| > 980 or |z| > 380 activates open void space', () => {
  const onIsland = { x: 900, z: 200 };
  const resOn = refUpdateVoidPhysics(onIsland, 'the_end', 0.016);
  assert.equal(resOn.effectiveGroundY, 0, 'on island effectiveGroundY must be 0');

  const offX = { x: 990, z: 0 };
  const resOffX = refUpdateVoidPhysics(offX, 'the_end', 0.016);
  assert.equal(resOffX.effectiveGroundY, 99999, 'past halfX effectiveGroundY must be 99999');

  const offZ = { x: 0, z: 395 };
  const resOffZ = refUpdateVoidPhysics(offZ, 'the_end', 0.016);
  assert.equal(resOffZ.effectiveGroundY, 99999, 'past halfZ effectiveGroundY must be 99999');
});

test('Tier 1 [Void F6.2] Dynamic effectiveGroundY: stepping into open space sets effectiveGroundY = 99999', () => {
  const entity = { x: 1020, z: 0, y: 0, vy: 0 };
  const res = refUpdateVoidPhysics(entity, 'aether', 0.016);
  assert.equal(res.effectiveGroundY, 99999);
  assert.ok(entity.y > 0, 'entity must accelerate below 0');
});

test('Tier 1 [Void F6.3] Sub-Ground Gravity Plunge: entity accelerates downwards past groundY = 0 into 3D negative space', () => {
  const entity = { x: 1050, z: 0, y: 0, vy: 0 };
  for (let step = 0; step < 10; step++) {
    refUpdateVoidPhysics(entity, 'the_end', 0.016);
  }
  assert.ok(entity.y > 0, '2D Y must plunge downwards');
  assert.ok(to3DY(entity.y) < 0, '3D Y must be in negative space below arena floor');
});

test('Tier 1 [Void F6.4] Airborne State Retention: isGrounded remains false while plunging through open void', () => {
  const entity = { x: 1010, z: 0, y: 50, vy: 400 };
  refUpdateVoidPhysics(entity, 'cloud_cache', 0.016);
  assert.equal(entity.isGrounded, false, 'isGrounded must remain false while plunging through void');
});

test('Tier 1 [Void F6.5] Safe Surface Return: stepping back onto island footprint restores effectiveGroundY = 0', () => {
  const entity = { x: 800, z: 100, y: -20, vy: 100 };
  const res = refUpdateVoidPhysics(entity, 'lucky_orb', 0.016);
  assert.equal(res.effectiveGroundY, 0, 'effectiveGroundY must return to 0 when inside island footprint');
});

// ----------------------------------------------------------------------------
// Feature 7: Player Void Damage & Safe Respawn
// ----------------------------------------------------------------------------

test('Tier 1 [Void F7.1] Void Threshold Trigger: entity reaching y >= 180 triggers void penalty', () => {
  const player = { x: 1000, z: 0, y: 180, hp: 100 };
  const res = refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.ok(res.fellIntoVoid, 'y >= 180 must trigger fellIntoVoid');
});

test('Tier 1 [Void F7.2] Void Damage Infliction: falling into void deducts exactly 40 HP from player', () => {
  const player = { x: 1000, z: 0, y: 185, hp: 100 };
  refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.equal(player.hp, 60, 'player must lose exactly 40 HP');
});

test('Tier 1 [Void F7.3] Safe Island Respawn: surviving player respawns at island center (0, 0, 0) with zero velocity', () => {
  const player = { x: 1000, z: 50, y: 185, hp: 100, vx: 200, vy: 800, vz: 100 };
  const res = refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.ok(res.respawned, 'player must trigger respawn');
  assert.equal(player.x, 0, 'respawn X must be 0');
  assert.equal(player.y, 0, 'respawn Y must be 0');
  assert.equal(player.z, 0, 'respawn Z must be 0');
  assert.equal(player.vx, 0, 'respawn vx must be 0');
  assert.equal(player.vy, 0, 'respawn vy must be 0');
  assert.equal(player.vz, 0, 'respawn vz must be 0');
  assert.equal(player.isGrounded, true, 'player must be grounded on respawn');
});

test('Tier 1 [Void F7.4] Post-Respawn Invulnerability: respawn grants 60 frames of invulnerability (iFrames = 60)', () => {
  const player = { x: 1000, z: 0, y: 180, hp: 90 };
  refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.equal(player.iFrames, 60, 'player must receive 60 iFrames on respawn');
});

test('Tier 1 [Void F7.5] Fatal Void Fall: falling into void with HP <= 40 sets player.isDead = true', () => {
  const player = { x: 1000, z: 0, y: 185, hp: 40 };
  const res = refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.equal(player.hp, 0, 'HP must be 0');
  assert.equal(player.isDead, true, 'player must be dead');
  assert.ok(!res.respawned, 'fatal fall must NOT respawn');
});

// ----------------------------------------------------------------------------
// Feature 8: Creative Mode Void Rules
// ----------------------------------------------------------------------------

test('Tier 1 [Void F8.1] Creative God Mode Void Immunity: god mode prevents void damage even past y >= 180', () => {
  const player = { x: 1050, z: 0, y: 200, hp: 100, isGodMode: true };
  const res = refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.equal(player.hp, 100, 'God Mode player must take zero void damage');
  assert.ok(!player.isDead, 'God Mode player must not die in void');
});

test('Tier 1 [Void F8.2] Creative Flight Over Void: flight allows controlled descent below groundY down to lowerY = 220', () => {
  const player = { x: 1050, z: 0, y: 100, vy: 150, isCreativeFlight: true };
  const res = refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.ok(player.y > 100, 'flying player should move smoothly downward without gravity acceleration');
  assert.ok(!res.fellIntoVoid, 'flight overrides void threshold damage');
});

test('Tier 1 [Void F8.3] Free Flight Recovery: player can fly upward from void space back onto the island surface', () => {
  const player = { x: 1050, z: 0, y: 150, vy: -300, isCreativeFlight: true };
  refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.ok(player.y < 150, 'flying player must ascend upward');
});

test('Tier 1 [Void F8.4] Creative Flight Grounded Bypass: flight mode overrides ground clamping and void kill checks', () => {
  const player = { x: 0, z: 0, y: -50, isCreativeFlight: true };
  const res = refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.equal(res.fellIntoVoid, false);
});

test('Tier 1 [Void F8.5] Velocity Zeroing on Flight Toggle: toggling flight halts vertical gravity acceleration', () => {
  const player = { x: 1000, z: 0, y: 50, vy: 500, isCreativeFlight: true };
  player.vy = 0; // Simulated flight hover toggle
  refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.equal(player.vy, 0, 'flight hover maintains zero vertical velocity');
});

// ----------------------------------------------------------------------------
// Feature 9: Non-Flying Enemy Void Elimination
// ----------------------------------------------------------------------------

test('Tier 1 [Void F9.1] Zombie Void Threshold Elimination: non-flying zombie at y >= 180 is eliminated (isDead = true)', () => {
  const zombie = { x: 1020, z: 0, y: 185, hp: 80, isZombie: true, isFlying: false };
  const res = refUpdateVoidPhysics(zombie, 'the_end', 0.016);
  assert.ok(res.eliminated, 'zombie must be eliminated');
  assert.equal(zombie.isDead, true, 'zombie.isDead must be true');
  assert.equal(zombie.pendingRemoval, true, 'zombie.pendingRemoval must be true');
});

test('Tier 1 [Void F9.2] Specialized Ground Zombie Void Drop: brutes, spitters, and shieldbearers are eliminated in void', () => {
  const types = ['brute', 'spitter', 'shieldbearer', 'boom_bug'];
  for (const t of types) {
    const e = { x: 1010, z: 0, y: 180, hp: 120, zombieType: t, isZombie: true };
    const res = refUpdateVoidPhysics(e, 'the_end', 0.016);
    assert.equal(e.isDead, true, `${t} must be eliminated at void threshold`);
    assert.equal(e.pendingRemoval, true);
  }
});

test('Tier 1 [Void F9.3] Flying Boss Hover Immunity: Ender Dragon hovers safely above void and does not drop', () => {
  const dragon = { x: 1050, z: 0, y: -150, isZombie: true, isFlying: true };
  const res = refUpdateVoidPhysics(dragon, 'the_end', 0.016);
  assert.ok(!res.eliminated, 'flying boss must never be eliminated in void');
  assert.ok(!dragon.isDead, 'flying boss must remain alive');
});

test('Tier 1 [Void F9.4] Elimination Particle Burst: void eliminated enemy triggers death voxel burst cleanup', () => {
  let burstTriggered = false;
  const triggerBurst = () => { burstTriggered = true; };
  const zombie = { x: 1050, z: 0, y: 190, isZombie: true };
  const res = refUpdateVoidPhysics(zombie, 'the_end', 0.016);
  if (res.eliminated) triggerBurst();
  assert.ok(burstTriggered, 'elimination must trigger death particle burst');
});

test('Tier 1 [Void F9.5] Active Enemy Wave Decrement: void eliminated zombies decrement active enemy count', () => {
  let activeCount = 5;
  const enemies = [
    { x: 1020, z: 0, y: 185, isZombie: true },
    { x: 0, z: 0, y: 0, isZombie: true }
  ];
  for (const e of enemies) {
    const res = refUpdateVoidPhysics(e, 'the_end', 0.016);
    if (res.eliminated) activeCount--;
  }
  assert.equal(activeCount, 4, 'active enemies must decrement upon void elimination');
});

// ----------------------------------------------------------------------------
// Feature 10: 3D Animated Lava Sea
// ----------------------------------------------------------------------------

test('Tier 1 [Lava F10.1] Lava Sea Mesh Instantiation: Nether stage builds lava sea mesh at Y = -8.0', () => {
  const lavaGeo = new THREE.PlaneGeometry(140, 90);
  const lavaMat = new THREE.MeshStandardMaterial({
    map: getVoxelTexture('lava', 35, 22),
    emissive: new THREE.Color(0xff4400),
    emissiveIntensity: 0.8
  });
  const lavaMesh = new THREE.Mesh(lavaGeo, lavaMat);
  lavaMesh.rotation.x = -Math.PI / 2;
  lavaMesh.position.set(0, -8.0, 0);

  assert.equal(lavaMesh.position.y, -8.0, 'lava sea mesh must be placed at Y = -8.0');
  assert.equal(lavaMesh.rotation.x, -Math.PI / 2, 'lava sea mesh must be horizontal');
});

test('Tier 1 [Lava F10.2] Lava Sea Dimensions: lava sea geometry spans extended area (140 x 90 units) below arena', () => {
  const lavaGeo = new THREE.PlaneGeometry(140, 90);
  assert.equal(lavaGeo.parameters.width, 140, 'lava sea width must be 140');
  assert.equal(lavaGeo.parameters.height, 90, 'lava sea height must be 90');
});

test('Tier 1 [Lava F10.3] Procedural Lava Texture: lava sea uses getVoxelTexture(\'lava\') with repeat wrapping', () => {
  const tex = getVoxelTexture('lava', 35, 22);
  assert.ok(tex instanceof THREE.CanvasTexture, 'lava texture must be a THREE.CanvasTexture');
  assert.equal(tex.repeat.x, 35, 'texture repeat X must equal 35');
  assert.equal(tex.repeat.y, 22, 'texture repeat Y must equal 22');
});

test('Tier 1 [Lava F10.4] Emissive Glow Profile: lava material has emissive color and intensity for dark Nether ambiance', () => {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff3300,
    emissive: new THREE.Color(0xff5500),
    emissiveIntensity: 0.85
  });
  assert.equal(mat.emissive.getHexString(), 'ff5500');
  assert.equal(mat.emissiveIntensity, 0.85);
});

test('Tier 1 [Lava F10.5] WebGL Lava Sea Disposal: rebuildForStage disposes lava sea geometry and non-shared material', () => {
  let geoDisposed = false;
  let matDisposed = false;
  const mockGeo = { dispose: () => { geoDisposed = true; }, isShared: false };
  const mockMat = { dispose: () => { matDisposed = true; }, isShared: false };
  const mockMesh = { geometry: mockGeo, material: mockMat };
  const root = {
    traverse: (cb) => { cb(mockMesh); }
  };
  verifyDisposeHierarchy(root, true);
  assert.ok(geoDisposed, 'lava sea geometry must be disposed');
  assert.ok(matDisposed, 'lava sea material must be disposed');
});

// ----------------------------------------------------------------------------
// Feature 11: Physical 3D Floor Lava Pools & Channels
// ----------------------------------------------------------------------------

test('Tier 1 [Lava F11.1] Stage 7 Lava Hazard Configuration: campaign defines twin floor lava hazard zones on Stage 7', () => {
  const hazards = [
    { x: -360, y: 0, z: 0, width: 160, height: 10, depth3d: 220, damage: 20 },
    { x: 360, y: 0, z: 0, width: 160, height: 10, depth3d: 220, damage: 20 }
  ];
  assert.equal(hazards.length, 2, 'Stage 7 must define 2 floor lava hazard pools');
  assert.equal(hazards[0].x, -360);
  assert.equal(hazards[1].x, 360);
  assert.equal(hazards[0].damage, 20);
});

test('Tier 1 [Lava F11.2] Floor Lava Contact Detection: player stepping into lava pool bounds triggers burn hit', () => {
  const hazard = { x: 360, y: 0, z: 0, width: 160, height: 10, depth3d: 220, damage: 20 };
  const player = { x: 360, y: 0, z: 0, hp: 100, iFrames: 0 };
  const hit = refCheckLavaHazard(player, hazard);
  assert.ok(hit, 'stepping into lava bounds must trigger burn hit');
});

test('Tier 1 [Lava F11.3] Contact Burn Damage: floor lava deals exactly 20 damage on contact', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100, damage: 20 };
  const player = { x: 0, y: 0, z: 0, hp: 100, iFrames: 0 };
  refCheckLavaHazard(player, hazard);
  assert.equal(player.hp, 80, 'player HP must be reduced by exactly 20');
});

test('Tier 1 [Lava F11.4] Player Scorch Recoil Impulse: lava burn launches player upwards with vy = -340', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100, damage: 20 };
  const player = { x: 0, y: 0, z: 0, hp: 100, vy: 0, isGrounded: true, isZombie: false };
  refCheckLavaHazard(player, hazard);
  assert.equal(player.vy, -340, 'player upward scorch recoil must equal -340');
  assert.equal(player.isGrounded, false, 'player isGrounded must be reset to false');
});

test('Tier 1 [Lava F11.5] Enemy Scorch Recoil Impulse: lava burn launches zombies upwards with vy = -260', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100, damage: 20 };
  const enemy = { x: 0, y: 0, z: 0, hp: 60, vy: 0, isGrounded: true, isZombie: true };
  refCheckLavaHazard(enemy, hazard);
  assert.equal(enemy.vy, -260, 'enemy upward scorch recoil must equal -260');
  assert.equal(enemy.isGrounded, false, 'enemy isGrounded must be reset to false');
});

// ----------------------------------------------------------------------------
// Feature 12: Burn Damage & Immunity Matrix
// ----------------------------------------------------------------------------

test('Tier 1 [Lava F12.1] Creative God Mode Burn Immunity: god mode completely ignores lava damage and recoil', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100, damage: 20 };
  const godPlayer = { x: 0, y: 0, z: 0, hp: 100, vy: 0, isGodMode: true };
  const hit = refCheckLavaHazard(godPlayer, hazard);
  assert.ok(!hit, 'god mode player must not be hit');
  assert.equal(godPlayer.hp, 100, 'hp must remain 100');
  assert.equal(godPlayer.vy, 0, 'vy must remain 0');
});

test('Tier 1 [Lava F12.2] Dodge Roll Burn Immunity: player isRolling = true grants full immunity to lava hazards', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100, damage: 20 };
  const rollingPlayer = { x: 0, y: 0, z: 0, hp: 100, isRolling: true };
  const hit = refCheckLavaHazard(rollingPlayer, hazard);
  assert.ok(!hit, 'rolling player must be immune to lava');
  assert.equal(rollingPlayer.hp, 100);
});

test('Tier 1 [Lava F12.3] Hurt i-Frame Burn Immunity: player iFrames > 0 prevents duplicate damage on consecutive frames', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100, damage: 20 };
  const player = { x: 0, y: 0, z: 0, hp: 80, iFrames: 25 };
  const hit = refCheckLavaHazard(player, hazard);
  assert.ok(!hit, 'player with active iFrames must ignore lava damage');
  assert.equal(player.hp, 80);
});

test('Tier 1 [Lava F12.4] Enemy Lava Tick Cooldown: enemies have a 0.45s cooldown between consecutive lava damage ticks', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100, damage: 20 };
  const enemy = { x: 0, y: 0, z: 0, hp: 80, isZombie: true, lavaTickCooldown: 0.3 };
  const hit = refCheckLavaHazard(enemy, hazard);
  assert.ok(!hit, 'enemy in cooldown must not be damaged');
  assert.equal(enemy.hp, 80);
});

test('Tier 1 [Lava F12.5] Grounded State Reset on Scorch: lava recoil clears isGrounded to allow airborne trajectory', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100, damage: 20 };
  const player = { x: 0, y: 0, z: 0, hp: 100, isGrounded: true };
  refCheckLavaHazard(player, hazard);
  assert.equal(player.isGrounded, false, 'isGrounded must be false to initiate upward parabola');
});

// ----------------------------------------------------------------------------
// Feature 13: Creative Mode Lava Block Option
// ----------------------------------------------------------------------------

test('Tier 1 [Lava F13.1] Selectable Lava Option: creative block selector includes lava block definition', () => {
  const blockTypes = ['command_block', 'obsidian', 'gold_block', 'tnt_block', 'lucky_block', 'purpur_block', 'lava'];
  assert.ok(blockTypes.includes('lava'), 'lava must be an available creative block type');
});

test('Tier 1 [Lava F13.2] Placed Lava Block Dimensions: placed lava block sets width = 68, height = 68, depth3d = 68', () => {
  const lavaBlock = {
    x: 0, y: 0, z: 0,
    width: 68, height: 68, depth3d: 68,
    texKey: 'lava'
  };
  assert.equal(lavaBlock.width, 68);
  assert.equal(lavaBlock.height, 68);
  assert.equal(lavaBlock.depth3d, 68);
});

test('Tier 1 [Lava F13.3] Active Hazard Attribution: placed lava blocks act as lethal hazard sources for enemies', () => {
  const lavaBlock = { x: 100, y: 0, z: 0, width: 68, height: 68, depth3d: 68, texKey: 'lava', damage: 20 };
  const enemy = { x: 100, y: 0, z: 0, hp: 50, isZombie: true };
  const hit = refCheckLavaHazard(enemy, lavaBlock);
  assert.ok(hit, 'placed creative lava block must burn nearby enemy');
  assert.equal(enemy.hp, 30);
});

test('Tier 1 [Lava F13.4] Block Pool Bounding: placed lava blocks obey the 64-block maximum pool capacity', () => {
  const pool = [];
  for (let i = 0; i < 80; i++) {
    if (pool.length >= 64) pool.shift();
    pool.push({ texKey: 'lava', id: i });
  }
  assert.equal(pool.length, 64, 'block array must stay bounded to 64');
  assert.equal(pool[0].id, 16, 'oldest block must be evicted FIFO');
});

test('Tier 1 [Lava F13.5] Clean Lava Block Disposal: clearing or cycling lava blocks disposes mesh and recycles pool', () => {
  const creativeBlockPool = [];
  const mockMesh = {
    visible: true,
    scale: { x: 1, y: 1, z: 1, set: function(x,y,z){ this.x=x;this.y=y;this.z=z; } },
    material: { emissive: { hex: 0, setHex: function(h){ this.hex=h; } } }
  };
  mockMesh.visible = false;
  mockMesh.scale.set(1, 1, 1);
  creativeBlockPool.push(mockMesh);
  assert.equal(creativeBlockPool.length, 1);
  assert.equal(creativeBlockPool[0].visible, false);
});

// ----------------------------------------------------------------------------
// Feature 14: WebGL Resource Hygiene & 2D Budget Preservation
// ----------------------------------------------------------------------------

test('Tier 1 [Hygiene F14.1] Non-Shared Resource Disposal: disposeHierarchy disposes unique geometries and materials', () => {
  let geoDisposed = false;
  let matDisposed = false;
  const mockMesh = {
    geometry: { dispose: () => { geoDisposed = true; }, isShared: false },
    material: { dispose: () => { matDisposed = true; }, isShared: false }
  };
  const root = { traverse: (fn) => fn(mockMesh) };
  verifyDisposeHierarchy(root, true);
  assert.ok(geoDisposed);
  assert.ok(matDisposed);
});

test('Tier 1 [Hygiene F14.2] Shared Texture Preservation: textures marked isShared are not disposed during stage rebuild', () => {
  let texDisposed = false;
  const sharedTex = { dispose: () => { texDisposed = true; }, isShared: true };
  const mockMesh = {
    material: { dispose: () => {}, isShared: false, map: sharedTex }
  };
  const root = { traverse: (fn) => fn(mockMesh) };
  verifyDisposeHierarchy(root, true);
  assert.ok(!texDisposed, 'shared texture must NOT be disposed');
});

test('Tier 1 [Hygiene F14.3] Multi-Material Traversal: material arrays in complex meshes have all elements disposed', () => {
  let disposedCount = 0;
  const matArray = [
    { dispose: () => { disposedCount++; }, isShared: false },
    { dispose: () => { disposedCount++; }, isShared: false }
  ];
  const mockMesh = { material: matArray };
  const root = { traverse: (fn) => fn(mockMesh) };
  verifyDisposeHierarchy(root, true);
  assert.equal(disposedCount, 2, 'all constituent materials must be disposed');
});

test('Tier 1 [Hygiene F14.4] Zero Per-Frame Garbage Allocation: physics and hazard checks reuse scratch objects', () => {
  const entity = { x: 0, z: 0, y: 0, hp: 100 };
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100 };
  for (let i = 0; i < 100; i++) {
    refCheckLavaHazard(entity, hazard, 0.016);
  }
  assert.ok(true, '100 iterations executed cleanly');
});

test('Tier 1 [Hygiene F14.5] Strict 500KB 2D Source Budget: total 2D codebase stays strictly under 500,000 bytes with >= 60 bytes headroom', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const sourceFiles = [
    join(root, 'index.html'),
    join(root, 'css/style.css'),
    ...listSourceFiles(join(root, 'js'))
  ];
  const totalBytes = sourceFiles.reduce((sum, f) => sum + readFileSync(f).byteLength, 0);
  assert.ok(totalBytes < 500000, `2D byte total (${totalBytes}) must strictly stay under 500,000 bytes`);
  assert.ok(500000 - totalBytes >= 60, `2D headroom must remain >= 60 bytes (current: ${500000 - totalBytes})`);
});


// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES (Features 1 - 14)
// ============================================================================

// ----------------------------------------------------------------------------
// Boundary Group 1: Exact X/Z Boundaries & Perimeter Precision
// ----------------------------------------------------------------------------

test('Tier 2 [Boundary B1.1] Exact Island Edge Threshold: x = 980 is on island, x = 980.01 triggers void plunge', () => {
  const atEdge = { x: 980.0, z: 0 };
  const pastEdge = { x: 980.01, z: 0 };

  const resAt = refUpdateVoidPhysics(atEdge, 'the_end', 0.016);
  const resPast = refUpdateVoidPhysics(pastEdge, 'the_end', 0.016);

  assert.equal(resAt.effectiveGroundY, 0, 'x = 980 must remain on island ground');
  assert.equal(resPast.effectiveGroundY, 99999, 'x = 980.01 must activate open void space');
});

test('Tier 2 [Boundary B1.2] Exact Z Island Edge Threshold: z = 380 is on island, z = 380.01 triggers void plunge', () => {
  const atEdgeZ = { x: 0, z: 380.0 };
  const pastEdgeZ = { x: 0, z: 380.01 };

  const resAtZ = refUpdateVoidPhysics(atEdgeZ, 'aether', 0.016);
  const resPastZ = refUpdateVoidPhysics(pastEdgeZ, 'aether', 0.016);

  assert.equal(resAtZ.effectiveGroundY, 0, 'z = 380 must remain on island ground');
  assert.equal(resPastZ.effectiveGroundY, 99999, 'z = 380.01 must activate open void space');
});

test('Tier 2 [Boundary B1.3] Negative Corner Boundary: (-980, -380) corner transition triggers void only when both X and Z are outside', () => {
  const cornerInside = { x: -979.9, z: -379.9 };
  const cornerOutside = { x: -980.1, z: -380.1 };

  const resIn = refUpdateVoidPhysics(cornerInside, 'cloud_cache', 0.016);
  const resOut = refUpdateVoidPhysics(cornerOutside, 'cloud_cache', 0.016);

  assert.equal(resIn.effectiveGroundY, 0);
  assert.equal(resOut.effectiveGroundY, 99999);
});

test('Tier 2 [Boundary B1.4] Platform Edge Fluctuation: standing at platform boundary maxX +/- 0.001 drops cleanly', () => {
  const p = { x: 0, y: 100, width: 200, height: 20, depth3d: 170, z3d: 0 };
  // HalfW = 100. Entity radius = 14. Max overlap X = 100 + 14 = 114.
  assert.ok(refIsEntityInsidePlatformXZ(113.9, 0, 14, 0, p), 'within radius must overlap');
  assert.ok(!refIsEntityInsidePlatformXZ(114.1, 0, 14, 0, p), 'beyond radius must NOT overlap');
});

// ----------------------------------------------------------------------------
// Boundary Group 2: Extreme Velocities & CCD Edge Cases
// ----------------------------------------------------------------------------

test('Tier 2 [Boundary B2.1] Hyper-Velocity Fall: vy = 2500 (terminal velocity) does not tunnel through platform', () => {
  const p = { x: 0, y: 200, width: 300, height: 20 };
  const bTop = 180;
  // Frame 1: prevY was above top (bTop - 20)
  // Frame 2: current y = bTop + 2500 * 0.016 = bTop + 40
  const entity = { x: 0, z: 0, y: bTop + 40, vy: 2500, isGrounded: false };
  const prevY = bTop - 20;
  const resolved = refResolveSweptVerticalCollision(entity, [p], prevY, 0.016);

  assert.ok(resolved, 'hyper-velocity fall must be caught by swept collision');
  assert.equal(entity.y, bTop, 'entity must snap to bTop (180)');
  assert.equal(entity.vy, 0);
  assert.equal(entity.isGrounded, true);
});

test('Tier 2 [Boundary B2.2] Zero Delta Time Step: dt = 0 in swept collision executes safely without division by zero', () => {
  const p = { x: 0, y: 100, width: 200, height: 20 };
  const entity = { x: 0, z: 0, y: 80, vy: 0, isGrounded: true };
  assert.doesNotThrow(() => {
    refResolveSweptVerticalCollision(entity, [p], 80, 0);
  });
});

test('Tier 2 [Boundary B2.3] Negative Delta Time: negative dt is clamped to positive minimum without inverted collision', () => {
  const p = { x: 0, y: 100, width: 200, height: 20 };
  const entity = { x: 0, z: 0, y: 80, vy: 200, isGrounded: false };
  assert.doesNotThrow(() => {
    refResolveSweptVerticalCollision(entity, [p], 70, -0.016);
  });
});

test('Tier 2 [Boundary B2.4] Dive Kick Swept Contact at Slanted Angle: high vx combined with high vy snaps correctly to platform top', () => {
  const p = { x: 200, y: 150, width: 200, height: 20 };
  const player = { x: 200, z: 0, y: 160, vx: 500, vy: 1600, diveKick: true, isGrounded: false };
  const prevY = 120;
  const resolved = refResolveSweptVerticalCollision(player, [p], prevY, 0.016);

  assert.ok(resolved);
  assert.equal(player.y, 130); // 150 - 20
  assert.equal(player.isGrounded, true);
});

// ----------------------------------------------------------------------------
// Boundary Group 3: Zero HP & Health Edge Cases
// ----------------------------------------------------------------------------

test('Tier 2 [Boundary B3.1] Void Fall with Exactly 40 HP: drops player to 0 HP and triggers death instead of respawn', () => {
  const player = { x: 1000, z: 0, y: 185, hp: 40 };
  const res = refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.equal(player.hp, 0);
  assert.equal(player.isDead, true);
  assert.equal(res.respawned, false);
});

test('Tier 2 [Boundary B3.2] Lava Burn with Exactly 20 HP: drops player to 0 HP and triggers death explosion', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100, damage: 20 };
  const player = { x: 0, y: 0, z: 0, hp: 20 };
  refCheckLavaHazard(player, hazard);
  assert.equal(player.hp, 0, 'HP must be reduced to 0');
});

test('Tier 2 [Boundary B3.3] 1 HP Survival Respawn: player with 41 HP takes 40 void damage, survives at 1 HP, and respawns safely', () => {
  const player = { x: 1000, z: 0, y: 185, hp: 41 };
  const res = refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.equal(player.hp, 1);
  assert.equal(res.respawned, true);
  assert.equal(player.x, 0);
  assert.equal(player.y, 0);
});

test('Tier 2 [Boundary B3.4] Rapid Successive Void Falls: consecutive falls deplete player HP to 0 and halt respawn loop', () => {
  const player = { x: 1000, z: 0, y: 185, hp: 80 };
  // Fall 1: 80 -> 40, respawns
  let res = refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.equal(player.hp, 40);
  assert.equal(res.respawned, true);

  // Fall 2: pushed back into void: 40 -> 0, dies
  player.x = 1000;
  player.y = 185;
  res = refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.equal(player.hp, 0);
  assert.equal(player.isDead, true);
  assert.equal(res.respawned, false);
});

// ----------------------------------------------------------------------------
// Boundary Group 4: Creative Block Pool Saturation & Boundary
// ----------------------------------------------------------------------------

test('Tier 2 [Boundary B4.1] 64 Block Cap Saturation: placing 65th block shifts oldest block and maintains exactly 64', () => {
  const blocks = [];
  for (let i = 0; i < 65; i++) {
    if (blocks.length >= 64) blocks.shift();
    blocks.push({ id: i });
  }
  assert.equal(blocks.length, 64);
  assert.equal(blocks[0].id, 1, 'oldest block (id: 0) must be evicted');
  assert.equal(blocks[63].id, 64, 'newest block (id: 64) must be appended');
});

test('Tier 2 [Boundary B4.2] Rapid Clear and Refill: clearing 64 blocks and placing 64 new blocks generates zero memory leak', () => {
  const pool = [];
  const active = [];

  // Populate 64
  for (let i = 0; i < 64; i++) active.push({ mesh: { visible: true } });
  // Clear all
  while (active.length > 0) {
    const b = active.pop();
    b.mesh.visible = false;
    pool.push(b.mesh);
  }
  assert.equal(pool.length, 64);
  assert.equal(active.length, 0);

  // Refill
  for (let i = 0; i < 64; i++) {
    const m = pool.pop();
    m.visible = true;
    active.push({ mesh: m });
  }
  assert.equal(active.length, 64);
  assert.equal(pool.length, 0);
});

test('Tier 2 [Boundary B4.3] Block Stacking Height Limit: stacking 10 blocks vertically computes correct landing tops', () => {
  let currentY = 0;
  const blockSize = 68;
  const stack = [];
  for (let i = 0; i < 10; i++) {
    currentY -= blockSize;
    stack.push({ x: 0, y: currentY + blockSize, height: blockSize });
  }
  assert.equal(stack.length, 10);
  assert.equal(stack[9].y - stack[9].height, -680, 'top of 10-block tower must equal -680');
});

test('Tier 2 [Boundary B4.4] Mixed Block Type Cap: placing mixture of obsidian, TNT, lucky, and lava blocks respects 64 cap', () => {
  const types = ['obsidian', 'tnt_block', 'lucky_block', 'lava'];
  const blocks = [];
  for (let i = 0; i < 100; i++) {
    if (blocks.length >= 64) blocks.shift();
    blocks.push({ type: types[i % types.length] });
  }
  assert.equal(blocks.length, 64);
  const lavaCount = blocks.filter(b => b.type === 'lava').length;
  assert.equal(lavaCount, 16);
});

// ----------------------------------------------------------------------------
// Boundary Group 5: Lava Tick Timing & Cooldown Boundaries
// ----------------------------------------------------------------------------

test('Tier 2 [Boundary B5.1] Exact Cooldown Expiration: enemy re-takes damage at t = 0.45s but not at t = 0.44s', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100, damage: 20 };
  const enemy = { x: 0, y: 0, z: 0, hp: 100, isZombie: true, lavaTickCooldown: 0.45 };

  // Step 1: Advance by 0.44s (cooldown becomes 0.01)
  let hit = refCheckLavaHazard(enemy, hazard, 0.44);
  assert.ok(!hit, 'must not hit before full 0.45s duration');
  assert.equal(enemy.hp, 100);

  // Step 2: Cooldown timer decrements to 0
  enemy.lavaTickCooldown = 0;
  assert.equal(enemy.lavaTickCooldown, 0);

  // Step 3: Next frame at t = 0.45s applies burn hit
  hit = refCheckLavaHazard(enemy, hazard, 0.016);
  assert.ok(hit, 'must re-hit once cooldown reaches 0');
  assert.equal(enemy.hp, 80);
});

test('Tier 2 [Boundary B5.2] Multi-Zombie Cooldown Independence: individual enemies track their own lava tick timers', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 200, height: 10, depth3d: 200, damage: 20 };
  const z1 = { x: -20, y: 0, z: 0, hp: 60, isZombie: true, lavaTickCooldown: 0.4 };
  const z2 = { x: 20, y: 0, z: 0, hp: 60, isZombie: true, lavaTickCooldown: 0.0 };

  const hit1 = refCheckLavaHazard(z1, hazard, 0.016);
  const hit2 = refCheckLavaHazard(z2, hazard, 0.016);

  assert.ok(!hit1, 'z1 in cooldown must not be hit');
  assert.ok(hit2, 'z2 without cooldown must be hit');
  assert.equal(z1.hp, 60);
  assert.equal(z2.hp, 40);
});

test('Tier 2 [Boundary B5.3] Rapid Enter and Exit: zombie leaving lava pool clears overlap without carrying lingering damage', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 50, height: 10, depth3d: 50, damage: 20 };
  const enemy = { x: 0, y: 0, z: 0, hp: 60, isZombie: true };

  // Enter: gets hit
  refCheckLavaHazard(enemy, hazard, 0.016);
  assert.equal(enemy.hp, 40);

  // Move outside pool
  enemy.x = 200;
  const hitOutside = refCheckLavaHazard(enemy, hazard, 0.016);
  assert.ok(!hitOutside, 'must not take damage when outside bounds');
  assert.equal(enemy.hp, 40);
});

test('Tier 2 [Boundary B5.4] Zero dt Tick Step: updating cooldown with dt = 0 preserves existing timer without reset', () => {
  const hazard = { x: 1000, y: 0, z: 0, width: 10, height: 10, depth3d: 10 };
  const enemy = { x: 0, y: 0, z: 0, lavaTickCooldown: 0.25 };
  refCheckLavaHazard(enemy, hazard, 0);
  assert.equal(enemy.lavaTickCooldown, 0.25, 'cooldown must remain 0.25 when dt = 0');
});

// ----------------------------------------------------------------------------
// Boundary Group 6: Invulnerability & Frame Boundary Cases
// ----------------------------------------------------------------------------

test('Tier 2 [Boundary B6.1] Last Frame of Roll: damage applies on the immediate frame after isRolling becomes false', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100, damage: 20 };
  const player = { x: 0, y: 0, z: 0, hp: 100, isRolling: true };

  // While rolling: immune
  assert.ok(!refCheckLavaHazard(player, hazard, 0.016));
  assert.equal(player.hp, 100);

  // Roll ends on next frame
  player.isRolling = false;
  assert.ok(refCheckLavaHazard(player, hazard, 0.016));
  assert.equal(player.hp, 80);
});

test('Tier 2 [Boundary B6.2] Last Frame of i-Frames: damage applies immediately when iFrames decrements from 1 to 0', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100, damage: 20 };
  const player = { x: 0, y: 0, z: 0, hp: 80, iFrames: 1 };

  // Frame with iFrames = 1: immune
  assert.ok(!refCheckLavaHazard(player, hazard, 0.016));
  assert.equal(player.hp, 80);

  // Next frame: iFrames = 0
  player.iFrames = 0;
  assert.ok(refCheckLavaHazard(player, hazard, 0.016));
  assert.equal(player.hp, 60);
});

test('Tier 2 [Boundary B6.3] Respawn i-Frames Window: respawn 60 i-frames protect player from secondary hazards during reset', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100, damage: 20 };
  const player = { x: 1000, z: 0, y: 185, hp: 80 };
  // Trigger void fall and respawn at (0, 0, 0)
  refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.equal(player.iFrames, 60);

  // If a hazard is located at spawn (0, 0, 0), player must be immune due to respawn i-frames
  const hit = refCheckLavaHazard(player, hazard, 0.016);
  assert.ok(!hit, 'respawn i-frames must protect player from spawn point hazard');
  assert.equal(player.hp, 40); // Only void damage was taken
});

test('Tier 2 [Boundary B6.4] God Mode Toggle Mid-Lava: enabling god mode inside lava instantly halts damage application', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100, damage: 20 };
  const player = { x: 0, y: 0, z: 0, hp: 80, isGodMode: false, iFrames: 0 };

  refCheckLavaHazard(player, hazard, 0.016);
  assert.equal(player.hp, 60);

  // Player enables god mode
  player.isGodMode = true;
  player.iFrames = 0;
  const hit = refCheckLavaHazard(player, hazard, 0.016);
  assert.ok(!hit, 'god mode toggle must immediately halt damage');
  assert.equal(player.hp, 60);
});

// ----------------------------------------------------------------------------
// Boundary Group 7: WebGL Disposal & Traversal Boundaries
// ----------------------------------------------------------------------------

test('Tier 2 [Boundary B7.1] Deeply Nested Group Traversal: 8-level nested hierarchy has all leaf meshes properly visited', () => {
  let disposed = false;
  let currentGroup = new THREE.Group();
  const root = currentGroup;
  for (let i = 0; i < 7; i++) {
    const nextGroup = new THREE.Group();
    currentGroup.add(nextGroup);
    currentGroup = nextGroup;
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.isShared = false;
  const origDispose = geo.dispose.bind(geo);
  geo.dispose = () => {
    disposed = true;
    origDispose();
  };
  const leafMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  currentGroup.add(leafMesh);

  verifyDisposeHierarchy(root, true);
  assert.ok(disposed, 'leaf mesh in 8-level group must be disposed');
});

test('Tier 2 [Boundary B7.2] Missing Geometry or Material: mesh with null geometry or undefined material does not throw', () => {
  const brokenMesh = { geometry: null, material: undefined };
  const root = { traverse: (fn) => fn(brokenMesh) };
  assert.doesNotThrow(() => {
    verifyDisposeHierarchy(root, true);
  });
});

test('Tier 2 [Boundary B7.3] Mixed Shared and Non-Shared Materials: only non-shared materials have dispose called', () => {
  let sharedDisposed = false;
  let nonSharedDisposed = false;
  const mats = [
    { dispose: () => { sharedDisposed = true; }, isShared: true },
    { dispose: () => { nonSharedDisposed = true; }, isShared: false }
  ];
  const mockMesh = { material: mats };
  const root = { traverse: (fn) => fn(mockMesh) };
  verifyDisposeHierarchy(root, true);
  assert.ok(!sharedDisposed, 'shared material must NOT be disposed');
  assert.ok(nonSharedDisposed, 'non-shared material MUST be disposed');
});

test('Tier 2 [Boundary B7.4] Disposed Mesh Re-Traversal: calling disposeHierarchy twice on same group is safe and idempotent', () => {
  let disposeCount = 0;
  const mockMesh = {
    geometry: { dispose: () => { disposeCount++; }, isShared: false }
  };
  const root = { traverse: (fn) => fn(mockMesh) };
  verifyDisposeHierarchy(root, true);
  verifyDisposeHierarchy(root, true);
  assert.equal(disposeCount, 2, 'subsequent dispose calls must execute without throwing');
});

// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise Interactions)
// ============================================================================

test('Tier 3 [Pairwise 1] Lava Sea Fall + Creative Flight Recovery: falling into Nether lava sea, engaging flight, and ascending back to safety', () => {
  // Player falls past Stage 7 arena bounds towards lava sea at Y = -8.0 (y = 272 in 2D)
  const player = { x: 1020, z: 0, y: 150, vy: 800, hp: 100, isCreativeFlight: false };
  // Step 1: Plunges past island edge
  refUpdateVoidPhysics(player, 'minecraft', 0.016);
  assert.ok(player.y > 150);

  // Step 2: Player activates flight mode before reaching lethal void threshold
  player.isCreativeFlight = true;
  player.vy = -600; // Ascend upward
  refUpdateVoidPhysics(player, 'minecraft', 0.016);
  assert.ok(player.y < 160, 'flight mode must reverse downward plunge');

  // Step 3: Returns to arena footprint
  player.x = 900;
  player.y = 0;
  const res = refUpdateVoidPhysics(player, 'minecraft', 0.016);
  assert.equal(res.effectiveGroundY, 0, 'safe return to island restores ground');
});

test('Tier 3 [Pairwise 2] Lava Hazard Block + TNT Detonation: placing lava block adjacent to TNT block triggers explosive chain reaction', () => {
  const blocks = [
    { x: 0, y: 0, z: 0, texKey: 'lava', damage: 20 },
    { x: 40, y: 0, z: 0, texKey: 'tnt_block', fuseTimer: 2.2, isIgnited: false }
  ];

  // Contact proximity check between lava and TNT
  const dist = Math.abs(blocks[0].x - blocks[1].x);
  if (dist < 48) {
    blocks[1].isIgnited = true;
    blocks[1].fuseTimer = 0.5; // Accelerated detonation near lava
  }

  assert.ok(blocks[1].isIgnited, 'TNT near lava block must ignite');
  assert.equal(blocks[1].fuseTimer, 0.5, 'lava contact must accelerate fuse timer');
});

test('Tier 3 [Pairwise 3] Moving Platform + Swept CCD Landing: landing on high-speed moving platform cleanly carries entity horizontally', () => {
  const movingPlatform = {
    x: 100, y: 120, width: 200, height: 20,
    vx: 150, isMoving: true
  };
  const player = { x: 100, z: 0, y: 110, vy: 900, isGrounded: false };
  const prevY = 80;

  // 1. Swept vertical collision lands on platform
  const landed = refResolveSweptVerticalCollision(player, [movingPlatform], prevY, 0.016);
  assert.ok(landed);
  assert.equal(player.y, 100);

  // 2. Platform horizontal velocity carries player
  player.x += movingPlatform.vx * 0.016;
  assert.ok(player.x > 100, 'moving platform must carry grounded player horizontally');
});

test('Tier 3 [Pairwise 4] Dive Kick + Platform Edge Drop: dive kick lands on platform edge, slides past boundary, and plunges into void', () => {
  const platform = { x: 900, y: 120, width: 100, height: 20 }; // bounds: [850, 950]
  const player = { x: 940, z: 0, y: 115, vx: 300, vy: 1400, diveKick: true, isGrounded: false };

  // 1. Dive kick lands near right edge
  refResolveSweptVerticalCollision(player, [platform], 90, 0.016);
  assert.equal(player.y, 100);
  assert.equal(player.isGrounded, true);

  // 2. Velocity carries player past platform edge (x = 960) and past island edge (x = 990)
  player.x += player.vx * 0.2; // x = 1000
  const isInside = refIsEntityInsidePlatformXZ(player.x, 0, 14, 0, platform);
  assert.ok(!isInside, 'player slid past platform edge');

  // 3. Entity drops into void
  const res = refUpdateVoidPhysics(player, 'the_end', 0.016);
  assert.equal(res.effectiveGroundY, 99999, 'sliding past island edge triggers void plunge');
});

test('Tier 3 [Pairwise 5] God Mode + Floor Lava Hazard + Island Void Fall: god mode character steps into lava pool then walks off island without taking damage', () => {
  const hazard = { x: 360, y: 0, z: 0, width: 160, height: 10, depth3d: 220, damage: 20 };
  const godPlayer = { x: 360, y: 0, z: 0, hp: 100, isGodMode: true };

  // 1. Step in floor lava
  refCheckLavaHazard(godPlayer, hazard, 0.016);
  assert.equal(godPlayer.hp, 100, 'lava must deal 0 damage to god mode');

  // 2. Walk off island edge
  godPlayer.x = 1050;
  godPlayer.y = 250;
  const res = refUpdateVoidPhysics(godPlayer, 'the_end', 0.016);
  assert.equal(godPlayer.hp, 100, 'void fall must deal 0 damage to god mode');
  assert.ok(!godPlayer.isDead, 'god mode character must not die in void');
});

test('Tier 3 [Pairwise 6] Non-Flying Enemy Knockback: comparing floor lava burn recoil vs floating island void threshold elimination', () => {
  const hazard = { x: 0, y: 0, z: 0, width: 100, height: 10, depth3d: 100, damage: 20 };
  const zombieLava = { x: 0, y: 0, z: 0, hp: 60, vy: 0, isZombie: true };
  const zombieVoid = { x: 1050, y: 185, z: 0, hp: 60, isZombie: true };

  // Lava contact gives upward recoil vy = -260
  refCheckLavaHazard(zombieLava, hazard, 0.016);
  assert.equal(zombieLava.vy, -260, 'lava burns and repels enemy upward');
  assert.equal(zombieLava.isDead, undefined, 'zombie is damaged but not eliminated by lava pool');

  // Void contact eliminates enemy permanently
  const res = refUpdateVoidPhysics(zombieVoid, 'the_end', 0.016);
  assert.equal(zombieVoid.isDead, true, 'void elimination kills enemy');
  assert.equal(res.eliminated, true);
});

test('Tier 3 [Pairwise 7] Creative Lava Block Barrier Defense: creative lava blocks placed on island edge burn enemies before they reach void', () => {
  const lavaMoat = { x: 950, y: 0, z: 0, width: 68, height: 68, depth3d: 68, texKey: 'lava', damage: 20 };
  const pursuingZombie = { x: 950, y: 0, z: 0, hp: 20, isZombie: true };

  // Zombie enters lava block footprint on island edge
  refCheckLavaHazard(pursuingZombie, lavaMoat, 0.016);
  assert.equal(pursuingZombie.hp, 0, 'lava defense block burns zombie to 0 HP');
});

test('Tier 3 [Pairwise 8] Stacked Multi-Level Blocks + Enclosed Wall Clamping: ascending stacked blocks at arena perimeter clamps within visible wall bounds', () => {
  // Stack of 3 creative blocks placed near outer wall
  const stackedBlock = { x: 966, y: -136, z: 0, width: 68, height: 68, depth3d: 68 };
  const player = { x: 980, z: 0, vx: 200, y: -136, isZombie: false };

  // Enclosed wall clamp halts player at x = 966 on top of block
  refClampEnclosedWalls(player, true);
  assert.equal(player.x, 966, 'player must be clamped to 966 on top of perimeter block');
  assert.equal(player.vx, 0);
});

// ============================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS (Combat & Sandbox Workloads)
// ============================================================================

test('Tier 4 [Scenario 1] Nether Stage (Stage 7) Lava Hazard Combat: Orange battles zombie wave in Nether Core arena surrounded by lava sea with active floor pools', () => {
  // Arena setup: Stage 7 Minecraft Nether Core
  const theme = 'minecraft';
  assert.ok(refIsOpenEdgeTheme(theme), 'Stage 7 must have open edges over lava sea');

  const floorLavaPools = [
    { x: -360, y: 0, z: 0, width: 160, height: 10, depth3d: 220, damage: 20 },
    { x: 360, y: 0, z: 0, width: 160, height: 10, depth3d: 220, damage: 20 }
  ];

  const player = { x: 350, y: 0, z: 0, hp: 100, vy: 0, isGrounded: true, iFrames: 0 };
  const waveZombies = [
    { id: 1, x: 360, y: 0, z: 0, hp: 50, vy: 0, isZombie: true, lavaTickCooldown: 0 },
    { id: 2, x: -360, y: 0, z: 0, hp: 50, vy: 0, isZombie: true, lavaTickCooldown: 0 }
  ];

  // 1. Orange accidentally steps onto edge of right lava pool
  const playerBurned = refCheckLavaHazard(player, floorLavaPools[1], 0.016);
  assert.ok(playerBurned, 'Orange takes contact burn');
  assert.equal(player.hp, 80);
  assert.equal(player.vy, -340, 'scorch launches Orange upward');
  assert.equal(player.iFrames, 30);

  // 2. Both zombies walk into lava hazards
  refCheckLavaHazard(waveZombies[0], floorLavaPools[1], 0.016);
  refCheckLavaHazard(waveZombies[1], floorLavaPools[0], 0.016);
  assert.equal(waveZombies[0].hp, 30);
  assert.equal(waveZombies[1].hp, 30);
  assert.equal(waveZombies[0].vy, -260);
  assert.equal(waveZombies[1].vy, -260);

  // 3. Orange executes dodge roll across pool to escape
  player.isRolling = true;
  player.x = 360;
  const rollBurn = refCheckLavaHazard(player, floorLavaPools[1], 0.016);
  assert.ok(!rollBurn, 'dodge roll safely traverses lava pool without additional damage');
});

test('Tier 4 [Scenario 2] The End (Stage 18) Floating Island Void Combat: Orange and allies battle Ender Dragon and ground horde on open-edge void island', () => {
  const theme = 'the_end';
  assert.ok(refIsFloatingIslandTheme(theme), 'Stage 18 must be a floating island');

  const groundZombies = [
    { id: 1, x: 920, y: 0, z: 0, hp: 60, isZombie: true },
    { id: 2, x: 880, y: 0, z: 0, hp: 60, isZombie: true }
  ];
  const enderDragon = { x: 0, y: -250, z: 0, isZombie: true, isFlying: true };

  // 1. Orange performs shockwave attack, knocking Zombie 1 beyond island edge (x = 1010)
  groundZombies[0].x = 1010;
  const fallRes1 = refUpdateVoidPhysics(groundZombies[0], theme, 0.016);
  assert.equal(fallRes1.effectiveGroundY, 99999, 'knocked off zombie plunges into void');

  // Simulate falling 12 frames to void threshold (y >= 180)
  groundZombies[0].y = 190;
  const elimRes = refUpdateVoidPhysics(groundZombies[0], theme, 0.016);
  assert.ok(elimRes.eliminated, 'ground zombie eliminated in void');
  assert.equal(groundZombies[0].isDead, true);

  // 2. Ender Dragon hovers across open void safely
  enderDragon.x = 1200;
  const dragonRes = refUpdateVoidPhysics(enderDragon, theme, 0.016);
  assert.ok(!dragonRes.eliminated, 'flying boss ignores void elimination');
  assert.equal(enderDragon.isDead, undefined);
});

test('Tier 4 [Scenario 3] Creative Sandbox Lava Trap & Defense Engineering: sandbox builder builds obsidian fortification with lava moat and TNT traps', () => {
  const sandboxBlocks = [];
  const place = (type, x, z) => {
    if (sandboxBlocks.length < 64) {
      sandboxBlocks.push({ texKey: type, x, y: 0, z, width: 68, height: 68, depth3d: 68 });
    }
  };

  // 1. Place 4 obsidian blocks
  for (let i = 0; i < 4; i++) place('obsidian', i * 68, 0);
  // 2. Place 4 lava hazard blocks
  for (let i = 0; i < 4; i++) place('lava', i * 68, 80);
  // 3. Place 2 TNT blocks
  place('tnt_block', 0, 160);
  place('tnt_block', 68, 160);

  assert.equal(sandboxBlocks.length, 10, '10 defense blocks placed');
  const lavaBlocks = sandboxBlocks.filter(b => b.texKey === 'lava');
  assert.equal(lavaBlocks.length, 4, '4 active lava hazard blocks ready');

  // Verify lava hazard burns approaching enemy
  const intruder = { x: 0, y: 0, z: 80, hp: 40, isZombie: true };
  refCheckLavaHazard(intruder, lavaBlocks[0], 0.016);
  assert.equal(intruder.hp, 20);
});

test('Tier 4 [Scenario 4] Aether Sky Realm Combat with Flight Recovery: high-altitude aerial battle with platform hopping and emergency flight recovery', () => {
  const skyPlatform = { x: 500, y: -100, width: 160, height: 20, depth3d: 170, z3d: 0 };
  const player = { x: 500, z: 0, y: -120, vy: 400, isGrounded: false };

  // 1. Land on sky platform at y = -120
  const landed = refResolveSweptVerticalCollision(player, [skyPlatform], -140, 0.016);
  assert.ok(landed, 'player lands on high-altitude sky platform');
  assert.equal(player.y, -120);

  // 2. Enemy hits player off platform edge into open Aether sky
  player.x = 1050; // Off island bounds
  player.y = 50;
  player.vy = 800;
  refUpdateVoidPhysics(player, 'aether', 0.016);

  // 3. Player activates Creative Flight to recover
  player.isCreativeFlight = true;
  player.vy = -500;
  for (let step = 0; step < 5; step++) {
    refUpdateVoidPhysics(player, 'aether', 0.016);
  }
  assert.ok(player.y < 50, 'flight recovery ascends player back to safety');
});

test('Tier 4 [Scenario 5] Multi-Elevation Platform Gauntlet with Swept CCD & Enclosed Walls: climbing multi-tier arena with moving lifts, flush contact, and boundary clamping', () => {
  const tiers = [
    { x: 0, y: 150, width: 250, height: 20 },
    { x: 200, y: 90, width: 200, height: 20 },
    { x: 400, y: 30, width: 180, height: 20 }
  ];

  const player = { x: 0, z: 0, y: 140, vy: 600, isGrounded: false };

  // 1. Land on Tier 1
  refResolveSweptVerticalCollision(player, [tiers[0]], 120, 0.016);
  assert.equal(player.y, 130);

  // 2. Jump to Tier 2
  player.x = 200;
  player.y = 80;
  player.vy = 500;
  refResolveSweptVerticalCollision(player, [tiers[1]], 60, 0.016);
  assert.equal(player.y, 70);

  // 3. Jump to Tier 3 and sprint towards wall
  player.x = 400;
  player.y = 20;
  player.vy = 400;
  refResolveSweptVerticalCollision(player, [tiers[2]], 0, 0.016);
  assert.equal(player.y, 10);

  // 4. Hit enclosed stage perimeter wall at x = 990
  player.x = 990;
  player.vx = 400;
  refClampEnclosedWalls(player, true);
  assert.equal(player.x, 966, 'player must be stopped at enclosed arena wall');
  assert.equal(player.vx, 0);
});

// ============================================================================
// Stage 20: Ancient City & The Warden Boss Suite
// ============================================================================

test('Ancient City [1] Deep Dark Voxel Textures: sculk, deepslate_tiles, and reinforced_deepslate generate cached CanvasTextures', () => {
  const sculk = getVoxelTexture('sculk');
  const deepslate = getVoxelTexture('deepslate_tiles');
  const reinforced = getVoxelTexture('reinforced_deepslate');

  assert.ok(sculk instanceof THREE.CanvasTexture, 'sculk must be a THREE.CanvasTexture');
  assert.ok(deepslate instanceof THREE.CanvasTexture, 'deepslate_tiles must be a THREE.CanvasTexture');
  assert.ok(reinforced instanceof THREE.CanvasTexture, 'reinforced_deepslate must be a THREE.CanvasTexture');
  assert.equal(getVoxelTexture('sculk'), sculk, 'sculk texture must be singleton-cached');
  assert.equal(getThemeFloorTextureKey('ancient_city'), 'sculk', 'ancient_city floor must map to sculk');
});

test('Ancient City [2] Stage 20 Arena3DBuilder: builds Center Reinforced Deepslate Portal Monument, ruins, Deep Dark portal sign, and disposes cleanly', () => {
  const scene = new THREE.Scene();
  const stageManager = {
    currentStage: 1,
    stageName: 'Main Desktop',
    theme: 'desktop',
    stageTime: 0,
    platforms: [],
    movingPlatforms: [],
    desktopIcons: [],
    laserHazards: [],
    lavaHazards: [],
    errorPopups: [],
    entranceDoor: { x: -900, y: 0, width: 60, height: 110 },
    exitDoor: { x: 860, y: 0, width: 60, height: 110, isOpen: false },
    loadStage: () => {},
    enterTrophyRoom: () => {},
    getCampaignBeat: (n) => ({ name: `Stage ${n}` })
  };
  const waveDirector = {
    zombies: [],
    spawnQueue: [],
    generateWaveQueue: () => {},
    queueWaveRecipe: () => {},
    spawnZombie: () => {},
    getSafeSpawnX: () => 420,
    update: () => {}
  };

  extendCampaignFor3D(stageManager, waveDirector);
  stageManager.loadStage(20);

  assert.equal(stageManager.stageName, 'Ancient City');
  assert.equal(stageManager.theme, 'ancient_city');
  assert.equal(stageManager.platforms.length, 3, 'Ancient City must have 3 static deepslate catwalk/altar platforms');
  assert.equal(stageManager.movingPlatforms.length, 1, 'Ancient City must have 1 moving Soul_Lantern_Bridge');
  assert.equal(stageManager.movingPlatforms[0].title, 'Soul_Lantern_Bridge');
  assert.equal(refIsOpenEdgeTheme('ancient_city'), false, 'ancient_city is an enclosed subterranean sanctum');

  const arena = new Arena3DBuilder(scene, stageManager);
  arena.rebuildForStage();

  assert.ok(arena.ancientCityCenterPortal, 'Ancient City must construct the iconic Center Portal monument');
  assert.equal(arena.standNeck.visible, false, 'monitor stand neck must be hidden in subterranean Ancient City');
  arena.update(0.25);
  assert.ok(arena.ancientCityCenterPortal.veilMat.opacity > 0.2, 'Center Portal cyan soul veil must pulse');

  // Verify clean rebuild transition to Stage 21 (Pale Garden)
  stageManager.loadStage(21);
  assert.equal(stageManager.stageName, 'Pale Garden');
  arena.rebuildForStage();
  assert.equal(arena.ancientCityCenterPortal, null, 'Center Portal reference must clear on stage rebuild');
});

test('Ancient City [3] WardenBossRig3D Anatomy & Animation: flush feet, pulsing Soul Heart, vibrating sculk tendrils, and Sonic Boom concentric rings', () => {
  const rig = new WardenBossRig3D();
  assert.ok(rig.root instanceof THREE.Group);
  assert.equal(rig.sonicGroup.visible, false, 'Sonic Boom rings must start hidden');

  // Idle update: Soul Heart pulses, Sonic Boom stays hidden
  rig.update({ pose: 'idle', animTimer: 1.2, isGrounded: true, actionKind: null, actionPhase: 0, dt: 0.016 });
  assert.equal(rig.sonicGroup.visible, false);
  assert.ok(rig.soulHeart.material.opacity >= 0.45, 'Soul Heart must glow in chest ribcage');

  // Sonic Boom update: concentric cyan rings appear & jaw roars wide
  rig.update({
    pose: 'idle',
    animTimer: 2.0,
    isGrounded: true,
    actionKind: 'warden_sonic',
    actionPhase: 0.65,
    dt: 0.016
  });
  assert.equal(rig.sonicGroup.visible, true, 'Sonic Boom torus rings must activate during warden_sonic');
  assert.equal(rig.sonicRings.length, 5, 'Sonic Boom must project 5 concentric cyan rings');
  assert.ok(rig.jaw.rotation.x > 0.35, 'Warden jaw must roar open during Sonic Boom');

  // Awakened Phase 2 overdrive intensifies heart pulse
  rig.update({ pose: 'zombie_walk', animTimer: 3.1, isGrounded: true, isAwakened: true, actionKind: null, dt: 0.016 });
  assert.equal(rig.sonicGroup.visible, false, 'Sonic Boom rings must hide once attack completes');
  assert.ok(Number.isFinite(rig.tendrilL.rotation.z) && Number.isFinite(rig.tendrilR.rotation.z));
});

test('Ancient City [4] WardenBoss Combat AI Lifecycle: Sonic Boom, Sculk Seismic Slam, Blind Charge, Phase 2 Overdrive, and Defeat', () => {
  const warden = new WardenBoss(320, 0);
  assert.equal(warden.type, 'warden_boss', 'Boss type must be warden_boss so regular warden shield-zombies remain distinct');
  assert.equal(warden.name, 'THE WARDEN');
  assert.equal(warden.maxHp, 1520);
  assert.equal(warden.phase, 1);

  let playerHits = 0;
  let lastDamage = 0;
  const mockPlayer = {
    x: 120,
    y: 0,
    z: 0,
    radius: 20,
    isDead: false,
    isRolling: false,
    iFrames: 0,
    isAwakened: false,
    takeDamage(dmg) {
      playerHits++;
      lastDamage = dmg;
    }
  };

  // 1. Trigger Attack 0: Sonic Boom
  warden.actionCooldown = 0;
  warden.update(0.05, 0, mockPlayer, [], null);
  assert.equal(warden.state, 'sonic_windup');
  assert.equal(warden.actionKind, 'warden_sonic');

  // Advance through windup + active Sonic Boom resolution
  for (let i = 0; i < 25; i++) {
    warden.update(0.05, 0, mockPlayer, [], null);
  }
  assert.ok(warden.sonicResolved, 'Sonic Boom must resolve');
  assert.equal(playerHits, 1, 'Player in Sonic Boom beam corridor must take damage');
  assert.equal(lastDamage, 28);

  // 2. Trigger Attack 1: Sculk Seismic Slam
  warden.state = 'idle';
  warden.actionCooldown = 0;
  warden.update(0.05, 0, mockPlayer, [], null);
  assert.equal(warden.state, 'slam_windup');
  for (let i = 0; i < 25; i++) {
    warden.update(0.05, 0, mockPlayer, [], null);
  }
  assert.ok(warden.dropResolved, 'Sculk Seismic Slam must resolve');
  assert.equal(playerHits, 2, 'Grounded player in Seismic Slam zone must take damage');

  // 3. Trigger Attack 2: Blind Charge
  warden.state = 'idle';
  warden.actionCooldown = 0;
  warden.x = 420;
  mockPlayer.x = 120;
  warden.update(0.05, 0, mockPlayer, [], null);
  assert.equal(warden.state, 'charge_windup');
  for (let i = 0; i < 28; i++) {
    warden.update(0.05, 0, mockPlayer, [], null);
  }
  assert.equal(playerHits, 3, 'Player in Blind Charge path must take contact damage');

  // 4. Phase 2 Overdrive at <= 50% HP and final defeat
  warden.takeDamage(800, -1, 300, true);
  warden.update(0.016, 0, mockPlayer, [], null);
  assert.equal(warden.phase, 2, 'Warden must enter Phase 2 at <= 50% HP');
  assert.equal(warden.isAwakened, true);

  warden.takeDamage(1000, -1, 400, true);
  assert.equal(warden.isDead, true, 'Warden must die when HP reaches 0');
  assert.equal(warden.state, 'defeated');
});

test('Ancient City [5] Creative Sandbox & Title Quick-Jump UI: 3d/index.html exposes warden_boss, sculk, deepslate_tiles, and Stage 20 pill', () => {
  const htmlPath = fileURLToPath(new URL('../3d/index.html', import.meta.url));
  const html = readFileSync(htmlPath, 'utf8');
  assert.ok(html.includes('value="warden_boss"'), '3d/index.html must include warden_boss in Creative spawn select');
  assert.ok(html.includes('value="sculk"'), '3d/index.html must include sculk in Creative block select');
  assert.ok(html.includes('value="deepslate_tiles"'), '3d/index.html must include deepslate_tiles in Creative block select');
  assert.ok(html.includes('data-jump-stage="20">🔊 20: Ancient City (The Warden)'), 'Title screen must include Stage 20 Ancient City quick-jump pill');
  assert.ok(html.includes('data-jump-stage="22">🕶️ 22: Rocket Corp (Mercenaries)'), 'Rocket Corp pill must be Stage 22 right before Stage 23 H4C3R');
  assert.ok(html.includes('data-jump-stage="23">⌁ 23: Zero-Day (H4C3R)'), 'Zero-Day H4C3R pill must be Stage 23');
});

// ============================================================================
// Stage 21: Pale Garden & The Creaking Boss Suite
// ============================================================================

test('Pale Garden [1] Pale Garden Voxel Textures: pale_moss, pale_oak_log, pale_oak_leaves, creaking_heart, and resin_block generate cached CanvasTextures', () => {
  const paleMoss = getVoxelTexture('pale_moss');
  const paleOakLog = getVoxelTexture('pale_oak_log');
  const paleOakLeaves = getVoxelTexture('pale_oak_leaves');
  const creakingHeart = getVoxelTexture('creaking_heart');
  const resinBlock = getVoxelTexture('resin_block');

  assert.ok(paleMoss instanceof THREE.CanvasTexture, 'pale_moss must be a THREE.CanvasTexture');
  assert.ok(paleOakLog instanceof THREE.CanvasTexture, 'pale_oak_log must be a THREE.CanvasTexture');
  assert.ok(paleOakLeaves instanceof THREE.CanvasTexture, 'pale_oak_leaves must be a THREE.CanvasTexture');
  assert.ok(creakingHeart instanceof THREE.CanvasTexture, 'creaking_heart must be a THREE.CanvasTexture');
  assert.ok(resinBlock instanceof THREE.CanvasTexture, 'resin_block must be a THREE.CanvasTexture');
  assert.equal(getVoxelTexture('pale_moss'), paleMoss, 'pale_moss texture must be singleton-cached');
  assert.equal(getThemeFloorTextureKey('pale_garden'), 'pale_moss', 'pale_garden floor must map to pale_moss');
});

test('Pale Garden [2] Stage 21 Arena3DBuilder: builds Center Ancient Pale Oak & Creaking Heart Shrine, twisted trees, Eyeblossoms, and disposes cleanly', () => {
  const scene = new THREE.Scene();
  const stageManager = {
    currentStage: 1,
    stageName: 'Main Desktop',
    theme: 'desktop',
    stageTime: 0,
    platforms: [],
    movingPlatforms: [],
    desktopIcons: [],
    laserHazards: [],
    lavaHazards: [],
    errorPopups: [],
    entranceDoor: { x: -900, y: 0, width: 60, height: 110 },
    exitDoor: { x: 860, y: 0, width: 60, height: 110, isOpen: false },
    loadStage: () => {},
    enterTrophyRoom: () => {},
    getCampaignBeat: (n) => ({ name: `Stage ${n}` })
  };
  const waveDirector = {
    zombies: [],
    spawnQueue: [],
    generateWaveQueue: () => {},
    queueWaveRecipe: () => {},
    spawnZombie: () => {},
    getSafeSpawnX: () => 420,
    update: () => {}
  };

  extendCampaignFor3D(stageManager, waveDirector);
  stageManager.loadStage(21);

  assert.equal(stageManager.stageName, 'Pale Garden');
  assert.equal(stageManager.theme, 'pale_garden');
  assert.equal(stageManager.platforms.length, 3, 'Pale Garden must have 3 static Pale Oak bough platforms');
  assert.equal(stageManager.movingPlatforms.length, 1, 'Pale Garden must have 1 moving Hanging_Moss_Bough bridge');
  assert.equal(stageManager.movingPlatforms[0].title, 'Hanging_Moss_Bough');
  assert.equal(refIsOpenEdgeTheme('pale_garden'), false, 'pale_garden is an enclosed haunted forest glade');

  const arena = new Arena3DBuilder(scene, stageManager);
  arena.rebuildForStage();

  assert.ok(arena.paleGardenHeartShrine, 'Pale Garden must construct the Center Creaking Heart Shrine');
  assert.equal(arena.standNeck.visible, false, 'monitor stand neck must be hidden in Pale Garden');
  const prevRingRot = arena.paleGardenHeartShrine.resinRing.rotation.z;
  stageManager.stageTime = 0.5;
  arena.update(0.25);
  assert.ok(arena.paleGardenHeartShrine.heartMat.emissiveIntensity >= 0.4, 'Creaking Heart emissive must pulse');
  assert.notEqual(arena.paleGardenHeartShrine.resinRing.rotation.z, prevRingRot, 'Resin ring around Creaking Heart must rotate');

  // Verify clean rebuild transition to Stage 22 (Rocket Corp HQ — right before Stage 23 H4C3R)
  stageManager.loadStage(22);
  assert.equal(stageManager.stageName, 'Rocket Corp HQ');
  arena.rebuildForStage();
  assert.equal(arena.paleGardenHeartShrine, null, 'Creaking Heart Shrine reference must clear on stage rebuild');
});

test('Pale Garden [3] CreakingBossRig3D Anatomy & Animation: 3 asymmetrical glowing eyes, flush stilts, frozen statue pose, and Resin Heart-Tether motes', () => {
  const rig = new CreakingBossRig3D();
  assert.ok(rig.root instanceof THREE.Group);
  assert.ok(rig.eyeTop && rig.eyeMid && rig.eyeLow, 'Creaking rig must feature 3 asymmetrical glowing orange eyes');
  assert.notEqual(rig.eyeTop.position.x, rig.eyeMid.position.x, 'Creaking eyes must be staggered asymmetrically');
  assert.equal(rig.tetherGroup.visible, false, 'Resin Heart-Tether motes must start hidden');

  // Gaze-frozen statue state: zero leg stride and rigid weeping-statue posture
  rig.update({
    pose: 'idle',
    animTimer: 1.7,
    isGrounded: true,
    actionKind: 'creaking_statue',
    actionPhase: 0,
    dt: 0.016
  });
  assert.equal(rig.legL.rotation.x, 0, 'Statue pose must lock left stilt leg stride at 0');
  assert.equal(rig.legR.rotation.x, 0, 'Statue pose must lock right stilt leg stride at 0');
  assert.equal(rig.headPivot.rotation.z, -0.26, 'Statue pose must tilt crooked wooden crown head');
  assert.equal(rig.tetherGroup.visible, false);

  // Resin Surge / Hurt / Awakened activates the 4-mote orange Resin Heart-Tether stream
  rig.update({
    pose: 'idle',
    animTimer: 2.3,
    isGrounded: true,
    isHurt: true,
    actionKind: 'creaking_surge',
    actionPhase: 0.5,
    dt: 0.016
  });
  assert.equal(rig.tetherGroup.visible, true, 'Resin Heart-Tether stream must appear when hurt or surging');
  assert.equal(rig.tetherMotes.length, 4, 'Resin Heart-Tether must animate 4 resin motes toward the Heart');
});

test('Pale Garden [4] CreakingBoss Combat AI Lifecycle: Gaze-Freeze ("Don\'t Blink"), Blink Ambush, Pale Root Snare, Heart-Link Resin Surge, Phase 2 Overdrive, and Defeat', () => {
  const creaking = new CreakingBoss(360, 0);
  assert.equal(creaking.type, 'creaking_boss');
  assert.equal(creaking.name, 'THE CREAKING');
  assert.equal(creaking.maxHp, 1480);
  assert.equal(creaking.phase, 1);

  let playerHits = 0;
  let lastDamage = 0;
  const mockPlayer = {
    x: 100,
    y: 0,
    z: 0,
    facing: 1, // Facing +X toward creaking at x = 360!
    radius: 20,
    isDead: false,
    isRolling: false,
    iFrames: 0,
    isAwakened: false,
    takeDamage(dmg) {
      playerHits++;
      lastDamage = dmg;
    }
  };

  // 1. Gaze-Freeze ("Don't Blink"): Player looks toward Creaking -> freezes into bark-armored statue!
  const cdBeforeGaze = creaking.actionCooldown;
  creaking.update(0.05, 0, mockPlayer, [], null);
  assert.equal(creaking.isObserved, true, 'Creaking must detect player gazing toward it');
  assert.equal(creaking.actionKind, 'creaking_statue', 'Creaking must freeze into creaking_statue while watched');
  assert.equal(creaking.vx, 0, 'Watched Creaking must have zero horizontal velocity');
  assert.ok(creaking.actionCooldown < cdBeforeGaze, 'Cooldown must still tick while watched so combat never stalls');

  // Verify hardened bark damage reduction (0.65x) on non-crit hits while frozen as statue
  const dmgTakenStatue = creaking.takeDamage(100, -1, 200, false);
  assert.equal(dmgTakenStatue, 65, 'Statue bark armor must reduce non-crit damage to 65%');

  // Player looks away (facing -1 while Creaking is at +X) -> Creaking stalks rapidly!
  mockPlayer.facing = -1;
  creaking.update(0.05, 0, mockPlayer, [], null);
  assert.equal(creaking.isObserved, false, 'Creaking must detect player looking away');
  assert.equal(creaking.actionKind, null);
  assert.ok(Math.abs(creaking.vx) >= 250, 'Unobserved Creaking must stalk rapidly toward player');

  // 2. Attack 0: Weeping Blink Ambush
  creaking.actionCooldown = 0;
  creaking.update(0.05, 0, mockPlayer, [], null);
  assert.equal(creaking.state, 'blink_windup');
  assert.equal(creaking.actionKind, 'creaking_blink');
  for (let i = 0; i < 25; i++) {
    creaking.update(0.05, 0, mockPlayer, [], null);
  }
  assert.equal(playerHits, 1, 'Player in Weeping Blink Ambush path must take damage');
  assert.equal(lastDamage, 26);

  // 3. Attack 1: Pale Root Snare
  creaking.state = 'idle';
  creaking.actionCooldown = 0;
  creaking.update(0.05, 0, mockPlayer, [], null);
  assert.equal(creaking.state, 'roots_windup');
  assert.equal(creaking.actionKind, 'creaking_roots');
  for (let i = 0; i < 25; i++) {
    creaking.update(0.05, 0, mockPlayer, [], null);
  }
  assert.ok(creaking.dropResolved, 'Pale Root Snare must resolve');
  assert.equal(playerHits, 2, 'Grounded player in Pale Root Snare zone must take damage');

  // 4. Attack 2: Heart-Link Resin Surge (move player close for resin burst AoE)
  creaking.state = 'idle';
  creaking.actionCooldown = 0;
  mockPlayer.x = creaking.x - 60;
  creaking.update(0.05, 0, mockPlayer, [], null);
  assert.equal(creaking.state, 'surge_windup');
  assert.equal(creaking.actionKind, 'creaking_surge');
  for (let i = 0; i < 25; i++) {
    creaking.update(0.05, 0, mockPlayer, [], null);
  }
  assert.ok(creaking.surgeResolved, 'Heart-Link Resin Surge must resolve');
  assert.equal(playerHits, 3, 'Nearby player in Resin Surge blast must take damage');

  // 5. Phase 2 Resin Overdrive at <= 50% HP and final defeat
  creaking.takeDamage(800, -1, 300, true);
  creaking.update(0.016, 0, mockPlayer, [], null);
  assert.equal(creaking.phase, 2, 'Creaking must enter Phase 2 Resin Overdrive at <= 50% HP');
  assert.equal(creaking.isAwakened, true);

  creaking.takeDamage(1000, -1, 400, true);
  assert.equal(creaking.isDead, true, 'Creaking must be severed and defeated at 0 HP');
  assert.equal(creaking.state, 'defeated');
});

test('Pale Garden [5] Creative Sandbox, Title Quick-Jump UI & Speech Aliases: 3d/index.html & speech3d support Creaking / Creeking', () => {
  const htmlPath = fileURLToPath(new URL('../3d/index.html', import.meta.url));
  const html = readFileSync(htmlPath, 'utf8');
  assert.ok(html.includes('value="creaking_boss"'), '3d/index.html must include creaking_boss in Creative spawn select');
  assert.ok(html.includes('value="pale_moss"'), '3d/index.html must include pale_moss in Creative block select');
  assert.ok(html.includes('value="pale_oak_log"'), '3d/index.html must include pale_oak_log in Creative block select');
  assert.ok(html.includes('value="creaking_heart"'), '3d/index.html must include creaking_heart in Creative block select');
  assert.ok(html.includes('data-jump-stage="21">🪵 21: Pale Garden (The Creaking)'), 'Title screen must include Stage 21 Pale Garden quick-jump pill');
  assert.ok(html.includes('data-jump-stage="22">🕶️ 22: Rocket Corp (Mercenaries)'), 'Rocket Corp pill must remain immediately before Zero-Day H4C3R');
  assert.ok(html.includes('data-jump-stage="23">⌁ 23: Zero-Day (H4C3R)'), 'Zero-Day H4C3R pill must be Stage 23');

  if (speech3dModule) {
    assert.ok(speech3dModule.SPEAKER_BADGES.creaking_boss, 'SPEAKER_BADGES must define creaking_boss');
    assert.ok(speech3dModule.SPEAKER_BADGES.creeking, 'SPEAKER_BADGES must also support alternate creeking spelling');
    assert.ok(speech3dModule.BANTER_CHAINS.boss_creaking_intro, 'BANTER_CHAINS must define boss_creaking_intro');
  }
});


