// ============================================================================
// Stick vs Zombies — Purple Ally (Smooth Elytra Swoop + King Orange Greeting)
// & Old Updates Playable Archive Catalog (Zero Three.js — Shared by 2D & 3D!)
// ============================================================================

import { StickFigureRenderer } from '../../js/entities/stickman.js?v=9.8';
import { particles } from '../../js/engine/particles.js?v=9.8';
import { audio } from '../../js/engine/audio.js?v=9.8';
import { SPEECH_CORPUS } from '../../js/engine/speech.js?v=9.8';

const ALLY_ARENA_BOUND = 1030;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clampAllyX = (x) => clamp(x, -ALLY_ARENA_BOUND, ALLY_ARENA_BOUND);

export const PURPLE_ALLY_CONFIG = Object.freeze({
  id: 'purple',
  color: '#9333ea',
  accentColor: '#c084fc',
  elytraLight: '#cbd5e1',
  elytraMid: '#94a3b8',
  elytraDark: '#475569',
  cooldown: 13,
  effectRadius: 380,
  damage: 135,
  bossDamage: 110,
  knockback: 680,
  swoopDuration: 0.68,
  strikeDuration: 0.38,
  landedDuration: 0.56,
  landedWithKingDuration: 1.05,
  takeoffDuration: 0.66
});

export const PURPLE_QUIPS = Object.freeze({
  battle: Object.freeze([
    'ELYTRA INCOMING!',
    'SKY SUPPORT!',
    'SWOOPING IN!',
    'CLEAR THE RUNWAY!'
  ]),
  kingHi: Object.freeze([
    'HI, KING!',
    'HI! GOOD TO SEE YOU!'
  ]),
  kingReply: Object.freeze([
    'HI, PURPLE!',
    'GLAD YOU FLEW IN!'
  ]),
  hurt: Object.freeze([
    'WING CLIPPED!',
    'PULLING UP!'
  ])
});

export const OLD_UPDATES_ARCHIVE = Object.freeze([
  {
    id: 'v1',
    version: 'v1.0',
    badge: 'ORIGINAL RELEASE',
    date: 'Aug 23, 2026',
    commit: 'b6ea855',
    title: 'Original 10-Stage Desktop Adventure',
    summary: 'Go back to the original 10-stage release! Fight through the classic dark desktop up to The Dark Lord with the original 5 allies and 80s retro speech bubbles.',
    highlights: ['10 Classic Stages', 'The Dark Lord Finale', 'Original 5 Allies', 'Classic Dark Desktop'],
    path: 'legacy/v1/index.html',
    accent: '#ff7700'
  },
  {
    id: 'v2',
    version: 'v2.0',
    badge: 'BOSS EXPANSION',
    date: 'Aug 23, 2026',
    commit: 'ed7fd0c',
    title: 'King Orange, H4C3R & Vector Hook',
    summary: 'The first big campaign expansion! Added King Orange & H4C3R boss fights, tactical ally combat, and the Vector Hook pull move.',
    highlights: ['King Orange & H4C3R', 'Vector Hook (H)', 'Tactical Ally Combat', 'Original 14 Stages'],
    path: 'legacy/v2/index.html',
    accent: '#f59e0b'
  },
  {
    id: 'v3',
    version: 'v3.0',
    badge: 'HAND-DRAWN CLASSIC',
    date: 'Sep 5, 2026',
    commit: '713bcc4',
    title: '18-Stage Restore Key & Trophy Room',
    summary: 'The classic pure-2D Restore Key edition before 3D Voxel or Creative Sandbox: Alan-era blue PC desktop, Lucky Orb, Creeper Clan, TCO, King Orange & 7-Boss Trophy Room.',
    highlights: ['18 Restore Key Stages', 'Alan-Era Blue Desktop', 'TCO + King Orange', '7-Boss Trophy Room'],
    path: 'legacy/v3/index.html',
    accent: '#38bdf8'
  },
  {
    id: 'v4-3d',
    version: 'v4.0',
    badge: 'FIRST 3D RELEASE',
    date: 'Oct 22, 2026',
    commit: '796a395',
    title: 'Original 3D Voxel Edition Launch',
    summary: 'Revisit the very first 3D Voxel launch with natural FK 3D stick figures and the original 18 stages — before Creative Sandbox, The End, Warden, Creaking, or App Gauntlet.',
    highlights: ['First 3D Voxel Engine', '18 Classic 3D Stages', '3 Camera Modes', 'Pre-Sandbox Era'],
    path: 'legacy/v4-3d/index.html',
    accent: '#22c55e'
  }
]);

export function resolveLegacyUpdateUrl(entryPath, options = {}) {
  const from = options.from === '3d' ? '3d' : '2d';
  const prefix = options.isSubdir ? '../' : '';
  return `${prefix}${entryPath}?from=${from}`;
}

