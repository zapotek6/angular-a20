export class MontecarloEstimation {
  mean_duration: number = 0;
  p50: number = 0;
  p80: number = 0;
  p95: number = 0;
  probability_on_time: number = 0;
}

export class ExtTicketInfo {
  integration_id: string = "";
  key: string = "";
}

export class Reference {
  tenant_id: string = "";
  project_id: string = "";
  id: string = "";
  name?: string | null;
}

export type LinkKind = "Dependency" | "Relation";

export class Link {
  kind: LinkKind = "Dependency";
  from: Reference = new Reference();
  to: Reference = new Reference();
  name?: string | null;
  condition?: string | null;
}

export class ResourceEstimation {
  resource_email: string = "";
  effort_o: number = 0;
  effort_m: number = 0;
  effort_p: number = 0;
}

export type Kind =
  | "ML"
  | "SS"
  | "TS"
  | "RK"
  | "AS"
  | "ID";

export type Category =
  | "ATD"
  | "ANA"
  | "QUA"
  | "QAA"
  | "ORG"
  | "DEV";

export type EarsKind =
  | "Optional"
  | "Ubiquitous"
  | "EventDriven"
  | "StateDriven"
  | "Robustness"
  | "Complex";

export class Requirement {
  ears: string = "";
  kind: EarsKind = "Optional";
  acceptance_criteria: string[] = [];
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

export class ATI {
  analysis?: AnalysisDifficulty | null;
  technical?: TechnicalDifficulty | null;
  integration?: IntegrationComplexity | null;
}
// Class model (handy for UI logic; mirrors DTO with defaults)
export class Pmo {
  project_id: string = "";
  kind: Kind = "TS";
  key: string = "";
  active: boolean = true;
  category: Category = "DEV";
  component: string = "";
  domain: string = "";
  name: string = "";
  description: string = "";
  moscow?: string | null = null;
  definition_status?: string | null = null;
  owner_email: string = "";
  estimations: ResourceEstimation[] = [];
  links: Link[] = [];
  ext_ticket_info?: ExtTicketInfo | null = null;
  requirements?: Requirement[] | null = null;
  ati?: ATI | null = null;

  // Flattened meta fields
  id: string = "";
  version: number = 1;
  tenant_id: string = "";
  location: string = "";
  resource_type: string = "";
  created_at: string = "";
  updated_at: string = "";
  created_by: string = "";
  updated_by: string = "";

  /*static fromDto(dto: PmoDto): Pmo {
    const p = new Pmo();
    Object.assign(p, dto);
    return p;
  }

  toDto(): PmoDto {
    const {
      project_id, kind, key, active, category, component, domain, name, description,
      moscow, definition_status, owner_email, estimations, links, ext_ticket_info,
      requirements, ati, id, version, tenant_id, location, resource_type,
      created_at, updated_at, created_by, updated_by
    } = this;
    return {
      project_id, kind, key, active, category, component, domain, name, description,
      moscow: moscow ?? null,
      definition_status: definition_status ?? null,
      owner_email, estimations, links,
      ext_ticket_info: ext_ticket_info ?? null,
      requirements: requirements ?? null,
      ati: ati ?? null,
      id, version, tenant_id, location, resource_type,
      created_at, updated_at, created_by, updated_by
    };
  }*/
}
