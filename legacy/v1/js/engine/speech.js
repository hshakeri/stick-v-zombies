// 80s Japanese Retro Arcade & Manga Style Speech Bubble Engine
// Samples from a large corpus of hilarious anime, retro gaming, stick figure, and coding humor!

import { audio } from './audio.js';

export const SPEECH_CORPUS = {
  playerAttack: [
    "OMAE WA MOU SHINDEIRU!!",
    "CTRL+Z CANNOT SAVE YOU NOW!",
    "TASTE THE 2B GRAPHITE, FIEND!",
    "SYSTEM ERROR: SKILL TOO HIGH!",
    "ALL YOUR BRAIN ARE BELONG TO US!",
    "ERROR 404: ZOMBIE NOT FOUND!",
    "BEHOLD MY FINAL FORM... IN 24 FPS!",
    "NANI?! IS THAT ALL YOU'VE GOT?!",
    "THIS IS FOR CLOSING WITHOUT SAVING!",
    "DO YOU EVEN LIFT... VECTORS?!",
    "SUPER AWESOME PENCIL ATTACK: OMEGA!!",
    "MY ANIMATOR DREW ME TOO POWERFUL!",
    "FATAL EXCEPTION AT 0xDEADBEEF!",
    "I AM THE CHOSEN ONE OF FLASH 8!",
    "SURPRISE ANVIL DELIVERY!",
    "DELETE KEY ACTIVATED!!",
    "HIKARI AREEEEEEE!! (BEHOLD THE LIGHT!)",
    "JUST AS PREDICTED BY THE TIMELINE!",
    "TASKKILL /F /IM ZOMBIE.EXE!",
    "HADOU-PENCIL!!!",
    "ORA ORA ORA ORA ORAAA!",
    "BEAUTIFUL 60FPS VIOLENCE!",
    "I WILL DRAW A MUSTACHE ON YOUR CORPSE!",
    "YOUR FREE TRIAL OF LIFE HAS EXPIRED!",
    "OUT OF MEMORY? OUT OF MERCY!",
    "GIT PUSH --FORCE YOUR DOOM!",
    "WHO FORGOT TO CAP THE RED MARKER?!",
    "SUDDEN DEATH VIA DESKTOP SHORTCUT!",
    "ANIMATOR APPROVED BEATDOWN!",
    "YOU CANNOT DODGE 60 FRAMES OF FURY!",
    "HYPER-KEYFRAME CANCEL!!",
    "MY ONION SKIN NEVER MISSES!",
    "BONK! GO TO THE RECYCLE BIN!",
    "CRITICAL STRIKE! +9999 STYLE POINTS!",
    "THE BRUSH TOOL IS MIGHTIER THAN THE SWORD!"
  ],

  playerAwakened: [
    "✨ BEHOLD THE POWER OF PURE INSPIRATION! ✨",
    "⚡ GOD MODE COMPILATION COMPLETE! ⚡",
    "🔥 WITNESS THE ULTIMATE FLASH ANIMATION! 🔥",
    "⚡ 100% AWAKENING POWER UNLEASHED! ⚡",
    "💥 NO KEYFRAME CAN CONTAIN ME NOW! 💥",
    "✨ BEHOLD: THE CHOSEN ONE OF NEWGROUNDS! ✨"
  ],

  playerHurt: [
    "OUCH! MY VECTOR PATHS!",
    "MY HITBOX GLITCHED!",
    "THAT'LL BUFF OUT IN POST-PRODUCTION!",
    "WHO PUT THAT CORRUPTED BYTE THERE?!",
    "I WAS IN I-FRAMES, REF!!",
    "N-NANI?! IMPOSSIBLE!"
  ],

  zombieGroan: [
    "BRRRRAAAINS.PNG...",
    "NEED... MORE... RAM...",
    "BUFFER OVERFLOWWW...",
    "I WAS PROMISED PIZZA...",
    "WHY ARE WE GREEN TODAY?!",
    "CURSE YOU, ORANGE ONE!",
    "LAG! I SWEAR IT WAS LAG!",
    "MY HITBOX WAS OUT OF BOUNDS!",
    "SEGMENTATION FAULT (CORE DUMPED)...",
    "RECYCLED AGAIN?!",
    "MY JAVA APPLET CRASHED...",
    "ZERO STARS ON NEWGROUNDS...",
    "UNHAND THAT PENCIL...",
    "PLEASE DON'T DRAG ME TO TRASH...",
    "OUT OF HEAP SPACE..."
  ],

  allies: {
    red: [
      "RED SQUADRON: METEOR SLAM!!",
      "FIRE IN THE NETHER HOLE!",
      "BLAZE OF GLORY TIME!"
    ],
    blue: [
      "POTION BREW COMPLETE!",
      "HAVE SOME CHILL JUICE!",
      "HEALING SPLASH INCOMING!"
    ],
    yellow: [
      "REDSTONE LOGIC ONLINE!",
      "AUTOMATED TURRET GO BRRR!",
      "ENGINEERING MAXIMUM PAIN!"
    ],
    green: [
      "SONIC NOTE WAVE DROP!",
      "FEEL THE RHYTHM OF DOOM!",
      "BEATBOX OF DESTRUCTION!"
    ],
    cursor: [
      "SELECT ALL ➔ DELETE!",
      "RIGHT CLICK: SEND TO RECYCLE BIN!",
      "SYSTEM ADMINISTRATOR HAS SPOKEN!"
    ]
  },

  darkLord: [
    "VIRABOT PROTOCOL: EXTERMINATE!",
    "THE CHOSEN ONE SHALL BE DELETED!",
    "WITNESS THE CORRUPTED MATRIX!",
    "DUAL VIRA-BLADES: MAXIMUM VOLTAGE!",
    "YOUR CODE WILL BE OVERWRITTEN!"
  ]
};