// Smooth cubic Bezier point + analytical derivative for silky-smooth Elytra trajectory
export function sampleCubicBezier(p0, p1, p2, p3, u) {
  const t = clamp(u, 0, 1);
  const inv = 1 - t;
  const inv2 = inv * inv;
  const t2 = t * t;
  const x = inv2 * inv * p0.x + 3 * inv2 * t * p1.x + 3 * inv * t2 * p2.x + t2 * t * p3.x;
  const y = inv2 * inv * p0.y + 3 * inv2 * t * p1.y + 3 * inv * t2 * p2.y + t2 * t * p3.y;
  const dx = 3 * inv2 * (p1.x - p0.x) + 6 * inv * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x);
  const dy = 3 * inv2 * (p1.y - p0.y) + 6 * inv * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y);
  return { x, y, dx, dy };
}

export function isKingOrangeWithPlayer(alliesManager) {
  if (!alliesManager) return false;
  if (alliesManager.unlocked?.king === true) return true;
  return Boolean(
    alliesManager.activeAllies?.some(
      (a) => a && a.type === 'king' && !a.isDead && !a.retreating
    )
  );
}

function findActiveKingAlly(alliesManager) {
  if (!alliesManager?.activeAllies) return null;
  return alliesManager.activeAllies.find(
    (a) => a && a.type === 'king' && !a.isDead && !a.retreating
  ) || null;
}

function emitPurpleSpeech(text, speakerType, x, y, anchor, speech2d, speech3d, options = {}) {
  const duration = options.duration ?? 1.65;
  const priority = options.priority ?? 4;
  const mood = options.mood ?? '★';
  const style = options.style ?? 'comic';

  if (speech3d && typeof speech3d.spawnSpeechBubble === 'function') {
    const key = speakerType === 'ally-king' ? 'king' : (speakerType === 'ally-purple' ? 'purple' : speakerType);
    const badge = key === 'purple' ? '🟣 PURPLE' : (key === 'king' ? '👑 KING ORANGE' : undefined);
    speech3d.spawnSpeechBubble(key, text, {
      x,
      y: y - 48,
      z: anchor?.z || 0,
      duration,
      style,
      badge,
      priority,
      mood,
      anchor,
      bypassCooldown: true
    });
    return;
  }

  if (speech2d && typeof speech2d.spawnBubble === 'function') {
    speech2d.spawnBubble(x, y, text, speakerType, duration, {
      anchor,
      priority,
      mood,
      style,
      cooldownMs: 0,
      bypassCooldown: true,
      speakerKey: options.speakerKey || `${speakerType}:${Date.now()}`
    });
  }
}

export function installPurpleStickmanPoses() {
  if (StickFigureRenderer.prototype._purplePosesInstalled) return;
  StickFigureRenderer.prototype._purplePosesInstalled = true;

  const origCompute = StickFigureRenderer.prototype.computePoseBones;
  StickFigureRenderer.prototype.computePoseBones = function computeExpandedPoseBones(pose, timer, isGrounded, isHurt) {
    if (pose !== 'elytra_glide' && pose !== 'wave') {
      return origCompute.call(this, pose, timer, isGrounded, isHurt);
    }
    const bones = origCompute.call(this, 'idle', timer, isGrounded, isHurt);
    if (isHurt) return bones;

    if (pose === 'elytra_glide') {
      const flutter = Math.sin((timer || 0) * 18) * 2.2;
      // Sleek horizontal Elytra glide silhouette facing +X
      bones.head.x = 24;
      bones.head.y = -34;
      bones.neck.x = 10;
      bones.neck.y = -29;
      bones.shoulder.x = 10;
      bones.shoulder.y = -29;
      bones.hip.x = -14;
      bones.hip.y = -23;

      // Arms swept aerodynamically back alongside the torso
      bones.elbowL.x = -5;
      bones.elbowL.y = -31 + flutter * 0.4;
      bones.handL.x = -21;
      bones.handL.y = -28 + flutter * 0.5;
      bones.elbowR.x = -3;
      bones.elbowR.y = -22 - flutter * 0.4;
      bones.handR.x = -19;
      bones.handR.y = -19 - flutter * 0.5;

      // Legs trailing behind in glide stream
      bones.kneeL.x = -29;
      bones.kneeL.y = -21 + flutter * 0.7;
      bones.footL.x = -44;
      bones.footL.y = -18 + flutter;
      bones.kneeR.x = -27;
      bones.kneeR.y = -26 - flutter * 0.7;
      bones.footR.x = -42;
      bones.footR.y = -23 - flutter;
      return bones;
    }

    if (pose === 'wave') {
      const bob = Math.sin((timer || 0) * 4.5) * 1.5;
      const waveSwing = Math.sin((timer || 0) * 15) * 9;
      bones.head.y = -62 + bob;
      bones.neck.y = -45 + bob * 0.8;
      // Relaxed left arm
      bones.elbowL.x = -12;
      bones.elbowL.y = -32 + bob;
      bones.handL.x = -10;
      bones.handL.y = -18 + bob;
      // Raised friendly waving right arm
      bones.elbowR.x = 15;
      bones.elbowR.y = -46 + bob;
      bones.handR.x = 18 + waveSwing;
      bones.handR.y = -66 + bob - Math.abs(waveSwing) * 0.2;
      return bones;
    }

    return bones;
  };
}

