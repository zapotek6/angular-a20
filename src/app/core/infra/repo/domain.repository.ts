import {Injectable} from '@angular/core';
import {GenericRepository} from './generic.repository';
import {OnlineFocusService} from '../../../utils/online-focus.service';
import {HttpClient} from '@angular/common/http';
import {CacheStore} from './cache-store';
import {Router} from '@angular/router';
import {MetricsService} from '../../../utils/metrics.service';
import {AuthService} from '../../auth/auth.service';
import {Domain, EntityKind} from '../../models/domain';

// DTO (shape of data exchanged over the wire)
export type DomainDto = {
  kind: EntityKind;
  name: string;
  description: string;
  parent_id: string;
  detail_id: string;

  // Flattened meta fields
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

export const DomainConverter = {
  fromDto: (d: DomainDto) => {
    const p = new Domain();
    Object.assign(p, d);
    return p;
  },
  toDto: (m: Domain): DomainDto =>
    (m as unknown as DomainDto)
};

export const DOMAIN_RESOURCE_NAME = 'domains';

@Injectable({ providedIn: 'root' })
export class DomainsRepository extends GenericRepository<DomainDto, Domain> {
  constructor(online: OnlineFocusService,
              http: HttpClient,
              cache: CacheStore,
              router: Router,
              metrics: MetricsService,
              auth: AuthService) {
    super(DOMAIN_RESOURCE_NAME, DomainConverter, online, http, cache, router, metrics, auth);
  }

  create(tenant_id: string, payload: Partial<Domain>): import('rxjs').Observable<Domain> {
    const toInvalidate = [`list:${DOMAIN_RESOURCE_NAME}`];
    const url = this.buildSprintappApiv1BaseUrl(tenant_id, DOMAIN_RESOURCE_NAME);
    return this.optimisticCreate<Domain>(toInvalidate, url, payload);
  }

  update(tenant_id: string, domain: Domain): import('rxjs').Observable<Domain> {
    const itemKey = `list:${DOMAIN_RESOURCE_NAME}:${domain.id}`;
    const url = `${this.buildSprintappApiv1BaseUrl(tenant_id, DOMAIN_RESOURCE_NAME)}/${domain.id}`;
    const toInvalidate = [`list:${DOMAIN_RESOURCE_NAME}`];
    return this.optimisticUpdate<Domain>(itemKey, url, domain, domain.version.toString(), toInvalidate);
  }
}