export class SpeechBubbleManager {
  constructor() {
    this.bubbles = [];
    this.lastShoutTime = 0;
  }

  // Spawn retro speech bubble above character
  spawnBubble(x, y, text, speakerType = 'player', duration = 2.0) {
    const now = Date.now();
    if (now - this.lastShoutTime < 350) return; // Prevent spam overload
    this.lastShoutTime = now;

    // Remove any existing bubble nearby to prevent visual stacking
    this.bubbles = this.bubbles.filter(b => Math.abs(b.x - x) > 100);

    // Limit max bubbles on screen to 2 for clean readability
    if (this.bubbles.length >= 2) {
      this.bubbles.shift();
    }

    // Play retro 8-bit speech chirp
    audio.playSpeechChirp?.();

    this.bubbles.push({
      x,
      y: y - 55,
      targetY: y - 80,
      text,
      speakerType,
      life: duration,
      maxLife: duration,
      popScale: 0.2, // Pop-in spring animation
      wobble: (Math.random() - 0.5) * 4
    });
  }

  // Sample random funny text from corpus
  shout(x, y, category = 'playerAttack', subKey = null, duration = 2.2) {
    let pool = SPEECH_CORPUS[category];
    if (subKey && pool && pool[subKey]) {
      pool = pool[subKey];
    }
    if (!pool || pool.length === 0) return;

    const randomIndex = Math.floor(Math.random() * pool.length);
    const text = pool[randomIndex];
    this.spawnBubble(x, y, text, category, duration);
  }

  update(dt) {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.life -= dt;

      // Pop-in scale spring
      if (b.popScale < 1.0) {
        b.popScale = Math.min(1.0, b.popScale + dt * 10);
      }

      // Gentle floating upward drift
      b.y += (b.targetY - b.y) * Math.min(1, 4.0 * dt);

      if (b.life <= 0) {
        this.bubbles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const b of this.bubbles) {
      const progress = 1 - b.life / b.maxLife;
      const alpha = b.life < 0.35 ? Math.max(0, b.life / 0.35) : 1.0;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(b.x, b.y);
      ctx.scale(b.popScale, b.popScale);

      // Measure text for adaptive 80s arcade bubble sizing
      ctx.font = "bold 11px 'Bungee', 'Impact', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const metrics = ctx.measureText(b.text);
      const textWidth = metrics.width;
      const paddingX = 14;
      const paddingY = 8;
      const bubbleW = textWidth + paddingX * 2;
      const bubbleH = 24 + paddingY;
      const halfW = bubbleW / 2;
      const halfH = bubbleH / 2;

      // Colors based on speaker
      let bgColor = '#ffffff';
      let borderColor = '#000000';
      let textColor = '#000000';
      let accentColor = '#ffea00';

      if (b.speakerType === 'playerAwakened') {
        bgColor = '#fffde7';
        borderColor = '#ff6f00';
        textColor = '#bf360c';
        accentColor = '#ffea00';
      } else if (b.speakerType === 'zombieGroan') {
        bgColor = '#1b2e1b';
        borderColor = '#76ff03';
        textColor = '#ccff90';
        accentColor = '#00e676';
      } else if (b.speakerType === 'darkLord') {
        bgColor = '#1a0006';
        borderColor = '#ff0033';
        textColor = '#ff5252';
        accentColor = '#ff1744';
      }

      // 1. Drop shadow (80s thick black comic shadow)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-halfW + 4, -halfH + 4, bubbleW, bubbleH, 6) : ctx.fillRect(-halfW + 4, -halfH + 4, bubbleW, bubbleH);
      ctx.fill();

      // 2. Main Bubble Body
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-halfW, -halfH, bubbleW, bubbleH, 6) : ctx.fillRect(-halfW, -halfH, bubbleW, bubbleH);
      ctx.fill();
      ctx.stroke();

      // 3. Comic Bubble Tail pointing down to speaker's head
      ctx.beginPath();
      ctx.moveTo(-6, halfH - 1);
      ctx.lineTo(0, halfH + 9);
      ctx.lineTo(8, halfH - 1);
      ctx.fillStyle = bgColor;
      ctx.fill();
      // Tail Outline
      ctx.beginPath();
      ctx.moveTo(-7, halfH);
      ctx.lineTo(0, halfH + 9);
      ctx.lineTo(9, halfH);
      ctx.stroke();

      // 4. 80s Manga Action Corner Accents
      ctx.fillStyle = accentColor;
      ctx.fillRect(-halfW + 3, -halfH + 3, 4, 4);
      ctx.fillRect(halfW - 7, -halfH + 3, 4, 4);

      // 5. Speech Text
      ctx.fillStyle = textColor;
      ctx.fillText(b.text, 0, 0);

      ctx.restore();
    }
  }
}

export const speech = new SpeechBubbleManager();
