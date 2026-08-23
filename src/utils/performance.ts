/**
 * Surakshit Vault Performance Telemetry & Instrumentation Engine
 * Tracks startup time, search latency, detail rendering, and crypto throughput.
 */

interface PerformanceMetric {
  name: string;
  durationMs: number;
  timestamp: number;
}

class PerformanceTracker {
  private marks: Map<string, number> = new Map();
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_HISTORY = 50;

  startMeasure(label: string): void {
    if (typeof performance !== 'undefined' && performance.now) {
      this.marks.set(label, performance.now());
    }
  }

  endMeasure(label: string): number {
    if (typeof performance === 'undefined' || !performance.now) return 0;
    const start = this.marks.get(label);
    if (start === undefined) return 0;

    const duration = Math.round((performance.now() - start) * 100) / 100;
    this.marks.delete(label);

    this.metrics.push({
      name: label,
      durationMs: duration,
      timestamp: Date.now(),
    });

    if (this.metrics.length > this.MAX_HISTORY) {
      this.metrics.shift();
    }

    return duration;
  }

  getLatestMetric(label: string): number | null {
    for (let i = this.metrics.length - 1; i >= 0; i--) {
      if (this.metrics[i].name === label) {
        return this.metrics[i].durationMs;
      }
    }
    return null;
  }

  getAllAverages(): Record<string, { avgMs: number; count: number }> {
    const map: Record<string, { total: number; count: number }> = {};
    for (const m of this.metrics) {
      if (!map[m.name]) {
        map[m.name] = { total: 0, count: 0 };
      }
      map[m.name].total += m.durationMs;
      map[m.name].count += 1;
    }

    const result: Record<string, { avgMs: number; count: number }> = {};
    for (const [k, v] of Object.entries(map)) {
      result[k] = {
        avgMs: Math.round((v.total / v.count) * 100) / 100,
        count: v.count,
      };
    }
    return result;
  }
}

export const perfTracker = new PerformanceTracker();