export function drawPurpleElytraWings2D(ctx, ally, isBackWing = false) {
  const spread = clamp(Number.isFinite(ally.wingSpread) ? ally.wingSpread : 0.2, 0.12, 1.05);
  const t = ally.timer || 0;
  const flutter = spread > 0.4 ? Math.sin(t * 22 + (isBackWing ? 0.6 : 0)) * (3.5 * spread) : 0;
  const isGliding = ally.pose === 'elytra_glide';

  // Shoulder mount point in Purple's local space
  const mountX = isGliding ? 8 : -2;
  const mountY = isGliding ? -30 : -43;

  ctx.save();
  ctx.translate(mountX, mountY);

  if (isGliding) {
    // Swept aerodynamic Minecraft Elytra wings spread wide behind shoulders
    const wingLen = 28 + spread * 34;
    const wingLift = (isBackWing ? -18 : -11) - spread * (isBackWing ? 18 : 11) + flutter;
    const tipY = wingLift + (isBackWing ? -4 : 6);

    ctx.fillStyle = isBackWing ? 'rgba(100, 116, 139, 0.82)' : 'rgba(203, 213, 225, 0.94)';
    ctx.strokeStyle = isBackWing ? '#4c1d95' : '#7c3aed';
    ctx.lineWidth = isBackWing ? 2.2 : 2.6;

    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.quadraticCurveTo(-wingLen * 0.42, wingLift * 0.85, -wingLen, tipY);
    // Scalloped Minecraft Elytra notch at trailing edge
    ctx.lineTo(-wingLen * 0.82, tipY + 11);
    ctx.lineTo(-wingLen * 0.64, tipY + 8);
    ctx.lineTo(-wingLen * 0.46, tipY + 16);
    ctx.quadraticCurveTo(-wingLen * 0.2, 6, -4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner purple-enchanted glint line along leading wing edge
    ctx.strokeStyle = isBackWing ? 'rgba(192, 132, 252, 0.45)' : 'rgba(233, 213, 255, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-2, -1);
    ctx.quadraticCurveTo(-wingLen * 0.44, wingLift * 0.72, -wingLen * 0.92, tipY + 2);
    ctx.stroke();
  } else {
    // Folded Elytra cape wings resting sleekly behind Purple's back
    const flare = (spread - 0.15) * 26;
    const dx = isBackWing ? -13 - flare * 0.6 : -17 - flare;
    const dy = 26 - flare * 0.25;

    ctx.fillStyle = isBackWing ? 'rgba(71, 85, 105, 0.85)' : 'rgba(186, 198, 214, 0.92)';
    ctx.strokeStyle = isBackWing ? '#3b0764' : '#7c3aed';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dx * 0.45, 4);
    ctx.lineTo(dx, dy);
    ctx.lineTo(dx * 0.52, dy + 4);
    ctx.lineTo(-3, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

export function drawPurpleAlly2D(ctx, ally, renderer, crowded = false) {
  if (!ally || !renderer) return;

  // 1. Sleek lavender/white Elytra slipstream ribbons while gliding or taking off
  if (ally.trail && ally.trail.length > 1) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < ally.trail.length; i++) {
      const prev = ally.trail[i - 1];
      const curr = ally.trail[i];
      const frac = i / ally.trail.length;
      ctx.strokeStyle = i % 2 === 0 ? '#e9d5ff' : '#a855f7';
      ctx.globalAlpha = frac * 0.55;
      ctx.lineWidth = 1.5 + frac * 4.5;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y - 26);
      ctx.lineTo(curr.x, curr.y - 26);
      ctx.stroke();
    }
    ctx.restore();
  }

  const facing = ally.facing >= 0 ? 1 : -1;
  const isGliding = ally.pose === 'elytra_glide';
  const pitch = isGliding ? clamp(ally.pitchAngle || 0, -0.95, 0.95) : 0;

  ctx.save();
  if (isGliding && Math.abs(pitch) > 0.005) {
    // Rotate smoothly around Purple's center of mass along his flight tangent
    ctx.translate(ally.x, ally.y - 28);
    ctx.rotate(pitch * facing);
    ctx.translate(-ally.x, -(ally.y - 28));
  }

  // Back Elytra wing behind body
  ctx.save();
  ctx.translate(ally.x, ally.y);
  ctx.scale(facing * 1.02, 1.02);
  drawPurpleElytraWings2D(ctx, ally, true);
  ctx.restore();

  // Purple stickman body
  renderer.draw(ctx, {
    x: ally.x,
    y: ally.y,
    facing,
    pose: ally.pose || 'idle',
    animTimer: ally.timer || 0,
    isGrounded: !isGliding,
    isHurt: ally.isHurt === true,
    isAwakened: false,
    suppressGlow: crowded
  });

  // Front Elytra wing layered cleanly on shoulder side
  ctx.save();
  ctx.translate(ally.x, ally.y);
  ctx.scale(facing * 1.02, 1.02);
  drawPurpleElytraWings2D(ctx, ally, false);
  ctx.restore();

  ctx.restore();
}

