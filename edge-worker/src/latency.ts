export class LatencyTracker {
  private readonly start = performance.now();

  now(): number {
    return performance.now();
  }

  elapsedSince(start: number): number {
    return Math.max(0, performance.now() - start);
  }

  total(): number {
    return Math.max(0, performance.now() - this.start);
  }
}
