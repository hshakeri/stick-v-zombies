import * as THREE from '../lib/three.module.min.js';
import { getVoxelTexture, getThemeFloorTextureKey } from './textures3d.js?v=10.5';
import {
  StickRig3D,
  CreeperLordRig3D,
  GiantCatRig3D,
  LuckyOrbRig3D,
  EnderDragonRig3D,
  WardenBossRig3D,
  CreakingBossRig3D
} from './models3d.js?v=10.5';

export const WORLD_TO_3D = 1 / 34;
export const ARENA_HALF_X = 980;
export const ARENA_HALF_Z = 380;
export const ISLAND_FLOOR_BOUNDS = Object.freeze({ halfX: 980, halfZ: 380 });

export function isFloatingIslandTheme(theme) {
  return theme === 'the_end' || theme === 'aether' || theme === 'cloud_cache' || theme === 'lucky_orb';
}

export function isOpenEdgeTheme(theme) {
  return isFloatingIslandTheme(theme) || theme === 'minecraft';
}

export function isLavaSeaTheme(theme) {
  return theme === 'minecraft';
}

export function to3DX(x) {
  return x * WORLD_TO_3D;
}
export function to3DY(y) {
  return -y * WORLD_TO_3D;
}
export function to3DZ(z) {
  return (z || 0) * WORLD_TO_3D;
}

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
    this.lavaHazardMeshes = [];
    this.lavaSeaMesh = null;
    this.lavaSeaMat = null;
    this._lavaTime = 0;
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
    this.lastMonitorStateKey = '';

    this.buildPersistentMonitor();
  }

  dispose() {
    disposeHierarchy(this.group, false);
    disposeHierarchy(this.monitorGroup, false);
    this.monitorTexture?.dispose?.();
    this.lavaSeaMesh = null;
    this.lavaSeaMat = null;
    this.lavaHazardMeshes.length = 0;
  }

  buildPersistentMonitor() {
    this.monitorGroup = new THREE.Group();
    this.monitorGroup.position.set(0, 10.2, -14.8);

    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.5
    });
    this.monitorFrame = new THREE.Mesh(new THREE.BoxGeometry(66, 23.5, 1.2), bezelMat);
    this.monitorFrame.position.z = -0.7;

    this.standNeck = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 1.6), bezelMat);
    this.standNeck.position.set(0, -13.5, -1.0);

    const screenMat = new THREE.MeshBasicMaterial({ map: this.monitorTexture });
    this.screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(63.6, 21.4), screenMat);

    this.monitorGroup.add(this.monitorFrame, this.standNeck, this.screenMesh);
    this.scene.add(this.monitorGroup);
  }

  rebuildForStage(stageManager = this.stageManager, themeOverride = null) {
    disposeHierarchy(this.group, true);
    while (this.group.children.length > 0) {
      const child = this.group.children.pop();
      this.group.remove(child);
    }
    this.platformMeshes.length = 0;
    this.movingPlatformMeshes.length = 0;
    this.laserMeshes.length = 0;
    this.lavaHazardMeshes.length = 0;
    this.lavaSeaMesh = null;
    this.lavaSeaMat = null;
    this.floatingProps.length = 0;
    this.trophyKeyGroup = null;
    this.ancientCityCenterPortal = null;
    this.paleGardenHeartShrine = null;
    this.youtubePlayMonument = null;
    this.chromeLogoGroup = null;
    this.spotifyEqualizerBars = [];
    this.spotifyVinylDisc = null;
    this.slidesChartBars = [];

    if (stageManager) this.stageManager = stageManager;
    const sm = stageManager || this.stageManager;
    const theme = themeOverride || sm?.theme || 'desktop';
    const floorKey = getThemeFloorTextureKey(theme, false);

    // Hide PC monitor stand neck when inside Rocket Corp Facility, Ancient City, Pale Garden, or AvA 8 Lake
    if (this.standNeck) {
      this.standNeck.visible = theme !== 'rocket_corp' && theme !== 'ancient_city' && theme !== 'pale_garden' && theme !== 'dark_core';
    }

    // 1. Voxel Arena Floor (62 x 26 blocks)
    const floorW = 62;
    const floorD = 26;
    const floorTex = getVoxelTexture(floorKey, 31, 13);
    this.floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: theme === 'rocket_corp' ? 0.35 : 0.55,
      metalness: theme === 'rocket_corp' ? 0.22 : 0.1
    });
    const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(floorW, 1.5, floorD), this.floorMat);
    floorMesh.position.set(0, -0.75, 0);
    floorMesh.receiveShadow = true;
    this.group.add(floorMesh);

    // Sub-floor voxel cliff layers (Minecraft island / Ancient City & AvA 8 Lake canyon stone / Pale Garden oak / Facility foundation)
    const subTexKey = theme === 'minecraft' || theme === 'the_end'
      ? 'obsidian'
      : (theme === 'ancient_city' || theme === 'dark_core' ? 'deepslate_tiles'
      : (theme === 'pale_garden' ? 'pale_oak_log'
      : (theme === 'aether' ? 'holystone' : (theme === 'rocket_corp' ? 'rocket_corp_wall' : 'anvil_iron'))));
    const subTex = getVoxelTexture(subTexKey, 31, 2);
    const subMat = new THREE.MeshStandardMaterial({ map: subTex, roughness: 0.7 });
    const subLayer = new THREE.Mesh(new THREE.BoxGeometry(floorW - 1.5, 3.2, floorD - 1.5), subMat);
    subLayer.position.set(0, -3.1, 0);
    this.group.add(subLayer);

    // 1b. 3D Animated Lava Sea Mesh (Stage 7 Nether Core)
    if (theme === 'minecraft') {
      this.buildLavaSea();
    }

    // Glowing Arena Border Rails (or Industrial Yellow/Black Hazard Curbs in Rocket Corp!)
    // Border rails are omitted on open-edge stages (floating islands & Nether) to permit free passage and void falling
    const accentHex = this.getThemeAccentColor(theme);
    if (!isOpenEdgeTheme(theme)) {
      const railMat = theme === 'rocket_corp'
        ? new THREE.MeshStandardMaterial({
            map: getVoxelTexture('rocket_corp_hazard', 24, 1),
            roughness: 0.4,
            metalness: 0.2
          })
        : new THREE.MeshStandardMaterial({
            color: accentHex,
            emissive: accentHex,
            emissiveIntensity: 0.55,
            roughness: 0.25
          });
      const sideRailMat = theme === 'rocket_corp'
        ? new THREE.MeshStandardMaterial({
            map: getVoxelTexture('rocket_corp_hazard', 1, 10),
            roughness: 0.4,
            metalness: 0.2
          })
        : railMat;
      const railNorth = new THREE.Mesh(new THREE.BoxGeometry(floorW, 0.35, 0.45), railMat);
      railNorth.name = 'railNorth';
      railNorth.userData = { isRail: true, side: 'north' };
      railNorth.position.set(0, 0.18, -floorD / 2 + 0.25);
      const railSouth = railNorth.clone();
      railSouth.name = 'railSouth';
      railSouth.userData = { isRail: true, side: 'south' };
      railSouth.position.set(0, 0.18, floorD / 2 - 0.25);
      const wallX = to3DX(980) + 0.55;
      const railWest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, floorD), sideRailMat);
      railWest.name = 'railWest';
      railWest.userData = { isRail: true, side: 'west' };
      railWest.position.set(-wallX, 0.55, 0);
      const railEast = railWest.clone();
      railEast.name = 'railEast';
      railEast.userData = { isRail: true, side: 'east' };
      railEast.position.set(wallX, 0.55, 0);
      this.group.add(railNorth, railSouth, railWest, railEast);
    }

    // 2. Voxel Pillars / Minecraft Biome Props / Rocket Corp Facility Architecture
    this.buildBiomeColumns(theme, accentHex);

    // 3. Start Portal & Exit Portal (set slightly back in Z so the full player figure is always visible in front)
    this.buildPortal(to3DX(sm.entranceDoor.x), -2.2, false, sm.isTrophyRoom ? 'ENTRY' : (theme === 'rocket_corp' ? 'AIRLOCK IN' : 'START'));
    this.buildPortal(to3DX(sm.exitDoor.x), -2.2, true, sm.isTrophyRoom ? 'RESULTS' : (theme === 'rocket_corp' ? 'SECTOR EXIT' : 'EXIT'));

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

    // 6b. Floor Lava Hazards (Stage 7 Nether Core or authored hazards)
    if (sm?.lavaHazards && Array.isArray(sm.lavaHazards)) {
      sm.lavaHazards.forEach((hazard) => {
        const lavaGroup = this.createLavaHazardMesh(hazard);
        this.group.add(lavaGroup.root);
        this.lavaHazardMeshes.push(lavaGroup);
      });
    }

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
      dark_core: 0x38bdf8,
      command_realm: 0xffb340,
      browser_glitch: 0x38bdf8,
      cloud_cache: 0x7dd3fc,
      root_gateway: 0x22c55e,
      creeper_clan: 0xa3e635,
      lucky_orb: 0xfacc15,
      the_end: 0xd946ef,
      aether: 0x38d9a9,
      ancient_city: 0x22d3ee,
      pale_garden: 0xf97316,
      youtube: 0xff0033,
      chrome: 0x4285f4,
      spotify: 0x1db954,
      slides: 0xfbbc04,
      rocket_corp: 0xff6b00,
      zero_day: 0x00f5ff,
      trophy: 0xffd54a
    }[theme] || 0x38bdf8;
  }

  buildLavaSea() {
    const lavaGeo = new THREE.PlaneGeometry(140, 90);
    const lavaTex = getVoxelTexture('lava', 35, 22);
    this.lavaSeaMat = new THREE.MeshStandardMaterial({
      map: lavaTex,
      color: 0xff3300,
      emissive: new THREE.Color(0xff4400),
      emissiveIntensity: 0.8,
      roughness: 0.4,
      metalness: 0.1
    });
    this.lavaSeaMesh = new THREE.Mesh(lavaGeo, this.lavaSeaMat);
    this.lavaSeaMesh.name = 'lavaSeaMesh';
    this.lavaSeaMesh.rotation.x = -Math.PI / 2;
    this.lavaSeaMesh.position.set(0, -8.0, 0);
    this.lavaSeaMesh.receiveShadow = true;
    this.group.add(this.lavaSeaMesh);
  }

  createLavaHazardMesh(hazard) {
    const root = new THREE.Group();
    const x3d = to3DX(hazard.x);
    const y3d = 0.06;
    const z3d = to3DZ(hazard.z || 0);
    const w3d = (hazard.width || 160) * WORLD_TO_3D;
    const h3d = Math.max(0.12, (hazard.height || 10) * WORLD_TO_3D);
    const d3d = (hazard.depth3d || 220) * WORLD_TO_3D;

    const repX = Math.max(1, Math.round((hazard.width || 160) / 34));
    const repZ = Math.max(1, Math.round((hazard.depth3d || 220) / 34));
    const lavaTex = getVoxelTexture('lava', repX, repZ);

    const slabMat = new THREE.MeshStandardMaterial({
      map: lavaTex,
      color: 0xff3300,
      emissive: new THREE.Color(0xff4400),
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.1
    });

    const slabMesh = new THREE.Mesh(new THREE.BoxGeometry(w3d, h3d, d3d), slabMat);
    slabMesh.name = 'lavaHazardSlab';
    slabMesh.position.set(x3d, y3d, z3d);
    slabMesh.receiveShadow = true;

    const curbMat = new THREE.MeshStandardMaterial({
      map: getVoxelTexture('obsidian', 1, 1),
      roughness: 0.8
    });
    const curbMesh = new THREE.Mesh(new THREE.BoxGeometry(w3d + 0.35, h3d * 0.85, d3d + 0.35), curbMat);
    curbMesh.name = 'lavaHazardCurb';
    curbMesh.position.set(x3d, y3d - 0.02, z3d);

    root.add(curbMesh, slabMesh);
    return { root, slabMesh, slabMat, curbMesh, curbMat, data: hazard };
  }

  buildAncientCityRuins() {
    const deepslateTex = getVoxelTexture('deepslate_tiles', 4, 4);
    deepslateTex.isShared = true;
    const reinforcedTex = getVoxelTexture('reinforced_deepslate', 6, 2);
    reinforcedTex.isShared = true;
    const sculkTex = getVoxelTexture('sculk', 3, 3);
    sculkTex.isShared = true;

    const deepslateMat = new THREE.MeshStandardMaterial({
      map: deepslateTex,
      roughness: 0.65,
      metalness: 0.15
    });
    const reinforcedMat = new THREE.MeshStandardMaterial({
      map: reinforcedTex,
      roughness: 0.45,
      metalness: 0.25
    });
    const sculkPatchMat = new THREE.MeshStandardMaterial({
      map: sculkTex,
      emissive: new THREE.Color(0x0891b2),
      emissiveIntensity: 0.55,
      roughness: 0.5
    });
    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3c4,
      roughness: 0.45
    });
    const soulCyanGlow = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: new THREE.Color(0x06b6d4),
      emissiveIntensity: 0.95,
      roughness: 0.2
    });

    // 1. Center Reinforced Deepslate Ancient City Portal Monument (Warden-head silhouette!)
    const portalMonument = new THREE.Group();
    portalMonument.name = 'ancientCityCenterPortal';
    portalMonument.position.set(0, 0, -11.4);

    // Stepped Deepslate Altar Dais
    const daisLower = new THREE.Mesh(new THREE.BoxGeometry(19.5, 0.75, 3.6), deepslateMat);
    daisLower.position.y = 0.38;
    const daisUpper = new THREE.Mesh(new THREE.BoxGeometry(16.8, 0.65, 2.8), deepslateMat);
    daisUpper.position.y = 1.05;
    portalMonument.add(daisLower, daisUpper);

    // Wide Rectangular Reinforced Deepslate Frame
    const frameBottom = new THREE.Mesh(new THREE.BoxGeometry(15.2, 1.15, 1.65), reinforcedMat);
    frameBottom.position.y = 1.95;
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(15.2, 1.25, 1.65), reinforcedMat);
    frameTop.position.y = 9.35;
    const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(1.45, 6.25, 1.65), reinforcedMat);
    frameLeft.position.set(-6.88, 5.65, 0);
    const frameRight = frameLeft.clone();
    frameRight.position.set(6.88, 5.65, 0);

    // Iconic Warden-Ear Stone Flanges atop the Center Portal Frame
    const earFlangeL = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.55, 1.35), deepslateMat);
    earFlangeL.position.set(-7.6, 10.45, 0);
    earFlangeL.rotation.z = 0.24;
    const earTipL = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 1.4), soulCyanGlow);
    earTipL.position.set(-8.55, 11.15, 0);
    const earFlangeR = earFlangeL.clone();
    earFlangeR.position.set(7.6, 10.45, 0);
    earFlangeR.rotation.z = -0.24;
    const earTipR = earTipL.clone();
    earTipR.position.set(8.55, 11.15, 0);

    // Shimmering Deep Dark Soul Veil inside the Giant Portal
    const veilMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide
    });
    const portalVeil = new THREE.Mesh(new THREE.PlaneGeometry(12.2, 6.15), veilMat);
    portalVeil.position.set(0, 5.65, 0);
    const portalEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(12.3, 6.2, 0.4)),
      new THREE.LineBasicMaterial({ color: 0x22d3ee })
    );
    portalEdges.position.set(0, 5.65, 0);

    const plaqueTex = makeTextSignTexture('ANCIENT CITY // DEEP DARK', 'REINFORCED DEEPSLATE SANCTUM', '#06141f', '#22d3ee', '#67e8f9');
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8, 1.05),
      new THREE.MeshBasicMaterial({ map: plaqueTex })
    );
    plaque.position.set(0, 10.45, 0.9);

    portalMonument.add(
      frameBottom, frameTop, frameLeft, frameRight,
      earFlangeL, earTipL, earFlangeR, earTipR,
      portalVeil, portalEdges, plaque
    );
    this.ancientCityCenterPortal = { root: portalMonument, veilMat, earTipL, earTipR };
    this.group.add(portalMonument);

    // 2. Four Ruined Deepslate Watchtowers with Sculk Growth & Soul Fire Braziers
    const towerXs = [-25.5, -15.5, 15.5, 25.5];
    towerXs.forEach((tx, idx) => {
      const h = idx % 2 === 0 ? 9.4 : 8.2;
      const tower = new THREE.Group();
      tower.position.set(tx, 0, -11.6);

      const shaft = new THREE.Mesh(new THREE.BoxGeometry(2.5, h, 2.5), deepslateMat);
      shaft.position.y = h / 2;
      shaft.castShadow = true;
      tower.add(shaft);

      const sculkWrap = new THREE.Mesh(new THREE.BoxGeometry(2.68, 2.2, 2.68), sculkPatchMat);
      sculkWrap.position.y = 1.1;
      tower.add(sculkWrap);

      // Soul Fire Brazier Basin & Cyan Flame atop each tower
      const basin = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.65, 2.9), reinforcedMat);
      basin.position.y = h + 0.32;
      const soulFlame = new THREE.Mesh(new THREE.ConeGeometry(0.88, 1.85, 5), soulCyanGlow);
      soulFlame.position.y = h + 1.45;
      tower.add(basin, soulFlame);
      this.floatingProps.push(soulFlame);

      this.group.add(tower);
    });

    // 3. Ruined Deepslate Bridges & Hanging Soul Lanterns between Outer & Inner Towers
    [-20.5, 20.5].forEach((bx) => {
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.85, 1.4), deepslateMat);
      bridge.position.set(bx, 7.6, -11.6);
      this.group.add(bridge);

      const lanternGroup = new THREE.Group();
      lanternGroup.position.set(bx, 5.85, -11.2);
      const chain = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.4, 0.14), deepslateMat);
      chain.position.y = 0.95;
      const lanternCap = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.2, 0.76), deepslateMat);
      lanternCap.position.y = 0.28;
      const lanternCore = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.58), soulCyanGlow);
      lanternCore.position.y = -0.15;
      lanternGroup.add(chain, lanternCap, lanternCore);
      this.group.add(lanternGroup);
      this.floatingProps.push(lanternGroup);
    });

    // 4. Sculk Shriekers & Waving Sculk Sensors along the Cavern Edge
    [-10.2, -4.6, 4.6, 10.2].forEach((sx, idx) => {
      const prop = new THREE.Group();
      prop.position.set(sx, 0, -8.8);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.68, 1.35), sculkPatchMat);
      base.position.y = 0.34;
      prop.add(base);

      if (idx % 2 === 0) {
        // Sculk Shrieker: 4 curved bone jaw-horns + glowing cyan soul ring
        for (const cx of [-0.46, 0.46]) {
          for (const cz of [-0.46, 0.46]) {
            const horn = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.24), boneMat);
            horn.position.set(cx, 0.92, cz);
            prop.add(horn);
          }
        }
        const soulRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.08, 8, 14), soulCyanGlow);
        soulRing.rotation.x = Math.PI / 2;
        soulRing.position.y = 0.78;
        prop.add(soulRing);
        this.floatingProps.push(soulRing);
      } else {
        // Sculk Sensor: 4 waving bioluminescent cyan tendrils
        const tendrilCluster = new THREE.Group();
        tendrilCluster.position.y = 0.68;
        for (const cx of [-0.38, 0.38]) {
          for (const cz of [-0.38, 0.38]) {
            const tendril = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), soulCyanGlow);
            tendril.position.set(cx, 0.28, cz);
            tendril.rotation.z = cx > 0 ? -0.25 : 0.25;
            tendrilCluster.add(tendril);
          }
        }
        prop.add(tendrilCluster);
        this.floatingProps.push(tendrilCluster);
      }
      this.group.add(prop);
    });
  }

  buildPaleGardenGrove() {
    const oakTex = getVoxelTexture('pale_oak_log', 1, 3);
    oakTex.isShared = true;
    const leavesTex = getVoxelTexture('pale_oak_leaves', 2, 2);
    leavesTex.isShared = true;
    const mossTex = getVoxelTexture('pale_moss', 2, 1);
    mossTex.isShared = true;
    const heartTex = getVoxelTexture('creaking_heart', 1, 1);
    heartTex.isShared = true;

    const oakMat = new THREE.MeshStandardMaterial({
      map: oakTex,
      roughness: 0.72,
      metalness: 0.08
    });
    const leavesMat = new THREE.MeshStandardMaterial({
      map: leavesTex,
      roughness: 0.78
    });
    const mossMat = new THREE.MeshStandardMaterial({
      map: mossTex,
      roughness: 0.85
    });
    const hangingMossMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.9
    });
    const resinGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfb923c,
      emissive: new THREE.Color(0xf97316),
      emissiveIntensity: 0.92,
      roughness: 0.25
    });
    const heartMat = new THREE.MeshStandardMaterial({
      map: heartTex,
      emissive: new THREE.Color(0xf97316),
      emissiveIntensity: 0.85,
      roughness: 0.35
    });

    // 1. Center Gnarled Ancient Pale Oak & Suspended Creaking Heart Shrine
    const shrine = new THREE.Group();
    shrine.name = 'paleGardenHeartShrine';
    shrine.position.set(0, 0, -11.4);

    // Moss-covered root mound
    const rootMound = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.75, 3.4), mossMat);
    rootMound.position.y = 0.38;
    const rootStep = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.62, 2.6), oakMat);
    rootStep.position.y = 0.98;
    shrine.add(rootMound, rootStep);

    // Twin gnarled Pale Oak trunks arching around the glowing Creaking Heart cavity
    const trunkL = new THREE.Mesh(new THREE.BoxGeometry(1.75, 7.6, 1.75), oakMat);
    trunkL.position.set(-2.65, 4.4, 0);
    trunkL.rotation.z = -0.14;
    const trunkR = new THREE.Mesh(new THREE.BoxGeometry(1.75, 7.6, 1.75), oakMat);
    trunkR.position.set(2.65, 4.4, 0);
    trunkR.rotation.z = 0.14;
    const boughArch = new THREE.Mesh(new THREE.BoxGeometry(7.8, 1.45, 1.85), oakMat);
    boughArch.position.set(0, 8.15, 0);

    // Wide Pale Oak Leaf Canopy & Hanging Pale Moss Drapes
    const mainCanopy = new THREE.Mesh(new THREE.BoxGeometry(13.6, 2.6, 3.8), leavesMat);
    mainCanopy.position.set(0, 9.85, 0);
    const upperCanopy = new THREE.Mesh(new THREE.BoxGeometry(9.2, 1.8, 3.0), leavesMat);
    upperCanopy.position.set(0, 11.55, 0);
    shrine.add(trunkL, trunkR, boughArch, mainCanopy, upperCanopy);

    for (const mx of [-5.2, -3.6, 3.6, 5.2]) {
      const mossStrand = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.6, 0.22), hangingMossMat);
      mossStrand.position.set(mx, 7.35, 1.1);
      shrine.add(mossStrand);
      this.floatingProps.push(mossStrand);
    }

    // Glowing Resin Clump Bark Veins leading into the Creaking Heart
    for (const vx of [-1.85, 1.85]) {
      const vein = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.8, 0.28), resinGlowMat);
      vein.position.set(vx, 4.85, 0.82);
      vein.rotation.z = vx < 0 ? -0.22 : 0.22;
      shrine.add(vein);
    }

    // Central Pulsing Creaking Heart Block & Resin Aura Ring
    const heartMesh = new THREE.Mesh(new THREE.BoxGeometry(2.15, 2.15, 2.15), heartMat);
    heartMesh.position.set(0, 5.15, 0.15);
    const resinRing = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.11, 8, 22), resinGlowMat);
    resinRing.position.set(0, 5.15, 0.2);

    const plaqueTex = makeTextSignTexture('PALE GARDEN // CREAKING HEART', "DON'T BLINK · SHATTER THE PUPPET", '#181b20', '#fb923c', '#f8fafc');
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(5.0, 1.05),
      new THREE.MeshBasicMaterial({ map: plaqueTex })
    );
    plaque.position.set(0, 10.25, 1.98);

    shrine.add(heartMesh, resinRing, plaque);
    this.paleGardenHeartShrine = { root: shrine, heartMesh, heartMat, resinRing };
    this.group.add(shrine);

    // 2. Six Haunted Twisted Pale Oak Trees with Hanging Moss Curtains
    const treeXs = [-25.5, -17.0, -9.2, 9.2, 17.0, 25.5];
    treeXs.forEach((tx, idx) => {
      const h = 7.4 + (idx % 3) * 1.35;
      const tree = new THREE.Group();
      tree.position.set(tx, 0, -11.8);

      const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.85, h, 1.85), oakMat);
      trunk.position.y = h / 2;
      trunk.rotation.z = (idx % 2 === 0 ? 1 : -1) * 0.05;
      trunk.castShadow = true;

      const mossBase = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.85, 2.35), mossMat);
      mossBase.position.y = 0.42;

      const crown = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.35, 3.6), leavesMat);
      crown.position.y = h + 0.95;

      const limbDir = tx < 0 ? 1 : -1;
      const limb = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 0.65), oakMat);
      limb.position.set(limbDir * 1.45, h - 1.1, 0.45);
      limb.rotation.z = limbDir * 0.22;

      const drape = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.15, 0.2), hangingMossMat);
      drape.position.set(limbDir * 2.15, h - 2.25, 0.45);
      this.floatingProps.push(drape);

      // Subtle orange resin sap knot on alternate Pale Oaks
      if (idx % 2 === 1) {
        const resinKnot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.24), resinGlowMat);
        resinKnot.position.set(0, h * 0.52, 0.92);
        tree.add(resinKnot);
      }

      tree.add(trunk, mossBase, crown, limb, drape);
      this.group.add(tree);
    });

    // 3. Open Eyeblossom Flower Clusters Glowing in the Pale Moss
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.8 });
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.6 });
    [-12.8, -5.6, 5.6, 12.8].forEach((fx) => {
      const cluster = new THREE.Group();
      cluster.position.set(fx, 0, -8.7);
      const patch = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 1.3), mossMat);
      patch.position.y = 0.14;
      cluster.add(patch);

      for (const ox of [-0.38, 0.36]) {
        const stemH = ox < 0 ? 0.72 : 0.92;
        const stem = new THREE.Mesh(new THREE.BoxGeometry(0.12, stemH, 0.12), stemMat);
        stem.position.set(ox, stemH / 2 + 0.2, 0);
        const petals = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), petalMat);
        petals.position.set(ox, stemH + 0.24, 0);
        const eyePupil = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.22), resinGlowMat);
        eyePupil.position.set(ox, stemH + 0.32, 0.04);
        cluster.add(stem, petals, eyePupil);
      }
      this.group.add(cluster);
    });
  }

  buildAvA8ShowdownLake() {
    const slateTex = getVoxelTexture('deepslate_tiles', 4, 4);
    slateTex.isShared = true;
    const slateMat = new THREE.MeshStandardMaterial({ map: slateTex, roughness: 0.78 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.72 });
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.32,
      roughness: 0.18,
      metalness: 0.15,
      transparent: true,
      opacity: 0.86
    });
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.85 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.82 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85 });
    const viraGlowMat = new THREE.MeshStandardMaterial({
      color: 0xff1744,
      emissive: 0xff1744,
      emissiveIntensity: 0.9,
      roughness: 0.25
    });

    // 1. Shimmering Outernet Lake Basin surrounding the rocky lakeshore arena
    const lakeSea = new THREE.Mesh(new THREE.PlaneGeometry(148, 96), waterMat);
    lakeSea.rotation.x = -Math.PI / 2;
    lakeSea.position.set(0, -1.15, 0);
    lakeSea.receiveShadow = true;
    this.group.add(lakeSea);

    // 2. Left High Waterfall Bluff + Cascading 3D Waterfall Curtain + Plunge Foam Pool
    const leftBluff = new THREE.Group();
    leftBluff.position.set(-14.5, 0, -11.4);
    const cliffBodyL = new THREE.Mesh(new THREE.BoxGeometry(16.5, 9.6, 3.6), slateMat);
    cliffBodyL.position.y = 4.8;
    const turfCapL = new THREE.Mesh(new THREE.BoxGeometry(16.8, 0.55, 3.8), grassMat);
    turfCapL.position.y = 9.75;
    const waterfallSheet = new THREE.Mesh(new THREE.BoxGeometry(3.2, 9.5, 0.55), waterMat);
    waterfallSheet.position.set(3.4, 4.75, 1.9);
    const waterfallCore = new THREE.Mesh(new THREE.BoxGeometry(1.7, 9.55, 0.62), foamMat);
    waterfallCore.position.set(3.4, 4.75, 1.95);
    const plungePoolFoam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.28, 16), foamMat);
    plungePoolFoam.position.set(3.4, 0.14, 2.2);
    // Scorched TCO vs. TDL impact crater fissure on left cliff
    const craterVein = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, 0.3), viraGlowMat);
    craterVein.rotation.z = -0.35;
    craterVein.position.set(-3.2, 4.6, 1.85);
    leftBluff.add(cliffBodyL, turfCapL, waterfallSheet, waterfallCore, plungePoolFoam, craterVein);
    this.group.add(leftBluff);

    // 3. Right Cliff Bluff + Wrecked Dark Lord Cabin Shack + Subterranean ViraBot Bunker
    const rightBluff = new THREE.Group();
    rightBluff.position.set(14.5, 0, -11.4);
    const cliffBodyR = new THREE.Mesh(new THREE.BoxGeometry(16.5, 8.6, 3.6), slateMat);
    cliffBodyR.position.y = 4.3;
    const turfCapR = new THREE.Mesh(new THREE.BoxGeometry(16.8, 0.55, 3.8), grassMat);
    turfCapR.position.y = 8.75;

    // Wrecked wooden shack perched on the right cliff bluff
    const shackWalls = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, 2.6), woodMat);
    shackWalls.position.set(-0.6, 10.0, 0.1);
    const roofHalfL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 2.9), roofMat);
    roofHalfL.rotation.z = 0.42;
    roofHalfL.position.set(-1.65, 11.35, 0.1);
    const roofHalfR = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.35, 2.9), roofMat);
    roofHalfR.rotation.z = -0.48;
    roofHalfR.position.set(0.55, 11.2, 0.1);
    const shackMonitor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.2), viraGlowMat);
    shackMonitor.position.set(0.3, 10.0, 1.35);

    // Subterranean ViraBot Canister Pods recessed into the cliff rock below the shack
    for (let c = -1; c <= 1; c++) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.9, 12), viraGlowMat);
      pod.position.set(-0.6 + c * 1.45, 3.4, 1.85);
      rightBluff.add(pod);
    }

    rightBluff.add(cliffBodyR, turfCapR, shackWalls, roofHalfL, roofHalfR, shackMonitor);
    this.group.add(rightBluff);
  }

  buildYouTubeStudioArena() {
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.42, metalness: 0.35 });
    const redGlow = new THREE.MeshStandardMaterial({
      color: 0xff0033,
      emissive: 0xff0033,
      emissiveIntensity: 0.72,
      roughness: 0.28
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf8fafc,
      emissiveIntensity: 0.35,
      roughness: 0.2
    });

    // 1. Center Monumental 3D YouTube Play Button Sculpture
    const monument = new THREE.Group();
    monument.position.set(0, 0, -10.8);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.85, 2.4), darkMat);
    plinth.position.y = 0.42;
    const playBlock = new THREE.Mesh(new THREE.BoxGeometry(6.4, 4.2, 1.15), redGlow);
    playBlock.position.y = 3.2;
    playBlock.castShadow = true;

    const triangleGeo = new THREE.CylinderGeometry(1.15, 1.15, 0.42, 3);
    const playPrism = new THREE.Mesh(triangleGeo, whiteMat);
    playPrism.rotation.x = Math.PI / 2;
    playPrism.rotation.y = Math.PI / 2;
    playPrism.position.set(0.15, 3.2, 0.55);

    const subSignTex = makeTextSignTexture('SUBSCRIBE // 10M', 'YOUTUBE STUDIO ARENA', '#09090b', '#ff0033', '#ffffff');
    const subSign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 1.05),
      new THREE.MeshBasicMaterial({ map: subSignTex })
    );
    subSign.position.set(0, 5.95, 0.2);

    monument.add(plinth, playBlock, playPrism, subSign);
    this.youtubePlayMonument = { root: monument, playPrism };
    this.group.add(monument);

    // 2. Creator Award Columns (Silver, Gold, Diamond Play Plaques)
    const awardSpecs = [
      { x: -23.5, col: 0xcbd5e1, h: 6.2 },
      { x: -13.5, col: 0xfacc15, h: 7.4 },
      { x: 13.5, col: 0x38bdf8, h: 7.4 },
      { x: 23.5, col: 0xff0033, h: 6.2 }
    ];
    for (let i = 0; i < awardSpecs.length; i++) {
      const sp = awardSpecs[i];
      const colGroup = new THREE.Group();
      colGroup.position.set(sp.x, 0, -11.6);
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.1, sp.h, 1.8), darkMat);
      pillar.position.y = sp.h * 0.5;
      pillar.castShadow = true;
      const plaqueMat = new THREE.MeshStandardMaterial({
        color: sp.col,
        emissive: sp.col,
        emissiveIntensity: 0.45,
        metalness: 0.65,
        roughness: 0.22
      });
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.5, 0.35), plaqueMat);
      plaque.position.set(0, sp.h - 1.2, 0.9);
      colGroup.add(pillar, plaque);
      this.group.add(colGroup);
    }
  }

  buildChromeBrowserArena() {
    const slateMat = new THREE.MeshStandardMaterial({ color: 0x292a2d, roughness: 0.45, metalness: 0.3 });
    const dinoMat = new THREE.MeshStandardMaterial({ color: 0xbdc1c6, roughness: 0.55 });
    const cactusMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.6 });
    const googleHex = [0x4285f4, 0xea4335, 0xfbbc05, 0x34a853];

    // 1. Center Spinning 4-Color Google Chrome Ring Sculpture
    const logoGroup = new THREE.Group();
    logoGroup.position.set(0, 4.6, -10.8);
    const outerArcs = [0xea4335, 0xfbbc05, 0x34a853];
    for (let s = 0; s < 3; s++) {
      const arcMat = new THREE.MeshStandardMaterial({
        color: outerArcs[s],
        emissive: outerArcs[s],
        emissiveIntensity: 0.45,
        roughness: 0.28
      });
      const arcMesh = new THREE.Mesh(
        new THREE.TorusGeometry(2.55, 0.52, 12, 24, (Math.PI * 2) / 3 - 0.08),
        arcMat
      );
      arcMesh.rotation.z = (s * Math.PI * 2) / 3;
      logoGroup.add(arcMesh);
    }
    const whiteRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.48, 0.22, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    const blueCore = new THREE.Mesh(
      new THREE.SphereGeometry(1.22, 18, 18),
      new THREE.MeshStandardMaterial({ color: 0x4285f4, emissive: 0x4285f4, emissiveIntensity: 0.55, roughness: 0.25 })
    );
    logoGroup.add(whiteRing, blueCore);
    this.chromeLogoGroup = logoGroup;
    this.group.add(logoGroup);

    // 2. Iconic 3D Voxel Chrome Offline T-Rex Dino + Desert Cacti
    const dino = new THREE.Group();
    dino.position.set(-18.5, 0, -9.8);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.9), dinoMat);
    head.position.set(0.45, 2.75, 0);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.45, 0.85), dinoMat);
    torso.position.set(0, 1.55, 0);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.65, 0.65), dinoMat);
    tail.position.set(-0.95, 1.65, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 0.45), dinoMat);
    arm.position.set(0.82, 1.85, 0);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.85, 0.38), dinoMat);
    legL.position.set(-0.28, 0.42, 0.18);
    const legR = legL.clone();
    legR.position.set(0.32, 0.42, -0.18);
    dino.add(head, torso, tail, arm, legL, legR);
    this.group.add(dino);

    for (const cx of [-11.5, 13.5, 20.5]) {
      const cactus = new THREE.Group();
      cactus.position.set(cx, 0, -9.8);
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.48, 2.3, 0.48), cactusMat);
      stem.position.y = 1.15;
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.36, 0.36), cactusMat);
      armL.position.set(-0.5, 1.35, 0);
      const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.75, 0.36), cactusMat);
      tipL.position.set(-0.78, 1.72, 0);
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.36, 0.36), cactusMat);
      armR.position.set(0.5, 1.1, 0);
      const tipR = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.75, 0.36), cactusMat);
      tipR.position.set(0.78, 1.48, 0);
      cactus.add(stem, armL, tipL, armR, tipR);
      this.group.add(cactus);
    }

    // 3. Four Google-Colored Browser Tab Pillars
    const tabXs = [-25.5, -8.5, 8.5, 25.5];
    for (let i = 0; i < 4; i++) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(2.0, 5.8, 1.6), slateMat);
      col.position.set(tabXs[i], 2.9, -11.8);
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(2.15, 0.42, 1.75),
        new THREE.MeshStandardMaterial({ color: googleHex[i], emissive: googleHex[i], emissiveIntensity: 0.65 })
      );
      cap.position.set(tabXs[i], 6.0, -11.8);
      this.group.add(col, cap);
    }
  }

  buildSpotifyPlayerArena() {
    const matteDark = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.5, metalness: 0.3 });
    const greenGlow = new THREE.MeshStandardMaterial({
      color: 0x1db954,
      emissive: 0x1db954,
      emissiveIntensity: 0.78,
      roughness: 0.25
    });
    const peakGlow = new THREE.MeshStandardMaterial({
      color: 0x86efac,
      emissive: 0x4ade80,
      emissiveIntensity: 0.85,
      roughness: 0.2
    });

    // 1. Live Animated 12-Bar 3D Audio Spectrum Equalizer Wall
    this.spotifyEqualizerBars = [];
    for (let i = 0; i < 12; i++) {
      const bx = -22 + i * 4.0;
      const barRoot = new THREE.Group();
      barRoot.position.set(bx, 0.1, -11.6);
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.4, 1.5), matteDark);
      pedestal.position.y = 0.2;
      const barMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.2), greenGlow);
      barMesh.position.y = 0.9;
      const capMesh = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.28, 1.3), peakGlow);
      capMesh.position.y = 1.65;
      barRoot.add(pedestal, barMesh, capMesh);
      this.group.add(barRoot);
      this.spotifyEqualizerBars.push({ barMesh, capMesh, index: i });
    }

    // 2. Center Spinning 3D Vinyl Turntable Plinth
    const deck = new THREE.Group();
    deck.position.set(0, 0, -8.6);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.65, 5.2), matteDark);
    plinth.position.y = 0.32;
    const vinylGroup = new THREE.Group();
    vinylGroup.position.set(0, 0.74, 0);
    const vinylDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(2.25, 2.25, 0.14, 28),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.22, metalness: 0.6 })
    );
    const vinylLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.17, 20), greenGlow);
    const grooveMarker = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.19, 1.9), peakGlow);
    grooveMarker.position.z = 0.95;
    vinylGroup.add(vinylDisc, vinylLabel, grooveMarker);
    deck.add(plinth, vinylGroup);
    this.spotifyVinylDisc = vinylGroup;
    this.group.add(deck);
  }

  buildSlidesPresentationArena() {
    const whiteCardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.08 });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbc04,
      emissive: 0xd97706,
      emissiveIntensity: 0.38,
      roughness: 0.3
    });
    const handleBlueMat = new THREE.MeshStandardMaterial({
      color: 0x4285f4,
      emissive: 0x4285f4,
      emissiveIntensity: 0.55
    });

    // 1. Left 3D Presentation Slide Easel with Free-Transform Handles (□)
    const easel = new THREE.Group();
    easel.position.set(-15.5, 0, -10.8);
    const board = new THREE.Mesh(new THREE.BoxGeometry(10.5, 6.2, 0.65), whiteCardMat);
    board.position.y = 3.8;
    board.castShadow = true;
    const header = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.85, 0.72), goldMat);
    header.position.y = 6.5;
    easel.add(board, header);

    for (const [hx, hy] of [[-5.25, 0.7], [5.25, 0.7], [-5.25, 6.9], [5.25, 6.9]]) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.85), handleBlueMat);
      handle.position.set(hx, hy, 0);
      easel.add(handle);
    }
    this.group.add(easel);

    // 2. Right 3D Live Rising 4-Color Google Bar-Chart Monument
    const chartPlinth = new THREE.Group();
    chartPlinth.position.set(14.5, 0, -10.8);
    const base = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.6, 2.4), whiteCardMat);
    base.position.y = 0.3;
    chartPlinth.add(base);

    const chartColors = [0x4285f4, 0xea4335, 0xfbbc04, 0x34a853];
    const baseHeights = [3.6, 5.2, 4.4, 6.4];
    this.slidesChartBars = [];
    for (let i = 0; i < 4; i++) {
      const colMat = new THREE.MeshStandardMaterial({
        color: chartColors[i],
        emissive: chartColors[i],
        emissiveIntensity: 0.28,
        roughness: 0.32
      });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.0, 1.6), colMat);
      const bx = -4.2 + i * 2.8;
      bar.scale.y = baseHeights[i];
      bar.position.set(bx, 0.6 + baseHeights[i] * 0.5, 0);
      bar.castShadow = true;
      chartPlinth.add(bar);
      this.slidesChartBars.push({ bar, baseH: baseHeights[i], index: i });
    }
    this.group.add(chartPlinth);
  }

  buildBiomeColumns(theme, accentHex) {
    if (theme === 'rocket_corp') {
      this.buildRocketCorpFacility();
      return;
    }
    if (theme === 'ancient_city') {
      this.buildAncientCityRuins();
      return;
    }
    if (theme === 'pale_garden') {
      this.buildPaleGardenGrove();
      return;
    }
    if (theme === 'dark_core') {
      this.buildAvA8ShowdownLake();
      return;
    }
    if (theme === 'youtube') {
      this.buildYouTubeStudioArena();
      return;
    }
    if (theme === 'chrome') {
      this.buildChromeBrowserArena();
      return;
    }
    if (theme === 'spotify') {
      this.buildSpotifyPlayerArena();
      return;
    }
    if (theme === 'slides') {
      this.buildSlidesPresentationArena();
      return;
    }

    const texKey = theme === 'minecraft' || theme === 'the_end' ? 'obsidian'
      : (theme === 'command_realm' || theme === 'trophy' ? 'gold_block'
      : (theme === 'lucky_orb' ? 'lucky_block'
      : (theme === 'aether' ? 'holystone'
      : (theme === 'creeper_clan' ? 'creeper_moss' : getThemeFloorTextureKey(theme)))));
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
      const h = theme === 'the_end' ? (5.5 + (i % 3) * 1.8) : (3.2 + (i % 3) * 1.4);
      const w = theme === 'the_end' ? 2.2 : 1.6;
      const col = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), blockMat);
      col.position.set(cx, h / 2, -12.0);
      col.castShadow = true;
      col.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.35, w + 0.2), capMat);
      cap.position.set(cx, h + 0.18, -12.0);
      this.group.add(col, cap);

      if (theme === 'the_end') {
        // Floating End Crystal atop each Obsidian Pillar
        const crystalGroup = new THREE.Group();
        crystalGroup.position.set(cx, h + 1.25, -12.0);
        const crystalCore = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.62, 0),
          new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xd946ef, emissiveIntensity: 0.9 })
        );
        const glassCage = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(1.1, 1.1, 1.1)),
          new THREE.LineBasicMaterial({ color: 0xf5d0fe })
        );
        crystalGroup.add(crystalCore, glassCage);
        this.group.add(crystalGroup);
        this.floatingProps.push(crystalGroup);
      } else if (theme === 'aether' && i % 2 === 0) {
        // Golden Oak Tree Crown atop Aether Sky Pillars
        const crown = new THREE.Mesh(
          new THREE.BoxGeometry(2.8, 2.2, 2.8),
          new THREE.MeshStandardMaterial({ map: getVoxelTexture('gold_block', 2, 2), roughness: 0.5 })
        );
        crown.position.set(cx, h + 1.3, -12.0);
        this.group.add(crown);
      }
    });

    if (theme === 'the_end') {
      // Center End Portal Fountain & Dragon Egg Monument
      const fountain = new THREE.Group();
      fountain.position.set(0, 0, -6.8);
      const bedrockMat = new THREE.MeshStandardMaterial({ map: getVoxelTexture('anvil_iron', 2, 2), roughness: 0.8 });
      const portalMat = new THREE.MeshBasicMaterial({ map: getVoxelTexture('end_portal', 2, 2) });
      const rim = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.65, 4.4), bedrockMat);
      rim.position.y = 0.32;
      const pool = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.72, 3.4), portalMat);
      pool.position.y = 0.34;
      const centerPost = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.4, 1.1), bedrockMat);
      centerPost.position.y = 1.2;
      const dragonEgg = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.58, 1),
        new THREE.MeshStandardMaterial({ color: 0x1a0b2e, emissive: 0x9333ea, emissiveIntensity: 0.5, roughness: 0.3 })
      );
      dragonEgg.scale.set(0.85, 1.25, 0.85);
      dragonEgg.position.y = 2.85;
      fountain.add(rim, pool, centerPost, dragonEgg);
      this.group.add(fountain);
    } else if (theme === 'aether') {
      // Glowing Glowstone + Water Aether Portal in Back Center
      const aetherPortal = new THREE.Group();
      aetherPortal.position.set(0, 0, -9.2);
      const glowMat = new THREE.MeshStandardMaterial({
        map: getVoxelTexture('gold_block', 2, 3),
        emissive: 0xfacc15,
        emissiveIntensity: 0.55
      });
      const waterMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
      const pL = new THREE.Mesh(new THREE.BoxGeometry(0.85, 4.4, 0.85), glowMat);
      pL.position.set(-1.5, 2.2, 0);
      const pR = pL.clone();
      pR.position.x = 1.5;
      const pTop = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.85, 0.85), glowMat);
      pTop.position.set(0, 4.4, 0);
      const pWater = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.8), waterMat);
      pWater.position.set(0, 2.2, 0);
      aetherPortal.add(pL, pR, pTop, pWater);
      this.group.add(aetherPortal);
    }
  }

  createRocketCorpEmblem3D(scale = 1) {
    const emblem = new THREE.Group();
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.2 });
    const orangeGlow = new THREE.MeshStandardMaterial({ color: 0xff6b00, emissive: 0xff6b00, emissiveIntensity: 0.75 });
    const cyanGlow = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.65 });

    // Circular backing disc & glowing ring
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.24, 24), darkSteel);
    disc.rotation.x = Math.PI / 2;
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.14, 10, 28), orangeGlow);
    outerRing.position.z = 0.08;
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.06, 8, 24), cyanGlow);
    innerRing.position.z = 0.1;

    // Sculpted 3D Rocket / Cursor Arrow (Rocket Corp Logo)
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.35, 12), whiteMat);
    fuselage.position.set(0, 0.05, 0.2);
    const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.75, 12), orangeGlow);
    noseCone.position.set(0, 1.05, 0.2);
    const windowPorthole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.15, 12), cyanGlow);
    windowPorthole.rotation.x = Math.PI / 2;
    windowPorthole.position.set(0, 0.22, 0.48);

    // Swept Delta Fins
    const finGeo = new THREE.BoxGeometry(0.48, 0.65, 0.14);
    const finL = new THREE.Mesh(finGeo, whiteMat);
    finL.position.set(-0.48, -0.35, 0.18);
    finL.rotation.z = 0.42;
    const finR = new THREE.Mesh(finGeo, whiteMat);
    finR.position.set(0.48, -0.35, 0.18);
    finR.rotation.z = -0.42;

    // Exhaust Thruster Flame
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.65, 10), orangeGlow);
    flame.rotation.z = Math.PI;
    flame.position.set(0, -0.92, 0.2);

    // "ROCKET CORP" Plaque below emblem
    const plaqueTex = makeTextSignTexture('ROCKET CORP', 'CONTAINMENT DIV.', '#0f172a', '#ff6b00', '#f8fafc');
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 1.05),
      new THREE.MeshBasicMaterial({ map: plaqueTex })
    );
    plaque.position.set(0, -2.45, 0.15);

    emblem.add(disc, outerRing, innerRing, fuselage, noseCone, windowPorthole, finL, finR, flame, plaque);
    emblem.scale.setScalar(scale);
    return emblem;
  }

  createRocketCorpHoverBike3D(facing = 1) {
    const bike = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.45, roughness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff6b00, emissive: 0xff6b00, emissiveIntensity: 0.65 });
    const cyanMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.85 });

    // Main hover chassis
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.48, 0.85), hullMat);
    body.position.y = 0.75;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.0, 4), hullMat);
    nose.rotation.z = -Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    nose.position.set(1.65, 0.78, 0);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.88), orangeMat);
    stripe.position.y = 0.82;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.25, 0.65), darkMat);
    seat.position.set(-0.35, 1.08, 0);
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.45, 0.72),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 })
    );
    windshield.position.set(0.85, 1.15, 0);
    windshield.rotation.z = 0.45;
    const handlebars = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.15, 8), darkMat);
    handlebars.rotation.x = Math.PI / 2;
    handlebars.position.set(0.55, 1.22, 0);

    // Dual underside hover-pads
    const padGeo = new THREE.CylinderGeometry(0.48, 0.52, 0.16, 14);
    const padFront = new THREE.Mesh(padGeo, cyanMat);
    padFront.position.set(0.95, 0.38, 0);
    const padRear = new THREE.Mesh(padGeo, cyanMat);
    padRear.position.set(-0.95, 0.38, 0);
    const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.45, 10), orangeMat);
    thruster.rotation.z = Math.PI / 2;
    thruster.position.set(-1.45, 0.75, 0);

    bike.add(body, nose, stripe, seat, windshield, handlebars, padFront, padRear, thruster);
    bike.rotation.y = facing >= 0 ? 0.35 : Math.PI - 0.35;
    return bike;
  }

  makeRocketCorpFloorMedallionTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Transparent floor decal with industrial stencil frame
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(8, 8, 496, 240);
    ctx.strokeStyle = '#ff6b00';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, 488, 232);

    // Yellow hazard corner stripes
    ctx.fillStyle = '#facc15';
    ctx.fillRect(18, 18, 48, 8);
    ctx.fillRect(18, 18, 8, 48);
    ctx.fillRect(446, 18, 48, 8);
    ctx.fillRect(486, 18, 8, 48);
    ctx.fillRect(18, 230, 48, 8);
    ctx.fillRect(18, 190, 8, 48);
    ctx.fillRect(446, 230, 48, 8);
    ctx.fillRect(486, 190, 8, 48);

    // Center Rocket Corp Emblem Circle
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(256, 108, 64, 0, Math.PI * 2);
    ctx.stroke();

    // Upward Rocket Silhouette inside circle
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(256, 52);
    ctx.lineTo(276, 92);
    ctx.lineTo(272, 136);
    ctx.lineTo(292, 154);
    ctx.lineTo(268, 148);
    ctx.lineTo(256, 162);
    ctx.lineTo(244, 148);
    ctx.lineTo(220, 154);
    ctx.lineTo(240, 136);
    ctx.lineTo(236, 92);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ff6b00';
    ctx.beginPath();
    ctx.arc(256, 98, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ROCKET CORP // THE BOX', 256, 202);
    ctx.fillStyle = '#ff6b00';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('SECTOR 01 · ANOMALY CONTAINMENT & TESTING FLOOR', 256, 226);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  buildRocketCorpFacility() {
    const wallMat = new THREE.MeshStandardMaterial({
      map: getVoxelTexture('rocket_corp_wall', 6, 4),
      roughness: 0.5,
      metalness: 0.35
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.75,
      roughness: 0.28
    });
    const hazardMat = new THREE.MeshStandardMaterial({
      map: getVoxelTexture('rocket_corp_hazard', 8, 1),
      roughness: 0.4
    });
    const orangeGlow = new THREE.MeshStandardMaterial({
      color: 0xff6b00,
      emissive: 0xff6b00,
      emissiveIntensity: 0.75
    });
    const cyanGlow = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.75
    });

    // 1. Giant Painted Rocket Corp Floor Medallion in Center of Arena
    const medallionMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(18.5, 9.2),
      new THREE.MeshBasicMaterial({
        map: this.makeRocketCorpFloorMedallionTexture(),
        transparent: true,
        depthWrite: false
      })
    );
    medallionMesh.rotation.x = -Math.PI / 2;
    medallionMesh.position.set(0, 0.03, 0.4);
    this.group.add(medallionMesh);

    // 2. Gridded "The Box" Facility Back Wall Wings & Angled Side Bulkheads
    const leftBackWall = new THREE.Mesh(new THREE.BoxGeometry(19, 12.5, 1.2), wallMat);
    leftBackWall.position.set(-21.2, 6.25, -12.6);
    const rightBackWall = leftBackWall.clone();
    rightBackWall.position.set(21.2, 6.25, -12.6);
    const leftBaseboard = new THREE.Mesh(new THREE.BoxGeometry(19.2, 0.65, 1.35), hazardMat);
    leftBaseboard.position.set(-21.2, 0.32, -12.6);
    const rightBaseboard = leftBaseboard.clone();
    rightBaseboard.position.set(21.2, 0.32, -12.6);
    this.group.add(leftBackWall, rightBackWall, leftBaseboard, rightBaseboard);

    // Side Containment Bulkhead Walls framing Left & Right edges of "The Box"
    const sideWallGeo = new THREE.BoxGeometry(1.2, 9.5, 16);
    const sideWallL = new THREE.Mesh(sideWallGeo, wallMat);
    sideWallL.position.set(-30.2, 4.75, -4.5);
    const sideWallR = new THREE.Mesh(sideWallGeo, wallMat);
    sideWallR.position.set(30.2, 4.75, -4.5);
    this.group.add(sideWallL, sideWallR);

    // 3. Heavy Steel I-Beam Facility Columns & Overhead Gantry Truss with Security Cameras
    const pillarXs = [-27.5, -17.5, -8.5, 8.5, 17.5, 27.5];
    pillarXs.forEach((px, idx) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(1.35, 12.8, 1.45), steelMat);
      col.position.set(px, 6.4, -12.0);
      col.castShadow = true;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 11.2, 1.52), idx % 2 === 0 ? orangeGlow : cyanGlow);
      strip.position.set(px, 6.2, -12.0);
      this.group.add(col, strip);

      // Ceiling-mounted Rocket Corp Security Camera / Suppression Turret
      const camGroup = new THREE.Group();
      camGroup.position.set(px, 11.6, -10.9);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 1.15), steelMat);
      housing.rotation.x = 0.42;
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.25, 10),
        new THREE.MeshBasicMaterial({ color: 0xff1744 })
      );
      lens.rotation.x = Math.PI / 2 + 0.42;
      lens.position.set(0, -0.18, 0.55);
      camGroup.add(housing, lens);
      this.group.add(camGroup);
    });

    const overheadGantry = new THREE.Mesh(new THREE.BoxGeometry(61, 0.95, 1.6), steelMat);
    overheadGantry.position.set(0, 12.6, -11.8);
    this.group.add(overheadGantry);

    // 4. Two Giant 3D Sculpted Rocket Corp Logos on Left & Right Facility Wings
    const logoLeft = this.createRocketCorpEmblem3D(1.35);
    logoLeft.position.set(-22.5, 7.6, -11.85);
    const logoRight = this.createRocketCorpEmblem3D(1.35);
    logoRight.position.set(22.5, 7.6, -11.85);
    this.group.add(logoLeft, logoRight);

    // 5. "The Box" Center Hard-Light Containment Chamber + Suppression Clamps
    const boxChamber = new THREE.Group();
    boxChamber.position.set(0, 0, -8.5);
    const base = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.5, 3.8), steelMat);
    base.position.y = 0.25;
    const baseHazard = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.22, 3.9), hazardMat);
    baseHazard.position.y = 0.52;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.55, 3.8), steelMat);
    roof.position.y = 4.35;
    const glassMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.7, 3.2), glassMat);
    glass.position.y = 2.4;
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(5.86, 3.76, 3.26)),
      new THREE.LineBasicMaterial({ color: 0xff6b00 })
    );
    wire.position.y = 2.4;

    // Restraint Clamp Rings inside "The Box" (used on The Chosen One in AvA Season 3)
    const clampRingL = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 8, 16), orangeGlow);
    clampRingL.position.set(-1.1, 2.2, 0);
    const clampRingR = clampRingL.clone();
    clampRingR.position.set(1.1, 2.2, 0);

    const boxSignTex = makeTextSignTexture('THE BOX // CELL 01', 'MAX SUPPRESSION ACTIVE', '#0f172a', '#ff6b00', '#38bdf8');
    const boxSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 1.05),
      new THREE.MeshBasicMaterial({ map: boxSignTex })
    );
    boxSign.position.set(0, 5.2, 1.6);

    boxChamber.add(base, baseHazard, roof, glass, wire, clampRingL, clampRingR, boxSign);
    this.group.add(boxChamber);

    // 6. Two Cylindrical Cyan Glass Stasis Tubes (Left: Gray Rocket Corp Clone, Right: Memory Scanner Rig)
    [-12.6, 12.6].forEach((tx, idx) => {
      const tubeGroup = new THREE.Group();
      tubeGroup.position.set(tx, 0, -9.6);
      const podBase = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.45, 0.55, 18), steelMat);
      podBase.position.y = 0.28;
      const podCap = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.35, 0.55, 18), steelMat);
      podCap.position.y = 4.15;
      const podRing = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.09, 8, 20), idx === 0 ? cyanGlow : orangeGlow);
      podRing.rotation.x = Math.PI / 2;
      podRing.position.y = 0.58;
      const cylGlass = new THREE.Mesh(
        new THREE.CylinderGeometry(1.18, 1.18, 3.4, 18),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.26 })
      );
      cylGlass.position.y = 2.25;
      tubeGroup.add(podBase, podCap, podRing, cylGlass);

      if (idx === 0) {
        // Rocket Corp Gray Clone Worker inside Left Stasis Tube
        const cloneWorker = new StickRig3D({ color: '#94a3b8', scale: 0.78 });
        cloneWorker.root.position.y = 0.65;
        tubeGroup.add(cloneWorker.root);
      } else {
        // Memory Scanner Helmet Rig inside Right Stasis Tube
        const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.56, 0.55, 12), steelMat);
        helmet.position.y = 2.55;
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.2, 0.65), cyanGlow);
        visor.position.y = 2.45;
        tubeGroup.add(helmet, visor);
      }
      this.group.add(tubeGroup);
    });

    // 7. Wanted Posters & Target Displays on Facility Pillars
    const wantedLeftTex = makeTextSignTexture('WANTED: CHOSEN ONE', 'BOUNTY // MAX PRIORITY', '#1e293b', '#ff6b00', '#facc15');
    const wantedLeft = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.25),
      new THREE.MeshBasicMaterial({ map: wantedLeftTex })
    );
    wantedLeft.position.set(-17.5, 4.2, -11.15);

    const wantedRightTex = makeTextSignTexture('TARGET: ORANGE', 'ANOMALY // PENCIL USER', '#1e293b', '#38bdf8', '#ffffff');
    const wantedRight = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.25),
      new THREE.MeshBasicMaterial({ map: wantedRightTex })
    );
    wantedRight.position.set(17.5, 4.2, -11.15);
    this.group.add(wantedLeft, wantedRight);

    // 8. Two Rocket Corp Hover-Bikes parked on Left & Right Deck (from AvA Season 3 "Wanted")
    const bikeLeft = this.createRocketCorpHoverBike3D(1);
    bikeLeft.position.set(-22.5, 0, -8.6);
    const bikeRight = this.createRocketCorpHoverBike3D(-1);
    bikeRight.position.set(22.5, 0, -8.6);
    this.group.add(bikeLeft, bikeRight);
  }

  buildPortal(x3d, z3d, isExit, label) {
    const group = new THREE.Group();
    group.position.set(x3d, 0, z3d);

    const isRocketCorp = this.stageManager?.theme === 'rocket_corp';
    const isAncientCity = this.stageManager?.theme === 'ancient_city';
    const isPaleGarden = this.stageManager?.theme === 'pale_garden';
    const frameMat = new THREE.MeshStandardMaterial({
      map: getVoxelTexture(
        isRocketCorp
          ? 'rocket_corp_wall'
          : (isAncientCity ? 'reinforced_deepslate' : (isPaleGarden ? 'pale_oak_log' : 'obsidian')),
        1,
        2
      ),
      roughness: 0.35,
      metalness: isRocketCorp ? 0.65 : 0.3
    });

    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.6, 0.7), frameMat);
    pillarL.position.set(-1.25, 1.8, 0);
    pillarL.castShadow = true;
    const pillarR = pillarL.clone();
    pillarR.position.set(1.25, 1.8, 0);
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.7, 0.8),
      isRocketCorp
        ? new THREE.MeshStandardMaterial({ map: getVoxelTexture('rocket_corp_hazard', 4, 1), roughness: 0.4 })
        : frameMat
    );
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

    const signTex = makeTextSignTexture(
      label,
      isRocketCorp
        ? 'ROCKET CORP'
        : (isAncientCity ? 'DEEP DARK' : (isPaleGarden ? 'PALE GARDEN' : (isExit ? 'PORTAL' : 'SPAWN'))),
      '#0f172a',
      isRocketCorp
        ? '#ff6b00'
        : (isAncientCity ? '#22d3ee' : (isPaleGarden ? '#fb923c' : (isExit ? '#10b981' : '#38bdf8')))
    );
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
    const h = (p.height || 60) * WORLD_TO_3D;
    const d = (p.depth3d || 170) * WORLD_TO_3D;

    const group = new THREE.Group();
    const texKey = theme === 'command_realm' ? 'gold_block'
      : (theme === 'minecraft' ? 'obsidian'
      : (theme === 'the_end' ? 'purpur_block'
      : (theme === 'aether' ? 'holystone'
      : (theme === 'ancient_city' ? 'deepslate_tiles'
      : (theme === 'pale_garden' ? 'pale_oak_log'
      : (theme === 'youtube' ? 'youtube_floor'
      : (theme === 'chrome' ? 'chrome_floor'
      : (theme === 'spotify' ? 'spotify_floor'
      : (theme === 'slides' ? 'slides_floor'
      : (theme === 'rocket_corp' ? 'rocket_corp_wall'
      : (theme === 'lucky_orb' ? 'lucky_block'
      : (theme === 'trophy' ? 'trophy_floor' : 'anvil_iron'))))))))))));

    const bodyMat = new THREE.MeshStandardMaterial({
      map: getVoxelTexture(texKey, Math.max(2, Math.round(w / 2)), 2),
      roughness: 0.45,
      metalness: 0.25
    });

    // Flush Platform Top Alignment (F1):
    // Highest vertex of platform mesh is at exactly +h / 2 = (p.height * WORLD_TO_3D) / 2.
    // Entity resting at to3DY(p.y - p.height) makes crisp, flush contact with zero sinking and zero hover gap.
    const barH = Math.min(0.18, h * 0.35);
    const slabH = Math.max(0.01, h - barH);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, slabH, d), bodyMat);
    slab.position.y = -barH / 2;
    slab.castShadow = true;
    slab.receiveShadow = true;
    group.add(slab);

    const isAppTheme = theme === 'youtube' || theme === 'chrome' || theme === 'spotify' || theme === 'slides';
    const accentHex = p.accent
      ? new THREE.Color(p.accent).getHex()
      : (isMoving && !isAppTheme ? 0x38bdf8 : this.getThemeAccentColor(theme));

    const headerMat = theme === 'rocket_corp' && !isMoving
      ? new THREE.MeshStandardMaterial({
          map: getVoxelTexture('rocket_corp_hazard', Math.max(4, Math.round(w)), 1),
          roughness: 0.35
        })
      : new THREE.MeshStandardMaterial({
          color: accentHex,
          emissive: accentHex,
          emissiveIntensity: 0.38
        });
    const headerBar = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.04, barH, d + 0.04),
      headerMat
    );
    headerBar.position.y = slabH / 2;
    headerBar.castShadow = true;
    headerBar.receiveShadow = true;
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
    if (label.includes('DRAGON') || label.includes('END')) {
      const rig = new EnderDragonRig3D();
      rig.root.scale.setScalar(0.32);
      rig.flightGroup.position.y = 1.65;
      return rig.root;
    }
    if (label.includes('WARDEN')) {
      const rig = new WardenBossRig3D();
      rig.root.scale.setScalar(0.38);
      return rig.root;
    }
    if (label.includes('CREAKING') || label.includes('CREEKING')) {
      const rig = new CreakingBossRig3D();
      rig.root.scale.setScalar(0.42);
      return rig.root;
    }
    if (label.includes('MERCENAR') || label.includes('ROCKET')) {
      const rig = new StickRig3D({ color: '#1e293b', scale: 0.68, zombieType: 'mercenary_agent', weaponType: 'toolbar_staff' });
      return rig.root;
    }
    if (label.includes('KING')) {
      const rig = new StickRig3D({ color: '#ff8a00', scale: 0.68, hasCrown: true, weaponType: 'staff' });
      return rig.root;
    }
    const rig = new StickRig3D({ color: '#67e8f9', scale: 0.68, isHollowHead: true, zombieType: 'h4c3r' });
    return rig.root;
  }

  drawAncientCityCavernBackdrop(ctx, w, h, sm) {
    // 1. Abyssal Deep Dark Cavern Sky & Sculk Mist
    const grad = typeof ctx.createLinearGradient === 'function' ? ctx.createLinearGradient(0, 0, 0, h) : null;
    if (grad && typeof grad.addColorStop === 'function') {
      grad.addColorStop(0, '#02070c');
      grad.addColorStop(0.6, '#051520');
      grad.addColorStop(1, '#082433');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#04121c';
    }
    ctx.fillRect(0, 0, w, h);

    // 2. Jagged Deepslate Cavern Stalactites along ceiling
    ctx.fillStyle = '#0e1722';
    for (let sx = 0; sx < w; sx += 58) {
      const dropH = 42 + ((sx * 37) % 75);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx + 29, dropH);
      ctx.lineTo(sx + 58, 0);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Bioluminescent Sculk Stars & Veins across Cavern Wall
    const starCols = ['#06b6d4', '#22d3ee', '#67e8f9', '#0e7490'];
    for (let i = 0; i < 68; i++) {
      ctx.fillStyle = starCols[i % starCols.length];
      const px = (i * 157 + 23) % (w - 20) + 10;
      const py = 55 + ((i * 97 + 19) % (h - 140));
      ctx.fillRect(px, py, i % 3 === 0 ? 4 : 2, i % 3 === 0 ? 4 : 2);
    }

    // 4. Distant Ruined Deepslate City Silhouettes & Soul Fire Beacons
    const towers = [90, 220, 760, 890];
    towers.forEach((tx, idx) => {
      const tw = 68;
      const th = idx % 2 === 0 ? 195 : 155;
      ctx.fillStyle = '#111824';
      ctx.fillRect(tx, h - 68 - th, tw, th);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.strokeRect(tx + 14, h - 68 - th + 24, tw - 28, 36);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
      ctx.fillRect(tx + 16, h - 68 - th + 26, tw - 32, 32);
    });

    // 5. Center Deep Dark Vibration & Warden Heartbeat Telemetry Header
    ctx.textAlign = 'center';
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('ACT VI // MINECRAFT DEEP DARK — ANCIENT CITY SANCTUM', w / 2, 74);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px monospace';
    ctx.fillText(
      sm.isObjectiveComplete ? '✓ THE WARDEN SILENCED — PORTAL OPEN' : '⚠ SCULK SHRIEKER TRIGGERED: THE WARDEN',
      w / 2,
      122
    );

    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('VIBRATION RESONANCE: CRITICAL  •  BEWARE SONIC BOOM & SEISMIC SLAM', w / 2, 162);

    // 6. Reinforced Deepslate Footer Bar
    ctx.fillStyle = '#07131d';
    ctx.fillRect(0, h - 62, w, 62);
    ctx.fillStyle = '#d6d3c4';
    ctx.fillRect(0, h - 62, w, 5);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('🔊 DEEP DARK // Y = -51  •  SCULK CATALYST ACTIVE', 32, h - 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#22d3ee';
    ctx.fillText(sm.isObjectiveComplete ? 'HEARTBEAT: SILENT' : 'HEARTBEAT: 180 BPM', w - 32, h - 22);
  }

  drawPaleGardenBackdrop(ctx, w, h, sm) {
    // 1. Haunted Monochrome Grey-Ash Forest Mist Gradient
    const grad = typeof ctx.createLinearGradient === 'function' ? ctx.createLinearGradient(0, 0, 0, h) : null;
    if (grad && typeof grad.addColorStop === 'function') {
      grad.addColorStop(0, '#14171c');
      grad.addColorStop(0.55, '#1f242c');
      grad.addColorStop(1, '#2a303a');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#1d2229';
    }
    ctx.fillRect(0, 0, w, h);

    // 2. Pale Hanging Moss Curtains draping from canopy ceiling
    ctx.fillStyle = '#8b949b';
    for (let mx = 18; mx < w; mx += 44) {
      const mossLen = 58 + ((mx * 31) % 95);
      ctx.fillRect(mx, 0, 8, mossLen);
      ctx.fillStyle = '#b4bcc2';
      ctx.fillRect(mx + 2, 0, 3, Math.max(18, mossLen - 22));
      ctx.fillStyle = '#8b949b';
    }

    // 3. Silhouette Pale Oak Trunks in the Fog
    const trunks = [74, 198, 336, 684, 816, 932];
    trunks.forEach((tx, idx) => {
      const tw = idx % 2 === 0 ? 48 : 38;
      ctx.fillStyle = '#363b42';
      ctx.fillRect(tx, 34, tw, h - 96);
      ctx.fillStyle = '#535962';
      ctx.fillRect(tx + 8, 34, 8, h - 96);
      // Glowing Resin Heart scars on inner trunks
      if (idx === 2 || idx === 3) {
        ctx.fillStyle = '#f97316';
        ctx.fillRect(tx + 14, 195, 16, 26);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(tx + 18, 202, 8, 12);
      }
    });

    // 4. Glowing Orange Open Eyeblossoms & Unblinking Eyes in the Undergrowth
    for (let i = 0; i < 28; i++) {
      const ex = 36 + ((i * 139) % (w - 72));
      const ey = h - 135 + ((i * 47) % 58);
      ctx.fillStyle = i % 2 === 0 ? '#f97316' : '#fb923c';
      ctx.fillRect(ex, ey, 6, 6);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(ex + 2, ey + 2, 2, 2);
    }

    // 5. Pale Garden Header & Gaze-Freeze Telemetry
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('ACT VI // MINECRAFT PALE GARDEN — CREAKING HEART GROVE', w / 2, 74);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px monospace';
    ctx.fillText(
      sm.isObjectiveComplete ? '✓ CREAKING HEART SHATTERED — PORTAL OPEN' : '⚠ DON\'T BLINK — THE CREAKING STALKS WHEN UNSEEN',
      w / 2,
      122
    );

    ctx.fillStyle = '#fb923c';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('GAZE-FREEZE ACTIVE: FACE IT TO LOCK  •  WATCH FOR ROOT SNARE & RESIN SURGE', w / 2, 162);

    // 6. Pale Moss & Resin Footer Bar
    ctx.fillStyle = '#16191f';
    ctx.fillRect(0, h - 62, w, 62);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(0, h - 62, w, 5);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('🪵 PALE GARDEN // EYEBLOSSOMS OPEN  •  RESIN HEART ACTIVE', 32, h - 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fb923c';
    ctx.fillText(sm.isObjectiveComplete ? 'HEART TETHER: SEVERED' : 'HEART TETHER: LINKED', w - 32, h - 22);
  }

  drawAvA8LakeBackdrop(ctx, w, h, sm) {
    // 1. Outernet Daylight-to-Mist Sky Gradient
    const grad = typeof ctx.createLinearGradient === 'function' ? ctx.createLinearGradient(0, 0, 0, h) : null;
    if (grad && typeof grad.addColorStop === 'function') {
      grad.addColorStop(0, '#082f49');
      grad.addColorStop(0.45, '#0284c7');
      grad.addColorStop(0.76, '#7dd3fc');
      grad.addColorStop(1, '#0369a1');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#0284c7';
    }
    ctx.fillRect(0, 0, w, h);

    // 2. Crimson ViraBot Launch Spire piercing the Outernet clouds on the right
    ctx.fillStyle = 'rgba(255, 23, 68, 0.25)';
    ctx.fillRect(w * 0.7 - 36, 0, 72, h);
    ctx.fillStyle = 'rgba(255, 59, 92, 0.52)';
    ctx.fillRect(w * 0.7 - 10, 0, 20, h);

    // 3. Distant Outernet Canyon Peaks & Waterfall Cove Silhouette
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(0, h - 120);
    ctx.lineTo(0, h - 320);
    ctx.lineTo(w * 0.34, h - 340);
    ctx.lineTo(w * 0.44, h - 120);
    ctx.moveTo(w * 0.56, h - 120);
    ctx.lineTo(w * 0.64, h - 310);
    ctx.lineTo(w, h - 330);
    ctx.lineTo(w, h - 120);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(0, h - 332, w * 0.34, 12);
    ctx.fillRect(w * 0.64, h - 320, w * 0.36, 12);

    // Distant Plunging Waterfall + Shimmering Lake Band
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(w * 0.28 - 22, h - 328, 44, 212);
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(0, h - 122, w, 64);

    // 4. Showdown Header
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('ACT II // OUTERNET COVE — THE SHOWDOWN LAKE (AVA 8)', w / 2, 70);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px monospace';
    ctx.fillText(
      sm.isObjectiveComplete ? '✓ THE DARK LORD DEFEATED — PORTAL OPEN' : '⚠ THE DARK LORD // VIRABOT LAUNCH DETECTED',
      w / 2,
      118
    );

    // 5. Lakeshore Status Footer
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, h - 58, w, 58);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, h - 58, w, 4);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#bae6fd';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('🌊 OUTERNET LAKE // WATERFALL CLIFF & WRECKED SHACK', 32, h - 21);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff4d6d';
    ctx.fillText(sm.isObjectiveComplete ? 'VIRABOTS: NEUTRALIZED' : 'VIRABOT CANISTERS: ARMED', w - 32, h - 21);
  }

  drawYouTubeMonitorBackdrop(ctx, w, h, sm) {
    // 1. Dark Mode YouTube Chrome
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, w, 58);

    // YouTube Red Logo Pill + Title + Search Bar
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(28, 13, 52, 32);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(48, 20);
    ctx.lineTo(48, 38);
    ctx.lineTo(66, 29);
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('YouTube Studio', 90, 37);

    ctx.fillStyle = '#121212';
    ctx.fillRect(320, 12, 420, 34);
    ctx.strokeStyle = '#303030';
    ctx.lineWidth = 2;
    ctx.strokeRect(320, 12, 420, 34);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px monospace';
    ctx.fillText('🔍 stickman vs zombies — live stream', 336, 35);

    // 2. Central 16:9 Video Frame + Up Next Sidebar
    ctx.fillStyle = '#050505';
    ctx.fillRect(28, 72, 668, 292);
    ctx.strokeStyle = '#272727';
    ctx.strokeRect(28, 72, 668, 292);

    // Red Progress Bar & Playhead
    ctx.fillStyle = '#3f3f3f';
    ctx.fillRect(42, 344, 640, 6);
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(42, 344, sm.isObjectiveComplete ? 640 : 410, 6);
    ctx.beginPath();
    ctx.arc(42 + (sm.isObjectiveComplete ? 640 : 410), 347, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff0033';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('● LIVE PREMIERE // 1080p60 HD', 362, 138);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px monospace';
    ctx.fillText(
      sm.isObjectiveComplete ? '✓ STREAM STABILIZED — PORTAL OPEN' : '▶ STICKMAN VS VIRAL UPLOAD HORDE',
      362,
      192
    );
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('WATCH OUT FOR SKIP-AD LASER & BUFFERING SCRUBBER!', 362, 236);

    // Up Next Sidebar Cards
    const cards = [
      { title: 'Animation vs. YouTube', views: '48M views', col: '#ff0033' },
      { title: 'Orange Combo Guide', views: '12M views', col: '#f97316' },
      { title: 'Next App: Chrome ➔', views: 'Autoplay ON', col: '#38bdf8' }
    ];
    cards.forEach((c, idx) => {
      const cy = 72 + idx * 98;
      ctx.fillStyle = '#1f1f1f';
      ctx.fillRect(714, cy, 282, 86);
      ctx.fillStyle = c.col;
      ctx.fillRect(722, cy + 10, 88, 66);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(c.title, 820, cy + 36);
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '13px monospace';
      ctx.fillText(c.views, 820, cy + 58);
    });

    // 3. Subscribe & Like Bar Footer
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, h - 60, w, 60);
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(28, h - 46, 178, 34);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('🔔 SUBSCRIBED 10M', 117, h - 23);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('👍 998K  •  AUTOPLAY: CHROME.EXE', w - 28, h - 23);
  }

  drawChromeMonitorBackdrop(ctx, w, h, sm) {
    // 1. Chrome Tab Strip + Omnibox Toolbar
    ctx.fillStyle = '#202124';
    ctx.fillRect(0, 0, w, 46);
    const tabs = [
      { label: '🔵 New Tab', col: '#4285f4', active: true },
      { label: '🔴 YouTube', col: '#ea4335', active: false },
      { label: '🟡 Extensions', col: '#fbbc05', active: false },
      { label: '🟢 Downloads', col: '#34a853', active: false }
    ];
    tabs.forEach((t, idx) => {
      const tx = 18 + idx * 212;
      ctx.fillStyle = t.active ? '#35363a' : '#292a2d';
      ctx.fillRect(tx, 8, 202, 38);
      ctx.fillStyle = t.col;
      ctx.fillRect(tx, 8, 202, 4);
      ctx.fillStyle = '#e8eaed';
      ctx.textAlign = 'left';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(t.label, tx + 14, 33);
    });

    ctx.fillStyle = '#35363a';
    ctx.fillRect(0, 46, w, 48);
    ctx.fillStyle = '#202124';
    ctx.fillRect(126, 54, w - 210, 32);
    ctx.fillStyle = '#9aa0a6';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('←  →  ↻', 24, 77);
    ctx.fillStyle = '#8ab4f8';
    ctx.font = '16px monospace';
    ctx.fillText('🔒 https://chrome.google.com/stick-vs-zombies/arena', 144, 76);

    // 2. Browser Viewport + 4-Color Google Emblem + Offline Dino Horizon
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 94, w, h - 144);

    const gColors = ['#4285f4', '#ea4335', '#fbbc05', '#34a853'];
    gColors.forEach((col, i) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(w / 2, 178, 44, (i * Math.PI) / 2, ((i + 1) * Math.PI) / 2);
      ctx.stroke();
    });
    ctx.fillStyle = '#4285f4';
    ctx.beginPath();
    ctx.arc(w / 2, 178, 19, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#202124';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(
      sm.isObjectiveComplete ? '✓ ALL ROGUE TABS CLOSED — PORTAL OPEN' : '🌐 GOOGLE CHROME // MULTI-TAB SANDBOX',
      w / 2,
      264
    );
    ctx.fillStyle = '#5f6368';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('ERR_ZOMBIE_OVERFLOW  •  DINO RUNNER ACTIVE  •  RIDE THE DOWNLOAD BAR', w / 2, 298);

    // Pixel Desert Ground Line + T-Rex Silhouette
    ctx.fillStyle = '#535353';
    ctx.fillRect(60, h - 78, w - 120, 3);
    ctx.fillRect(140, h - 110, 22, 32);
    ctx.fillRect(148, h - 122, 24, 16);
    ctx.fillRect(830, h - 106, 12, 28);
    ctx.fillRect(862, h - 114, 14, 36);

    // 3. Chrome Downloads Shelf Footer
    ctx.fillStyle = '#202124';
    ctx.fillRect(0, h - 50, w, 50);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8ab4f8';
    ctx.font = 'bold 17px monospace';
    ctx.fillText('⬇ spotify_setup.exe — Complete', 28, h - 19);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#34a853';
    ctx.fillText('SANDBOX: PROTECTED', w - 28, h - 19);
  }

  drawSpotifyMonitorBackdrop(ctx, w, h, sm) {
    // 1. Matte Black & Electric Green Spotify Desktop App
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, w, h);

    // Left Library Sidebar
    ctx.fillStyle = '#090909';
    ctx.fillRect(0, 0, 236, h - 68);
    ctx.fillStyle = '#1db954';
    ctx.beginPath();
    ctx.arc(42, 38, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Spotify', 70, 46);

    const playlists = ['🏠 Home', '🔍 Search', '📚 Your Library', '🔥 Stickman Beats', '⚡ Boss Fight Mix', '🎧 AvM Lo-Fi'];
    playlists.forEach((pl, idx) => {
      ctx.fillStyle = idx === 3 ? '#1db954' : '#b3b3b3';
      ctx.font = idx === 3 ? 'bold 16px sans-serif' : '15px sans-serif';
      ctx.fillText(pl, 24, 96 + idx * 38);
    });

    // 2. Main Playlist Header + 20-Bar Green Spectrum Equalizer
    const grad = typeof ctx.createLinearGradient === 'function' ? ctx.createLinearGradient(236, 0, 236, 220) : null;
    if (grad && typeof grad.addColorStop === 'function') {
      grad.addColorStop(0, '#1db954');
      grad.addColorStop(1, '#121212');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#15803d';
    }
    ctx.fillRect(236, 0, w - 236, 178);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('VERIFIED PLAYLIST • 27 TRACKS', 268, 46);
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(
      sm.isObjectiveComplete ? '✓ TRACK CLEARED — PORTAL OPEN' : '🎧 STICKMAN BASS DROP MIX',
      268,
      94
    );
    ctx.fillStyle = '#dcfce7';
    ctx.font = 'bold 17px monospace';
    ctx.fillText('RIDE THE GREEN EQUALIZER LIFTS  •  DROP THE BEAT ON ZOMBIES', 268, 132);

    // Spectrum Visualizer Bars
    for (let i = 0; i < 20; i++) {
      const bx = 268 + i * 36;
      const bh = 36 + ((i * 43 + 19) % 130);
      ctx.fillStyle = i % 3 === 0 ? '#4ade80' : '#1db954';
      ctx.fillRect(bx, h - 84 - bh, 24, bh);
    }

    // 3. Bottom Now-Playing Transport Bar
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, h - 68, w, 68);
    ctx.fillStyle = '#1db954';
    ctx.fillRect(0, h - 68, w, 3);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('♫ Orange Stickman — Bassline Brawl (140 BPM)', 28, h - 34);
    ctx.fillStyle = '#1db954';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('⏮   ⏸   ⏭   🔀   🔁', 28, h - 12);
    ctx.textAlign = 'right';
    ctx.fillText('🔊 100%  •  NEXT: GOOGLE SLIDES', w - 28, h - 24);
  }

  drawSlidesMonitorBackdrop(ctx, w, h, sm) {
    // 1. Google Slides Gold Header & Workspace Toolbar
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fbbc04';
    ctx.fillRect(0, 0, w, 52);

    ctx.fillStyle = '#202124';
    ctx.textAlign = 'left';
    ctx.font = 'bold 23px sans-serif';
    ctx.fillText('📊 Stickman_vs_Zombies_Q4_Deck.slides', 24, 34);

    // Slideshow Button Pill
    ctx.fillStyle = '#202124';
    ctx.fillRect(w - 208, 10, 182, 32);
    ctx.fillStyle = '#fbbc04';
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('▶ SLIDESHOW', w - 117, 32);

    // Secondary Editor Ribbon
    ctx.fillStyle = '#edf2fa';
    ctx.fillRect(0, 52, w, 34);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#444746';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('File  Edit  View  Insert  Slide  Arrange  Tools   |   B  I  U  ⊞  🎨  Transition: Slide', 24, 74);

    // 2. Left Filmstrip Thumbnails
    ctx.fillStyle = '#e8eaed';
    ctx.fillRect(0, 86, 178, h - 86);
    for (let i = 0; i < 4; i++) {
      const ty = 100 + i * 82;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(26, ty, 132, 68);
      ctx.strokeStyle = i === 1 ? '#fbbc04' : '#bdc1c6';
      ctx.lineWidth = i === 1 ? 4 : 2;
      ctx.strokeRect(26, ty, 132, 68);
      ctx.fillStyle = '#3c4043';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`${i + 1}`, 10, ty + 38);
    }

    // 3. Central 16:9 Presentation Canvas with Selection Handles & 4-Color Chart
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(212, 104, 774, 314);
    ctx.strokeStyle = '#dadce0';
    ctx.lineWidth = 3;
    ctx.strokeRect(212, 104, 774, 314);

    // Blue Free-Transform Title Box
    ctx.strokeStyle = '#1a73e8';
    ctx.lineWidth = 2;
    ctx.strokeRect(244, 124, 710, 74);
    [244, 599, 954].forEach((hx) => {
      [124, 198].forEach((hy) => {
        ctx.fillStyle = '#1a73e8';
        ctx.fillRect(hx - 4, hy - 4, 8, 8);
      });
    });

    ctx.textAlign = 'left';
    ctx.fillStyle = '#202124';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(
      sm.isObjectiveComplete ? '✓ PRESENTATION COMPLETE — PORTAL OPEN' : 'SLIDE 02: HOW TO ERASE ZOMBIES',
      264,
      170
    );

    const bullets = [
      '• Grab the Giant Pink Eraser pickup!',
      '• Jump across Text Boxes & Chart Bars',
      '• Next Stop: Rocket Corp HQ ("The Box")'
    ];
    bullets.forEach((b, idx) => {
      ctx.fillStyle = '#3c4043';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(b, 256, 242 + idx * 42);
    });

    // 4-Color Bar Chart on Right Side of Slide
    const chartCols = ['#4285f4', '#ea4335', '#fbbc04', '#34a853'];
    const chartHeights = [88, 128, 104, 162];
    chartCols.forEach((col, idx) => {
      const bx = 742 + idx * 52;
      const bh = chartHeights[idx];
      ctx.fillStyle = col;
      ctx.fillRect(bx, 392 - bh, 36, bh);
    });
  }

  redrawMonitorScreen(force = false) {
    const sm = this.stageManager;
    const beat = sm.campaignBeat || {};
    const clearedThrough = sm.currentStage - (sm.isObjectiveComplete ? 0 : 1);
    const keyPieces = sm.isTrophyRoom ? 3 : (clearedThrough < 5 ? 0 : (clearedThrough < 10 ? 1 : (clearedThrough < 11 ? 2 : 3)));
    const stateKey = `${sm.theme}|${sm.currentStage}|${sm.stageName}|${sm.isObjectiveComplete}|${sm.isTrophyRoom}|${sm.whiteVoidProgress > 0.5}|${beat.act || ''}|${beat.mission || ''}|${beat.bossLabel || ''}|${beat.clue || ''}|${keyPieces}`;

    if (!force && this.lastMonitorStateKey === stateKey) return;
    this.lastMonitorStateKey = stateKey;
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
    } else if (sm.theme === 'rocket_corp') {
      this.drawRocketCorpControlRoom(ctx, w, h, sm);
    } else if (sm.theme === 'ancient_city') {
      this.drawAncientCityCavernBackdrop(ctx, w, h, sm);
    } else if (sm.theme === 'pale_garden') {
      this.drawPaleGardenBackdrop(ctx, w, h, sm);
    } else if (sm.theme === 'dark_core') {
      this.drawAvA8LakeBackdrop(ctx, w, h, sm);
    } else if (sm.theme === 'youtube') {
      this.drawYouTubeMonitorBackdrop(ctx, w, h, sm);
    } else if (sm.theme === 'chrome') {
      this.drawChromeMonitorBackdrop(ctx, w, h, sm);
    } else if (sm.theme === 'spotify') {
      this.drawSpotifyMonitorBackdrop(ctx, w, h, sm);
    } else if (sm.theme === 'slides') {
      this.drawSlidesMonitorBackdrop(ctx, w, h, sm);
    } else {
      ctx.fillStyle = sm.theme === 'bsod' ? '#003999'
        : (sm.theme === 'dark_core' ? '#1a0008'
        : (sm.theme === 'the_end' ? '#120624'
        : (sm.theme === 'aether' ? '#0c3b5e'
        : (sm.theme === 'minecraft' ? '#291218'
        : (sm.theme === 'trophy' ? '#051b3b' : '#0b192c')))));
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

  drawRocketCorpControlRoom(ctx, w, h, sm) {
    // 1. Control Room Interior Wall (Gridded "The Box" Slate Acoustic Panels)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // 2. Left Panel: Rocket Corp Corporate Identity & Security Alert
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(26, 22, 300, 325);
    ctx.strokeStyle = '#ff6b00';
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 22, 300, 325);

    // Rocket Corp Circle + Rocket Emblem
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(176, 108, 52, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(176, 62);
    ctx.lineTo(192, 95);
    ctx.lineTo(188, 132);
    ctx.lineTo(206, 146);
    ctx.lineTo(186, 142);
    ctx.lineTo(176, 154);
    ctx.lineTo(166, 142);
    ctx.lineTo(146, 146);
    ctx.lineTo(164, 132);
    ctx.lineTo(160, 95);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ff6b00';
    ctx.beginPath();
    ctx.arc(176, 98, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('ROCKET CORP', 176, 192);
    ctx.fillStyle = '#ff6b00';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('SECTOR 01 // THE BOX', 176, 214);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('▸ CEO: VICTIM [ONLINE]', 44, 250);
    ctx.fillText('▸ SQUAD: MERCENARIES', 44, 274);
    ctx.fillStyle = '#facc15';
    ctx.fillText('▸ AGENT  · BALLISTA', 44, 300);
    ctx.fillText('▸ PRIMAL · HAZARD', 44, 322);

    // 3. Center Observation Window: Victim (Gray Hollow-Head CEO in Suit & Tie) Watching!
    ctx.fillStyle = '#0b1322';
    ctx.fillRect(346, 22, 332, 325);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.strokeRect(346, 22, 332, 325);

    // Subtle cyan observation glass reflection
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.beginPath();
    ctx.moveTo(350, 26);
    ctx.lineTo(440, 26);
    ctx.lineTo(380, 342);
    ctx.lineTo(350, 342);
    ctx.closePath();
    ctx.fill();

    // Two Gray Rocket Corp Clone Technicians on left/right of Victim
    [412, 612].forEach((cx) => {
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, 178, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, 194);
      ctx.lineTo(cx, 268);
      ctx.moveTo(cx, 206);
      ctx.lineTo(cx - 22, 242);
      ctx.moveTo(cx, 206);
      ctx.lineTo(cx + 22, 242);
      ctx.stroke();
    });

    // Victim (Center — Gray Hollow-Head Stick Figure `#94a3b8` + White Collar + Red/Black Tie)
    const vx = 512;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(vx, 146, 24, 0, Math.PI * 2);
    ctx.stroke();
    // Victim's torso & clasped-behind-back executive stance
    ctx.beginPath();
    ctx.moveTo(vx, 170);
    ctx.lineTo(vx, 272);
    ctx.moveTo(vx, 182);
    ctx.lineTo(vx - 26, 228);
    ctx.lineTo(vx - 10, 252);
    ctx.moveTo(vx, 182);
    ctx.lineTo(vx + 26, 228);
    ctx.lineTo(vx + 10, 252);
    ctx.stroke();
    // Executive Tie
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(vx, 174);
    ctx.lineTo(vx + 6, 218);
    ctx.lineTo(vx, 228);
    ctx.lineTo(vx - 6, 218);
    ctx.closePath();
    ctx.fill();

    // Control Room Desk in front of Victim
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(350, 268, 324, 75);
    ctx.fillStyle = '#ff6b00';
    ctx.fillRect(350, 268, 324, 5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('OBSERVATION DECK // DIRECTOR: VICTIM', vx, 302);
    ctx.fillStyle = '#ffea00';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`STATUS: ${sm.isObjectiveComplete ? 'CONTAINMENT BREACHED!' : 'OBSERVING SUBJECTS'}`, vx, 326);

    // 4. Right Panel: "THE BOX" Live Parameter Sliders & Toolbar Controls
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(698, 22, 300, 325);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(698, 22, 300, 325);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 19px monospace';
    ctx.fillText('⚙ THE BOX // CONTROLS', 718, 54);

    const sliders = [
      { label: 'STRENGTH', pct: 0.85, col: '#ff6b00' },
      { label: 'SPEED   ', pct: 0.92, col: '#38bdf8' },
      { label: 'DEFENSE ', pct: 0.78, col: '#22c55e' },
      { label: 'SUPPRESS', pct: 0.68, col: '#facc15' }
    ];
    sliders.forEach((s, idx) => {
      const sy = 88 + idx * 44;
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(s.label, 718, sy);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(802, sy - 13, 168, 16);
      ctx.fillStyle = s.col;
      ctx.fillRect(802, sy - 13, Math.round(168 * s.pct), 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(802 + Math.round(168 * s.pct) - 5, sy - 16, 10, 22);
    });

    // Iconic AvA Toolbar Buttons (Pause, Slow-Mo, Box Seal, Memory Scanner)
    const tools = ['|| PAUSE', '⏪ 0.25x', '⛶ BOX', '🔍 MEM'];
    tools.forEach((t, idx) => {
      const bx = 716 + (idx % 2) * 136;
      const by = 258 + Math.floor(idx / 2) * 38;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(bx, by, 124, 30);
      ctx.strokeStyle = idx === 0 ? '#ff6b00' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, 124, 30);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(t, bx + 16, by + 20);
    });

    // 5. Bottom Facility Caution Footer Bar (No Windows Taskbar!)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, h - 68, w, 68);
    ctx.fillStyle = '#facc15';
    for (let sx = 0; sx < w; sx += 48) {
      ctx.fillRect(sx, h - 68, 24, 8);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ROCKET CORP HQ // CONTAINMENT CHAMBER 01 ("THE BOX")', 28, h - 24);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff6b00';
    ctx.fillText('SECURITY LEVEL: MAXIMUM', w - 28, h - 24);
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

    // Sync 3D Animated Lava Sea (Stage 7 Nether Core)
    if (this.lavaSeaMat && this.lavaSeaMesh) {
      const tex = this.lavaSeaMat.map;
      if (tex && tex.offset) {
        tex.offset.x = (tex.offset.x + dt * 0.05) % 1;
        tex.offset.y = (tex.offset.y + dt * 0.03) % 1;
      }
      const t = (sm && typeof sm.stageTime === 'number') ? sm.stageTime : (this._lavaTime = (this._lavaTime || 0) + dt);
      this.lavaSeaMat.emissiveIntensity = 0.8 + Math.sin(t * 3.0) * 0.15;
    }

    // Sync Floor Lava Hazard Pools
    for (const item of this.lavaHazardMeshes) {
      if (item.slabMat) {
        const tex = item.slabMat.map;
        if (tex && tex.offset) {
          tex.offset.x = (tex.offset.x + dt * 0.08) % 1;
        }
        const t = (sm && typeof sm.stageTime === 'number') ? sm.stageTime : (this._lavaTime || 0);
        item.slabMat.emissiveIntensity = 0.85 + Math.sin(t * 4.0) * 0.15;
      }
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

    // Pulse Ancient City Center Portal soul veil
    if (this.ancientCityCenterPortal?.veilMat) {
      const t = (sm && typeof sm.stageTime === 'number') ? sm.stageTime : (this._portalTime = (this._portalTime || 0) + dt);
      this.ancientCityCenterPortal.veilMat.opacity = 0.28 + Math.sin(t * 3.2) * 0.07;
    }

    // Pulse Pale Garden Creaking Heart Shrine & Resin Halo
    if (this.paleGardenHeartShrine) {
      const t = (sm && typeof sm.stageTime === 'number') ? sm.stageTime : (this._portalTime = (this._portalTime || 0) + dt);
      if (this.paleGardenHeartShrine.heartMat) {
        this.paleGardenHeartShrine.heartMat.emissiveIntensity = 0.75 + Math.sin(t * 4.2) * 0.25;
      }
      if (this.paleGardenHeartShrine.resinRing) {
        this.paleGardenHeartShrine.resinRing.rotation.z = t * 0.9;
      }
    }

    // Animate App Gauntlet 3D Props (YouTube, Chrome, Spotify, Slides)
    const appTime = (sm && typeof sm.stageTime === 'number') ? sm.stageTime : (this._portalTime = (this._portalTime || 0) + dt);
    if (this.youtubePlayMonument?.playPrism) {
      const pulse = 1 + Math.sin(appTime * 4.5) * 0.08;
      this.youtubePlayMonument.playPrism.scale.set(pulse, 1, pulse);
    }
    if (this.chromeLogoGroup) {
      this.chromeLogoGroup.rotation.z -= dt * 1.15;
    }
    if (this.spotifyVinylDisc) {
      this.spotifyVinylDisc.rotation.y += dt * 2.4;
    }
    if (this.spotifyEqualizerBars && this.spotifyEqualizerBars.length > 0) {
      for (let i = 0; i < this.spotifyEqualizerBars.length; i++) {
        const entry = this.spotifyEqualizerBars[i];
        const wave = 0.5 + 0.5 * Math.sin(appTime * 7.5 + entry.index * 0.72) * Math.cos(appTime * 3.1 + entry.index * 0.35);
        const h = 1.1 + wave * 5.2;
        entry.barMesh.scale.y = h;
        entry.barMesh.position.y = 0.4 + h * 0.5;
        entry.capMesh.position.y = 0.58 + h;
      }
    }
    if (this.slidesChartBars && this.slidesChartBars.length > 0) {
      for (let i = 0; i < this.slidesChartBars.length; i++) {
        const entry = this.slidesChartBars[i];
        const dynH = Math.max(1.2, entry.baseH + Math.sin(appTime * 2.8 + entry.index * 1.1) * 0.45);
        entry.bar.scale.y = dynH;
        entry.bar.position.y = 0.6 + dynH * 0.5;
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
