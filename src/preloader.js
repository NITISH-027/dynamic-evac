/**
 * Safe high-concurrency image preloader for continuous 227-frame playback array.
 */
export class FramePreloader {
  constructor(urls, { onProgress, onStatus, concurrency = 12 } = {}) {
    this.urls = urls;
    this.total = urls.length;
    this.onProgress = onProgress || (() => {});
    this.onStatus = onStatus || (() => {});
    this.concurrency = concurrency;
    this.loadedImages = new Array(this.total).fill(null);
    this.loadedCount = 0;
    this.errorCount = 0;
    this.isAborted = false;
  }

  load() {
    return new Promise((resolve) => {
      let currentIndex = 0;
      let activeJobs = 0;
      const total = this.total;

      const checkFinish = () => {
        if (this.loadedCount + this.errorCount >= total || this.isAborted) {
          this.onProgress(100, total, total);
          this.onStatus('[SIMULATION READY - ENGAGING TELEMETRY]');
          resolve(this.loadedImages);
        }
      };

      const launchNext = () => {
        if (this.isAborted) return;
        while (activeJobs < this.concurrency && currentIndex < total) {
          const index = currentIndex++;
          activeJobs++;
          this.loadImage(index).then(() => {
            activeJobs--;
            this.loadedCount++;
            const pct = Math.floor((this.loadedCount / total) * 100);
            this.onProgress(pct, this.loadedCount, total);
            checkFinish();
            launchNext();
          }).catch(() => {
            activeJobs--;
            this.errorCount++;
            checkFinish();
            launchNext();
          });
        }
      };

      launchNext();
    });
  }

  loadImage(index) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this.loadedImages[index] = img;
        resolve(img);
      };
      img.onerror = () => {
        // Retry once
        const retry = new Image();
        retry.onload = () => {
          this.loadedImages[index] = retry;
          resolve(retry);
        };
        retry.onerror = () => {
          console.warn(`Failed to load frame ${index}: ${this.urls[index]}`);
          // Provide placeholder or mirror neighbor if available
          this.loadedImages[index] = this.loadedImages[Math.max(0, index - 1)] || null;
          reject(new Error(`Failed ${index}`));
        };
        retry.src = this.urls[index];
      };
      img.src = this.urls[index];
    });
  }

  abortAndProceed() {
    this.isAborted = true;
  }
}
