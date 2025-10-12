import {RepositoryBase} from './repository-base';
import {OnlineFocusService} from '../../../utils/online-focus.service';
import {HttpClient} from '@angular/common/http';
import {CacheStore} from './cache-store';
import {Router} from '@angular/router';
import {MetricsService} from '../../../utils/metrics.service';
import {AuthService} from '../../auth/auth.service';
import {EMPTY, expand, filter, map, merge, Observable, reduce, switchMap} from 'rxjs';
import {Converter} from './interfaces';

export class GenericRepository<DTO, MODEL> extends RepositoryBase<DTO, MODEL> {
  private readonly listKey: string;

  constructor(private readonly apiResourceName: string,
              converter: Converter<DTO, MODEL>,
              private online: OnlineFocusService,
              http: HttpClient,
              cache: CacheStore,
              router: Router, metrics:
              MetricsService, auth: AuthService) {
    super(converter, http, cache, router, metrics, auth);
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

  getAll(tenant_id: string, params: Record<string, any> = {}): Observable<MODEL[]> {

    return this.getList(this.buildListKey(params), this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName), params).pipe(
      // keep requesting while a "next" exists
      expand(res => {
        const next =  res.pagination.has_next;
        const newParams = { ...params, cursor: res.pagination.next_cursor };
        return next ? this.getList(this.buildListKey(params), this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName), params) : EMPTY;
      }),
      map(res => res.data ?? []),
      reduce((all, items) => all.concat(items), [] as MODEL[])
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

  /*read(tenant_id: string, id: string): Observable<DTO> {
    return super.get<DTO>(this.itemKey(id), `${this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName)}/${id}`);
  }

  watch(tenant_id: string, id: string): Observable<DTO> {
    const key = this.itemKey(id);
    return merge(
      this.read(tenant_id, id),
      this.online.triggers$.pipe(
        filter(() => {
          const entry = this.cache.peek<DTO>(key);
          return !entry || entry.expiresAt <= Date.now();
        }),
        switchMap(() => this.read(tenant_id, id))
      )
    );
  }

  create(tenant_id: string, payload: Partial<DTO>): Observable<DTO> {
    // invalidate list keys; since we don't track params combinations centrally, invalidate the base list key
    const toInvalidate = [this.listKey];
    return this.optimisticCreate<DTO>(toInvalidate, this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName), payload);
  }

  update(tenant_id: string, pmo: MODEL): Observable<MODEL> {
    const key = this.itemKey(pmo.id);
    const url = `${this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName)}/${pmo.id}`;
    const toInvalidate = [this.listKey];
    return this.optimisticUpdate<MODEL>(key, url, pmo, toInvalidate);
  }

  delete(tenant_id: string, id: string): Observable<void> {
    const key = this.itemKey(id);
    const url = `${this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName)}/${id}`;
    const toInvalidate = [this.listKey];
    return this.optimisticDelete(key, url, toInvalidate);
  }*/
}
