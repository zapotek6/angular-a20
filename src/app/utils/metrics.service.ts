import { Injectable } from '@angular/core';

export type MetricKey =
  | 'cache_hits'
  | 'cache_misses'
  | 'etag_304'
  | 'optimistic_success'
  | 'rollback';

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private counters = new Map<MetricKey, number>();

  inc(key: MetricKey, by = 1) {
    this.counters.set(key, (this.counters.get(key) ?? 0) + by);
  }

  get(key: MetricKey): number {
    return this.counters.get(key) ?? 0;
  }

  snapshot(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of this.counters.entries()) out[k] = v;
    return out;
  }

  reset() {
    this.counters.clear();
  }
}
