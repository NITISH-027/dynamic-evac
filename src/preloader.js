/**
 * Progressive Priority Frame Loader for EVAC.OS
 *
 * Features:
 * 1. Phase 1 (Critical Buffer): Preloads first 15 frames -> draws frame 0 immediately -> unlocks in ~1.5s.
 * 2. Phase 2 (Proximity-Prioritized Streaming Queue):
 *    - Dynamically prioritizes downloading frames CLOSEST to current scroll position (setPriorityIndex).
 *    - If user scrolls to Act 3 (e.g. frame 140), it immediately prioritizes downloading Act 3 frames!
 *    - Non-blocking asynchronous worker pool (concurrency = 8) with zero scroll freezing.
 * 3. Instant Fallback Replacement: Fires onFrameLoaded callback so canvas refreshes immediately.
 */
export class ProgressiveFrameLoader {
  constructor(urls, {
    criticalCount = 15,
    concurrency = 8,
    onFrameZeroLoaded,
    onCriticalProgress,
    onCriticalReady,
    onFrameLoaded,
    onBackgroundProgress
  } = {}) {
    this.urls = urls;
    this.total = urls.length;
    this.criticalCount = Math.min(criticalCount, this.total);
    this.concurrency = concurrency;

    this.images = new Array(this.total).fill(null);
    this.loadedSet = new Set();
    this.inFlightSet = new Set();
    this.priorityIndex = 0;

    this.isCriticalDone = false;
    this.criticalLoaded = 0;
    this.totalLoaded = 0;

    this.onFrameZeroLoaded = onFrameZeroLoaded || (() => {});
    this.onCriticalProgress = onCriticalProgress || (() => {});
    this.onCriticalReady = onCriticalReady || (() => {});
    this.onFrameLoaded = onFrameLoaded || (() => {});
    this.onBackgroundProgress = onBackgroundProgress || (() => {});
  }

  /**
   * Set the current scroll frame so background loader prioritizes frames nearby
   */
  setPriorityIndex(index) {
    this.priorityIndex = Math.max(0, Math.min(this.total - 1, Math.round(index)));
  }

  getNextPriorityIndex() {
    let bestIdx = -1;
    let minDiff = Infinity;

    for (let i = 0; i < this.total; i++) {
      if (!this.loadedSet.has(i) && !this.inFlightSet.has(i)) {
        const diff = Math.abs(i - this.priorityIndex);
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = i;
          if (minDiff === 0) break;
        }
      }
    }

    return bestIdx;
  }

  loadImage(index) {
    this.inFlightSet.add(index);

    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';

      const handleSuccess = (loadedImg) => {
        this.images[index] = loadedImg;
        this.loadedSet.add(index);
        this.inFlightSet.delete(index);
        this.totalLoaded++;
        this.onFrameLoaded(index, loadedImg);
        resolve(loadedImg);
      };

      img.onload = () => handleSuccess(img);

      img.onerror = () => {
        // Retry once on failure
        const retry = new Image();
        retry.decoding = 'async';
        retry.onload = () => handleSuccess(retry);
        retry.onerror = () => {
          console.warn(`Failed loading frame ${index}: ${this.urls[index]}`);
          this.inFlightSet.delete(index);
          // Neighbor fallback
          this.images[index] = this.images[Math.max(0, index - 1)] || null;
          resolve(this.images[index]);
        };
        retry.src = this.urls[index];
      };

      img.src = this.urls[index];
    });
  }

  start() {
    return new Promise((resolveReady) => {
      // ----------------------------------------------------
      // PHASE 1: Load Critical Buffer (Frames 0 to 14)
      // ----------------------------------------------------
      let criticalRemaining = this.criticalCount;

      for (let i = 0; i < this.criticalCount; i++) {
        this.loadImage(i).then((img) => {
          if (i === 0 && img) {
            this.onFrameZeroLoaded(img);
          }

          this.criticalLoaded++;
          const pct = Math.floor((this.criticalLoaded / this.criticalCount) * 100);
          this.onCriticalProgress(pct, this.criticalLoaded, this.criticalCount);

          criticalRemaining--;
          if (criticalRemaining === 0 && !this.isCriticalDone) {
            this.isCriticalDone = true;
            this.onCriticalReady(this.images);
            resolveReady(this.images);

            // ----------------------------------------------------
            // PHASE 2: Start Proximity-Prioritized Background Queue
            // ----------------------------------------------------
            this.startBackgroundStreaming();
          }
        });
      }
    });
  }

  startBackgroundStreaming() {
    let activeWorkers = 0;

    const pumpWorker = () => {
      if (this.loadedSet.size >= this.total) return;

      while (activeWorkers < this.concurrency) {
        const nextIdx = this.getNextPriorityIndex();
        if (nextIdx === -1) break;

        activeWorkers++;
        this.loadImage(nextIdx).then(() => {
          activeWorkers--;
          this.onBackgroundProgress(this.totalLoaded, this.total);
          // Yield to event loop and immediately pick next closest frame
          setTimeout(pumpWorker, 4);
        });
      }
    };

    pumpWorker();
  }

  abortAndUnlock() {
    if (!this.isCriticalDone) {
      this.isCriticalDone = true;
      this.onCriticalReady(this.images);
      this.startBackgroundStreaming();
    }
  }
}
