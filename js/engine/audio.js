class SoundEngine {
  constructor() {
	 this.ctx = null;
	 this.enabled = true;
	 this.bgmPlaying = false;
	 this.bgmTempo = 120;
	 this.bgmTimer = null;
	 this.bgmStep = 0;
	 this.bgmNextStepTime = 0;
	 this.bgmDucked = false;
	 this.musicAct = 1;
	 this.actTranspose = 1.0;
	 this.actBaseTempo = 120;
	 this.intensity = 0;
	 this.masterGain = null;
	 this.compressor = null;
	 this.sfxGain = null;
	 this.bgmGain = null;
	 this.noiseBuffer = null;
  }
  init() {
	 if (this.ctx) return;
	 try {
		const AudioContext = window.AudioContext || window.webkitAudioContext;
		this.ctx = new AudioContext();
		this.masterGain = this.ctx.createGain();
		this.masterGain.gain.setValueAtTime(this.enabled ? 0.7 : 0.0, this.ctx.currentTime);
		this.compressor = this.ctx.createDynamicsCompressor();
		this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
		this.compressor.knee.setValueAtTime(24, this.ctx.currentTime);
		this.compressor.ratio.setValueAtTime(5, this.ctx.currentTime);
		this.compressor.attack.setValueAtTime(0.004, this.ctx.currentTime);
		this.compressor.release.setValueAtTime(0.18, this.ctx.currentTime);
		this.masterGain.connect(this.compressor);
		this.compressor.connect(this.ctx.destination);
		this.sfxGain = this.ctx.createGain();
		this.sfxGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
		this.sfxGain.connect(this.masterGain);
		this.bgmGain = this.ctx.createGain();
		this.bgmGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
		this.bgmGain.connect(this.masterGain);
		const bufferSize = Math.max(1024, this.ctx.sampleRate * 2);
		this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
		const output = this.noiseBuffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i++) {
		  output[i] = Math.random() * 2 - 1;
		}
		this.startBGM();
	 } catch (e) {
		console.warn('Web Audio API not supported or blocked:', e);
	 }
  }
  toggleAudio() {
	 return this.setEnabled(!this.enabled);
  }
  setEnabled(value) {
	 this.enabled = value !== false;
	 if (this.masterGain && this.ctx) {
		try {
		  this.masterGain.gain.setValueAtTime(this.enabled ? 0.7 : 0.0, this.ctx.currentTime);
		} catch (e) {}
	 }
	 return this.enabled;
  }
  resume() {
	 if (this.ctx && this.ctx.state === 'suspended') {
		try {
		  this.ctx.resume();
		} catch (e) {}
	 }
  }
  playPunch(type = 'light') {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		if (type === 'heavy') {
		  osc.type = 'triangle';
		  osc.frequency.setValueAtTime(240, t);
		  osc.frequency.linearRampToValueAtTime(35, t + 0.16);
		  gain.gain.setValueAtTime(0.85, t);
		  gain.gain.linearRampToValueAtTime(0, t + 0.18);
		  this.createNoiseBurst(0.09, 0.5, 900);
		} else {
		  osc.type = 'sine';
		  osc.frequency.setValueAtTime(340, t);
		  osc.frequency.linearRampToValueAtTime(70, t + 0.08);
		  gain.gain.setValueAtTime(0.6, t);
		  gain.gain.linearRampToValueAtTime(0, t + 0.09);
		  this.createNoiseBurst(0.04, 0.25, 1400);
		}
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.2);
	 } catch (e) {}
  }
  playFinisherImpact() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(160, t);
		osc.frequency.linearRampToValueAtTime(25, t + 0.28);
		gain.gain.setValueAtTime(0.9, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.3);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.32);
		this.createNoiseBurst(0.16, 0.5, 650);
	 } catch (e) {}
  }
  playWhoosh() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(450, t);
		osc.frequency.linearRampToValueAtTime(140, t + 0.12);
		gain.gain.setValueAtTime(0.2, t);
		gain.gain.linearRampToValueAtTime(0.4, t + 0.04);
		gain.gain.linearRampToValueAtTime(0, t + 0.12);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.14);
	 } catch (e) {}
  }
  playSlash() {
	 if (!this.enabled || !this.ctx) return;
	 this.createNoiseBurst(0.12, 0.45, 1400);
	 this.playWhoosh();
  }
  playSpeechChirp() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'square';
		const baseFreq = 950 + Math.random() * 450;
		osc.frequency.setValueAtTime(baseFreq, t);
		osc.frequency.linearRampToValueAtTime(baseFreq * 1.5, t + 0.03);
		gain.gain.setValueAtTime(0.18, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.04);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.045);
	 } catch (e) {}
  }
  playFlashStep() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(1400, t);
		osc.frequency.exponentialRampToValueAtTime(280, t + 0.12);
		gain.gain.setValueAtTime(0.35, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.14);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.15);
		this.playWhoosh();
	 } catch (e) {}
  }
  playBassDrop() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'triangle';
		osc.frequency.setValueAtTime(150, t);
		osc.frequency.exponentialRampToValueAtTime(35, t + 0.35);
		gain.gain.setValueAtTime(0.65, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.38);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.4);
	 } catch (e) {}
  }
  playGrabThrow() {
	 if (!this.enabled || !this.ctx) return;
	 this.playWhoosh();
	 this.createNoiseBurst(0.15, 0.5, 900);
  }
  playMouseClick() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'square';
		osc.frequency.setValueAtTime(1800, t);
		osc.frequency.linearRampToValueAtTime(600, t + 0.025);
		gain.gain.setValueAtTime(0.4, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.03);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.035);
	 } catch (e) {}
  }
  playWindowsError() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const chord = [261.63, 311.13, 392.00, 523.25];
		chord.forEach((freq) => {
		  const osc = this.ctx.createOscillator();
		  const gain = this.ctx.createGain();
		  osc.type = 'triangle';
		  osc.frequency.setValueAtTime(freq, t);
		  gain.gain.setValueAtTime(0.2, t);
		  gain.gain.linearRampToValueAtTime(0, t + 0.45);
		  osc.connect(gain);
		  gain.connect(this.sfxGain);
		  osc.start(t);
		  osc.stop(t + 0.5);
		});
	 } catch (e) {}
  }
  playRecycleBinDelete() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.createNoiseBurst(0.2, 0.5, 2200);
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(800, t);
		osc.frequency.linearRampToValueAtTime(80, t + 0.22);
		gain.gain.setValueAtTime(0.35, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.24);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.26);
	 } catch (e) {}
  }
  playDoorUnlock() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const arpeggio = [329.63, 440.00, 554.37, 659.25, 880.00];
		arpeggio.forEach((freq, i) => {
		  const startT = t + i * 0.05;
		  const osc = this.ctx.createOscillator();
		  const gain = this.ctx.createGain();
		  osc.type = 'sine';
		  osc.frequency.setValueAtTime(freq, startT);
		  gain.gain.setValueAtTime(0.25, startT);
		  gain.gain.linearRampToValueAtTime(0, startT + 0.35);
		  osc.connect(gain);
		  gain.connect(this.sfxGain);
		  osc.start(startT);
		  osc.stop(startT + 0.38);
		});
	 } catch (e) {}
  }
  playDoorEnter() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(200, t);
		osc.frequency.linearRampToValueAtTime(1200, t + 0.35);
		gain.gain.setValueAtTime(0.1, t);
		gain.gain.linearRampToValueAtTime(0.5, t + 0.2);
		gain.gain.linearRampToValueAtTime(0, t + 0.4);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.45);
		this.createNoiseBurst(0.3, 0.35, 1500);
	 } catch (e) {}
  }
  playLand() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'triangle';
		osc.frequency.setValueAtTime(110, t);
		osc.frequency.linearRampToValueAtTime(35, t + 0.07);
		gain.gain.setValueAtTime(0.3, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.08);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.1);
	 } catch (e) {}
  }
  playWallKick() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'triangle';
		osc.frequency.setValueAtTime(420, t);
		osc.frequency.linearRampToValueAtTime(160, t + 0.08);
		gain.gain.setValueAtTime(0.35, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.09);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.1);
		this.createNoiseBurst(0.04, 0.25, 2500);
	 } catch (e) {}
  }
  playSkid() {
	 if (!this.enabled || !this.ctx) return;
	 this.createNoiseBurst(0.08, 0.2, 3000);
  }
  playPlayerHurt() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(260, t);
		osc.frequency.linearRampToValueAtTime(90, t + 0.12);
		gain.gain.setValueAtTime(0.45, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.14);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.16);
	 } catch (e) {}
  }
  playPlayerEffort() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'triangle';
		osc.frequency.setValueAtTime(280 + Math.random() * 80, t);
		osc.frequency.linearRampToValueAtTime(180, t + 0.06);
		gain.gain.setValueAtTime(0.15, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.07);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.08);
	 } catch (e) {}
  }
  playRunnerScreech() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(600, t);
		osc.frequency.linearRampToValueAtTime(850, t + 0.08);
		osc.frequency.linearRampToValueAtTime(400, t + 0.18);
		gain.gain.setValueAtTime(0.3, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.2);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.22);
	 } catch (e) {}
  }
  playAcidSizzle() {
	 if (!this.enabled || !this.ctx) return;
	 this.createNoiseBurst(0.18, 0.3, 3800);
  }
  playSpitterSpit() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(180, t);
		osc.frequency.linearRampToValueAtTime(450, t + 0.08);
		gain.gain.setValueAtTime(0.35, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.1);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.12);
	 } catch (e) {}
  }
  playBruteStomp() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(90, t);
		osc.frequency.linearRampToValueAtTime(20, t + 0.3);
		gain.gain.setValueAtTime(0.85, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.35);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.38);
		this.createNoiseBurst(0.18, 0.5, 400);
	 } catch (e) {}
  }
  playBossRoar() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		const filter = this.ctx.createBiquadFilter();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(65, t);
		osc.frequency.linearRampToValueAtTime(110, t + 0.3);
		osc.frequency.linearRampToValueAtTime(35, t + 0.8);
		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(450, t);
		gain.gain.setValueAtTime(0.75, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.9);
		osc.connect(filter);
		filter.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.95);
		this.createNoiseBurst(0.4, 0.45, 300);
	 } catch (e) {}
  }
  playInkPickup() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const notes = [523.25, 659.25, 783.99, 1046.50];
		const note = notes[Math.floor(Math.random() * notes.length)];
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(note, t);
		gain.gain.setValueAtTime(0.25, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.18);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.2);
	 } catch (e) {}
  }
  playLaserZap() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.createNoiseBurst(0.08, 0.4, 2800);
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(900, t);
		osc.frequency.linearRampToValueAtTime(200, t + 0.08);
		gain.gain.setValueAtTime(0.35, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.09);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.1);
	 } catch (e) {}
  }
  playComboMilestone(count) {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const chord = [392.00, 493.88, 587.33, 783.99];
		chord.forEach((freq, i) => {
		  const startT = t + i * 0.04;
		  const osc = this.ctx.createOscillator();
		  const gain = this.ctx.createGain();
		  osc.type = 'triangle';
		  osc.frequency.setValueAtTime(freq, startT);
		  gain.gain.setValueAtTime(0.3, startT);
		  gain.gain.linearRampToValueAtTime(0, startT + 0.35);
		  osc.connect(gain);
		  gain.connect(this.sfxGain);
		  osc.start(startT);
		  osc.stop(startT + 0.38);
		});
	 } catch (e) {}
  }
  playZombieGroan() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sawtooth';
		const startFreq = 80 + Math.random() * 30;
		osc.frequency.setValueAtTime(startFreq, t);
		osc.frequency.linearRampToValueAtTime(startFreq - 25, t + 0.3);
		gain.gain.setValueAtTime(0.2, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.35);
		const filter = this.ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(400, t);
		osc.connect(filter);
		filter.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.4);
	 } catch (e) {}
  }
  playZombieDeath() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.createNoiseBurst(0.18, 0.35, 600);
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'triangle';
		osc.frequency.setValueAtTime(140, t);
		osc.frequency.linearRampToValueAtTime(30, t + 0.2);
		gain.gain.setValueAtTime(0.35, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.22);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.25);
	 } catch (e) {}
  }
  playJump() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(160, t);
		osc.frequency.linearRampToValueAtTime(380, t + 0.12);
		gain.gain.setValueAtTime(0.25, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.13);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.14);
	 } catch (e) {}
  }
  playDodge() {
	 if (!this.enabled || !this.ctx) return;
	 this.createNoiseBurst(0.1, 0.2, 800);
  }
  playBlockPlace() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'square';
		osc.frequency.setValueAtTime(200, t);
		osc.frequency.linearRampToValueAtTime(60, t + 0.09);
		gain.gain.setValueAtTime(0.25, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.1);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.12);
	 } catch (e) {}
  }
  playAnvilHit() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc1 = this.ctx.createOscillator();
		const osc2 = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc1.type = 'sine';
		osc1.frequency.setValueAtTime(880, t);
		osc1.frequency.linearRampToValueAtTime(440, t + 0.4);
		osc2.type = 'triangle';
		osc2.frequency.setValueAtTime(1320, t);
		osc2.frequency.linearRampToValueAtTime(660, t + 0.3);
		gain.gain.setValueAtTime(0.5, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.45);
		osc1.connect(gain);
		osc2.connect(gain);
		gain.connect(this.sfxGain);
		osc1.start(t);
		osc2.start(t);
		osc1.stop(t + 0.5);
		osc2.stop(t + 0.5);
		this.createNoiseBurst(0.1, 0.35);
	 } catch (e) {}
  }
  playAwakening() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(150, t);
		osc.frequency.linearRampToValueAtTime(900, t + 0.8);
		gain.gain.setValueAtTime(0.1, t);
		gain.gain.linearRampToValueAtTime(0.6, t + 0.6);
		gain.gain.linearRampToValueAtTime(0, t + 1.1);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 1.2);
	 } catch (e) {}
  }
  playLaserBeam() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(700, t);
		osc.frequency.linearRampToValueAtTime(250, t + 0.35);
		gain.gain.setValueAtTime(0.45, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.4);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.45);
		this.createNoiseBurst(0.25, 0.25, 2000);
	 } catch (e) {}
  }
  playWaveStart() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const notes = [261.63, 329.63, 392.00, 523.25];
		notes.forEach((freq, i) => {
		  const startT = t + i * 0.08;
		  const osc = this.ctx.createOscillator();
		  const gain = this.ctx.createGain();
		  osc.type = 'triangle';
		  osc.frequency.setValueAtTime(freq, startT);
		  gain.gain.setValueAtTime(0, startT);
		  gain.gain.linearRampToValueAtTime(0.35, startT + 0.02);
		  gain.gain.linearRampToValueAtTime(0, startT + 0.26);
		  osc.connect(gain);
		  gain.connect(this.sfxGain);
		  osc.start(startT);
		  osc.stop(startT + 0.28);
		});
	 } catch (e) {}
  }
  playUpgradeBuy() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(440, t);
		osc.frequency.setValueAtTime(659.25, t + 0.08);
		osc.frequency.setValueAtTime(880, t + 0.16);
		gain.gain.setValueAtTime(0.35, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.35);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.4);
	 } catch (e) {}
  }
  playDarkBladeSlash() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(600, t);
		osc.frequency.linearRampToValueAtTime(120, t + 0.14);
		gain.gain.setValueAtTime(0.6, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.16);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.18);
		this.createNoiseBurst(0.12, 0.4, 3200);
	 } catch (e) {}
  }
  playTeleportZap() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'square';
		osc.frequency.setValueAtTime(950, t);
		osc.frequency.linearRampToValueAtTime(150, t + 0.12);
		gain.gain.setValueAtTime(0.45, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.14);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.15);
		this.createNoiseBurst(0.08, 0.3, 4000);
	 } catch (e) {}
  }
  playViraBotSpawn() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(320, t);
		osc.frequency.linearRampToValueAtTime(750, t + 0.1);
		osc.frequency.linearRampToValueAtTime(240, t + 0.2);
		gain.gain.setValueAtTime(0.4, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.22);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.25);
	 } catch (e) {}
  }
  playDoomLaserCharge() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'triangle';
		osc.frequency.setValueAtTime(100, t);
		osc.frequency.linearRampToValueAtTime(800, t + 0.7);
		gain.gain.setValueAtTime(0.1, t);
		gain.gain.linearRampToValueAtTime(0.7, t + 0.65);
		gain.gain.linearRampToValueAtTime(0, t + 0.8);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.85);
	 } catch (e) {}
  }
  playDoomLaserFire() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(350, t);
		osc.frequency.linearRampToValueAtTime(120, t + 0.5);
		gain.gain.setValueAtTime(0.85, t);
		gain.gain.linearRampToValueAtTime(0, t + 0.6);
		osc.connect(gain);
		gain.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + 0.65);
		this.createNoiseBurst(0.5, 0.5, 1200);
	 } catch (e) {}
  }
  playBossVictoryFanfare() {
	 if (!this.enabled || !this.ctx) return;
	 try {
		this.resume();
		const t = this.ctx.currentTime;
		const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
		notes.forEach((freq, i) => {
		  const startT = t + i * 0.12;
		  const osc = this.ctx.createOscillator();
		  const gain = this.ctx.createGain();
		  osc.type = 'triangle';
		  osc.frequency.setValueAtTime(freq, startT);
		  gain.gain.setValueAtTime(0.4, startT);
		  gain.gain.linearRampToValueAtTime(0, startT + 0.45);
		  osc.connect(gain);
		  gain.connect(this.sfxGain);
		  osc.start(startT);
		  osc.stop(startT + 0.5);
		});
	 } catch (e) {}
  }
  createNoiseBurst(duration = 0.1, volume = 0.3, filterFreq = 1000, destination = null, when = null) {
	 if (!this.ctx || !this.enabled || !this.noiseBuffer) return;
	 try {
		const whiteNoise = this.ctx.createBufferSource();
		whiteNoise.buffer = this.noiseBuffer;
		whiteNoise.loop = true;
		const filter = this.ctx.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.value = filterFreq;
		filter.Q.value = 1.0;
		const gain = this.ctx.createGain();
		const t = Number.isFinite(when) ? when : this.ctx.currentTime;
		gain.gain.setValueAtTime(volume, t);
		gain.gain.linearRampToValueAtTime(0, t + duration);
		whiteNoise.connect(filter);
		filter.connect(gain);
		gain.connect(destination || this.sfxGain);
		whiteNoise.start(t, Math.random() * 1.5);
		whiteNoise.stop(t + duration);
	 } catch (e) {}
  }
  startBGM() {
	 if (this.bgmPlaying || !this.ctx) return;
	 this.bgmPlaying = true;
	 this.bgmStep = 0;
	 this.bgmNextStepTime = this.ctx.currentTime + 0.06;
	 const LOOKAHEAD = 0.12;
	 const scheduler = () => {
		if (!this.bgmPlaying || !this.ctx) return;
		if (typeof document !== 'undefined' && document.hidden) {
		  this.bgmNextStepTime = this.ctx.currentTime + 0.06;
		  return;
		}
		while (this.bgmNextStepTime < this.ctx.currentTime + LOOKAHEAD) {
		  this.playBGMStep(this.bgmStep, this.bgmNextStepTime);
		  this.bgmStep = (this.bgmStep + 1) % 32;
		  const tempo = Math.max(80, this.bgmTempo);
		  this.bgmNextStepTime += (60 / tempo) / 4;
		}
	 };
	 this.bgmTimer = setInterval(scheduler, 25);
	 scheduler();
  }
  stopBGM() {
	 this.bgmPlaying = false;
	 if (this.bgmTimer) {
		clearInterval(this.bgmTimer);
		this.bgmTimer = null;
	 }
  }
  setBGMDucked(ducked) {
	 this.bgmDucked = ducked === true;
	 if (this.bgmGain && this.ctx) {
		try {
		  const t = this.ctx.currentTime;
		  this.bgmGain.gain.cancelScheduledValues(t);
		  this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, t);
		  this.bgmGain.gain.linearRampToValueAtTime(this.bgmDucked ? 0.07 : 0.35, t + 0.3);
		} catch (e) {}
	 }
  }
  setWhiteVoid(on) {
	 this.whiteVoidMode = on === true;
  }
  setMusicAct(act) {
	 const settings = { 1: [0, 120], 2: [3, 128], 3: [5, 136], 4: [-2, 132] }[act] || [0, 120];
	 this.musicAct = act;
	 this.actTranspose = Math.pow(2, settings[0] / 12);
	 this.actBaseTempo = settings[1];
	 this.bgmTempo = this.actBaseTempo + Math.floor(this.intensity * 18);
  }
  setIntensity(level) {
	 this.intensity = Math.max(0, Math.min(1, level));
	 this.bgmTempo = this.actBaseTempo + Math.floor(this.intensity * 18);
  }
  playBGMStep(step, when = null) {
	 if (!this.enabled || !this.ctx || this.ctx.state === 'suspended') return;
	 try {
		const t = Number.isFinite(when) ? when : this.ctx.currentTime;
		if (this.whiteVoidMode) {
		  if (step % 8 === 0) this.synthesizeDrum('kick', t, 0.3);
		  if (step % 16 === 0) this.synthesizeSynthNote(55 * this.actTranspose, t, 1.6, 'sine', 0.1);
		  return;
		}
		if (step % 4 === 0) {
		  this.synthesizeDrum('kick', t);
		}
		if (step % 8 === 4) {
		  this.synthesizeDrum('snare', t);
		}
		if (step % 2 === 0) {
		  this.synthesizeDrum('hihat', t, step % 4 === 2 ? 0.2 : 0.1);
		}
		const bassScale = [65.41, 73.42, 77.78, 87.31, 98.00, 110.0];
		if (step % 2 === 0) {
		  const noteIdx = (Math.floor(step / 4) + (step % 8 === 0 ? 0 : 2)) % bassScale.length;
		  const freq = bassScale[noteIdx] * this.actTranspose;
		  this.synthesizeSynthNote(freq, t, 0.15, 'sawtooth', 0.18);
		}
		if (this.intensity > 0.3 && step % 2 === 1) {
		  const arpNotes = [261.63, 311.13, 392.0, 523.25, 622.25, 784.0];
		  const leadFreq = arpNotes[(step * 3) % arpNotes.length] * this.actTranspose;
		  this.synthesizeSynthNote(leadFreq, t, 0.08, 'triangle', 0.12 * this.intensity);
		}
	 } catch (e) {}
  }
  synthesizeDrum(type, t, customGain = 0.35) {
	 try {
		if (type === 'kick') {
		  const osc = this.ctx.createOscillator();
		  const gain = this.ctx.createGain();
		  osc.type = 'sine';
		  osc.frequency.setValueAtTime(140, t);
		  osc.frequency.linearRampToValueAtTime(35, t + 0.1);
		  gain.gain.setValueAtTime(customGain, t);
		  gain.gain.linearRampToValueAtTime(0, t + 0.12);
		  osc.connect(gain);
		  gain.connect(this.bgmGain);
		  osc.start(t);
		  osc.stop(t + 0.14);
		} else if (type === 'snare') {
		  this.createNoiseBurst(0.1, customGain * 0.7, 1800, this.bgmGain, t);
		  const osc = this.ctx.createOscillator();
		  const gain = this.ctx.createGain();
		  osc.type = 'triangle';
		  osc.frequency.setValueAtTime(180, t);
		  osc.frequency.linearRampToValueAtTime(70, t + 0.08);
		  gain.gain.setValueAtTime(customGain * 0.5, t);
		  gain.gain.linearRampToValueAtTime(0, t + 0.09);
		  osc.connect(gain);
		  gain.connect(this.bgmGain);
		  osc.start(t);
		  osc.stop(t + 0.1);
		} else if (type === 'hihat') {
		  this.createNoiseBurst(0.03, customGain * 0.35, 7000, this.bgmGain, t);
		}
	 } catch (e) {}
  }
  synthesizeSynthNote(freq, t, duration, type = 'sawtooth', volume = 0.18) {
	 try {
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		const filter = this.ctx.createBiquadFilter();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t);
		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(800 + this.intensity * 1200, t);
		gain.gain.setValueAtTime(volume, t);
		gain.gain.linearRampToValueAtTime(0, t + duration);
		osc.connect(filter);
		filter.connect(gain);
		gain.connect(this.bgmGain);
		osc.start(t);
		osc.stop(t + duration + 0.02);
	 } catch (e) {}
  }
}
export const audio = new SoundEngine();