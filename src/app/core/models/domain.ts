import {ResourceType} from './types';

export enum EntityKind {
  Tenant = "tenant",
  Group = "group",
  Company = "company",
  Unit = "unit",
  Department = "department",
  Container = "container",
  Project = "project",
  Team = "team",}


export class Domain {
  kind: EntityKind = EntityKind.Tenant;
  name: string = "";
  description: string = "";
  parent_id: string = "'";
  detail_id: string = "";

  id: string = "";
  version: number = 0;
  tenant_id: string = "";
  location: string = "";
  resource_type: string = "";
  created_at: string = "";
  updated_at: string = "";
  created_by: string = "";
  updated_by: string = "";
}
