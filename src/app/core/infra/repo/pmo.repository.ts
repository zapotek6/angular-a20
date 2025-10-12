import {Injectable} from '@angular/core';
import {GenericRepository} from './generic.repository';
import {OnlineFocusService} from '../../../utils/online-focus.service';
import {HttpClient} from '@angular/common/http';
import {CacheStore} from './cache-store';
import {Router} from '@angular/router';
import {MetricsService} from '../../../utils/metrics.service';
import {AuthService} from '../../auth/auth.service';
import {Pmo} from '../../models/pmo';
import {Item} from '../../models/item';
import {ItemDto} from './items.repository';

export interface MontecarloEstimation {
  mean_duration: number;
  p50: number;
  p80: number;
  p95: number;
  probability_on_time: number;
}

export interface ExtTicketInfo {
  integration_id: string;
  key: string;
}

export interface Reference {
  project_id: string;
  key: string;
  name?: string | null;
}

export type LinkKind = "Dependency" | "Relation";

export interface Link {
  name?: string | null;
  kind: LinkKind;
  from: Reference;
  to: Reference;
  condition?: string | null;
}

export interface ResourceEstimation {
  resource_email: string;
  effort_o: number;
  effort_m: number;
  effort_p: number;
}

export type EarsKind =
  | "Optional"
  | "Ubiquitous"
  | "EventDriven"
  | "StateDriven"
  | "Robustness"
  | "Complex";

export interface Requirement {
  ears: string;
  kind: EarsKind;
  acceptance_criteria: string[];
}

export type AnalysisDifficulty =
  | "Clear"
  | "MinorUncertainty"
  | "Moderate"
  | "High"
  | "Undefined";

export type TechnicalDifficulty =
  | "Trivial"
  | "Low"
  | "Moderate"
  | "High"
  | "VeryHigh";

export type IntegrationComplexity =
  | "Isolated"
  | "FewComponents"
  | "Moderate"
  | "ManyComponents"
  | "CrossDomain"
  | "EnterpriseWide";

export interface ATI {
  analysis?: AnalysisDifficulty | null;
  technical?: TechnicalDifficulty | null;
  integration?: IntegrationComplexity | null;
}

// Meta coming from backend (flattened on entity)
// Adjust types to your existing Meta on the frontend if you have it already.
export interface Meta {
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

// DTO (shape of data exchanged over the wire)
export type PmoDto = {
  project_id: string;
  kind: string;
  key: string;
  active: boolean;
  category: string;
  component: string;
  domain: string;
  name: string;
  description: string;
  moscow?: string | null;
  definition_status?: string | null;
  owner_email: string;
  estimations: ResourceEstimation[];
  links: Link[];
  ext_ticket_info?: ExtTicketInfo | null;
  requirements?: Requirement[] | null;
  ati?: ATI | null;

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

export const PmoConverter = {
  fromDto: (d: PmoDto) => {
    const p = new Pmo();
    Object.assign(p, d);
    return p;
  },
  toDto: (m: Pmo): PmoDto =>
    m
};

export const PMO_RESOURCE_NAME = 'pmos';

@Injectable({ providedIn: 'root' })
export class PmosRepository extends GenericRepository<PmoDto, Pmo> {
  constructor(online: OnlineFocusService,
              http: HttpClient,
              cache: CacheStore,
              router: Router,
              metrics: MetricsService,
              auth: AuthService) {
    super(PMO_RESOURCE_NAME, PmoConverter, online, http, cache, router, metrics, auth);
  }
}
