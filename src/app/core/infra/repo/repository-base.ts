import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { Observable, Subject, of, shareReplay, finalize, takeUntil, map, throwError, catchError } from 'rxjs';
import { CacheStore } from './cache-store';
import { MetricsService } from '../../../utils/metrics.service';
import {AuthService} from '../../auth/auth.service';
import {environment} from '../../../../environments/environment';
import {Filters, Links, PaginationResponse} from './pagination';
import {Converter} from './interfaces';

//@Injectable({ providedIn: 'root' })
export class RepositoryBase<DTO, MODEL> {
  private inflight = new Map<string, Observable<any>>();
  private readonly nav$ = new Subject<void>();

  constructor(
    private converter: Converter<DTO, MODEL>,
    protected http: HttpClient,
    protected cache: CacheStore,
    router: Router,
    protected metrics: MetricsService,
    protected auth: AuthService
  ) {
    router.events.subscribe((ev) => {
      if (ev instanceof NavigationStart) {
        this.nav$.next();
      }
    });
  }

  protected buildSprintappApiv1BaseUrl(tenant_id: string, apiResourceName: string): string {
    return environment.apiUrl + '/api/v1/' + tenant_id + '/' + apiResourceName
  }

  protected getList(key: string, url: string, params?: Record<string, any>, ttlMs = 60_000): Observable<PaginationResponse<MODEL>> {
    const fresh = this.cache.get<MODEL>(key);
    if (fresh) {
      // Provide cached quickly
      // Note: background refresh can be implemented by callers on focus/online using fetchList again.
      let response = {
        data: fresh.data as MODEL[],
        pagination: {
          limit: -1,
          returned: (fresh.data as MODEL[]).length,
          has_next: false,
          next_cursor: null,
          links: {
            next: null,
          },
          filters: {
            path: params?params['path']??"":"",
          },
          sort: [],
        }
      }
      return of(response as PaginationResponse<MODEL>);
    }

    const dedupKey = `GET|${key}`;
    /*const inFlight = this.inflight.get(dedupKey);
    if (inFlight) {
      let response = {
        data: fresh.data as T[],
        pagination: {
          limit: -1,
          returned: (fresh.data as T[]).length,
          has_next: false,
          next_cursor: null,
          links: {
            next: null,
          },
          filters: {
            path: params?params['path']??"":"",
          },
          sort: [],
        }
      }
      return inFlight as Observable<T>;
    }*/

    const entry = this.cache.peek<MODEL>(key);

    const httpParams = new HttpParams({ fromObject: params ?? {} });
    let headers = new HttpHeaders();
    headers = headers.append(this.auth.get_xsrf_header_name(), this.auth.get_xsrf_token());
    const req$ = this.http
      .get<PaginationResponse<DTO>>(url, { observe: 'response', params: httpParams, headers: headers, withCredentials: true })
      .pipe(
        map((resp: HttpResponse<PaginationResponse<DTO>>) => {
          const etag = resp.headers.get('ETag') || resp.headers.get('Etag') || resp.headers.get('etag') || undefined;
          let body = resp.body as PaginationResponse<DTO> | null;
          let data = Array.from(resp.body?.data ?? []);
          let models = data.map<MODEL>(dto => {
            return this.converter.fromDto(dto);
          });
          /*if (!body) {
            const cached = this.cache.peek<T>(key)?.data;
            if (cached) body = cached;
          }
          if (body != null) {
            this.cache.set<T>(key, body, etag ?? entry?.etag, ttlMs);
            this.cache.setUrlMeta(resp.url ?? url, { etag: etag ?? entry?.etag, body });
          }*/
          return {
            data: models,
            pagination: resp.body?.pagination ?? {}
          } as PaginationResponse<MODEL>;
        }),
        finalize(() => this.inflight.delete(dedupKey)),
        takeUntil(this.nav$),
        shareReplay({ bufferSize: 1, refCount: true })
      );

    this.inflight.set(dedupKey, req$);
    return req$;
  }

  protected get(key: string, url: string, ttlMs = 60_000): Observable<MODEL> {
    console.log('get', key, url, this.cache);
    const fresh = this.cache.get<MODEL>(key);
    if (fresh) return of(fresh.data as MODEL);

    const dedupKey = `GET|${key}`;
    const inFlight = this.inflight.get(dedupKey);
    if (inFlight) return inFlight as Observable<MODEL>;

    const entry = this.cache.peek<MODEL>(key);
    const ifNoneMatch = entry?.etag;

    const headers = ifNoneMatch ? new HttpHeaders({ 'If-None-Match': ifNoneMatch }) : undefined;
    headers?.append(this.auth.get_xsrf_header_name(), this.auth.get_xsrf_token());
    const req$ = this.http
      .get<DTO>(url, { observe: 'response', headers ,withCredentials: true })
      .pipe(
        map((resp: HttpResponse<DTO>) => {
          const etag = resp.headers.get('ETag') || resp.headers.get('Etag') || resp.headers.get('etag') || undefined;
          let body = resp.body as DTO | null;
          // if (!body) body = this.cache.peek<T>(key)?.data ?? null;
          if (body != null) {
            let model = this.converter.fromDto(body);
            this.cache.set<MODEL>(key, model, etag ?? entry?.etag, ttlMs);
            this.cache.setUrlMeta(resp.url ?? url, { etag: etag ?? entry?.etag, body });
            return model;
          }
          throw new Error('body is null');
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
    const headers = new HttpHeaders().append(this.auth.get_xsrf_header_name(), this.auth.get_xsrf_token());
    const req$ = this.http.post<T>(url, body, { observe: 'response', headers, withCredentials: true }).pipe(
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
    patch: T,
    etag: string,
    listKeysToInvalidate: string[]
  ): Observable<T> {
    const snapshot = this.cache.peek<T>(itemKey);
    // optimistic apply in cache (stale) if snapshot exists
    if (snapshot?.data) {
      const next = { ...(snapshot.data as any), ...(patch as any) } as T;
      this.cache.setStale<T>(itemKey, next, snapshot.etag);
    }
    const ifMatch =  etag;
    let headers = new HttpHeaders();
    headers = headers.append('If-Match', ifMatch);
    headers = headers.append(this.auth.get_xsrf_header_name(), this.auth.get_xsrf_token());
    const req$ = this.http.put<T>(url, patch, { observe: 'response', headers: headers, withCredentials: true }).pipe(
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

    const headers = new HttpHeaders().append(this.auth.get_xsrf_header_name(), this.auth.get_xsrf_token());
    const req$ = this.http.delete<void>(url, { observe: 'response', headers, withCredentials: true }).pipe(
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
