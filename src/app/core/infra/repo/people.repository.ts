import {Injectable} from '@angular/core';
import {GenericRepository} from './generic.repository';
import {OnlineFocusService} from '../../../utils/online-focus.service';
import {HttpClient} from '@angular/common/http';
import {CacheStore} from './cache-store';
import {Router} from '@angular/router';
import {MetricsService} from '../../../utils/metrics.service';
import {AuthService} from '../../auth/auth.service';
import {Person} from '../../models/person';

// DTO (shape of data exchanged over the wire)
export type PersonDto = {
  email: string;
  name: string;
  surname: string;
  roles: string[];
  display_name: string;
  description: string;

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

export const PersonConverter = {
  fromDto: (d: PersonDto) => {
    const p = new Person();
    Object.assign(p, d);
    return p;
  },
  toDto: (m: Person): PersonDto =>
    (m as unknown as PersonDto)
};

export const PERSON_RESOURCE_NAME = 'people';

@Injectable({ providedIn: 'root' })
export class PeopleRepository extends GenericRepository<PersonDto, Person> {
  constructor(online: OnlineFocusService,
              http: HttpClient,
              cache: CacheStore,
              router: Router,
              metrics: MetricsService,
              auth: AuthService) {
    super(PERSON_RESOURCE_NAME, PersonConverter, online, http, cache, router, metrics, auth);
  }

  create(tenant_id: string, payload: Partial<Person>): import('rxjs').Observable<Person> {
    const toInvalidate = [`list:${PERSON_RESOURCE_NAME}`];
    const url = this.buildSprintappApiv1BaseUrl(tenant_id, PERSON_RESOURCE_NAME);
    return this.optimisticCreate<Person>(toInvalidate, url, payload);
  }

  update(tenant_id: string, person: Person): import('rxjs').Observable<Person> {
    const itemKey = `list:${PERSON_RESOURCE_NAME}:${person.id}`;
    const url = `${this.buildSprintappApiv1BaseUrl(tenant_id, PERSON_RESOURCE_NAME)}/${person.id}`;
    const toInvalidate = [`list:${PERSON_RESOURCE_NAME}`];
    return this.optimisticUpdate<Person>(itemKey, url, person, person.version.toString(), toInvalidate);
  }
}
