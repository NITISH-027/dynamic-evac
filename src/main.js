/**
 * EVAC.OS Main Coordinator - Progressive Instant Unlock
 *
 * Architecture:
 * - Phase 1: Preload only first 15 frames -> render frame 0 immediately -> unlock UI in ~1.5s.
 * - Phase 2: Stream remaining frames 15..226 in background using concurrency limiter & idle callbacks.
 * - Lenis Smooth Scroll + Virtual Lerp Dampening (0.09) + Cinema Hotkeys.
 */
import { FRAME_URLS } from './framesManifest.js';
import { ProgressiveFrameLoader } from './preloader.js';
import { ScrollytellingEngine } from './scrollytelling.js';
import { EvacuationSandbox } from './sandbox.js';
import { audioEngine } from './audio.js';

window.addEventListener('DOMContentLoaded', () => {
  const preloaderEl = document.getElementById('cyber-preloader');
  const statusTextEl = document.getElementById('loader-status-text');
  const barFillEl = document.getElementById('loader-bar-fill');
  const frameCountEl = document.getElementById('loader-frame-count');
  const btnSkipPreloader = document.getElementById('btn-skip-preloader');
  const logStreamEl = document.getElementById('loader-log-stream');
  const cinemaToastEl = document.getElementById('cinema-toast');

  const scrollyCanvas = document.getElementById('scrolly-canvas');
  const scrollyContainer = document.getElementById('scrolly-container');
  let scrollytelling = null;

  // Immediate draw helper for Frame 0
  const drawInitialFrame = (img) => {
    if (!scrollyCanvas || !img) return;
    const ctx = scrollyCanvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    scrollyCanvas.width = Math.floor(window.innerWidth * dpr);
    scrollyCanvas.height = Math.floor(window.innerHeight * dpr);

    const cw = scrollyCanvas.width;
    const ch = scrollyCanvas.height;
    const iw = img.naturalWidth || 1920;
    const ih = img.naturalHeight || 1080;
    const scale = Math.max(cw / iw, ch / ih);
    const nw = iw * scale;
    const nh = ih * scale;
    const ox = (cw - nw) / 2;
    const oy = (ch - nh) / 2;
    ctx.drawImage(img, ox, oy, nw, nh);
  };

  // Instantiate Progressive Frame Loader (Phase 1: 15 critical frames)
  const loader = new ProgressiveFrameLoader(FRAME_URLS, {
    criticalCount: 15,
    concurrency: 8, // 8 parallel streams with proximity priority
    onFrameZeroLoaded: (frame0) => {
      // Immediately draw frame 0 onto canvas
      drawInitialFrame(frame0);
      if (logStreamEl) {
        logStreamEl.innerHTML += '<div>> FIRST FRAME DECODED & MOUNTED TO CANVAS</div>';
      }
    },
    onCriticalProgress: (pct, loaded, total) => {
      if (statusTextEl) {
        statusTextEl.textContent = `[INITIALIZING SYSTEM... ${pct}%]`;
      }
      if (barFillEl) {
        barFillEl.style.width = `${pct}%`;
      }
      if (frameCountEl) {
        frameCountEl.textContent = `${loaded} / ${total} BUFFER`;
      }
    },
    onCriticalReady: (images) => {
      // Phase 1 Complete (Instant 1.5s Unlock)
      if (statusTextEl) {
        statusTextEl.textContent = `[SYSTEM READY • BACKGROUND STREAMING]`;
      }
      if (barFillEl) {
        barFillEl.style.width = '100%';
      }

      // Smoothly dismiss preloader
      setTimeout(() => {
        preloaderEl?.classList.add('fade-out');
      }, 300);

      // Mount Scrollytelling Engine with active streaming images array & priority loader hook
      if (!scrollytelling) {
        scrollytelling = new ScrollytellingEngine(scrollyCanvas, scrollyContainer, images, {
          loader: loader
        });
      }
    },
    onFrameLoaded: (index) => {
      // Instantly upgrade any active fallback frame on canvas
      scrollytelling?.onFrameLoaded(index);
    },
    onBackgroundProgress: (totalLoaded, total) => {
      // Background streaming status (silent & non-blocking)
      if (logStreamEl && totalLoaded === 50) {
        logStreamEl.innerHTML += '<div>> 50 FRAMES STREAMED IN BACKGROUND</div>';
      } else if (logStreamEl && totalLoaded === 125) {
        logStreamEl.innerHTML += '<div>> ACT 3 VECTOR LAYER STREAMED IN BACKGROUND</div>';
      } else if (logStreamEl && totalLoaded === 227) {
        logStreamEl.innerHTML += '<div>> ALL 227 CONTINUOUS FRAMES BUFFERED</div>';
      }
    }
  });

  // Skip button allows immediate bypass
  btnSkipPreloader?.addEventListener('click', () => {
    loader.abortAndUnlock();
  });

  // Start Phase 1 progressive loading
  loader.start();

  // Initialize ACT 4 Interactive Sandbox
  const sandboxCanvas = document.getElementById('sandbox-canvas');
  const sandbox = new EvacuationSandbox(sandboxCanvas);

  // Smooth scroll to sandbox via Lenis
  const scrollToSandbox = () => {
    if (scrollytelling?.lenis) {
      scrollytelling.lenis.scrollTo('#sandbox', { duration: 1.2 });
    } else {
      const sandboxEl = document.getElementById('sandbox');
      sandboxEl?.scrollIntoView({ behavior: 'smooth' });
    }
    audioEngine.playRerouteSuccess();
  };

  const btnJumpSandbox = document.getElementById('btn-jump-sandbox');
  const btnEngageSandboxHero = document.getElementById('btn-engage-sandbox-hero');
  btnJumpSandbox?.addEventListener('click', scrollToSandbox);
  btnEngageSandboxHero?.addEventListener('click', scrollToSandbox);

  // Cinema Mode Toggle Functionality
  let toastTimer = null;
  const showToast = (text) => {
    if (!cinemaToastEl) return;
    cinemaToastEl.textContent = text;
    cinemaToastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      cinemaToastEl.classList.remove('show');
    }, 2400);
  };

  const toggleCinemaMode = () => {
    const isCinema = document.body.classList.toggle('cinema-mode-active');
    if (isCinema) {
      showToast('CINEMA MODE ACTIVE • PRESS [C] TO RESTORE HUD');
      audioEngine.playChime(660, 0.12, 'sine');
    } else {
      showToast('CINEMA MODE DEACTIVATED • HUD RESTORED');
      audioEngine.playChime(440, 0.12, 'sine');
    }
  };

  // Sandbox Mode Switch Buttons
  const btnModeStatic = document.getElementById('btn-mode-static');
  const btnModeDynamic = document.getElementById('btn-mode-dynamic');

  btnModeStatic?.addEventListener('click', () => {
    sandbox.setMode('static');
    btnModeStatic.classList.add('active');
    btnModeDynamic.classList.remove('active');
  });

  btnModeDynamic?.addEventListener('click', () => {
    sandbox.setMode('dynamic');
    btnModeDynamic.classList.add('active');
    btnModeStatic.classList.remove('active');
  });

  // Sandbox Action Controls
  const btnSpawnHazard = document.getElementById('btn-spawn-hazard');
  const btnClearHazards = document.getElementById('btn-clear-hazards');
  const btnResetSim = document.getElementById('btn-reset-sim');
  const btnToggleVectors = document.getElementById('btn-toggle-vectors');
  const labelToggleVectors = document.getElementById('label-toggle-vectors');
  const occupantSlider = document.getElementById('occupant-slider');
  const sliderOccupantVal = document.getElementById('slider-occupant-val');

  btnSpawnHazard?.addEventListener('click', () => {
    sandbox.spawnRandomHazard();
  });

  btnClearHazards?.addEventListener('click', () => {
    sandbox.clearHazards();
  });

  btnResetSim?.addEventListener('click', () => {
    sandbox.resetSimulation();
    audioEngine.playChime(580, 0.12, 'sine');
  });

  btnToggleVectors?.addEventListener('click', () => {
    sandbox.toggleVectors();
    const isVisible = sandbox.showVectors;
    btnToggleVectors.classList.toggle('active-toggle', isVisible);
    if (labelToggleVectors) {
      labelToggleVectors.textContent = isVisible ? 'VECTORS: VISIBLE' : 'VECTORS: HIDDEN';
    }
  });

  occupantSlider?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (sliderOccupantVal) sliderOccupantVal.textContent = val;
    sandbox.setOccupantCount(val);
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'KeyC' || e.code === 'KeyH') {
      e.preventDefault();
      toggleCinemaMode();
    } else if (e.code === 'KeyS') {
      e.preventDefault();
      scrollToSandbox();
    } else if (e.code === 'Space') {
      e.preventDefault();
      if (scrollytelling) {
        const isPlaying = scrollytelling.togglePlay(1);
        showToast(isPlaying ? 'AUTOPLAY: ENGAGED' : 'AUTOPLAY: PAUSED');
      }
    } else if (e.code === 'KeyM') {
      if (sandbox.mode === 'static') {
        btnModeDynamic?.click();
      } else {
        btnModeStatic?.click();
      }
    } else if (e.code === 'KeyR') {
      btnResetSim?.click();
    }
  });
});
