/**
 * Scrollytelling Canvas Engine
 * Features:
 * 1. Calibrated Track Height (20px/frame = ~4540px track)
 * 2. Virtual Dampening (Lerp / Smooth Scrub with LERP_FACTOR = 0.09)
 * 3. Lenis Smooth Scroll Integration (for notched mouse wheels on Windows/Webkit)
 * 4. Smooth Subtitle Opacity Fade (zero pops, analog crossfade)
 */
import Lenis from 'lenis';

export class ScrollytellingEngine {
  constructor(canvas, container, images, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    this.container = container;
    this.images = images;
    this.totalFrames = images.length;
    this.onFrameChange = options.onFrameChange || (() => {});

    // Calibration: ~20px per frame gives ~4.5s deliberate scrub across 227 frames
    this.PIXELS_PER_FRAME = 20;
    this.scrollDistance = (this.totalFrames - 1) * this.PIXELS_PER_FRAME;

    // Physics State
    this.targetFrame = 0;
    this.currentFrame = 0;
    this.lastRenderedFrame = -1;
    this.LERP_FACTOR = 0.09; // Ideal cinematic inertia without lag

    this.isPlaying = false;
    this.playSpeed = 1;
    this.animFrameId = null;

    // Narrative Elements
    this.act1Card = document.getElementById('hud-act1');
    this.act2Card = document.getElementById('hud-act2');
    this.act3Card = document.getElementById('hud-act3');
    this.actJumpPrompt = document.getElementById('hud-act4-jump');
    this.scrollExploreCue = document.getElementById('scroll-explore-cue');

    // 1. Initialize Lenis Smooth Scroll
    this.initLenis();

    // 2. Calibrate Track Height
    this.calibrateTrackHeight();

    // 3. Initialize Canvas & Events
    this.initCanvasSize();
    this.bindEvents();

    // 4. Initial Render
    this.drawCover(0);
    this.updateSubtitles(0);
    this.lastRenderedFrame = 0;

    // 5. Start Render Loop
    this.startLoop();
  }

