import {RepositoryBase} from './repository-base';
import {inject} from '@angular/core';
import {OnlineFocusService} from '../../../utils/online-focus.service';
import {HttpClient} from '@angular/common/http';
import {CacheStore} from './cache-store';
import {Router} from '@angular/router';
import {MetricsService} from '../../../utils/metrics.service';
import {AuthService} from '../../auth/auth.service';
import {EMPTY, expand, filter, map, merge, Observable, reduce, switchMap} from 'rxjs';
import {Pagination, PaginationResponse} from './pagination';

export class GenericRepository<T> extends RepositoryBase {
  private readonly listKey: string;

  constructor(private readonly apiResourceName: string, private online: OnlineFocusService, http: HttpClient, cache: CacheStore, router: Router, metrics: MetricsService, auth: AuthService) {
    super(http, cache, router, metrics, auth);
    this.listKey = 'list:' + this.apiResourceName;
  }

  private buildListKey(params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) return this.listKey;
    const q = Object.keys(params)
      .sort()
      .map((k) => `${k}=${encodeURIComponent(params[k])}`)
      .join('&');
    return `${this.listKey}?${q}`;
  }

  private itemKey(id: string): string {
    return `${this.listKey}:${id}`;
  }

  getAll(tenant_id: string, params: Record<string, any> = {}): Observable<T[]> {

    return this.getList<T>(this.buildListKey(params), this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName), params).pipe(
      // keep requesting while a "next" exists
      expand(res => {
        const next =  res.pagination.has_next;
        const newParams = { ...params, cursor: res.pagination.next_cursor };
        return next ? this.getList<T>(this.buildListKey(params), this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName), params) : EMPTY;
      }),
      map(res => res.data ?? []),
      reduce((all, items) => all.concat(items), [] as T[])
    );
  }
  /*getMany(tenant_id: string, params?: Record<string, any>): Observable<PaginationResponse<T>> {
    return this.getList<T>(this.buildListKey(params), this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName), params);
  }*/

  /*watchMany(tenant_id: string, params?: Record<string, any>): Observable<T[]> {
    const key = this.buildListKey(params);
    return merge(
      this.getMany(tenant_id, params),
      this.online.triggers$.pipe(
        filter(() => {
          const entry = this.cache.peek<T>(key);
          return !entry || entry.expiresAt <= Date.now();
        }),
        switchMap(() => this.getMany(tenant_id, params))
      )
    );
  }*/

  read(tenant_id: string, id: string): Observable<T> {
    return super.get<T>(this.itemKey(id), `${this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName)}/${id}`);
  }

  watch(tenant_id: string, id: string): Observable<T> {
    const key = this.itemKey(id);
    return merge(
      this.read(tenant_id, id),
      this.online.triggers$.pipe(
        filter(() => {
          const entry = this.cache.peek<T>(key);
          return !entry || entry.expiresAt <= Date.now();
        }),
        switchMap(() => this.read(tenant_id, id))
      )
    );
  }

  create(tenant_id: string, payload: Partial<T>): Observable<T> {
    // invalidate list keys; since we don't track params combinations centrally, invalidate the base list key
    const toInvalidate = [this.listKey];
    return this.optimisticCreate<T>(toInvalidate, this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName), payload);
  }

  update(tenant_id: string, id: string, patch: Partial<T>): Observable<T> {
    const key = this.itemKey(id);
    const url = `${this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName)}/${id}`;
    const toInvalidate = [this.listKey];
    return this.optimisticUpdate<T>(key, url, patch, toInvalidate);
  }

  delete(tenant_id: string, id: string): Observable<void> {
    const key = this.itemKey(id);
    const url = `${this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName)}/${id}`;
    const toInvalidate = [this.listKey];
    return this.optimisticDelete(key, url, toInvalidate);
  }
}
