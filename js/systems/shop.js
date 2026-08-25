// Upgrade Shop and Animator Workshop System

import { combat } from './combat.js?v=8.7';
import { audio } from '../engine/audio.js?v=8.7';
import { allies } from '../entities/allies.js?v=8.7';
import { weapons } from '../entities/weapons.js?v=8.7';
import { particles } from '../engine/particles.js?v=8.7';

export class ShopSystem {
  constructor() {
    this.upgrades = [
      {
        id: 'max_hp',
        name: 'Max Health',
        icon: '❤️',
        desc: 'Increases maximum HP by +25 and heals to full.',
        level: 0,
        maxLevel: 5,
        baseCost: 25,
        costMultiplier: 1.6,
        apply: (player) => {
          player.maxHp += 25;
          player.hp = player.maxHp;
        }
      },
      {
        id: 'damage',
        name: 'Martial Power',
        icon: '⚔️',
        desc: 'Boosts all punches, kicks, and weapon attacks by +20%.',
        level: 0,
        maxLevel: 5,
        baseCost: 35,
        costMultiplier: 1.7,
        apply: (player) => {
          player.damageMultiplier += 0.20;
        }
      },
      {
        id: 'speed',
        name: 'Agility & Speed',
        icon: '👟',
        desc: 'Adds +40 sprint speed and +35 jump force per level.',
        level: 0,
        maxLevel: 4,
        baseCost: 20,
        costMultiplier: 1.5,
        apply: (player) => {
          player.speed += 40;
          player.jumpForce += 35;
        }
      },
      {
        id: 'super_charge',
        name: 'Awakening Affinity',
        icon: '⚡',
        desc: 'Fills the God Mode Awakening meter +25% faster on hits.',
        level: 0,
        maxLevel: 4,
        baseCost: 40,
        costMultiplier: 1.8,
        apply: (player) => {
          player.superGainRate += 0.25;
        }
      },
      {
        id: 'lifesteal',
        name: 'Ink Recharge',
        icon: '✒️',
        desc: 'Recycles 6% of strike damage into Orange’s health.',
        level: 0,
        maxLevel: 3,
        baseCost: 60,
        costMultiplier: 2.0,
        apply: (player) => {
          player.lifesteal += 0.06;
        }
      },
      {
        id: 'anvil_power',
        name: 'Heavy Iron Anvil',
        icon: '🔨',
        desc: 'Increases dropped anvil damage and shockwave radius by +40%.',
        level: 0,
        maxLevel: 3,
        baseCost: 45,
        costMultiplier: 1.7,
        apply: (player) => {
          weapons.anvilDamage += 75;
        }
      },
      {
        id: 'grab_mastery',
        name: "Executioner's Rhythm",
        icon: '🤼',
        desc: 'Shortens the Grab & Throw cooldown by 0.75s per level.',
        level: 0,
        maxLevel: 3,
        baseCost: 90,
        costMultiplier: 1.8,
        apply: (player) => {
          player.grabCooldownMax = Math.max(2.75, (player.grabCooldownMax ?? 5.0) - 0.75);
        }
      },
      {
        id: 'ink_battery',
        name: 'Ink Battery',
        icon: '🔋',
        desc: 'Converts 150 Ink into +35% Awakening meter, right now.',
        level: 0,
        maxLevel: 99,
        baseCost: 150,
        costMultiplier: 1.0,
        apply: (player) => {
          player.addSuper?.(35);
        }
      },
      {
        id: 'ally_synergy',
        name: 'Stick Squad Synergy',
        icon: '👥',
        desc: 'Cuts Red, Blue, Yellow, and Green return timers by 25%. The Animator Cursor keeps its own pace.',
        level: 0,
        maxLevel: 3,
        baseCost: 50,
        costMultiplier: 1.8,
        apply: () => {
          // Floors chosen so every synergy level buys a real reduction.
          allies.maxCooldowns.red = Math.max(4, allies.maxCooldowns.red * 0.75);
          allies.maxCooldowns.blue = Math.max(5, allies.maxCooldowns.blue * 0.75);
          allies.maxCooldowns.yellow = Math.max(8, allies.maxCooldowns.yellow * 0.75);
          allies.maxCooldowns.green = Math.max(5, allies.maxCooldowns.green * 0.75);
        }
      }
    ];
  }

  reset() {
    for (const upgrade of this.upgrades) upgrade.level = 0;
    weapons.reset();
  }

  getCost(upgrade) {
    return Math.round(upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.level));
  }

  buyUpgrade(id, player) {
    const up = this.upgrades.find(u => u.id === id);
    if (!up || up.level >= up.maxLevel) return false;

    const cost = this.getCost(up);
    if (combat.spendInk(cost)) {
      up.level++;
      up.apply(player);
      audio.playUpgradeBuy();
      particles.addDamageText(player.x, player.y - 50, `${up.name} UPGRADED!`, true, '#ffea00');
      this.onPurchase?.();
      this.renderShopUI(player);
      return true;
    }
    return false;
  }

  renderShopUI(player) {
    const container = document.getElementById('upgrades-container');
    const inkDisplay = document.getElementById('shop-ink-display');
    if (inkDisplay) inkDisplay.innerText = combat.ink;
    if (!container) return;

    container.innerHTML = '';

    for (const up of this.upgrades) {
      const isMaxed = up.level >= up.maxLevel;
      const cost = this.getCost(up);
      const canAfford = combat.ink >= cost;

      const card = document.createElement('div');
      card.className = 'upgrade-card';

      card.innerHTML = `
        <div>
          <div class="upgrade-card-header">
            <div class="upgrade-icon">${up.icon}</div>
            <div class="upgrade-name">${up.name}</div>
          </div>
          <div class="upgrade-desc">${up.desc}</div>
        </div>
        <div>
          <div class="upgrade-level">
            ${up.maxLevel === 1 ? (isMaxed ? 'UNLOCKED' : 'LOCKED') : `Level: ${up.level} / ${up.maxLevel}`}
          </div>
          <button class="upgrade-btn" id="btn-buy-${up.id}" ${isMaxed || !canAfford ? 'disabled' : ''}>
            <span>${isMaxed ? 'MAX LEVEL' : 'UPGRADE'}</span>
            <span>${isMaxed ? '✓' : `${cost} ✒️`}</span>
          </button>
        </div>
      `;

      container.appendChild(card);

      const btn = card.querySelector(`#btn-buy-${up.id}`);
      if (btn && !isMaxed) {
        btn.addEventListener('click', () => {
          this.buyUpgrade(up.id, player);
        });
      }
    }
  }
}

export const shop = new ShopSystem();