export function updatePurpleAlly(ally, dt, groundY, zombies, player, camera, alliesManager, speech2d, speech3d) {
  const safeDt = clamp(Number(dt) || 0, 0, 0.05);
  ally.timer += safeDt;
  ally.phaseTimer = (ally.phaseTimer || 0) + safeDt;
  ally.life -= safeDt;

  if (ally.hurtTimer > 0) {
    ally.hurtTimer = Math.max(0, ally.hurtTimer - safeDt);
    if (ally.hurtTimer <= 0) ally.isHurt = false;
  }

  if (!ally.trail) ally.trail = [];

  const pushTrail = () => {
    ally.trailTimer = (ally.trailTimer || 0) + safeDt;
    if (ally.trailTimer >= 0.028) {
      ally.trailTimer = 0;
      ally.trail.push({ x: ally.x, y: ally.y });
      if (ally.trail.length > 10) ally.trail.shift();
    }
  };

  // Hurt emergency retreat
  if (ally.retreating && ally.flightPhase !== 'takeoff') {
    ally.flightPhase = 'hurt_retreat';
    ally.isTargetable = false;
    ally.pose = ally.isHurt ? 'hurt' : 'elytra_glide';
    ally.wingSpread = Math.min(1.0, (ally.wingSpread || 0.4) + safeDt * 5);
    ally.pitchAngle = -0.58;
    ally.x = clampAllyX(ally.x - ally.facing * 260 * safeDt);
    ally.y -= 780 * safeDt;
    pushTrail();
    return ally.life > 0;
  }

  if (ally.flightPhase === 'swoop_in') {
    const dur = PURPLE_ALLY_CONFIG.swoopDuration;
    const t = clamp(ally.phaseTimer / dur, 0, 1);
    // Smooth dive acceleration with silky flare at the bottom
    const u = 0.28 * t + 0.72 * (t * t * (3 - 2 * t));

    const p0 = { x: ally.startX, y: ally.startY };
    const p1 = { x: ally.startX + (ally.diveTargetX - ally.startX) * 0.46, y: ally.startY + 95 };
    const p2 = { x: ally.diveTargetX - ally.facing * 120, y: groundY - 46 };
    const p3 = { x: ally.diveTargetX, y: groundY - 20 };
    const pt = sampleCubicBezier(p0, p1, p2, p3, u);

    ally.x = clampAllyX(pt.x);
    ally.y = pt.y;
    const rawPitch = Math.atan2(pt.dy, Math.max(40, Math.abs(pt.dx)));
    ally.pitchAngle = (ally.pitchAngle ?? rawPitch) + (rawPitch - (ally.pitchAngle ?? rawPitch)) * Math.min(1, safeDt * 18);
    ally.wingSpread = 0.84 + Math.sin(t * Math.PI) * 0.18;
    ally.pose = 'elytra_glide';
    ally.isTargetable = ally.y >= groundY - 120;
    pushTrail();

    if (Math.random() < 0.45) {
      particles.createHitSparks(ally.x - ally.facing * 18, ally.y - 26, 1, '#e9d5ff');
    }

    if (t >= 1) {
      ally.flightPhase = 'swoop_strike';
      ally.phaseTimer = 0;
      ally.strikeStartX = ally.x;
    }
    return ally.life > 0;
  }

  if (ally.flightPhase === 'swoop_strike') {
    const dur = PURPLE_ALLY_CONFIG.strikeDuration;
    const t = clamp(ally.phaseTimer / dur, 0, 1);
    const easeOut = 1 - Math.pow(1 - t, 2.2);

    ally.x = clampAllyX(ally.strikeStartX + (ally.swoopEndX - ally.strikeStartX) * easeOut);
    // Smooth flare touchdown onto groundY
    ally.y = groundY - 20 * (1 - easeOut);
    // Smoothly level pitch toward 0 and begin folding Elytra
    ally.pitchAngle = (ally.pitchAngle || 0) * Math.max(0, 1 - safeDt * 14);
    ally.wingSpread = 1.0 - easeOut * 0.78;
    ally.pose = t < 0.72 ? 'elytra_glide' : 'idle';
    ally.isTargetable = true;
    pushTrail();

    // Execute Purple's Elytra Swoop Gust hit once mid-pass!
    if (!ally.hasActed && t >= 0.35) {
      ally.hasActed = true;
      camera?.addShake?.(0.45);
      camera?.addZoomPunch?.(0.04);
      audio.playSlash?.();
      audio.playWhoosh?.();
      particles.addShockwave(ally.x, groundY - 20, 260, PURPLE_ALLY_CONFIG.accentColor, 12);
      particles.createHitSparks(ally.x, groundY - 28, 18, '#e9d5ff');
      particles.createDust(ally.x, groundY, 10, ally.facing);
      particles.addTextBanner(ally.x, groundY - 62, 'ELYTRA SWOOP!', '#c084fc');

      const midX = (ally.strikeStartX + ally.swoopEndX) * 0.5;
      for (const z of zombies || []) {
        if (!z || z.isDead) continue;
        if (Math.abs(z.x - midX) <= PURPLE_ALLY_CONFIG.effectRadius) {
          const dmg = z.isBoss ? PURPLE_ALLY_CONFIG.bossDamage : PURPLE_ALLY_CONFIG.damage;
          const dir = ally.facing || (z.x >= ally.x ? 1 : -1);
          z.takeDamage?.(dmg, dir, PURPLE_ALLY_CONFIG.knockback, true);
          if (!z.isBoss && typeof z.vy === 'number') {
            z.vy = Math.min(z.vy, -320);
            z.isGrounded = false;
          }
          particles.createHitSparks(z.x, z.y - 30, 8, '#c084fc');
        }
      }
    }

    if (t >= 1) {
      ally.y = groundY;
      ally.pitchAngle = 0;
      ally.wingSpread = 0.2;
      ally.flightPhase = 'landed';
      ally.phaseTimer = 0;
      ally.trail.length = 0;

      // Check live if King Orange is with you right now!
      const kingAlly = findActiveKingAlly(alliesManager);
      const kingWithPlayer = Boolean(kingAlly || isKingOrangeWithPlayer(alliesManager) || ally.kingPresent);
      ally.kingPresent = kingWithPlayer;

      if (kingWithPlayer) {
        if (kingAlly) {
          ally.facing = kingAlly.x >= ally.x ? 1 : -1;
        }
        ally.pose = 'wave';
        ally.saidHiToKing = true;
        ally.kingReplyPending = true;
        ally.kingReplyTimer = 0.36;
        ally.landedTargetDuration = PURPLE_ALLY_CONFIG.landedWithKingDuration;
        // Extend life so Purple finishes waving & King Orange finishes replying before smooth takeoff
        ally.life = Math.max(ally.life, ally.landedTargetDuration + PURPLE_ALLY_CONFIG.takeoffDuration + 0.15);

        emitPurpleSpeech('HI, KING!', 'ally-purple', ally.x, ally.y, ally, speech2d, speech3d, {
          priority: 4,
          mood: '★',
          duration: 1.7,
          speakerKey: 'purple:king-hi'
        });
      } else {
        ally.pose = 'idle';
        ally.landedTargetDuration = PURPLE_ALLY_CONFIG.landedDuration;
        const quip = PURPLE_QUIPS.battle[Math.floor(Math.random() * PURPLE_QUIPS.battle.length)];
        emitPurpleSpeech(quip, 'ally-purple', ally.x, ally.y, ally, speech2d, speech3d, {
          priority: 2,
          mood: '!',
          duration: 1.45,
          speakerKey: 'allies:purple'
        });
      }
    }
    return ally.life > 0;
  }

  if (ally.flightPhase === 'landed') {
    ally.y = groundY;
    ally.pitchAngle = 0;
    ally.wingSpread += (0.18 - ally.wingSpread) * Math.min(1, safeDt * 12);
    ally.isTargetable = true;

    if (ally.kingPresent) {
      ally.pose = 'wave';
      const kingAlly = findActiveKingAlly(alliesManager);
      if (kingAlly) {
        ally.facing = kingAlly.x >= ally.x ? 1 : -1;
      }
      if (ally.kingReplyPending) {
        ally.kingReplyTimer -= safeDt;
        if (ally.kingReplyTimer <= 0) {
          ally.kingReplyPending = false;
          ally.kingReplied = true;
          const kx = kingAlly ? kingAlly.x : (player ? player.x - (player.facing || 1) * 70 : ally.x - ally.facing * 70);
          const ky = kingAlly ? kingAlly.y : groundY;
          emitPurpleSpeech('HI, PURPLE!', 'ally-king', kx, ky, kingAlly || null, speech2d, speech3d, {
            priority: 4,
            mood: '★',
            duration: 1.65,
            speakerKey: 'king:purple-hi'
          });
        }
      }
    } else {
      ally.pose = 'idle';
    }

    const waitDur = ally.landedTargetDuration || PURPLE_ALLY_CONFIG.landedDuration;
    if (ally.phaseTimer >= waitDur) {
      ally.flightPhase = 'takeoff';
      ally.phaseTimer = 0;
      ally.takeoffStartX = ally.x;
      ally.takeoffStartY = ally.y;
      ally.takeoffDir = ally.facing || 1;
      ally.isTargetable = false;
      audio.playWhoosh?.();
      particles.createDust(ally.x, groundY, 6, ally.takeoffDir);
    }
    return ally.life > 0;
  }

  if (ally.flightPhase === 'takeoff') {
    const dur = PURPLE_ALLY_CONFIG.takeoffDuration;
    const t = clamp(ally.phaseTimer / dur, 0, 1);
    const u = t * t * (2.2 - 1.2 * t);

    const p0 = { x: ally.takeoffStartX, y: ally.takeoffStartY };
    const p1 = { x: ally.takeoffStartX + ally.takeoffDir * 90, y: ally.takeoffStartY - 85 };
    const p2 = { x: ally.takeoffStartX + ally.takeoffDir * 230, y: ally.takeoffStartY - 260 };
    const p3 = { x: ally.takeoffStartX + ally.takeoffDir * 390, y: ally.takeoffStartY - 470 };
    const pt = sampleCubicBezier(p0, p1, p2, p3, u);

    ally.x = clampAllyX(pt.x);
    ally.y = pt.y;
    const rawPitch = Math.atan2(pt.dy, Math.max(40, Math.abs(pt.dx)));
    ally.pitchAngle = (ally.pitchAngle ?? 0) + (rawPitch - (ally.pitchAngle ?? 0)) * Math.min(1, safeDt * 14);
    ally.wingSpread = Math.min(1.0, 0.25 + Math.min(1, t * 2.4) * 0.78);
    ally.pose = 'elytra_glide';
    ally.isTargetable = false;
    pushTrail();

    if (t >= 1) {
      ally.life = 0;
      return false;
    }
    return ally.life > 0;
  }

  return ally.life > 0;
}

