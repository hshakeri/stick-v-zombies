import * as THREE from '../lib/three.module.min.js';
import { getVoxelTexture, getThemeFloorTextureKey } from './textures3d.js?v=10.3';
import {
  StickRig3D,
  CreeperLordRig3D,
  GiantCatRig3D,
  LuckyOrbRig3D,
  EnderDragonRig3D
} from './models3d.js?v=10.3';

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

    if (stageManager) this.stageManager = stageManager;
    const sm = stageManager || this.stageManager;
    const theme = themeOverride || sm?.theme || 'desktop';
    const floorKey = getThemeFloorTextureKey(theme, false);

    // Hide PC monitor stand neck when inside Rocket Corp Facility so backdrop is the Observation Window
    if (this.standNeck) {
      this.standNeck.visible = theme !== 'rocket_corp';
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

    // Sub-floor voxel cliff layers (Minecraft island / Facility foundation)
    const subTexKey = theme === 'minecraft' || theme === 'dark_core' || theme === 'the_end'
      ? 'obsidian'
      : (theme === 'aether' ? 'holystone' : (theme === 'rocket_corp' ? 'rocket_corp_wall' : 'anvil_iron'));
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
      dark_core: 0xff0033,
      command_realm: 0xffb340,
      browser_glitch: 0x38bdf8,
      cloud_cache: 0x7dd3fc,
      root_gateway: 0x22c55e,
      creeper_clan: 0xa3e635,
      lucky_orb: 0xfacc15,
      the_end: 0xd946ef,
      aether: 0x38d9a9,
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

  buildBiomeColumns(theme, accentHex) {
    if (theme === 'rocket_corp') {
      this.buildRocketCorpFacility();
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
    const frameMat = new THREE.MeshStandardMaterial({
      map: getVoxelTexture(isRocketCorp ? 'rocket_corp_wall' : 'obsidian', 1, 2),
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
      isRocketCorp ? 'ROCKET CORP' : (isExit ? 'PORTAL' : 'SPAWN'),
      '#0f172a',
      isRocketCorp ? '#ff6b00' : (isExit ? '#10b981' : '#38bdf8')
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
      : (theme === 'rocket_corp' ? 'rocket_corp_wall'
      : (theme === 'lucky_orb' ? 'lucky_block'
      : (theme === 'trophy' ? 'trophy_floor' : 'anvil_iron'))))));

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

    const headerMat = theme === 'rocket_corp' && !isMoving
      ? new THREE.MeshStandardMaterial({
          map: getVoxelTexture('rocket_corp_hazard', Math.max(4, Math.round(w)), 1),
          roughness: 0.35
        })
      : new THREE.MeshStandardMaterial({
          color: isMoving ? 0x38bdf8 : this.getThemeAccentColor(theme),
          emissive: isMoving ? 0x38bdf8 : this.getThemeAccentColor(theme),
          emissiveIntensity: 0.35
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
