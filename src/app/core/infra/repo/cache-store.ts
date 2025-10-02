import { Injectable } from '@angular/core';
import { MetricsService } from '../../../utils/metrics.service';

export interface CacheEntry<T> {
  data: T;
  etag?: string;
  expiresAt: number;
}

export type InvalidationMessage = { type: 'invalidate'; keys: string[] } | { type: 'clear'; reason?: string };

const DEFAULT_TTL = 60_000; // 60s

@Injectable({ providedIn: 'root' })
export class CacheStore {
  private cache = new Map<string, CacheEntry<any>>();
  private urlEtags = new Map<string, string>();
  private urlBodies = new Map<string, any>();
  private bc?: BroadcastChannel;

  constructor(private metrics: MetricsService) {
    if ('BroadcastChannel' in window) {
      this.bc = new BroadcastChannel('cache');
      this.bc.onmessage = (ev) => {
        const msg: InvalidationMessage = ev.data;
        if (msg?.type === 'invalidate') {
          this.invalidate(msg.keys, false);
        }
        if (msg?.type === 'clear') {
          this.clearAll(msg.reason, false);
        }
      };
    }
  }

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this.metrics.inc('cache_misses');
      return null;
    }
    const now = Date.now();
    if (entry.expiresAt <= now) {
      // stale but return null here; callers may still use stale data separately if needed
      this.cache.delete(key);
      this.metrics.inc('cache_misses');
      return null;
    }
    this.metrics.inc('cache_hits');
    return entry;
  }

  peek<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    return entry ?? null;
  }

  set<T>(key: string, data: T, etag?: string, ttlMs: number = DEFAULT_TTL) {
    this.cache.set(key, { data, etag, expiresAt: Date.now() + ttlMs });
  }

  setStale<T>(key: string, data: T, etag?: string) {
    this.cache.set(key, { data, etag, expiresAt: 0 });
  }

  invalidate(keys: string[], broadcast = true) {
    for (const k of keys) this.cache.delete(k);
    if (broadcast) this.bc?.postMessage({ type: 'invalidate', keys } satisfies InvalidationMessage);
  }

  clearAll(reason?: string, broadcast = true) {
    this.cache.clear();
    this.urlEtags.clear();
    this.urlBodies.clear();
    if (broadcast) this.bc?.postMessage({ type: 'clear', reason } satisfies InvalidationMessage);
  }

  // URL metadata for interceptor and 304 recovery
  setUrlMeta(url: string, meta: { etag?: string; body?: any }) {
    if (meta.etag) this.urlEtags.set(url, meta.etag);
    if (meta.body !== undefined) this.urlBodies.set(url, meta.body);
  }
  getUrlEtag(url: string): string | undefined {
    return this.urlEtags.get(url);
  }
  getUrlBody<T = any>(url: string): T | undefined {
    return this.urlBodies.get(url);
  }
}