export function installPurpleAllySystem(alliesManager, inputManager, speech2d, speech3d = null, shopSystem = null) {
  if (!alliesManager) return alliesManager;

  installPurpleStickmanPoses();

  // Register Purple in shared 2D speech corpus (cleanly extends without modifying core speech.js)
  if (SPEECH_CORPUS?.allies && !SPEECH_CORPUS.allies.purple) {
    SPEECH_CORPUS.allies.purple = [...PURPLE_QUIPS.battle];
  }
  if (SPEECH_CORPUS?.allyHurt && !SPEECH_CORPUS.allyHurt.purple) {
    SPEECH_CORPUS.allyHurt.purple = [...PURPLE_QUIPS.hurt];
  }

  // Extend InputManager for Digit7 / Numpad7 -> actions.ally7
  if (inputManager && !inputManager._purpleAllyInputInstalled) {
    inputManager._purpleAllyInputInstalled = true;
    inputManager.actions.ally7 = false;
    const origUpdate = inputManager.update.bind(inputManager);
    const origEndFrame = inputManager.endFrame.bind(inputManager);
    inputManager.update = () => {
      origUpdate();
      inputManager.actions.ally7 = Boolean(inputManager.keysPressed?.Digit7 || inputManager.keysPressed?.Numpad7);
    };
    inputManager.endFrame = () => {
      origEndFrame();
      inputManager.actions.ally7 = false;
    };
  }

  // Extend Shop Stick Squad Synergy to also reduce Purple's cooldown
  if (shopSystem && !shopSystem._purpleSynergyInstalled) {
    shopSystem._purpleSynergyInstalled = true;
    const synergy = shopSystem.upgrades?.find((u) => u.id === 'ally_synergy');
    if (synergy && typeof synergy.apply === 'function') {
      const origApply = synergy.apply;
      synergy.apply = (player) => {
        origApply(player);
        if (Number.isFinite(alliesManager.maxCooldowns?.purple)) {
          alliesManager.maxCooldowns.purple = Math.max(5, alliesManager.maxCooldowns.purple * 0.75);
        }
      };
    }
  }

  // Keep speech3d ref fresh if called again later with speech3d
  if (speech3d) alliesManager._purpleSpeech3D = speech3d;
  if (speech2d) alliesManager._purpleSpeech2D = speech2d;

  if (alliesManager._purpleAllyInstalled) return alliesManager;
  alliesManager._purpleAllyInstalled = true;

  // Register Purple properties on AllyManager
  alliesManager.unlocked.purple = true;
  alliesManager.cooldowns.purple = 0;
  alliesManager.maxCooldowns.purple = PURPLE_ALLY_CONFIG.cooldown;
  alliesManager.recoveryStates.purple = false;
  alliesManager.renderers.purple = new StickFigureRenderer(PURPLE_ALLY_CONFIG.color, 5.2, 1.02, false);

  // Add unlockKingAlly helper (used by 3D Creative All Allies!)
  if (typeof alliesManager.unlockKingAlly !== 'function') {
    alliesManager.unlockKingAlly = (x = 0, groundY = 0, facing = 1) => {
      alliesManager.unlocked.king = true;
      alliesManager.cooldowns.king = 0;
      alliesManager.recoveryStates.king = false;
      if (!alliesManager.activeAllies.some((a) => a && a.type === 'king' && !a.isDead)) {
        return alliesManager.summonAlly('king', x, groundY, facing, []);
      }
      return true;
    };
  }

  // Wrap reset() so Purple stays unlocked & maxCooldown resets properly
  const origReset = alliesManager.reset.bind(alliesManager);
  alliesManager.reset = (resetUpgrades = false, preserveRecovery = false, kingUnlocked = false) => {
    origReset(resetUpgrades, preserveRecovery, kingUnlocked);
    alliesManager.unlocked.purple = true;
    if (resetUpgrades) {
      alliesManager.maxCooldowns.purple = PURPLE_ALLY_CONFIG.cooldown;
    }
    if (!Number.isFinite(alliesManager.cooldowns.purple)) {
      alliesManager.cooldowns.purple = 0;
    }
    if (typeof alliesManager.recoveryStates.purple !== 'boolean') {
      alliesManager.recoveryStates.purple = false;
    }
  };

  // Wrap summonAlly() to create Purple with smooth Elytra swoop trajectory
  const origSummon = alliesManager.summonAlly.bind(alliesManager);
  alliesManager.summonAlly = (type, targetX, targetY, facing = 1, zombies = []) => {
    if (type !== 'purple') {
      return origSummon(type, targetX, targetY, facing, zombies);
    }
    if (!alliesManager.unlocked.purple || alliesManager.cooldowns.purple > 0) {
      if (alliesManager.cooldowns.purple > 0) {
        audio.createNoiseBurst?.(0.05, 0.1, 800);
      }
      return false;
    }

    alliesManager.cooldowns.purple = alliesManager.maxCooldowns.purple || PURPLE_ALLY_CONFIG.cooldown;
    alliesManager.recoveryStates.purple = false;
    audio.playWhoosh?.();

    const dir = facing >= 0 ? 1 : -1;
    const startX = clampAllyX(targetX - dir * 340);
    const startY = targetY - 430;
    const diveTargetX = clampAllyX(targetX + dir * 130);
    const swoopEndX = clampAllyX(diveTargetX + dir * 210);
    const kingPresent = isKingOrangeWithPlayer(alliesManager);

    const ally = {
      type: 'purple',
      x: startX,
      y: startY,
      startX,
      startY,
      diveTargetX,
      swoopEndX,
      strikeStartX: diveTargetX,
      groundY: targetY,
      facing: dir,
      pose: 'elytra_glide',
      flightPhase: 'swoop_in',
      pitchAngle: 0.62,
      wingSpread: 0.96,
      trail: [{ x: startX, y: startY }],
      trailTimer: 0,
      timer: 0,
      phaseTimer: 0,
      readyTimer: 0,
      life: 3.4,
      hasActed: false,
      saidHiToKing: false,
      kingReplied: false,
      kingReplyPending: false,
      kingReplyTimer: 0,
      kingPresent,
      isAlly: true,
      isDead: false,
      isTargetable: false,
      retreating: false,
      isHurt: false,
      hurtTimer: 0,
      radius: 18,
      height: 62
    };
    ally.takeDamage = (amount, knockbackDir = 0) => alliesManager.injureAlly(ally, amount, knockbackDir);
    alliesManager.activeAllies.push(ally);
    return true;
  };

  // Wrap update() to drive Purple's smooth Elytra animation cleanly without core interference
  const origUpdate = alliesManager.update.bind(alliesManager);
  alliesManager.update = (dt, groundY, zombies, player, camera) => {
    const purples = [];
    for (let i = alliesManager.activeAllies.length - 1; i >= 0; i--) {
      if (alliesManager.activeAllies[i]?.type === 'purple') {
        purples.push(alliesManager.activeAllies[i]);
        alliesManager.activeAllies.splice(i, 1);
      }
    }

    origUpdate(dt, groundY, zombies, player, camera);

    const s2d = alliesManager._purpleSpeech2D || speech2d;
    const s3d = alliesManager._purpleSpeech3D || speech3d;
    for (let i = purples.length - 1; i >= 0; i--) {
      const p = purples[i];
      const alive = updatePurpleAlly(p, dt, groundY, zombies, player, camera, alliesManager, s2d, s3d);
      if (alive) {
        alliesManager.activeAllies.push(p);
      }
    }
  };

  // Wrap draw() so Purple renders with smooth rotated Elytra wings & wind ribbons in 2D
  const origDraw = alliesManager.draw.bind(alliesManager);
  alliesManager.draw = (ctx, crowded = false) => {
    const purples = [];
    for (let i = alliesManager.activeAllies.length - 1; i >= 0; i--) {
      if (alliesManager.activeAllies[i]?.type === 'purple') {
        purples.push(alliesManager.activeAllies[i]);
        alliesManager.activeAllies.splice(i, 1);
      }
    }

    try {
      origDraw(ctx, crowded);
    } finally {
      for (let i = 0; i < purples.length; i++) {
        alliesManager.activeAllies.push(purples[i]);
      }
    }

    const purpleRenderer = alliesManager.renderers.purple;
    for (let i = 0; i < purples.length; i++) {
      drawPurpleAlly2D(ctx, purples[i], purpleRenderer, crowded);
    }
  };

  return alliesManager;
}

