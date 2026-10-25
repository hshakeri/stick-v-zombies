// =============================================================================
// Stick vs Zombies (3D Voxel Edition) - 3D Physics Coordinator (physics3d.js)
// Accurate 3D Floor, Wall & Multi-Level Platform Physical Contact & CCD
// =============================================================================

export const WORLD_TO_3D = 1 / 34;
export const ARENA_HALF_X = 980;
export const ARENA_HALF_Z = 380;

export const PLAYER_CLAMP_X = 966;
export const PLAYER_CLAMP_Z = 360;
export const ENEMY_CLAMP_X = 960;
export const ENEMY_CLAMP_Z = 350;

export const CREATIVE_BLOCK_SIZE_2D = 68;
export const DEFAULT_PLATFORM_DEPTH_2D = 170;

export const ISLAND_FLOOR_BOUNDS = Object.freeze({
  halfX: ARENA_HALF_X,
  halfZ: ARENA_HALF_Z
});
export const VOID_FALL_THRESHOLD = 180;

/**
 * Returns true if the stage theme is an open floating island with no perimeter walls/rails.
 */
export function isFloatingIslandTheme(theme) {
  return theme === 'the_end' || theme === 'aether' || theme === 'cloud_cache' || theme === 'lucky_orb';
}

/**
 * Returns true if the stage theme has open edges (floating islands or Stage 7 Nether).
 */
export function isOpenEdgeTheme(theme) {
  return isFloatingIslandTheme(theme) || theme === 'minecraft';
}

/**
 * Returns true if the stage theme has a lava sea below the arena.
 */
export function isLavaSeaTheme(theme) {
  return theme === 'minecraft';
}

/**
 * Evaluates whether an entity's horizontal position is inside the floating island floor footprint.
 * @param {Object} entity
 * @returns {boolean}
 */
export function isEntityOverIsland(entity) {
  if (!entity || typeof entity !== 'object') return false;
  const x = entity.x || 0;
  const z = entity.z !== undefined ? entity.z : (entity.z3d || 0);
  return Math.abs(x) <= ISLAND_FLOOR_BOUNDS.halfX && Math.abs(z) <= ISLAND_FLOOR_BOUNDS.halfZ;
}

export function isPlayerEntity(entity) {
  return Boolean(
    entity && (
      entity.isPlayer ||
      entity.canDoubleJump !== undefined ||
      entity.inventory !== undefined ||
      entity.coyoteTimer !== undefined ||
      entity.superMeter !== undefined
    )
  );
}

export function isEnemyEntity(entity) {
  return Boolean(
    entity && (
      entity.isZombie ||
      entity.renderer?.isZombie ||
      entity.isBoss ||
      entity.isMercenary ||
      entity.type
    ) && !isPlayerEntity(entity)
  );
}

/**
 * Resolves void falling physics for an entity on a given stage theme.
 * Supports player void respawn and enemy void elimination.
 * @param {Object} entity
 * @param {string} theme
 * @param {number} dt
 * @returns {Object} { effectiveGroundY, fellIntoVoid, respawned, eliminated }
 */
