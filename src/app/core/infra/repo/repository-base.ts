import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { Observable, Subject, of, shareReplay, finalize, takeUntil, map, throwError, catchError } from 'rxjs';
import { CacheStore } from './cache-store';
import { MetricsService } from '../../../utils/metrics.service';

@Injectable({ providedIn: 'root' })
export class RepositoryBase {
  private inflight = new Map<string, Observable<any>>();
  private readonly nav$ = new Subject<void>();

  constructor(
    protected http: HttpClient,
    protected cache: CacheStore,
    router: Router,
    protected metrics: MetricsService
  ) {
    router.events.subscribe((ev) => {
      if (ev instanceof NavigationStart) {
        this.nav$.next();
      }
    });
  }

  protected getList<T>(key: string, url: string, params?: Record<string, any>, ttlMs = 60_000): Observable<T> {
    const fresh = this.cache.get<T>(key);
    if (fresh) {
      // Provide cached quickly
      // Note: background refresh can be implemented by callers on focus/online using fetchList again.
      return of(fresh.data as T);
    }

    const dedupKey = `GET|${key}`;
    const inFlight = this.inflight.get(dedupKey);
    if (inFlight) return inFlight as Observable<T>;

    const entry = this.cache.peek<T>(key);
    const ifNoneMatch = entry?.etag;

    const httpParams = new HttpParams({ fromObject: params ?? {} });
    const headers = ifNoneMatch ? new HttpHeaders({ 'If-None-Match': ifNoneMatch }) : undefined;

    const req$ = this.http
      .get<T>(url, { observe: 'response', params: httpParams, headers })
      .pipe(
        map((resp: HttpResponse<T>) => {
          const etag = resp.headers.get('ETag') || resp.headers.get('Etag') || resp.headers.get('etag') || undefined;
          let body = resp.body as T | null;
          if (!body) {
            const cached = this.cache.peek<T>(key)?.data;
            if (cached) body = cached;
          }
          if (body != null) {
            this.cache.set<T>(key, body, etag ?? entry?.etag, ttlMs);
            this.cache.setUrlMeta(resp.url ?? url, { etag: etag ?? entry?.etag, body });
          }
          return body as T;
        }),
        finalize(() => this.inflight.delete(dedupKey)),
        takeUntil(this.nav$),
        shareReplay({ bufferSize: 1, refCount: true })
      );

    this.inflight.set(dedupKey, req$);
    return req$;
  }

  protected getItem<T>(key: string, url: string, ttlMs = 60_000): Observable<T> {
    const fresh = this.cache.get<T>(key);
    if (fresh) return of(fresh.data as T);

    const dedupKey = `GET|${key}`;
    const inFlight = this.inflight.get(dedupKey);
    if (inFlight) return inFlight as Observable<T>;

    const entry = this.cache.peek<T>(key);
    const ifNoneMatch = entry?.etag;

    const headers = ifNoneMatch ? new HttpHeaders({ 'If-None-Match': ifNoneMatch }) : undefined;

    const req$ = this.http
      .get<T>(url, { observe: 'response', headers })
      .pipe(
        map((resp: HttpResponse<T>) => {
          const etag = resp.headers.get('ETag') || resp.headers.get('Etag') || resp.headers.get('etag') || undefined;
          let body = resp.body as T | null;
          if (!body) body = this.cache.peek<T>(key)?.data ?? null;
          if (body != null) {
            this.cache.set<T>(key, body, etag ?? entry?.etag, ttlMs);
            this.cache.setUrlMeta(resp.url ?? url, { etag: etag ?? entry?.etag, body });
          }
          return body as T;
        }),
        finalize(() => this.inflight.delete(dedupKey)),
        takeUntil(this.nav$),
        shareReplay({ bufferSize: 1, refCount: true })
      );

    this.inflight.set(dedupKey, req$);
    return req$;
  }

  protected optimisticCreate<T>(
    listKeysToInvalidate: string[],
    url: string,
    body: any
  ): Observable<T> {
    // For simplicity we only invalidate lists after success; callers may add provisional entry handling as needed
    const req$ = this.http.post<T>(url, body, { observe: 'response' }).pipe(
      map((resp) => {
        const etag = resp.headers.get('ETag') || resp.headers.get('Etag') || resp.headers.get('etag') || undefined;
        const entity = resp.body as T;
        // invalidate affected lists and specific item key if possible
        this.cache.invalidate(listKeysToInvalidate);
        // store url meta for GET by id if known
        if (resp.url) this.cache.setUrlMeta(resp.url, { etag, body: entity });
        this.metrics.inc('optimistic_success');
        return entity;
      }),
      catchError((err) => {
        this.metrics.inc('rollback');
        return throwError(() => err);
      }),
      takeUntil(this.nav$),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    return req$;
  }

  protected optimisticUpdate<T>(
    itemKey: string,
    url: string,
    patch: Partial<T>,
    listKeysToInvalidate: string[]
  ): Observable<T> {
    const snapshot = this.cache.peek<T>(itemKey);
    // optimistic apply in cache (stale) if snapshot exists
    if (snapshot?.data) {
      const next = { ...(snapshot.data as any), ...(patch as any) } as T;
      this.cache.setStale<T>(itemKey, next, snapshot.etag);
    }
    const ifMatch = snapshot?.etag;
    const headers = ifMatch ? new HttpHeaders({ 'If-Match': ifMatch }) : undefined;

    const req$ = this.http.patch<T>(url, patch, { observe: 'response', headers }).pipe(
      map((resp) => {
        const etag = resp.headers.get('ETag') || resp.headers.get('Etag') || resp.headers.get('etag') || undefined;
        const body = (resp.body ?? snapshot?.data) as T;
        // commit result
        this.cache.set<T>(itemKey, body, etag ?? ifMatch);
        // invalidate lists
        this.cache.invalidate(listKeysToInvalidate);
        this.metrics.inc('optimistic_success');
        return body;
      }),
      catchError((err) => {
        // rollback
        if (snapshot) this.cache.set<T>(itemKey, snapshot.data, snapshot.etag);
        this.metrics.inc('rollback');
        return throwError(() => err);
      }),
      takeUntil(this.nav$),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    return req$;
  }

  protected optimisticDelete(
    itemKey: string,
    url: string,
    listKeysToInvalidate: string[]
  ): Observable<void> {
    const snapshot = this.cache.peek<any>(itemKey);
    // optimistic remove from cache
    this.cache.invalidate([itemKey]);

    const req$ = this.http.delete<void>(url, { observe: 'response' }).pipe(
      map(() => {
        this.cache.invalidate(listKeysToInvalidate);
        this.metrics.inc('optimistic_success');
        return void 0;
      }),
      catchError((err) => {
        if (snapshot) this.cache.set(itemKey, snapshot.data, snapshot.etag);
        this.metrics.inc('rollback');
        return throwError(() => err);
      }),
      takeUntil(this.nav$),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    return req$;
  }
}
