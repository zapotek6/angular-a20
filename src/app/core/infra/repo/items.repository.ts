import {Injectable, inject, InjectionToken} from '@angular/core';
import { RepositoryBase } from './repository-base';
import { HttpClient } from '@angular/common/http';
import { CacheStore } from './cache-store';
import { Router } from '@angular/router';
import { MetricsService } from '../../../utils/metrics.service';
import { Observable, filter, merge, of, switchMap } from 'rxjs';
import { OnlineFocusService } from '../../../utils/online-focus.service';
import {environment} from '../../../../environments/environment';
import {AuthService} from '../../auth/auth.service';
import {GenericRepository} from './generic.repository';

export interface Item {
  name: string;
  value: string;
  id: string;
  version: number;
  tenant_id: string;
  location: string;
  resource_type: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export const ITEM_RESOURCE_NAME = 'items';

@Injectable({ providedIn: 'root' })
export class ItemsRepository extends GenericRepository<Item> {
  constructor(online: OnlineFocusService,
              http: HttpClient,
              cache: CacheStore,
              router: Router,
              metrics: MetricsService,
              auth: AuthService) {
    super(ITEM_RESOURCE_NAME, online, http, cache, router, metrics, auth);
  }
}

/*@Injectable({ providedIn: 'root' })
export class ItemsRepository1 extends RepositoryBase {
  private readonly apiResourceName: string = 'items';
  private readonly listKey: string;
  private readonly online = inject(OnlineFocusService);

  constructor(http: HttpClient, cache: CacheStore, router: Router, metrics: MetricsService, auth: AuthService) {
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

  getMany(tenant_id: string, params?: Record<string, any>): Observable<Item[]> {
    return this.getList<Item[]>(this.buildListKey(params), this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName), params);
  }

  watchItems(tenant_id: string, params?: Record<string, any>): Observable<Item[]> {
    const key = this.buildListKey(params);
    return merge(
      this.getMany(tenant_id, params),
      this.online.triggers$.pipe(
        filter(() => {
          const entry = this.cache.peek<Item[]>(key);
          return !entry || entry.expiresAt <= Date.now();
        }),
        switchMap(() => this.getMany(tenant_id, params))
      )
    );
  }

  read(tenant_id: string, id: string): Observable<Item> {
    return super.get<Item>(this.itemKey(id), `${this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName)}/${id}`);
  }

  watchItem(tenant_id: string, id: string): Observable<Item> {
    const key = this.itemKey(id);
    return merge(
      this.read(tenant_id, id),
      this.online.triggers$.pipe(
        filter(() => {
          const entry = this.cache.peek<Item>(key);
          return !entry || entry.expiresAt <= Date.now();
        }),
        switchMap(() => this.read(tenant_id, id))
      )
    );
  }

  create(tenant_id: string, payload: Partial<Item>): Observable<Item> {
    // invalidate list keys; since we don't track params combinations centrally, invalidate the base list key
    const toInvalidate = [this.listKey];
    return this.optimisticCreate<Item>(toInvalidate, this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName), payload);
  }

  update(tenant_id: string, id: string, patch: Partial<Item>): Observable<Item> {
    const key = this.itemKey(id);
    const url = `${this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName)}/${id}`;
    const toInvalidate = [this.listKey];
    return this.optimisticUpdate<Item>(key, url, patch, toInvalidate);
  }

  delete(tenant_id: string, id: string): Observable<void> {
    const key = this.itemKey(id);
    const url = `${this.buildSprintappApiv1BaseUrl(tenant_id, this.apiResourceName)}/${id}`;
    const toInvalidate = [this.listKey];
    return this.optimisticDelete(key, url, toInvalidate);
  }
}*/