export function updateVoidPhysics(entity, theme, dt = 0.016) {
  const isOpen = isOpenEdgeTheme(theme);
  const ez = entity.z !== undefined ? entity.z : (entity.z3d || 0);
  const isOffIsland = isOpen && (Math.abs(entity.x || 0) > ISLAND_FLOOR_BOUNDS.halfX || Math.abs(ez) > ISLAND_FLOOR_BOUNDS.halfZ);
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

  if (entity.y >= VOID_FALL_THRESHOLD) {
    if (isEnemyEntity(entity)) {
      if (entity.isFlying || entity.type === 'ender_dragon') {
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

/**
 * Returns exact 3D AABB for platforms and Creative blocks in 2D coordinate space.
 * @param {Object} platform - Static/moving platform or placed Creative block.
 * @returns {Object} { minX, maxX, minY, maxY, minZ, maxZ, topY, halfW, halfD, x, y, z, width, height, depth }
 */
export function getPlatformBoundingBox3D(platform) {
  if (!platform || typeof platform !== 'object') return null;
  const width = platform.width || 60;
  const height = platform.height || 60;
  const depth = platform.depth3d !== undefined
    ? platform.depth3d
    : (platform.texKey ? CREATIVE_BLOCK_SIZE_2D : DEFAULT_PLATFORM_DEPTH_2D);

  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const halfD = depth * 0.5;

  const x = platform.x || 0;
  const y = platform.y || 0;
  const z = platform.z3d !== undefined ? platform.z3d : (platform.z || 0);

  const topY = y - height;
  const bottomY = y;

  const minX = x - halfW;
  const maxX = x + halfW;
  const minY = topY;
  const maxY = bottomY;
  const minZ = z - halfD;
  const maxZ = z + halfD;

  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    topY,
    halfW,
    halfD,
    x,
    y,
    z,
    width,
    height,
    depth
  };
}

/**
 * Evaluates whether an entity's horizontal footprint overlaps a platform or Creative block.
 * Uses exact half-depths ((p.depth3d || 170) * 0.5 for platforms; 34 for Creative blocks).
 * Supports both signatures:
 *   isEntityInsidePlatformXZ(entityX, entityZ, radiusX, radiusZ, platform)
 *   isEntityInsidePlatformXZ(entity, platform)
 */
export function isEntityInsidePlatformXZ(entityX, entityZ, radiusX, radiusZ, platform) {
  let p = platform;
  let ex = entityX;
  let ez = entityZ;
  let rx = radiusX;
  let rz = radiusZ;

  if (typeof entityX === 'object' && entityX !== null) {
    p = entityZ;
    ex = entityX.x || 0;
    ez = entityX.z !== undefined ? entityX.z : (entityX.z3d || 0);
    rx = entityX.radius !== undefined ? entityX.radius : 14;
    rz = entityX.radiusZ !== undefined ? entityX.radiusZ : 0;
  }

  if (!p || typeof p !== 'object') return false;
  if (rx === undefined) rx = 14;
  if (rz === undefined) rz = 0;

  const halfW = (p.width || 60) * 0.5;
  const px = p.x || 0;
  const posX = typeof ex === 'number' ? ex : (ex || 0);
  if (posX + rx < px - halfW || posX - rx > px + halfW) {
    return false;
  }

  const depth = p.depth3d !== undefined
    ? p.depth3d
    : (p.texKey ? CREATIVE_BLOCK_SIZE_2D : DEFAULT_PLATFORM_DEPTH_2D);
  const halfD = depth * 0.5;
  const pz = p.z3d !== undefined ? p.z3d : (p.z || 0);
  const posZ = typeof ez === 'number' ? ez : (ez || 0);

  if (Math.abs(posZ - pz) > halfD + rz) {
    return false;
  }

  return true;
}

/**
 * Filters platforms to those matching Math.abs((entity.z || 0) - (p.z3d || 0)) <= (p.depth3d || 170) * 0.5 + 15.
 */
export function filterPlatformsForEntity(entity, allPlatforms, tolerance) {
  if (!allPlatforms || !Array.isArray(allPlatforms)) return [];
  const ez = entity?.z !== undefined ? entity.z : (entity?.z3d || 0);
  const tol = typeof tolerance === 'number'
    ? tolerance
    : (entity?.radiusZ !== undefined ? entity.radiusZ : 0);
  const out = [];
  for (let i = 0; i < allPlatforms.length; i++) {
    const p = allPlatforms[i];
    if (!p || typeof p !== 'object') continue;
    const pz = p.z3d !== undefined ? p.z3d : (p.z || 0);
    const depth = p.depth3d !== undefined
      ? p.depth3d
      : (p.texKey ? CREATIVE_BLOCK_SIZE_2D : DEFAULT_PLATFORM_DEPTH_2D);
    const halfD = depth * 0.5;
    if (Math.abs(ez - pz) <= halfD + tol) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Continuous Collision Detection (CCD) swept vertical landing:
 * Sweeps from prevY to entity.y. If prevY <= bTop + 6 && entity.y >= bTop while entity's
 * horizontal footprint overlaps the platform, cleanly snaps entity.y = bTop, entity.vy = 0,
 * and entity.isGrounded = true, preventing vertical tunneling.
 */
export function resolveSweptVerticalCollision(entity, platforms, prevY, dt = 0.016) {
  if (!entity || typeof entity !== 'object' || !platforms || !Array.isArray(platforms) || platforms.length === 0) return false;
  if (entity.vy < 0) return false; // Moving upward (jumping)
  if (entity.isCrouching) return false; // Crouching allows dropping through semi-solid platforms

  const startY = Number.isFinite(prevY) ? prevY : entity.y;
  const currentY = entity.y;

  let bestLandingTop = Infinity;
  let bestPlatform = null;

  const rx = entity.radius !== undefined ? entity.radius : 14;
  const rz = entity.radiusZ !== undefined ? entity.radiusZ : 0;
  const ez = entity.z !== undefined ? entity.z : (entity.z3d || 0);

  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (!p || typeof p !== 'object') continue;
    const bH = p.height || 60;
    const bTop = p.y - bH;

    // Swept crossing check: start was at or above top threshold, current is at or below top
    if (startY <= bTop + 6 && currentY >= bTop) {
      if (isEntityInsidePlatformXZ(entity.x, ez, rx, rz, p)) {
        // Pick highest surface in altitude (minimum Y in 2D screen space)
        if (bTop < bestLandingTop) {
          bestLandingTop = bTop;
          bestPlatform = p;
        }
      }
    }
  }

  if (bestPlatform !== null) {
    if (entity.diveKick) {
      entity.diveKick = false;
      entity.pose = 'idle';
      if (typeof entity.applyGroundSlamDamage === 'function') {
        entity.applyGroundSlamDamage(entity.currentZombies, 125, 42);
      }
    }
    entity.y = bestLandingTop;
    entity.vy = 0;
    entity.isGrounded = true;
    if (entity.canDoubleJump !== undefined) entity.canDoubleJump = true;
    if (entity.isWallSliding !== undefined) entity.isWallSliding = false;
    entity.standingPlatform = bestPlatform;
    entity.standingPlatformX = bestPlatform.x;
    entity.standingPlatformY = bestPlatform.y;
    return true;
  }

  return false;
}

/**
 * Checks if an entity currently marked as grounded on a standingPlatform has stepped beyond
 * its X or Z boundaries, dropping them cleanly into free fall.
 */
export function checkPlatformStepOff(entity) {
  if (!entity || typeof entity !== 'object' || !entity.standingPlatform || typeof entity.standingPlatform !== 'object') return false;
  const p = entity.standingPlatform;
  const ez = entity.z !== undefined ? entity.z : (entity.z3d || 0);
  const rx = entity.radius !== undefined ? entity.radius : 14;
  const rz = entity.radiusZ !== undefined ? entity.radiusZ : 0;
  if (!isEntityInsidePlatformXZ(entity.x, ez, rx, rz, p)) {
    entity.standingPlatform = null;
    entity.isGrounded = false;
    return true;
  }
  return false;
}

/**
 * On enclosed stages (!isOpenEdgeTheme(theme)), clamps entity positions inside visible 3D walls:
 *   - Player: |x| <= 966, |z| <= 360
 *   - Enemies: |x| <= 960, |z| <= 350
 * Prevents walking through perimeter walls at X = +-980.
 * On open edge stages (floating islands / Nether), allows free passage past edges into the void.
 */
export function clampEnclosedWalls(entity, isEnclosedStage = true) {
  if (!entity || typeof entity !== 'object') return;

  let enclosed = isEnclosedStage;
  if (typeof isEnclosedStage === 'string') {
    enclosed = !isOpenEdgeTheme(isEnclosedStage);
  }
  if (!enclosed) return;

  const isEnemy = isEnemyEntity(entity);

  const maxX = isEnemy ? ENEMY_CLAMP_X : PLAYER_CLAMP_X;
  const maxZ = isEnemy ? ENEMY_CLAMP_Z : PLAYER_CLAMP_Z;

  if (entity.x < -maxX) {
    entity.x = -maxX;
    if (entity.vx && entity.vx < 0) entity.vx = 0;
  } else if (entity.x > maxX) {
    entity.x = maxX;
    if (entity.vx && entity.vx > 0) entity.vx = 0;
  }

  if (entity.z !== undefined) {
    if (entity.z < -maxZ) {
      entity.z = -maxZ;
      if (entity.vz && entity.vz < 0) entity.vz = 0;
    } else if (entity.z > maxZ) {
      entity.z = maxZ;
      if (entity.vz && entity.vz > 0) entity.vz = 0;
    }
  }
}

/**
 * Evaluates 3D bounding box overlap and applies contact burn damage & recoil
 * to a player or enemy entity according to the Lava Hazard Contract.
 * @param {Object} entity - Player or zombie entity.
 * @param {Object} hazard - Floor lava hazard slab or placed creative lava block.
 * @param {number} dt - Frame delta time in seconds.
 * @returns {boolean} True if burn damage and recoil were applied on this tick.
 */
export function checkLavaHazard(entity, hazard, dt = 0.016) {
  if (!entity || typeof entity !== 'object' || !hazard || typeof hazard !== 'object') {
    return false;
  }
  const hz = hazard.z !== undefined ? hazard.z : (hazard.z3d || 0);
  const halfW = (hazard.width || (hazard.texKey ? 68 : 160)) * 0.5;
  const halfD = (hazard.depth3d || (hazard.texKey ? 68 : 220)) * 0.5;
  const minX = hazard.x - halfW;
  const maxX = hazard.x + halfW;
  const minZ = hz - halfD;
  const maxZ = hz + halfD;
  const ez = entity.z !== undefined ? entity.z : (entity.z3d || 0);

  const overlapsX = entity.x >= minX && entity.x <= maxX;
  const overlapsZ = ez >= minZ && ez <= maxZ;
  const topY = hazard.height ? (hazard.y || 0) - hazard.height : (hazard.y || 0);
  const overlapsY = Math.abs(entity.y - (hazard.y || 0)) <= 30 || Math.abs(entity.y - topY) <= 30;

  if (!overlapsX || !overlapsZ || !overlapsY) {
    if (entity.lavaTickCooldown > 0) {
      entity.lavaTickCooldown = Math.max(0, entity.lavaTickCooldown - dt);
    }
    if (entity.lavaBurnCooldown > 0) {
      entity.lavaBurnCooldown = Math.max(0, entity.lavaBurnCooldown - dt);
    }
    return false;
  }

  if (entity.isGodMode) return false;
  if (entity.isRolling) return false;
  if ((entity.iFrames || 0) > 0) return false;
  if (entity.lavaTickCooldown > 0) {
    entity.lavaTickCooldown = Math.max(0, entity.lavaTickCooldown - dt);
    if (entity.lavaBurnCooldown > 0) {
      entity.lavaBurnCooldown = Math.max(0, entity.lavaBurnCooldown - dt);
    }
    return false;
  }
  if (entity.lavaBurnCooldown > 0) {
    entity.lavaBurnCooldown = Math.max(0, entity.lavaBurnCooldown - dt);
    return false;
  }

  const dmg = hazard.damage !== undefined ? hazard.damage : 20;
  entity.hp = Math.max(0, (entity.hp !== undefined ? entity.hp : 100) - dmg);
  entity.isGrounded = false;
  entity.standingPlatform = null;

  const isEnemy = isEnemyEntity(entity);

  if (isEnemy) {
    entity.vy = -260;
    entity.lavaTickCooldown = 0.45;
    entity.lavaBurnCooldown = 0.45;
  } else {
    entity.vy = -340;
    entity.iFrames = 30;
  }
  return true;
}
