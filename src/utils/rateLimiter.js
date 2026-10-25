// ============================================================
// D-CONNECT In-Memory Rate Limiter
// Phong chong spam tin nhan, spam go phim va brute-force ma phong
// ============================================================

class MemoryRateLimiter {
  constructor() {
    this.buckets = new Map(); // Map<key, Array<timestamp>>
    // Tu dong don dep moi 5 phut
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  /**
   * Kiem tra xem hanh dong co vuot qua tan suat cho phep khong
   * @param {string} key Dinh danh hanh dong (vd: `msg:${clientId}`, `join:${ip}`)
   * @param {number} maxCount So lan toi da
   * @param {number} windowMs Cua so thoi gian (ms)
   * @returns {{ allowed: boolean, retryAfterMs: number }}
   */
  check(key, maxCount, windowMs) {
    const now = Date.now();
    let timestamps = this.buckets.get(key) || [];

    // Loai bo cac timestamp cu ngoai cua so thoi gian
    timestamps = timestamps.filter((t) => now - t < windowMs);

    if (timestamps.length >= maxCount) {
      const oldest = timestamps[0];
      const retryAfterMs = Math.max(0, windowMs - (now - oldest));
      return { allowed: false, retryAfterMs };
    }

    timestamps.push(now);
    this.buckets.set(key, timestamps);
    return { allowed: true, retryAfterMs: 0 };
  }

  reset(key) {
    this.buckets.delete(key);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.buckets.entries()) {
      const valid = timestamps.filter((t) => now - t < 60000);
      if (valid.length === 0) {
        this.buckets.delete(key);
      } else {
        this.buckets.set(key, valid);
      }
    }
  }

  destroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.buckets.clear();
  }
}

// Export singleton instance
module.exports = new MemoryRateLimiter();
