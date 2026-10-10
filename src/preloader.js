/**
 * Progressive Priority Frame Loader for EVAC.OS
 *
 * Phase 1 (Critical Buffer):
 * - Loads the first 15 frames (0..14).
 * - Immediately renders frame 0 as soon as it arrives.
 * - Resolves ready promise as soon as all 15 critical frames load (~1.5s).
 *
 * Phase 2 (Background Streaming Queue):
 * - Streams frames 15 to 226 in the background using a concurrency limiter (4–6 requests).
 * - Leverages requestIdleCallback/async scheduling to prevent network/main-thread choking.
 */
export class ProgressiveFrameLoader {
  constructor(urls, {
    criticalCount = 15,
    concurrency = 5,
    onFrameZeroLoaded,
    onCriticalProgress,
    onCriticalReady,
    onBackgroundProgress
  } = {}) {
    this.urls = urls;
    this.total = urls.length;
    this.criticalCount = Math.min(criticalCount, this.total);
    this.concurrency = concurrency;

    this.images = new Array(this.total).fill(null);
    this.isCriticalDone = false;
    this.criticalLoaded = 0;
    this.totalLoaded = 0;

    this.onFrameZeroLoaded = onFrameZeroLoaded || (() => {});
    this.onCriticalProgress = onCriticalProgress || (() => {});
    this.onCriticalReady = onCriticalReady || (() => {});
    this.onBackgroundProgress = onBackgroundProgress || (() => {});

    this.backgroundQueue = [];
    for (let i = this.criticalCount; i < this.total; i++) {
      this.backgroundQueue.push(i);
    }
  }

  loadImage(index) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this.images[index] = img;
        this.totalLoaded++;
        resolve(img);
      };
      img.onerror = () => {
        // Retry once on failure
        const retry = new Image();
        retry.onload = () => {
          this.images[index] = retry;
          this.totalLoaded++;
          resolve(retry);
        };
        retry.onerror = () => {
          console.warn(`Failed loading frame ${index}: ${this.urls[index]}`);
          // Reuse neighbor if network failed
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
            // PHASE 2: Start Background Streaming Queue (15 to 226)
            // ----------------------------------------------------
            this.startBackgroundStreaming();
          }
        });
      }
    });
  }

  startBackgroundStreaming() {
    const runWorker = () => {
      if (this.backgroundQueue.length === 0) return;
      const nextIndex = this.backgroundQueue.shift();
      this.loadImage(nextIndex).then(() => {
        this.onBackgroundProgress(this.totalLoaded, this.total);

        // Schedule next download without blocking user scroll interaction
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(() => runWorker(), { timeout: 100 });
        } else {
          setTimeout(runWorker, 12);
        }
      });
    };

    // Spawn 4-6 parallel workers
    const workersCount = Math.min(this.concurrency, this.backgroundQueue.length);
    for (let w = 0; w < workersCount; w++) {
      runWorker();
    }
  }

  abortAndUnlock() {
    if (!this.isCriticalDone) {
      this.isCriticalDone = true;
      this.onCriticalReady(this.images);
      this.startBackgroundStreaming();
    }
  }
}
