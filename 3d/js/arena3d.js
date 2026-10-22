import * as THREE from '../lib/three.module.min.js';
import { getVoxelTexture, getThemeFloorTextureKey } from './textures3d.js';
import {
  StickRig3D,
  CreeperLordRig3D,
  GiantCatRig3D,
  LuckyOrbRig3D
} from './models3d.js';

export const WORLD_TO_3D = 1 / 34;
export const ARENA_HALF_X = 980;
export const ARENA_HALF_Z = 380;

export function to3DX(x) {
  return x * WORLD_TO_3D;
}
export function to3DY(y) {
  return -y * WORLD_TO_3D;
}
export function to3DZ(z) {
  return (z || 0) * WORLD_TO_3D;
}

function makeTextSignTexture(title, subtitle = '', bg = '#1e293b', border = '#38bdf8', textCol = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = border;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 90);
  ctx.fillStyle = border;
  ctx.fillRect(0, 0, 256, 22);
  ctx.fillStyle = '#ff5f56';
  ctx.fillRect(210, 6, 10, 10);
  ctx.fillStyle = '#ffbd2e';
  ctx.fillRect(224, 6, 10, 10);
  ctx.fillStyle = '#27c93f';
  ctx.fillRect(238, 6, 10, 10);
  ctx.fillStyle = textCol;
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(title).slice(0, 22), 128, 54);
  if (subtitle) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(String(subtitle).slice(0, 26), 128, 78);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Arena3DBuilder {
  constructor(scene, stageManager) {
    this.scene = scene;
    this.stageManager = stageManager;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.platformMeshes = [];
    this.movingPlatformMeshes = [];
    this.laserMeshes = [];
    this.floatingProps = [];
    this.exitPortalCore = null;
    this.exitPortalMat = null;
    this.exitSignMesh = null;
    this.trophyKeyGroup = null;

    // Giant 3D Desktop Monitor Backdrop
    this.monitorCanvas = document.createElement('canvas');
    this.monitorCanvas.width = 1024;
    this.monitorCanvas.height = 440;
    this.monitorCtx = this.monitorCanvas.getContext('2d');
    this.monitorTexture = new THREE.CanvasTexture(this.monitorCanvas);
    this.monitorTexture.colorSpace = THREE.SRGBColorSpace;
    this.lastMonitorRedraw = -1;

    this.buildPersistentMonitor();
  }

  buildPersistentMonitor() {
    this.monitorGroup = new THREE.Group();
    this.monitorGroup.position.set(0, 10.2, -14.8);

    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.5
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(66, 23.5, 1.2), bezelMat);
    frame.position.z = -0.7;

    const standNeck = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 1.6), bezelMat);
    standNeck.position.set(0, -13.5, -1.0);

    const screenMat = new THREE.MeshBasicMaterial({ map: this.monitorTexture });
    this.screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(63.6, 21.4), screenMat);

    this.monitorGroup.add(frame, standNeck, this.screenMesh);
    this.scene.add(this.monitorGroup);
  }

  rebuildForStage() {
    while (this.group.children.length > 0) {
      const child = this.group.children.pop();
      this.group.remove(child);
    }
    this.platformMeshes.length = 0;
    this.movingPlatformMeshes.length = 0;
    this.laserMeshes.length = 0;
    this.floatingProps.length = 0;
    this.trophyKeyGroup = null;

    const sm = this.stageManager;
    const theme = sm.theme || 'desktop';
    const floorKey = getThemeFloorTextureKey(theme, false);

    // 1. Voxel Arena Floor (62 x 26 blocks)
    const floorW = 62;
    const floorD = 26;
    const floorTex = getVoxelTexture(floorKey, 31, 13);
    this.floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.55,
      metalness: 0.1
    });
    const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(floorW, 1.5, floorD), this.floorMat);
    floorMesh.position.set(0, -0.75, 0);
    floorMesh.receiveShadow = true;
    this.group.add(floorMesh);

    // Sub-floor voxel cliff layers (Minecraft island feel)
    const subTex = getVoxelTexture(theme === 'minecraft' || theme === 'dark_core' ? 'obsidian' : 'anvil_iron', 31, 2);
    const subMat = new THREE.MeshStandardMaterial({ map: subTex, roughness: 0.7 });
    const subLayer = new THREE.Mesh(new THREE.BoxGeometry(floorW - 1.5, 3.2, floorD - 1.5), subMat);
    subLayer.position.set(0, -3.1, 0);
    this.group.add(subLayer);

    // Glowing Arena Border Rails (North, South, West/Left Wall, East/Right Wall)
    const accentHex = this.getThemeAccentColor(theme);
    const railMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.55,
      roughness: 0.25
    });
    const railNorth = new THREE.Mesh(new THREE.BoxGeometry(floorW, 0.35, 0.45), railMat);
    railNorth.position.set(0, 0.18, -floorD / 2 + 0.25);
    const railSouth = railNorth.clone();
    railSouth.position.set(0, 0.18, floorD / 2 - 0.25);
    const wallX = to3DX(980) + 0.55;
    const railWest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, floorD), railMat);
    railWest.position.set(-wallX, 0.55, 0);
    const railEast = railWest.clone();
    railEast.position.set(wallX, 0.55, 0);
    this.group.add(railNorth, railSouth, railWest, railEast);

    // 2. Voxel Pillars / Minecraft Biome Props along Back Edge
    this.buildBiomeColumns(theme, accentHex);

    // 3. Start Portal & Exit Portal (set slightly back in Z so the full player figure is always visible in front)
    this.buildPortal(to3DX(sm.entranceDoor.x), -2.2, false, sm.isTrophyRoom ? 'ENTRY' : 'START');
    this.buildPortal(to3DX(sm.exitDoor.x), -2.2, true, sm.isTrophyRoom ? 'RESULTS' : 'EXIT');

    // 4. Static Platforms (3D Voxel Slabs)
    sm.platforms.forEach((p, idx) => {
      const zOffset = this.getPlatformZ(idx, sm.platforms.length);
      p.z3d = zOffset;
      p.depth3d = 260;
      const mesh = this.createPlatformMesh(p, theme);
      mesh.position.set(to3DX(p.x), to3DY(p.y - p.height / 2), to3DZ(zOffset));
      this.group.add(mesh);
      this.platformMeshes.push({ data: p, mesh });
    });

    // 5. Moving Platforms
    sm.movingPlatforms.forEach((p) => {
      const zOffset = 0;
      p.z3d = zOffset;
      p.depth3d = 260;
      const mesh = this.createPlatformMesh(p, theme, true);
      mesh.position.set(to3DX(p.x), to3DY(p.y - p.height / 2), to3DZ(zOffset));
      this.group.add(mesh);
      this.movingPlatformMeshes.push({ data: p, mesh });
    });

    // 6. Laser Hazards
    sm.laserHazards.forEach((laser) => {
      const laserGroup = this.createLaserHazardMesh(laser);
      this.group.add(laserGroup.root);
      this.laserMeshes.push(laserGroup);
    });

    // 7. Error Popups (3D Monoliths)
    sm.errorPopups.forEach((pop, idx) => {
      const popMesh = this.createErrorPopupMesh(pop);
      popMesh.position.set(to3DX(pop.x), to3DY(pop.y), -7.5 + (idx % 2) * 2.5);
      this.group.add(popMesh);
      this.floatingProps.push(popMesh);
    });

    // 8. Desktop Icons or Trophy Room Statues
    if (sm.isTrophyRoom) {
      this.buildTrophyRoomMonuments(sm.desktopIcons);
    } else {
      sm.desktopIcons.forEach((icon, idx) => {
        const totem = this.createDesktopIconTotem(icon, accentHex);
        totem.position.set(to3DX(icon.x), to3DY(icon.y) * 0.65 + 1.2, -10.8 + (idx % 2) * 1.4);
        this.group.add(totem);
        this.floatingProps.push(totem);
      });
    }

    this.redrawMonitorScreen(true);
  }

  getPlatformZ() {
    return 0;
  }

  getThemeAccentColor(theme) {
    return {
      desktop: 0x38bdf8,
      animate: 0xff7700,
      downloads: 0x2ecc71,
      firewall: 0xff3344,
      bsod: 0x60a5fa,
      recycle: 0x4db6ac,
      minecraft: 0xff682c,
      terminal: 0x4ade80,
      virabot: 0xf43f5e,
      dark_core: 0xff0033,
      command_realm: 0xffb340,
      browser_glitch: 0x38bdf8,
      cloud_cache: 0x7dd3fc,
      root_gateway: 0x22c55e,
      creeper_clan: 0xa3e635,
      lucky_orb: 0xfacc15,
      zero_day: 0x00f5ff,
      trophy: 0xffd54a
    }[theme] || 0x38bdf8;
  }

  buildBiomeColumns(theme, accentHex) {
    const texKey = theme === 'minecraft' ? 'obsidian'
      : (theme === 'command_realm' || theme === 'trophy' ? 'gold_block'
      : (theme === 'lucky_orb' ? 'lucky_block'
      : (theme === 'creeper_clan' ? 'creeper_moss' : getThemeFloorTextureKey(theme))));
    const blockMat = new THREE.MeshStandardMaterial({
      map: getVoxelTexture(texKey, 1, 4),
      roughness: 0.55
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.45
    });

    const columnXs = [-26, -16, -6, 6, 16, 26];
    columnXs.forEach((cx, i) => {
      const h = 3.2 + (i % 3) * 1.4;
      const col = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 1.6), blockMat);
      col.position.set(cx, h / 2, -12.0);
      col.castShadow = true;
      col.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 1.8), capMat);
      cap.position.set(cx, h + 0.18, -12.0);
      this.group.add(col, cap);
    });
  }

  buildPortal(x3d, z3d, isExit, label) {
    const group = new THREE.Group();
    group.position.set(x3d, 0, z3d);

    const frameMat = new THREE.MeshStandardMaterial({
      map: getVoxelTexture('obsidian', 1, 2),
      roughness: 0.4,
      metalness: 0.3
    });

    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.6, 0.7), frameMat);
    pillarL.position.set(-1.25, 1.8, 0);
    pillarL.castShadow = true;
    const pillarR = pillarL.clone();
    pillarR.position.set(1.25, 1.8, 0);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.8), frameMat);
    lintel.position.set(0, 3.75, 0);
    group.add(pillarL, pillarR, lintel);

    const coreColor = isExit ? 0xef4444 : 0x38bdf8;
    const coreMat = new THREE.MeshBasicMaterial({
      color: coreColor,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    const coreMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3.2), coreMat);
    coreMesh.position.set(0, 1.75, 0);
    group.add(coreMesh);

    const signTex = makeTextSignTexture(label, isExit ? 'PORTAL' : 'SPAWN', '#0f172a', isExit ? '#10b981' : '#38bdf8');
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.9),
      new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide })
    );
    signMesh.position.set(0, 4.7, 0);
    group.add(signMesh);

    if (isExit) {
      this.exitPortalCore = coreMesh;
      this.exitPortalMat = coreMat;
      this.exitSignMesh = signMesh;
    }

    this.group.add(group);
  }

  createPlatformMesh(p, theme, isMoving = false) {
    const w = p.width * WORLD_TO_3D;
    const h = Math.max(0.55, p.height * WORLD_TO_3D);
    const d = (p.depth3d || 170) * WORLD_TO_3D;

    const group = new THREE.Group();
    const texKey = theme === 'command_realm' ? 'gold_block'
      : (theme === 'minecraft' ? 'obsidian'
      : (theme === 'lucky_orb' ? 'lucky_block'
      : (theme === 'trophy' ? 'trophy_floor' : 'anvil_iron')));

    const bodyMat = new THREE.MeshStandardMaterial({
      map: getVoxelTexture(texKey, Math.max(2, Math.round(w / 2)), 2),
      roughness: 0.45,
      metalness: 0.25
    });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
    slab.castShadow = true;
    slab.receiveShadow = true;
    group.add(slab);

    const headerColor = isMoving ? 0x38bdf8 : this.getThemeAccentColor(theme);
    const headerBar = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.08, 0.22, d + 0.08),
      new THREE.MeshStandardMaterial({
        color: headerColor,
        emissive: headerColor,
        emissiveIntensity: 0.35
      })
    );
    headerBar.position.y = h / 2 + 0.05;
    group.add(headerBar);

    return group;
  }

  createLaserHazardMesh(laser) {
    const root = new THREE.Group();
    const x3d = to3DX(laser.x + laser.width / 2);
    const y3d = 0.48; // Low shin/knee-height laser beam across the arena floor
    const w3d = laser.width * WORLD_TO_3D;

    const emitterMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.3 });
    const emitterL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.55), emitterMat);
    emitterL.position.set(x3d - w3d / 2, 0.38, 0);
    const emitterR = emitterL.clone();
    emitterR.position.set(x3d + w3d / 2, 0.38, 0);

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xff1744,
      transparent: true,
      opacity: 0.92
    });
    const beam = new THREE.Group();
    const coreCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, w3d, 10), beamMat);
    coreCyl.rotation.z = Math.PI / 2;
    coreCyl.position.set(x3d, y3d, 0);
    beam.add(coreCyl);

    // Low cross-depth hazard strip so 3D arena movement sees the active laser zone clearly
    const crossBeam = new THREE.Mesh(
      new THREE.BoxGeometry(w3d, 0.28, 12),
      new THREE.MeshBasicMaterial({
        color: 0xff1744,
        transparent: true,
        opacity: 0.25,
        depthWrite: false
      })
    );
    crossBeam.position.set(x3d, y3d, 0);

    root.add(emitterL, emitterR, beam, crossBeam);
    return { root, beam, crossBeam, beamMat, data: laser };
  }

  createErrorPopupMesh(pop) {
    const w = pop.width * WORLD_TO_3D;
    const h = pop.height * WORLD_TO_3D;
    const tex = makeTextSignTexture(pop.title, pop.msg, '#ece9d8', '#0055ea', '#111827');
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.45), mat);
    box.castShadow = true;
    return box;
  }

  createDesktopIconTotem(icon, accentHex) {
    const group = new THREE.Group();
    const tex = makeTextSignTexture(icon.icon || '▣', icon.label, '#0f172a', '#38bdf8', icon.color || '#ffffff');
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.8, 0.5),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 })
    );
    group.add(cube);
    return group;
  }

  buildTrophyRoomMonuments(icons) {
    const pedestalMat = new THREE.MeshStandardMaterial({
      map: getVoxelTexture('gold_block', 1, 2),
      metalness: 0.5,
      roughness: 0.3
    });

    icons.forEach((item, idx) => {
      const pedGroup = new THREE.Group();
      const x3d = to3DX(item.x);
      const z3d = idx % 2 === 0 ? -5.8 : -3.8;
      pedGroup.position.set(x3d, 0, z3d);

      const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 2.4), pedestalMat);
      base.position.y = 0.7;
      base.castShadow = true;
      base.receiveShadow = true;
      pedGroup.add(base);

      const signTex = makeTextSignTexture(item.label, 'DEFEATED // ARCHIVED', '#071936', '#ffd54a', item.color || '#ffd54a');
      const plaque = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 0.85),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      plaque.position.set(0, 0.72, 1.22);
      pedGroup.add(plaque);

      // Miniature 3D Statue on top of each pedestal!
      const statue = this.createBossMiniature(item.label);
      statue.position.y = 1.42;
      pedGroup.add(statue);

      this.group.add(pedGroup);
    });

    // Center Spinning 3D Golden Restore Key Monument
    this.trophyKeyGroup = new THREE.Group();
    this.trophyKeyGroup.position.set(0, 11.2, -3.0);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      emissive: 0xb45309,
      metalness: 0.8,
      roughness: 0.2
    });
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.24, 12, 24), goldMat);
    bow.position.x = -1.2;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.32, 0.32), goldMat);
    shaft.position.x = 0.7;
    const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.65, 0.32), goldMat);
    tooth1.position.set(1.2, -0.4, 0);
    const tooth2 = tooth1.clone();
    tooth2.position.set(1.8, -0.4, 0);
    this.trophyKeyGroup.add(bow, shaft, tooth1, tooth2);
    this.group.add(this.trophyKeyGroup);
  }

  createBossMiniature(label) {
    if (label.includes('CREEPER')) {
      const rig = new CreeperLordRig3D();
      rig.root.scale.setScalar(0.5);
      return rig.root;
    }
    if (label.includes('CAT')) {
      const rig = new GiantCatRig3D();
      rig.root.scale.setScalar(0.5);
      return rig.root;
    }
    if (label.includes('ORB')) {
      const rig = new LuckyOrbRig3D();
      rig.root.scale.setScalar(0.55);
      return rig.root;
    }
    if (label.includes('TITAN')) {
      const rig = new StickRig3D({ color: '#1b5e20', scale: 0.72, isZombie: true, zombieType: 'titan_boss' });
      return rig.root;
    }
    if (label.includes('DARK')) {
      const rig = new StickRig3D({ color: '#ff1744', scale: 0.68, isHollowHead: true, weaponType: 'vira_blades' });
      return rig.root;
    }
    if (label.includes('KING')) {
      const rig = new StickRig3D({ color: '#ff8a00', scale: 0.68, hasCrown: true, weaponType: 'staff' });
      return rig.root;
    }
    const rig = new StickRig3D({ color: '#67e8f9', scale: 0.68, isHollowHead: true, zombieType: 'h4c3r' });
    return rig.root;
  }

  redrawMonitorScreen(force = false) {
    const sm = this.stageManager;
    if (!force && sm.stageTime - this.lastMonitorRedraw < 0.25) return;
    this.lastMonitorRedraw = sm.stageTime;

    const ctx = this.monitorCtx;
    const w = this.monitorCanvas.width;
    const h = this.monitorCanvas.height;
    ctx.save();

    if (sm.whiteVoidProgress > 0.5) {
      ctx.fillStyle = '#f2efe8';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('untitled.fla — 100% — WHITE VOID OVERRIDE', 48, 72);
      ctx.fillStyle = '#00f5ff';
      ctx.fillRect(48, 100, w - 96, 6);
    } else {
      ctx.fillStyle = sm.theme === 'bsod' ? '#003999'
        : (sm.theme === 'dark_core' ? '#1a0008'
        : (sm.theme === 'minecraft' ? '#291218'
        : (sm.theme === 'trophy' ? '#051b3b' : '#0b192c')));
      ctx.fillRect(0, 0, w, h);

      // Subtle cyber grid
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.14)';
      ctx.lineWidth = 2;
      for (let x = 0; x < w; x += 64) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 64) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      const beat = sm.campaignBeat || {};
      ctx.fillStyle = '#67e8f9';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(`${beat.act || 'ACT I'} // STAGE ${sm.currentStage}: ${sm.stageName.toUpperCase()}`, 42, 54);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 34px monospace';
      ctx.fillText(`MISSION: ${beat.mission || sm.stageName}`, 42, 104);

      if (beat.bossLabel) {
        ctx.fillStyle = '#ffea00';
        ctx.font = 'bold 26px monospace';
        ctx.fillText(`⚠ BOSS DETECTED: ${beat.bossLabel}`, 42, 150);
      } else if (beat.clue) {
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(`TRACE CLUE // ${beat.clue}`, 42, 150);
      }

      // Taskbar at bottom of monitor
      ctx.fillStyle = '#0b4989';
      ctx.fillRect(0, h - 52, w, 52);
      ctx.fillStyle = '#1682c4';
      ctx.fillRect(14, h - 44, 130, 36);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('🪟 START 3D', 26, h - 19);

      const clearedThrough = sm.currentStage - (sm.isObjectiveComplete ? 0 : 1);
      const keyPieces = sm.isTrophyRoom ? 3 : (clearedThrough < 5 ? 0 : (clearedThrough < 10 ? 1 : (clearedThrough < 11 ? 2 : 3)));
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffea00';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(`RESTORE.KEY: ${keyPieces}/3`, w - 28, h - 18);
    }

    ctx.restore();
    this.monitorTexture.needsUpdate = true;
  }

  update(dt) {
    const sm = this.stageManager;

    // Sync moving platforms
    for (const item of this.movingPlatformMeshes) {
      item.mesh.position.x = to3DX(item.data.x);
      item.mesh.position.y = to3DY(item.data.y - item.data.height / 2);
    }

    // Sync lasers
    for (const l of this.laserMeshes) {
      const isActive = l.data.timer < l.data.activeDuration;
      l.beam.visible = isActive;
      l.crossBeam.visible = isActive;
    }

    // Sync Exit Portal color & pulse
    if (this.exitPortalMat && this.exitPortalCore) {
      const isOpen = sm.exitDoor.isOpen;
      this.exitPortalMat.color.setHex(isOpen ? 0x10b981 : 0xef4444);
      this.exitPortalMat.opacity = isOpen ? 0.65 + Math.sin(sm.stageTime * 8) * 0.2 : 0.45;
      if (this.exitSignMesh) {
        this.exitSignMesh.position.y = 4.7 + (isOpen ? Math.sin(sm.stageTime * 6) * 0.22 : 0);
      }
    }

    // Spin Trophy Key if in Trophy Room
    if (this.trophyKeyGroup) {
      this.trophyKeyGroup.rotation.y += dt * 1.8;
    }

    // Floating desktop icons gentle bob
    this.floatingProps.forEach((prop, i) => {
      prop.position.y += Math.sin(sm.stageTime * 3 + i) * 0.004;
    });

    this.redrawMonitorScreen(false);
  }
}
