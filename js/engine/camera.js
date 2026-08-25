export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.zoomPunch = 0;
    this.focusCue = null;
    this.motionScale = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0.28 : 1;
    this.trauma = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeRotation = 0;
    this.shakeClock = 0;
    this.shakePhase = 0;
    this.hitstopTimer = 0;
    this.hitstopCooldown = 0;
    this.minX = -1100;
    this.maxX = 1100;
    this.minY = -550;
    this.maxY = -70;
    this.viewportCache = { width: 0, height: 0, stale: true };
  }
  invalidateViewport() {
    this.viewportCache.stale = true;
  }
  getViewportSize() {
    // clientWidth/Height are layout reads and this runs many times per
    // frame — cache the result and refresh once per update (or on resize).
    const cache = this.viewportCache;
    if (cache.stale || cache.width === 0) {
      cache.width = this.canvas.clientWidth || window.innerWidth || 1280;
      cache.height = this.canvas.clientHeight || window.innerHeight || 720;
      cache.stale = false;
    }
    return cache;
  }
  getMinimumZoom() {
    const { width } = this.getViewportSize();
    const arenaWidth = Math.max(1, this.maxX - this.minX);
    return Math.max(0.78, width / Math.max(1, arenaWidth - 64));
  }
  getEffectiveZoom() {
    return Math.max(this.getMinimumZoom(), this.zoom + this.zoomPunch);
  }
  getRenderPixelRatio(devicePixelRatio = globalThis.window?.devicePixelRatio || 1, maxBackingPixels = 10_000_000) {
    const { width, height } = this.getViewportSize();
    const budgetRatio = Math.sqrt(maxBackingPixels / Math.max(1, width * height));
    return Math.max(Number.EPSILON, Math.min(2, devicePixelRatio, budgetRatio));
  }
  getTargetPosition(target) {
    const { height } = this.getViewportSize();
    const vx = Number.isFinite(target.vx) ? target.vx : 0;
    const vy = Number.isFinite(target.vy) ? target.vy : 0;
    const leadX = Math.abs(vx) > 35
      ? clamp(vx * 0.18, -90, 90)
      : clamp((target.facing || 1) * 58, -90, 90);
    const airborneLeadY = target.isGrounded === false
      ? clamp(vy * 0.06, -35, 35)
      : 0;
    const groundOffset = height <= 500
      ? Math.max(36, height * 0.1)
      : Math.max(82, Math.min(190, height * 0.24));
    return {
      x: target.x + leadX,
      y: target.y - groundOffset + airborneLeadY
    };
  }
  clampToArena() {
    const { width, height } = this.getViewportSize();
    const halfView = width / (2 * Math.max(0.01, this.getEffectiveZoom()));
    const edgeInset = 24;
    const minCenter = this.minX + halfView - edgeInset;
    const maxCenter = this.maxX - halfView + edgeInset;
    if (minCenter > maxCenter) {
      this.x = (this.minX + this.maxX) * 0.5;
    } else {
      this.x = Math.max(minCenter, Math.min(maxCenter, this.x));
    }
    const viewportMaxY = height <= 500 ? -32 : this.maxY;
    this.y = Math.max(this.minY, Math.min(viewportMaxY, this.y));
  }
  snapTo(target) {
    if (!target) return;
    const next = this.getTargetPosition(target);
    this.targetX = next.x;
    this.targetY = next.y;
    this.x = next.x;
    this.y = next.y;
    const minimumZoom = this.getMinimumZoom();
    this.zoom = Math.max(1, minimumZoom);
    this.targetZoom = this.zoom;
    this.zoomPunch = 0;
    this.focusCue = null;
    this.trauma = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeRotation = 0;
    this.shakeClock = 0;
    this.hitstopTimer = 0;
    this.clampToArena();
  }
  clearTransient() {
    this.focusCue = null;
    this.trauma = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeRotation = 0;
    this.hitstopTimer = 0;
    this.hitstopCooldown = 0;
    this.zoomPunch = 0;
  }
  update(dt, target, zombieCount = 0) {
    this.invalidateViewport(); // one layout read per frame, then cached
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
    }
    if (this.hitstopCooldown > 0) {
      this.hitstopCooldown -= dt;
    }
    let desiredZoom = this.targetZoom;
    if (target) {
      const next = this.getTargetPosition(target);
      this.targetX = next.x;
      this.targetY = next.y;
      const speed = Math.hypot(target.vx || 0, target.vy || 0);
      desiredZoom = 1.0 - Math.min(speed / 1400, 0.15);
      const crowdPressure = clamp01((zombieCount - 6) / 6);
      desiredZoom *= 1 - crowdPressure * 0.08;
      if (target.isAwakened) desiredZoom = 0.95;
    }
    if (this.focusCue) {
      this.focusCue.remaining -= dt;
      this.focusCue.elapsed += dt;
      const fadeWindow = Math.min(0.24, this.focusCue.duration * 0.4);
      const introStrength = smoothstep01(
        this.focusCue.elapsed / Math.max(0.01, this.focusCue.introDuration)
      );
      const outroStrength = smoothstep01(
        this.focusCue.remaining / Math.max(0.01, fadeWindow)
      );
      const easedStrength = introStrength * outroStrength;
      this.targetX += (this.focusCue.x - this.targetX) * easedStrength;
      this.targetY += (this.focusCue.y - this.targetY) * easedStrength;
      desiredZoom += (this.focusCue.zoom - desiredZoom) * easedStrength;
      if (this.focusCue.remaining <= 0) this.focusCue = null;
    }
    this.targetZoom = Math.max(this.getMinimumZoom(), Math.min(1.15, desiredZoom));
    const lerpSpeed = 6.0;
    this.x += (this.targetX - this.x) * Math.min(1, lerpSpeed * dt);
    this.y += (this.targetY - this.y) * Math.min(1, lerpSpeed * dt);
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, 4.0 * dt);
    this.zoom = Math.max(this.getMinimumZoom(), this.zoom);
    this.zoomPunch += (0 - this.zoomPunch) * Math.min(1, 11 * dt);
    if (Math.abs(this.zoomPunch) < 0.0005) this.zoomPunch = 0;
    this.clampToArena();
    const safeDt = Math.max(0, Math.min(0.1, Number(dt) || 0));
    const shakeResponse = 1 - Math.exp(-30 * safeDt);
    if (this.trauma > 0) {
      const shakePower = Math.pow(this.trauma, 2);
      const maxOffset = 21 * shakePower;
      this.shakeClock += safeDt;
      const phase = this.shakePhase;
      const targetX = (
        Math.sin(this.shakeClock * 37 + phase)
        + Math.sin(this.shakeClock * 71 + phase * 0.37) * 0.35
      ) / 1.35 * maxOffset;
      const targetY = (
        Math.sin(this.shakeClock * 43 + phase + 1.91)
        + Math.sin(this.shakeClock * 67 + phase * 0.61) * 0.3
      ) / 1.3 * maxOffset;
      const targetRotation = Math.sin(this.shakeClock * 31 + phase * 0.73)
        * 0.018 * shakePower * this.motionScale;
      this.shakeOffsetX += (targetX - this.shakeOffsetX) * shakeResponse;
      this.shakeOffsetY += (targetY - this.shakeOffsetY) * shakeResponse;
      this.shakeRotation += (targetRotation - this.shakeRotation) * shakeResponse;
      this.trauma = Math.max(0, this.trauma - safeDt * 2.2);
    } else {
      this.shakeOffsetX += (0 - this.shakeOffsetX) * shakeResponse;
      this.shakeOffsetY += (0 - this.shakeOffsetY) * shakeResponse;
      this.shakeRotation += (0 - this.shakeRotation) * shakeResponse;
      if (Math.abs(this.shakeOffsetX) < 0.005) this.shakeOffsetX = 0;
      if (Math.abs(this.shakeOffsetY) < 0.005) this.shakeOffsetY = 0;
      if (Math.abs(this.shakeRotation) < 0.00001) this.shakeRotation = 0;
    }
  }
  addShake(amount = 0.3) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.trauma = Math.min(1.0, this.trauma + amount * this.motionScale);
    this.shakePhase = (this.shakePhase + 2.399963229728653) % (Math.PI * 2);
  }
  addZoomPunch(amount = 0.05) {
    if (!Number.isFinite(amount)) return;
    this.zoomPunch = Math.max(-0.08, Math.min(0.1, this.zoomPunch + amount * this.motionScale));
    this.clampToArena();
  }
  focusOn(x, y, duration = 0.7, zoom = 0.92) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const reducedMotion = this.motionScale < 0.5;
    const durationScale = reducedMotion ? 0.55 : 1;
    const safeDuration = Math.max(0.12, Math.min(1.8, (Number(duration) || 0.7) * durationScale));
    const requestedZoom = Math.max(this.getMinimumZoom(), Math.min(1.12, Number(zoom) || 0.92));
    const cueX = reducedMotion
      ? this.targetX + Math.max(-90, Math.min(90, x - this.targetX))
      : x;
    const cueY = reducedMotion
      ? this.targetY + Math.max(-55, Math.min(55, y - this.targetY))
      : y;
    this.focusCue = {
      x: cueX,
      y: cueY,
      duration: safeDuration,
      remaining: safeDuration,
      elapsed: 0,
      introDuration: Math.max(0.08, Math.min(0.12, safeDuration * 0.22)),
      zoom: reducedMotion
        ? this.targetZoom + (requestedZoom - this.targetZoom) * this.motionScale
        : requestedZoom
    };
    return true;
  }
  addHitstop(duration = 0.05) {
    if (this.hitstopCooldown > 0) return;
    this.hitstopTimer = Math.min(0.06, duration);
    this.hitstopCooldown = 0.18; // Prevents stacking slow-mo freeze
  }
  isHitstopped() {
    return this.hitstopTimer > 0;
  }
  apply(ctx) {
    ctx.save();
    const { width, height } = this.getViewportSize();
    const cx = width / 2;
    const cy = height / 2;
    ctx.translate(cx + this.shakeOffsetX, cy + this.shakeOffsetY);
    if (this.shakeRotation !== 0) {
      ctx.rotate(this.shakeRotation);
    }
    const effectiveZoom = this.getEffectiveZoom();
    ctx.scale(effectiveZoom, effectiveZoom);
    ctx.translate(-this.x, -this.y);
  }
  restore(ctx) {
    ctx.restore();
  }
  screenToWorld(screenX, screenY, includeShake = true) {
    const { width, height } = this.getViewportSize();
    const cx = width / 2;
    const cy = height / 2;
    const effectiveZoom = this.getEffectiveZoom();
    const offsetX = includeShake ? this.shakeOffsetX : 0;
    const offsetY = includeShake ? this.shakeOffsetY : 0;
    const rotation = includeShake ? this.shakeRotation : 0;
    const translatedX = screenX - cx - offsetX;
    const translatedY = screenY - cy - offsetY;
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const relX = (translatedX * cos - translatedY * sin) / effectiveZoom;
    const relY = (translatedX * sin + translatedY * cos) / effectiveZoom;
    return {
      x: this.x + relX,
      y: this.y + relY
    };
  }
  worldToScreen(worldX, worldY, includeShake = true) {
    const { width, height } = this.getViewportSize();
    const cx = width / 2;
    const cy = height / 2;
    const effectiveZoom = this.getEffectiveZoom();
    const rotation = includeShake ? this.shakeRotation : 0;
    const rawX = (worldX - this.x) * effectiveZoom;
    const rawY = (worldY - this.y) * effectiveZoom;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const relX = rawX * cos - rawY * sin;
    const relY = rawX * sin + rawY * cos;
    return {
      x: cx + (includeShake ? this.shakeOffsetX : 0) + relX,
      y: cy + (includeShake ? this.shakeOffsetY : 0) + relY
    };
  }
}
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
function smoothstep01(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
