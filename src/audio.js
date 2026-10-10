/**
 * Procedural Web Audio API sound effects generator for EVAC.OS
 * Zero external audio assets required.
 */
class EvacAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.humNode = null;
    this.humGain = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  }

  toggle() {
    this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.startAmbientHum();
      this.playChime(660, 0.15, 'sine');
    } else {
      this.stopAmbientHum();
    }
    return this.enabled;
  }

  startAmbientHum() {
    if (!this.ctx || !this.enabled) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A hum

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.018, this.ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      this.humNode = osc;
      this.humGain = gain;
    } catch (e) {
      console.warn('Hum audio error:', e);
    }
  }

  stopAmbientHum() {
    if (this.humNode) {
      try {
        this.humGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        setTimeout(() => {
          this.humNode?.stop();
          this.humNode = null;
        }, 100);
      } catch (e) {}
    }
  }

  playHazardAlert() {
    if (!this.ctx || !this.enabled) return;
    try {
      const now = this.ctx.currentTime;
      // Dual tone descending emergency klaxon
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(440, now + 0.25);
      osc2.frequency.setValueAtTime(920, now);
      osc2.frequency.exponentialRampToValueAtTime(460, now + 0.25);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.3);
      osc2.stop(now + 0.3);
    } catch (e) {}
  }

  playRerouteSuccess() {
    if (!this.ctx || !this.enabled) return;
    try {
      const now = this.ctx.currentTime;
      // Futuristic ascending chime (vector lock)
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);

        gain.gain.setValueAtTime(0.04, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + i * 0.05 + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.22);
      });
    } catch (e) {}
  }

  playEvacuateBlip() {
    if (!this.ctx || !this.enabled) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.06);

      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }

  playChime(freq = 440, dur = 0.1, type = 'sine') {
    if (!this.ctx || !this.enabled) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch (e) {}
  }
}

export const audioEngine = new EvacAudioEngine();