// ============================================================================
// Old Updates Modal Builder & Binder (Shared by 2D & 3D Main Menus!)
// ============================================================================
export function installOldUpdatesMenu(options = {}) {
  if (typeof document === 'undefined') return null;

  const isSubdir = Boolean(options.isSubdir);
  const from = options.from === '3d' ? '3d' : '2d';

  // 1. Ensure Main Menu "⏪ OLD UPDATES" button exists inside .title-actions
  let btn = document.getElementById('btn-old-updates');
  if (!btn) {
    const titleActions = document.querySelector('#title-screen .title-actions');
    if (titleActions) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'btn-old-updates';
      btn.className = 'secondary-btn old-updates-btn';
      btn.setAttribute('aria-label', 'Play previous updates of Stick vs Zombies');
      btn.title = 'Travel back and play older updates of Stick vs Zombies!';
      btn.textContent = '⏪ OLD UPDATES';
      titleActions.appendChild(btn);
    }
  }

  // 2. Ensure #old-updates-modal exists inside #game-container (or body)
  let modal = document.getElementById('old-updates-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'old-updates-modal';
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'old-updates-title');

    const cardsHtml = OLD_UPDATES_ARCHIVE.map((entry) => {
      const href = resolveLegacyUpdateUrl(entry.path, { isSubdir, from });
      const tagsHtml = entry.highlights
        .map((h) => `<span class="update-tag">${h}</span>`)
        .join('');
      return `
        <div class="update-archive-card" data-update-id="${entry.id}" style="border-color: ${entry.accent};">
          <div class="update-card-top">
            <span class="update-version-pill" style="background: ${entry.accent};">${entry.version}</span>
            <span class="update-era-badge">${entry.badge}</span>
            <span class="update-date">${entry.date}</span>
          </div>
          <div class="update-card-title">${entry.title}</div>
          <p class="update-card-desc">${entry.summary}</p>
          <div class="update-tags-row">${tagsHtml}</div>
          <a href="${href}" class="primary-btn update-play-link" data-legacy-id="${entry.id}">▶ PLAY ${entry.version}</a>
        </div>
      `;
    }).join('');

    modal.innerHTML = `
      <div class="modal-box old-updates-modal-box">
        <div class="modal-header">
          <div>
            <div id="old-updates-title" class="modal-title">⏪ TIME MACHINE — OLD UPDATES</div>
            <div class="old-updates-sub">Play classic historical builds of Stick vs Zombies! Every old version has a Back to Latest button.</div>
          </div>
          <button type="button" id="btn-close-old-updates" class="secondary-btn" style="padding: 6px 14px;">✕ Close</button>
        </div>
        <div class="current-update-banner">
          <span class="current-update-pill">✨ CURRENT (LATEST)</span>
          <span>32 Stages • Ice Caves • Desert Pyramid • Purple Elytra Ally (7) • Stronghold • Outside Rocket Corp • TNT Craters • Creative Sandbox</span>
        </div>
        <div class="modal-content">
          <div class="old-updates-grid">
            ${cardsHtml}
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" id="btn-stay-latest" class="secondary-btn">Stay on Latest Update</button>
        </div>
      </div>
    `;

    const container = document.getElementById('game-container') || document.body;
    container?.appendChild(modal);
  }

  const openModal = () => {
    modal?.classList.add('active');
  };
  const closeModal = () => {
    modal?.classList.remove('active');
  };

  if (btn && !btn._oldUpdatesBound) {
    btn._oldUpdatesBound = true;
    btn.addEventListener('click', openModal);
  }

  const closeBtn = document.getElementById('btn-close-old-updates');
  if (closeBtn && !closeBtn._oldUpdatesBound) {
    closeBtn._oldUpdatesBound = true;
    closeBtn.addEventListener('click', closeModal);
  }

  const stayBtn = document.getElementById('btn-stay-latest');
  if (stayBtn && !stayBtn._oldUpdatesBound) {
    stayBtn._oldUpdatesBound = true;
    stayBtn.addEventListener('click', closeModal);
  }

  if (modal && !modal._backdropBound) {
    modal._backdropBound = true;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (typeof window !== 'undefined' && !window._oldUpdatesEscBound) {
    window._oldUpdatesEscBound = true;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        const m = document.getElementById('old-updates-modal');
        if (m?.classList.contains('active')) {
          m.classList.remove('active');
        }
      }
    });
  }

  return { btn, modal, openModal, closeModal };
}
