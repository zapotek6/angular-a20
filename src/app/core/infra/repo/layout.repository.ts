import {Injectable} from '@angular/core';
import {GenericRepository} from './generic.repository';
import {OnlineFocusService} from '../../../utils/online-focus.service';
import {HttpClient} from '@angular/common/http';
import {CacheStore} from './cache-store';
import {Router} from '@angular/router';
import {MetricsService} from '../../../utils/metrics.service';
import {AuthService} from '../../auth/auth.service';
import {Layout} from '../../models/layout';

export type Position = {
  x: number,
  y: number,
}

export type Node = {
  id: string,
  pos: Position,
  collapsed: boolean,
  hidden: boolean,
}

export type EmbeddedLayout = {
  id: string,
  pan: Position,
  collapsed: boolean,
  hidden: boolean,
}

export type LayoutDto = {
  name: string,
  description: string,
  nodes: Node[],
  embedded_layouts: EmbeddedLayout[],

  // Flattened meta fields
  id: string,
  version: number,
  tenant_id: string,
  location: string,
  resource_type: string,
  created_at: string,
  updated_at: string,
  created_by: string,
  updated_by: string,
}

export const LayoutConverter = {
  fromDto: (d: LayoutDto) => {
    const p = new Layout();
    Object.assign(p, d);
    return p;
  },
  toDto: (m: Layout): LayoutDto =>
    (m as unknown as LayoutDto)
};

export const LAYOUT_RESOURCE_NAME = 'layouts';

@Injectable({ providedIn: 'root' })
export class LayoutsRepository extends GenericRepository<LayoutDto, Layout> {
  constructor(online: OnlineFocusService,
              http: HttpClient,
              cache: CacheStore,
              router: Router,
              metrics: MetricsService,
              auth: AuthService) {
    super(LAYOUT_RESOURCE_NAME, LayoutConverter, online, http, cache, router, metrics, auth);
  }

  create(tenant_id: string, payload: Partial<Layout>): import('rxjs').Observable<Layout> {
    const toInvalidate = [`list:${LAYOUT_RESOURCE_NAME}`];
    const url = this.buildSprintappApiv1BaseUrl(tenant_id, LAYOUT_RESOURCE_NAME);
    return this.optimisticCreate<Layout>(toInvalidate, url, payload);
  }

  update(tenant_id: string, domain: Layout): import('rxjs').Observable<Layout> {
    const itemKey = `list:${LAYOUT_RESOURCE_NAME}:${domain.id}`;
    const url = `${this.buildSprintappApiv1BaseUrl(tenant_id, LAYOUT_RESOURCE_NAME)}/${domain.id}`;
    const toInvalidate = [`list:${LAYOUT_RESOURCE_NAME}`];
    return this.optimisticUpdate<Layout>(itemKey, url, domain, domain.version.toString(), toInvalidate);
  }
}