  /**
   * Initialize Lenis Smooth Scroll
   */
  initLenis() {
    this.lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // smooth exponential deceleration
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
    });

    this.lenis.on('scroll', () => {
      if (!this.isPlaying) {
        this.updateScrollTarget();
      }
    });
  }

  /**
   * Calibrate Track Height to Frame Count
   * With 227 frames: (227 - 1) * 20px = 4520px scroll distance + window.innerHeight
   */
  calibrateTrackHeight() {
    this.scrollDistance = (this.totalFrames - 1) * this.PIXELS_PER_FRAME;
    this.container.style.height = `${this.scrollDistance + window.innerHeight}px`;
  }

  initCanvasSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.dpr = dpr;

    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    if (this.lastRenderedFrame >= 0) {
      this.drawCover(this.lastRenderedFrame);
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.calibrateTrackHeight();
      this.initCanvasSize();
      this.updateScrollTarget();
    });

    window.addEventListener('scroll', () => {
      if (!this.isPlaying) {
        this.updateScrollTarget();
      }
    }, { passive: true });
  }

  updateScrollTarget() {
    const rect = this.container.getBoundingClientRect();
    const scrollDist = -rect.top;

    if (this.scrollDistance <= 0) return;

    const rawProgress = scrollDist / this.scrollDistance;
    const progress = Math.max(0, Math.min(1, rawProgress));

    this.targetFrame = progress * (this.totalFrames - 1);
  }

  seekToFrame(frameIndex, syncScroll = false) {
    this.targetFrame = Math.max(0, Math.min(this.totalFrames - 1, frameIndex));
    this.currentFrame = this.targetFrame;

    if (syncScroll && this.lenis) {
      const progress = this.targetFrame / (this.totalFrames - 1);
      const targetScrollY = this.container.offsetTop + progress * this.scrollDistance;
      this.lenis.scrollTo(targetScrollY, { immediate: true });
    }
  }

  togglePlay(speed = 1) {
    this.playSpeed = speed;
    this.isPlaying = !this.isPlaying;
    return this.isPlaying;
  }

  /**
   * Virtual Dampening Render Loop with Lenis RAF & LERP_FACTOR = 0.09
   */
  startLoop() {
    const loop = (time) => {
      // Step Lenis Smooth Scroll
      if (this.lenis) {
        this.lenis.raf(time);
      }

      if (this.isPlaying) {
        this.targetFrame += this.playSpeed * 0.45;
        if (this.targetFrame >= this.totalFrames - 1) {
          this.targetFrame = this.totalFrames - 1;
          this.isPlaying = false;
        }
        const progress = this.targetFrame / (this.totalFrames - 1);
        const targetScrollY = this.container.offsetTop + progress * this.scrollDistance;
        this.lenis?.scrollTo(targetScrollY, { immediate: true });
      }

      const diff = this.targetFrame - this.currentFrame;

      // Only update and redraw canvas if there is visible movement
      if (Math.abs(diff) > 0.01) {
        this.currentFrame += diff * this.LERP_FACTOR;

        const frameIndex = Math.min(
          this.totalFrames - 1,
          Math.max(0, Math.round(this.currentFrame))
        );

        if (frameIndex !== this.lastRenderedFrame) {
          this.drawCover(frameIndex);
          this.lastRenderedFrame = frameIndex;
          this.onFrameChange(frameIndex);
        }

        // Smooth analog subtitle opacity fade (driven by floating-point currentFrame)
        this.updateSubtitles(this.currentFrame);
      } else if (this.currentFrame !== this.targetFrame) {
        // Snap to exact settled target
        this.currentFrame = this.targetFrame;
        const frameIndex = Math.min(
          this.totalFrames - 1,
          Math.max(0, Math.round(this.currentFrame))
        );
        if (frameIndex !== this.lastRenderedFrame) {
          this.drawCover(frameIndex);
          this.lastRenderedFrame = frameIndex;
          this.onFrameChange(frameIndex);
        }
        this.updateSubtitles(this.currentFrame);
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  drawCover(frameIndex) {
    let img = this.images[frameIndex];
    if (!img || !img.complete || img.naturalWidth === 0) {
      // Find nearest loaded frame to prevent any white flashing
      for (let offset = 1; offset < 20; offset++) {
        if (this.images[frameIndex - offset]?.complete) {
          img = this.images[frameIndex - offset];
          break;
        }
        if (this.images[frameIndex + offset]?.complete) {
          img = this.images[frameIndex + offset];
          break;
        }
      }
    }

    if (!img) return;

    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const iw = img.naturalWidth || 1920;
    const ih = img.naturalHeight || 1080;

    // object-fit: cover aspect ratio math
    const scale = Math.max(cw / iw, ch / ih);
    const nw = iw * scale;
    const nh = ih * scale;
    const ox = (cw - nw) / 2;
    const oy = (ch - nh) / 2;

    this.ctx.drawImage(img, ox, oy, nw, nh);
  }

  /**
   * Smooth Subtitle Opacity Fade (No Abrupt Pops)
   * Act 1: Fade out smoothly between frame 35 and 45.
   * Act 2: Fade in frame 45–55, fade out frame 110–120.
   * Act 3: Fade in frame 120–130, fade out as Act 4 sandbox approaches (frame 210–226).
   */
  updateSubtitles(frame) {
    // Act 1: [0 .. 35] solid 1.0 -> [35 .. 45] fade out to 0.0
    let op1 = 0;
    if (frame <= 35) {
      op1 = 1;
    } else if (frame < 45) {
      op1 = 1 - (frame - 35) / 10;
    }

    // Act 2: [45 .. 55] fade in to 1.0 -> [55 .. 110] solid 1.0 -> [110 .. 120] fade out to 0.0
    let op2 = 0;
    if (frame >= 45 && frame < 55) {
      op2 = (frame - 45) / 10;
    } else if (frame >= 55 && frame <= 110) {
      op2 = 1;
    } else if (frame > 110 && frame < 120) {
      op2 = 1 - (frame - 110) / 10;
    }

    // Act 3: [120 .. 130] fade in to 1.0 -> [130 .. 210] solid 1.0 -> [210 .. 226] fade out to 0.0
    let op3 = 0;
    if (frame >= 120 && frame < 130) {
      op3 = (frame - 120) / 10;
    } else if (frame >= 130 && frame <= 210) {
      op3 = 1;
    } else if (frame > 210 && frame <= 226) {
      op3 = 1 - (frame - 210) / 16;
    }

    // Jump prompt: fades in as frame reaches 210..226
    let opJump = 0;
    if (frame >= 210) {
      opJump = Math.min(1, (frame - 210) / 16);
    }

    this.applySubtitleStyle(this.act1Card, op1);
    this.applySubtitleStyle(this.act2Card, op2);
    this.applySubtitleStyle(this.act3Card, op3);
    this.applySubtitleStyle(this.actJumpPrompt, opJump);

    // Fade out scroll cue once user scrolls
    if (this.scrollExploreCue) {
      if (frame > 4 || window.scrollY > 60) {
        this.scrollExploreCue.classList.add('scrolled-out');
      } else {
        this.scrollExploreCue.classList.remove('scrolled-out');
      }
    }
  }

  applySubtitleStyle(el, op) {
    if (!el) return;
    const clamped = Math.max(0, Math.min(1, op));
    el.style.opacity = clamped.toFixed(3);
    el.style.transform = `translateY(${(1 - clamped) * 14}px)`;
    el.style.pointerEvents = clamped > 0.1 ? 'auto' : 'none';
  }

  destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.lenis) {
      this.lenis.destroy();
    }
  }
}
