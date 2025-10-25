import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CacheStore } from './cache-store';
import { Router } from '@angular/router';
import { MetricsService } from '../../../utils/metrics.service';
import { OnlineFocusService } from '../../../utils/online-focus.service';
import {AuthService} from '../../auth/auth.service';
import {GenericRepository} from './generic.repository';
import {Member, Project, ResourcePath} from '../../models/project';

export type ProjectDto = {
  project_id: string;
  name: string;
  description: string;
  resource_paths: ResourcePath[];
  members: Member[];
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

export const ProjectConverter = {
  fromDto: (d: ProjectDto) => {
    const p = new Project();
    Object.assign(p, d);
    return p;
  },
  toDto: (m: Project): ProjectDto =>
    m
};

export const PROJECT_RESOURCE_NAME = 'projects';

@Injectable({ providedIn: 'root' })
export class ProjectsRepository extends GenericRepository<ProjectDto, Project> {
  constructor(online: OnlineFocusService,
              http: HttpClient,
              cache: CacheStore,
              router: Router,
              metrics: MetricsService,
              auth: AuthService) {
    super(PROJECT_RESOURCE_NAME, ProjectConverter, online, http, cache, router, metrics, auth);
  }
}
