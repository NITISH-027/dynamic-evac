/**
 * Scrollytelling Canvas Engine
 * Features:
 * 1. Calibrated Track Height (20px/frame = ~4540px track)
 * 2. Virtual Dampening (Lerp / Smooth Scrub with LERP_FACTOR = 0.09)
 * 3. Lenis Smooth Scroll Integration (for notched mouse wheels on Windows/Webkit)
 * 4. Smooth Subtitle Opacity Fade (zero pops, analog crossfade)
 * 5. Proximity Priority Preloading & Dynamic Fallback Replacement (instant Act 3 frame paint)
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
    this.loader = options.loader || null;

    // Calibration: ~20px per frame gives ~4.5s deliberate scrub across 227 frames
    this.PIXELS_PER_FRAME = 20;
    this.scrollDistance = (this.totalFrames - 1) * this.PIXELS_PER_FRAME;

    // Physics State
    this.targetFrame = 0;
    this.currentFrame = 0;
    this.lastRenderedFrame = -1;
    this.renderedImageIndex = -1;
    this.isDisplayingFallback = false;
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
    this.actIndicator = document.getElementById('hud-act-indicator');
    this.btnFramingToggle = document.getElementById('btn-framing-toggle');

    // Mobile Responsive Framing: 'fit' ensures 100% full blueprint visibility on vertical screens
    this.framingMode = 'fit';
    if (this.btnFramingToggle) {
      this.btnFramingToggle.addEventListener('click', () => {
        this.framingMode = this.framingMode === 'fit' ? 'fill' : 'fit';
        const label = this.btnFramingToggle.querySelector('span');
        if (label) {
          label.textContent = this.framingMode === 'fit' ? 'FIT 16:9' : 'FILL SCREEN';
        }
        if (this.lastRenderedFrame >= 0) {
          this.drawCover(this.lastRenderedFrame);
        }
      });
    }

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
   * Initialize Lenis Smooth Scroll with mobile-tailored touch physics
   */
  initLenis() {
    const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 768 || window.matchMedia('(pointer: coarse)').matches);

    this.lenis = new Lenis({
      duration: isMobile ? 0.85 : 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // smooth exponential deceleration
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: isMobile ? 0.95 : 1.2,
      smoothTouch: false, // Let native touch inertia handle micro-gestures smoothly
    });

    this.lenis.on('scroll', () => {
      if (!this.isPlaying) {
        this.updateScrollTarget();
      }
    });
  }

  /**
   * Calibrate Track Height to Frame Count
   * With 227 frames:
   * Desktop: (227 - 1) * 20px = ~4520px
   * Mobile: (227 - 1) * 18px = ~4068px (balanced for standard mobile thumb swipe distance)
   */
  calibrateTrackHeight() {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    this.PIXELS_PER_FRAME = isMobile ? 18 : 20;
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
    this.loader?.setPriorityIndex(this.targetFrame);
  }

  seekToFrame(frameIndex, syncScroll = false) {
    this.targetFrame = Math.max(0, Math.min(this.totalFrames - 1, frameIndex));
    this.currentFrame = this.targetFrame;
    this.loader?.setPriorityIndex(this.targetFrame);

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
   * Called whenever a background frame finishes downloading
   * If currently showing a fallback frame, immediately upgrade to the real frame!
   */
  onFrameLoaded(loadedIndex) {
    const currentTarget = Math.round(this.currentFrame);
    if (
      loadedIndex === currentTarget ||
      (this.isDisplayingFallback && Math.abs(loadedIndex - currentTarget) < Math.abs(this.renderedImageIndex - currentTarget))
    ) {
      this.drawCover(currentTarget);
    }
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
        this.loader?.setPriorityIndex(this.targetFrame);
      }

      const diff = this.targetFrame - this.currentFrame;

      // Only update and redraw canvas if there is visible movement
      if (Math.abs(diff) > 0.01) {
        this.currentFrame += diff * this.LERP_FACTOR;

        const frameIndex = Math.min(
          this.totalFrames - 1,
          Math.max(0, Math.round(this.currentFrame))
        );

        if (frameIndex !== this.lastRenderedFrame || this.isDisplayingFallback) {
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
        if (frameIndex !== this.lastRenderedFrame || this.isDisplayingFallback) {
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
    let actualIndex = frameIndex;

    // Smart Proximity Fallback (Zero Blank Canvas)
    if (!img || !img.complete || img.naturalWidth === 0) {
      // 1. Search backwards for nearest loaded frame
      for (let i = frameIndex - 1; i >= 0; i--) {
        if (this.images[i]?.complete && this.images[i].naturalWidth > 0) {
          img = this.images[i];
          actualIndex = i;
          break;
        }
      }

      // 2. Search forwards if backwards search yielded nothing
      if (!img) {
        for (let i = frameIndex + 1; i < this.totalFrames; i++) {
          if (this.images[i]?.complete && this.images[i].naturalWidth > 0) {
            img = this.images[i];
            actualIndex = i;
            break;
          }
        }
      }

      // 3. Ultimate fallback: last successfully rendered image or frame 0
      if (!img) {
        img = this.lastDrawnImg || this.images[0];
        actualIndex = 0;
      }
    }

    if (!img || !img.complete || img.naturalWidth === 0) return;
    this.lastDrawnImg = img;
    this.renderedImageIndex = actualIndex;
    this.isDisplayingFallback = (actualIndex !== frameIndex);

    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const iw = img.naturalWidth || 1920;
    const ih = img.naturalHeight || 1080;

    const canvasAspect = cw / ch;
    const imgAspect = iw / ih;

    // Mobile / Portrait Framing Optimization:
    // If screen is vertical (canvasAspect < 1.18) and mode is 'fit', display 100% of the blueprint
    // so mobile visitors see all rooms, exit points, bottleneck choke, and vector reroutes!
    if (canvasAspect < 1.18 && this.framingMode === 'fit') {
      const nw = cw;
      const nh = Math.round(cw / imgAspect);
      const ox = 0;
      // Position vertically in upper-mid viewing zone to avoid colliding with bottom subtitles
      const oy = Math.round(Math.max(44 * this.dpr, (ch * 0.35) - (nh / 2)));

      // 1. Draw subtle cyber blueprint grid on letterbox margins
      this.drawCyberGridBackdrop(cw, ch, ox, oy, nw, nh);

      // 2. Draw complete 16:9 blueprint frame
      this.ctx.drawImage(img, ox, oy, nw, nh);

      // 3. Draw high-tech cyber HUD brackets & telemetry markings
      this.drawFrameHUD(ox, oy, nw, nh);
    } else {
      // Desktop / Landscape or 'fill' mode: Full viewport bleed
      const scale = Math.max(cw / iw, ch / ih);
      const nw = iw * scale;
      const nh = ih * scale;
      const ox = (cw - nw) / 2;
      const oy = (ch - nh) / 2;

      this.ctx.drawImage(img, ox, oy, nw, nh);
    }
  }

  /**
   * Draw high-tech HUD brackets and labels framing the 16:9 blueprint on mobile
   */
  drawFrameHUD(ox, oy, nw, nh) {
    const ctx = this.ctx;
    const dpr = this.dpr;

    ctx.save();
    // Frame boundary
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 1 * dpr;
    ctx.strokeRect(ox, oy, nw, nh);

    // Glowing cyan corner brackets
    const bLen = 14 * dpr;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2 * dpr;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(ox, oy + bLen);
    ctx.lineTo(ox, oy);
    ctx.lineTo(ox + bLen, oy);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(ox + nw - bLen, oy);
    ctx.lineTo(ox + nw, oy);
    ctx.lineTo(ox + nw, oy + bLen);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(ox, oy + nh - bLen);
    ctx.lineTo(ox, oy + nh);
    ctx.lineTo(ox + bLen, oy + nh);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(ox + nw - bLen, oy + nh);
    ctx.lineTo(ox + nw, oy + nh);
    ctx.lineTo(ox + nw, oy + nh - bLen);
    ctx.stroke();

    // Subtle Telemetry Stamps
    ctx.font = `600 ${9 * dpr}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.fillText('CAM-01 // FULL 16:9 BLUEPRINT', ox + 8 * dpr, oy - 6 * dpr);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.fillText('ALL EXITS & FLOW VECTORS ACTIVE', ox + nw - 8 * dpr, oy - 6 * dpr);
    ctx.textAlign = 'left';

    ctx.restore();
  }

  /**
   * Draw cybernetic grid background on mobile letterbox areas
   */
  drawCyberGridBackdrop(cw, ch, ox, oy, nw, nh) {
    const ctx = this.ctx;
    const dpr = this.dpr;

    // Background fill
    ctx.fillStyle = '#04070c';
    ctx.fillRect(0, 0, cw, ch);

    // Architectural grid pattern
    const step = 28 * dpr;
    ctx.save();
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
    ctx.lineWidth = 1 * dpr;

    // Top letterbox area
    ctx.beginPath();
    for (let x = 0; x <= cw; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, oy);
    }
    for (let y = 0; y <= oy; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
    }
    ctx.stroke();

    // Bottom letterbox area
    const bottomStart = oy + nh;
    ctx.beginPath();
    for (let x = 0; x <= cw; x += step) {
      ctx.moveTo(x, bottomStart);
      ctx.lineTo(x, ch);
    }
    for (let y = bottomStart; y <= ch; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
    }
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Smooth Subtitle Opacity Fade (No Abrupt Pops)
   * Act 1: Fade out smoothly between frame 35 and 45.
   * Act 2: Fade in frame 45–55, fade out frame 110–120.
   * Act 3: Fade in frame 120–130, fade out as Act 4 sandbox approaches (frame 210–226).
   */
  updateSubtitles(frame) {
    // Update active act indicator in top HUD
    if (this.actIndicator) {
      if (frame < 45) {
        this.actIndicator.textContent = 'ACT 01 // COMPLACENCY';
        this.actIndicator.className = 'brand-act-pill pill-cyan';
      } else if (frame < 120) {
        this.actIndicator.textContent = 'ACT 02 // THE CHOKE';
        this.actIndicator.className = 'brand-act-pill pill-red';
      } else {
        this.actIndicator.textContent = 'ACT 03 // VECTOR REROUTE';
        this.actIndicator.className = 'brand-act-pill pill-emerald';
      }
    }

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
