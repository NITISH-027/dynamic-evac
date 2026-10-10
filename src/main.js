/**
 * EVAC.OS Main Coordinator - Cinema-First Experience
 * Integrates Preloader, Scrollytelling, Sandbox, Audio, and Cinema Hotkeys.
 */
import { FRAME_URLS } from './framesManifest.js';
import { FramePreloader } from './preloader.js';
import { ScrollytellingEngine } from './scrollytelling.js';
import { EvacuationSandbox } from './sandbox.js';
import { audioEngine } from './audio.js';

window.addEventListener('DOMContentLoaded', async () => {
  const preloaderEl = document.getElementById('cyber-preloader');
  const statusTextEl = document.getElementById('loader-status-text');
  const barFillEl = document.getElementById('loader-bar-fill');
  const frameCountEl = document.getElementById('loader-frame-count');
  const btnSkipPreloader = document.getElementById('btn-skip-preloader');
  const logStreamEl = document.getElementById('loader-log-stream');
  const cinemaToastEl = document.getElementById('cinema-toast');

  // Preloader instance
  const preloader = new FramePreloader(FRAME_URLS, {
    concurrency: 12,
    onProgress: (pct, loaded, total) => {
      if (statusTextEl) {
        statusTextEl.textContent = `[INITIALIZING EVAC SIMULATION... ${pct}%]`;
      }
      if (barFillEl) {
        barFillEl.style.width = `${pct}%`;
      }
      if (frameCountEl) {
        frameCountEl.textContent = `${String(loaded).padStart(3, '0')} / ${total}`;
      }

      // Show skip button after 20% if on slow connections
      if (pct >= 20 && btnSkipPreloader) {
        btnSkipPreloader.style.display = 'inline-flex';
      }

      // Dynamic log lines
      if (logStreamEl) {
        if (pct === 30) {
          logStreamEl.innerHTML += '<div>> BLUEPRINT LAYER VERIFIED (ACT 1: 83 FRAMES)</div>';
        } else if (pct === 70) {
          logStreamEl.innerHTML += '<div>> DYNAMIC REROUTE VECTORS MOUNTED (ACT 2: 144 FRAMES)</div>';
        } else if (pct >= 99) {
          logStreamEl.innerHTML += '<div>> ALL 227 CONTINUOUS FRAMES BUFFERED IN GPU MEMORY</div>';
        }
      }
    },
    onStatus: (msg) => {
      if (statusTextEl) statusTextEl.textContent = msg;
    }
  });

  // Allow bypass
  btnSkipPreloader?.addEventListener('click', () => {
    preloader.abortAndProceed();
  });

  // Start preloading
  const images = await preloader.load();

  // Fade out preloader
  setTimeout(() => {
    preloaderEl?.classList.add('fade-out');
  }, 400);

  // Initialize Scrollytelling Engine
  const scrollyCanvas = document.getElementById('scrolly-canvas');
  const scrollyContainer = document.getElementById('scrolly-container');
  const scrollytelling = new ScrollytellingEngine(scrollyCanvas, scrollyContainer, images);

  // Initialize ACT 4 Interactive Sandbox
  const sandboxCanvas = document.getElementById('sandbox-canvas');
  const sandbox = new EvacuationSandbox(sandboxCanvas);

  // Smooth scroll to sandbox via Lenis
  const scrollToSandbox = () => {
    if (scrollytelling.lenis) {
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

  // Keyboard Shortcuts:
  // [C] or [H]: Toggle Cinema Mode (Hides all UI overlays)
  // [S]: Jump to Live Simulation Sandbox
  // [Space]: Toggle cinematic autoplay
  // [M]: Toggle Static / Dynamic mode in sandbox
  // [R]: Reset simulation occupants
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
      const isPlaying = scrollytelling.togglePlay(1);
      showToast(isPlaying ? 'AUTOPLAY: ENGAGED' : 'AUTOPLAY: PAUSED');
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
