// Weapons, special tools, and animator gadgets

export class WeaponManager {
  constructor() {
    this.pencilSharpness = 1;
    this.staffRadiusBonus = 0;
    this.anvilDamage = 150;
    this.laserPower = 1;
  }

  // Get active weapon stats
  getWeaponStats(type, level = 1) {
    switch (type) {
      case 'pencil':
        return {
          name: 'Animator Giant Pencil',
          damage: 35 * this.pencilSharpness,
          range: 85,
          knockback: 450,
          slashArc: Math.PI * 0.85,
          cooldown: 0.38
        };
      case 'staff':
        return {
          name: 'Fighting Stick Staff',
          damage: 28,
          range: 95 + this.staffRadiusBonus,
          knockback: 550,
          slashArc: Math.PI * 1.5,
          cooldown: 0.32
        };
      case 'eraser':
        return {
          name: 'Giant Eraser',
          damage: 60,
          range: 70,
          knockback: 600,
          slashArc: Math.PI * 0.6,
          cooldown: 0.5
        };
      default:
        return {
          name: 'Fists',
          damage: 15,
          range: 55,
          knockback: 300,
          cooldown: 0.22
        };
    }
  }
}

export const weapons = new WeaponManager();
