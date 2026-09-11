export class GameState {
  constructor(audioManager) {
    this.audioManager = audioManager;

    this.maxHealth = 100;
    this.health = 100;
    this.maxShield = 50;
    this.shield = 50;
    this.shieldRegenDelay = 4.0;
    this.shieldTimer = 0;

    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.wave = 1;
    this.enemiesRemaining = 0;

    // Combo system
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboMultiplier = 1;

    // Damage vignette & heartbeat
    this.damageVignette = 0.0;
    this.isDead = false;
  }

  reset() {
    this.health = this.maxHealth;
    this.shield = this.maxShield;
    this.shieldTimer = 0;
    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.wave = 1;
    this.enemiesRemaining = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboMultiplier = 1;
    this.damageVignette = 0.0;
    this.isDead = false;
  }

  applyDamage(amount) {
    if (this.isDead) return;

    this.damageVignette = Math.min(1.0, this.damageVignette + 0.45);
    this.shieldTimer = 0; // reset regen timer

    // Shield absorbs first
    if (this.shield > 0) {
      if (this.shield >= amount) {
        this.shield -= amount;
        amount = 0;
      } else {
        amount -= this.shield;
        this.shield = 0;
      }
    }

    if (amount > 0) {
      this.health = Math.max(0, this.health - amount);
      if (this.audioManager) {
        this.audioManager.playPlayerHurt();
      }
    }

    if (this.health <= 0) {
      this.isDead = true;
    }
  }

  recordKill(isHeadshot = false, scoreVal = 100) {
    this.kills++;
    if (isHeadshot) this.headshots++;

    // Combo streak logic
    this.comboCount++;
    this.comboTimer = 3.5;
    this.comboMultiplier = Math.min(4, 1 + Math.floor(this.comboCount / 3));

    const finalPoints = scoreVal * this.comboMultiplier * (isHeadshot ? 1.5 : 1.0);
    this.score += Math.round(finalPoints);

    return {
      combo: this.comboCount,
      multiplier: this.comboMultiplier
    };
  }

  update(delta) {
    // Shield regeneration
    if (!this.isDead && this.shield < this.maxShield) {
      this.shieldTimer += delta;
      if (this.shieldTimer >= this.shieldRegenDelay) {
        this.shield = Math.min(this.maxShield, this.shield + 20.0 * delta);
      }
    }

    // Decay damage vignette
    if (this.damageVignette > 0) {
      this.damageVignette = Math.max(0, this.damageVignette - 1.8 * delta);
    }

    // Decay combo
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboMultiplier = 1;
      }
    }
  }

  getLowHealthFactor() {
    if (this.health <= 30 && !this.isDead) {
      return (30 - this.health) / 30;
    }
    return 0.0;
  }
}
