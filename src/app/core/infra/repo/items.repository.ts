import { Injectable, inject } from '@angular/core';
import { RepositoryBase } from './repository-base';
import { HttpClient } from '@angular/common/http';
import { CacheStore } from './cache-store';
import { Router } from '@angular/router';
import { MetricsService } from '../../../utils/metrics.service';
import { Observable, filter, merge, of, switchMap } from 'rxjs';
import { OnlineFocusService } from '../../../utils/online-focus.service';

export interface Item {
  id: string;
  name: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class ItemsRepository extends RepositoryBase {
  private readonly baseUrl = '/api/items';
  private readonly online = inject(OnlineFocusService);

  constructor(http: HttpClient, cache: CacheStore, router: Router, metrics: MetricsService) {
    super(http, cache, router, metrics);
  }

  private listKey(params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) return 'list:items';
    const q = Object.keys(params)
      .sort()
      .map((k) => `${k}=${encodeURIComponent(params[k])}`)
      .join('&');
    return `list:items?${q}`;
  }

  private itemKey(id: string): string {
    return `item:items:${id}`;
  }

  getItems(params?: Record<string, any>): Observable<Item[]> {
    return this.getList<Item[]>(this.listKey(params), this.baseUrl, params);
  }

  watchItems(params?: Record<string, any>): Observable<Item[]> {
    const key = this.listKey(params);
    return merge(
      this.getItems(params),
      this.online.triggers$.pipe(
        filter(() => {
          const entry = this.cache.peek<Item[]>(key);
          return !entry || entry.expiresAt <= Date.now();
        }),
        switchMap(() => this.getItems(params))
      )
    );
  }

  readItem(id: string): Observable<Item> {
    return super.getItem<Item>(this.itemKey(id), `${this.baseUrl}/${id}`);
  }

  watchItem(id: string): Observable<Item> {
    const key = this.itemKey(id);
    return merge(
      this.readItem(id),
      this.online.triggers$.pipe(
        filter(() => {
          const entry = this.cache.peek<Item>(key);
          return !entry || entry.expiresAt <= Date.now();
        }),
        switchMap(() => this.readItem(id))
      )
    );
  }

  createItem(payload: Partial<Item>): Observable<Item> {
    // invalidate list keys; since we don't track params combinations centrally, invalidate the base list key
    const toInvalidate = ['list:items'];
    return this.optimisticCreate<Item>(toInvalidate, this.baseUrl, payload);
  }

  updateItem(id: string, patch: Partial<Item>): Observable<Item> {
    const key = this.itemKey(id);
    const url = `${this.baseUrl}/${id}`;
    const toInvalidate = ['list:items'];
    return this.optimisticUpdate<Item>(key, url, patch, toInvalidate);
  }

  deleteItem(id: string): Observable<void> {
    const key = this.itemKey(id);
    const url = `${this.baseUrl}/${id}`;
    const toInvalidate = ['list:items'];
    return this.optimisticDelete(key, url, toInvalidate);
  }
}
