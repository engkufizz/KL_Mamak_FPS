/**
 * AudioManager - 100% Procedural Web Audio API sound generator.
 * Zero external audio files required: guarantees instant load, zero 404s,
 * dynamic responsive audio with real-time parametric synthesis.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.ambientGain = null;
    this.rainSource = null;
    this.rainGain = null;
    this.heartbeatOsc = null;
    this.heartbeatGain = null;
    this.noiseBuffers = new Map();
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.65, this.ctx.currentTime);
    this.ambientGain.connect(this.masterGain);

    this.initMonsoonRain();
    this.initialized = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Generate white noise audio buffer (with caching to avoid runtime allocations)
  createNoiseBuffer(duration = 1.0) {
    if (!this.ctx) return null;
    const durKey = Math.round(duration * 100) / 100;
    if (this.noiseBuffers.has(durKey)) {
      return this.noiseBuffers.get(durKey);
    }
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffers.set(durKey, buffer);
    return buffer;
  }

  // Continuous monsoon rain generator (filtered pink/white noise with modulation)
  initMonsoonRain() {
    if (!this.ctx) return;
    const noiseBuffer = this.createNoiseBuffer(4.0);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // Dual-stage filters to simulate heavy tropical rain roaring against zinc roofs & asphalt
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(1400, this.ctx.currentTime);

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(280, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

    noiseSource.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(this.rainGain);
    this.rainGain.connect(this.ambientGain);

    noiseSource.start();
    this.rainSource = noiseSource;
  }

  // Atmospheric thunderclap synced with lightning flash
  playThunder(distance = 1.0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = 2.5 + Math.random() * 1.5;

    // Sub-bass rumble oscillator
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + dur);

    const oscFilter = this.ctx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.setValueAtTime(120, t);
    oscFilter.frequency.exponentialRampToValueAtTime(45, t + dur);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.001, t);
    oscGain.gain.linearRampToValueAtTime(0.7 / distance, t + 0.08);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(this.ambientGain);

    osc.start(t);
    osc.stop(t + dur);

    // Crack and rolling noise
    const noiseBuffer = this.createNoiseBuffer(dur);
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(180, t);
    noiseFilter.Q.setValueAtTime(1.8, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(60, t + dur);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, t);
    noiseGain.gain.linearRampToValueAtTime(0.55 / distance, t + 0.12);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ambientGain);

    noise.start(t);
    noise.stop(t + dur);
  }

  // Gun 1: Bullpup AR / SMG - Fast, punchy, mechanical crack
  playBullpupShoot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Bass punch
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.8, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);

    // Snappy muzzle crack (filtered noise)
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.18);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, t);
    filter.Q.setValueAtTime(1.2, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.18);

    // Mechanical bolt click
    this.playMechanicalClick(t + 0.05, 900, 0.25, 0.04);
  }

  // Gun 2: Tactical Pump-Action Shotgun - Heavy kickback boom
  playShotgunShoot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Sub-bass heavy thump
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.35);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(1.2, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.4);

    // Massive noise blast
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.45);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.4);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.3, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.45);
  }

  // Shotgun pump rack sound: Clack-Chick
  playShotgunPump() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Slide back
    this.playMechanicalClick(t + 0.02, 1100, 0.6, 0.07);
    this.playMechanicalClick(t + 0.04, 750, 0.5, 0.08);
    // Shell eject hiss
    this.playFoleyScrape(t + 0.08, 0.09);
    // Slide forward
    this.playMechanicalClick(t + 0.28, 1400, 0.7, 0.06);
    this.playMechanicalClick(t + 0.30, 950, 0.8, 0.09);
  }

  // Gun 3: Heavy Marksman Rifle (Cyber-DMR) - Loud supersonic whip + heavy chamber
  playDMRShoot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // High velocity crack
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.3);

    const oscFilter = this.ctx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.setValueAtTime(1800, t);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(1.1, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.35);

    // Supersonic sonic boom crack
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.38);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3600, t);
    filter.frequency.exponentialRampToValueAtTime(800, t + 0.28);
    filter.Q.setValueAtTime(2.2, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.2, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.4);

    // Cyber optic charge whine / bolt reset
    this.playMechanicalClick(t + 0.12, 1600, 0.4, 0.05);
  }

  // Helper mechanical metallic click
  playMechanicalClick(time, freq, gain, duration) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, time + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(600, time);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  playFoleyScrape(time, duration) {
    if (!this.ctx) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2800, time);
    filter.Q.setValueAtTime(3.0, time);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);

    noise.start(time);
    noise.stop(time + duration);
  }

  // Empty magazine click
  playEmptyClick() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.playMechanicalClick(t, 2400, 0.5, 0.04);
  }

  // Tactical reload sequence (Mag release, mag insert, bolt slide)
  playReloadSound(weaponType = 'bullpup') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Mag drop
    this.playMechanicalClick(t + 0.1, 1200, 0.6, 0.08);
    this.playMechanicalClick(t + 0.18, 600, 0.5, 0.06);

    // Mag slap in
    const slapDelay = weaponType === 'shotgun' ? 0.6 : 0.85;
    this.playMechanicalClick(t + slapDelay, 850, 0.7, 0.09);
    this.playMechanicalClick(t + slapDelay + 0.05, 1600, 0.8, 0.07);

    // Bolt release / chamber
    const boltDelay = weaponType === 'shotgun' ? 1.1 : 1.35;
    this.playMechanicalClick(t + boltDelay, 1900, 0.75, 0.08);
    this.playMechanicalClick(t + boltDelay + 0.04, 1100, 0.9, 0.11);
  }

  // Weapon switch click
  playSwitchWeapon() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.playMechanicalClick(t, 1800, 0.45, 0.06);
    this.playMechanicalClick(t + 0.07, 1300, 0.55, 0.08);
  }

  // Hitmarker feedback: Distinct bodymark vs headshot chime (Call of Duty feel)
  playHitmarker(isHeadshot = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    if (isHeadshot) {
      // Crisp high-frequency kill chime
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2200, t);
      osc.frequency.linearRampToValueAtTime(2800, t + 0.04);
      osc.frequency.exponentialRampToValueAtTime(1600, t + 0.22);

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(4400, t);
      osc2.frequency.exponentialRampToValueAtTime(2400, t + 0.18);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.7, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(g);
      osc2.connect(g);
      g.connect(this.sfxGain);

      osc.start(t);
      osc2.start(t);
      osc.stop(t + 0.26);
      osc2.stop(t + 0.26);
    } else {
      // Snappy body hit tick
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1500, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.045);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.65, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(g);
      g.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.055);
    }
  }

  // Footstep splashing in wet puddles
  playFootstep(inPuddle = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = 0.08;

    // Slap / tap
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(inPuddle ? 220 : 140, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + dur);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.25, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur);

    // Water squish / splash noise
    if (inPuddle) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(0.12);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, t);
      filter.Q.setValueAtTime(2.0, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);
      noise.start(t);
      noise.stop(t + 0.13);
    }
  }

  // Destructible mamak prop impact (plastic stool hollow crack or metal thud)
  playPropImpact(isMetal = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = 0.16;

    const osc = this.ctx.createOscillator();
    osc.type = isMetal ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(isMetal ? 800 : 280, t);
    osc.frequency.exponentialRampToValueAtTime(isMetal ? 300 : 90, t + dur);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur);
  }

  // Enemy sound effects
  playEnemyAlert() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.linearRampToValueAtTime(480, t + 0.15);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.35);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, t);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  playEnemyAttack() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.2);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700, t);
    filter.Q.setValueAtTime(1.5, t);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.22);
  }

  playEnemyDeath() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  playPlayerHurt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Thump
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.25);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  // Wave start horn / gong
  playWaveHorn(waveNumber) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const freqs = [130.81, 164.81, 196.00]; // C minor triad
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, t);
      filter.frequency.exponentialRampToValueAtTime(200, t + 1.6);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.1 + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 1.85);
    });
  }
}
