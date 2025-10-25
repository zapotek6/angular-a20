import {inject, Injectable, OnInit} from '@angular/core';
import {ItemsRepository} from '../infra/repo/items.repository';
import {ProjectDto, ProjectsRepository} from '../infra/repo/projects.repository';
import {AuthEvent, AuthService, BROADCAST_LOGOUT} from '../auth/auth.service';
import {OnlineFocusService} from '../../utils/online-focus.service';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {MetricsService} from '../../utils/metrics.service';
import {CacheStore} from '../infra/repo/cache-store';
import {catchError, forkJoin, mapTo, Observable, of, tap} from 'rxjs';
import {LoggerService} from '../logger/logger.service';
import {Logger, LogSeverity} from '../logger/logger';
import {Item} from '../models/item';
import {BroadcasterService} from '../brodacaster.service';
import {PmosRepository} from '../infra/repo/pmo.repository';
import {Kind, Pmo} from '../models/pmo';
import {ResourceType} from '../models/types';
import {Member, Project} from '../models/project';
import {PeopleRepository} from '../infra/repo/people.repository';
import {DomainsRepository} from '../infra/repo/domain.repository';
import {Domain} from '../models/domain';
import {Person} from '../models/person';
import {LayoutsRepository} from '../infra/repo/layout.repository';
import {Layout} from '../models/layout';

export enum WorkspaceState {
  NotReady = 'WORKSPACE-NOTREADY',
  Ready = 'WORKSPACE-READY',
  ProjectSelected = 'WORKSPACE-PROJECT-SELECTED'
}

export enum WorkspaceEvent { ChangeProject = 'WORKSPACE-CHANGE-PROJECT' }

@Injectable({providedIn: 'root'})
export class WorkspaceService {
  auth: AuthService = inject(AuthService);
  itemsRepo: ItemsRepository;
  projectsRepo: ProjectsRepository;
  layoutsRepo: LayoutsRepository;
  pmosRepo: PmosRepository;
  domainsRepo: DomainsRepository;
  peopleRepo: PeopleRepository;
  protected _tenant_id?: string;
  protected _project?: ProjectDto;
  protected status = WorkspaceState.NotReady;
  logger: Logger;
  bcast: BroadcasterService;

  constructor(private readonly loggerService: LoggerService) {
    this.logger = loggerService.createLocalLoggerInstance("WorkspaceService", LogSeverity.DEBUG);
    this.logger.enabled = false;
    this.bcast = new BroadcasterService(this.logger);
    this.itemsRepo = new ItemsRepository(inject(OnlineFocusService), inject(HttpClient), inject(CacheStore), inject(Router), inject(MetricsService), inject(AuthService));
    this.projectsRepo = new ProjectsRepository(inject(OnlineFocusService), inject(HttpClient), inject(CacheStore), inject(Router), inject(MetricsService), inject(AuthService));
    this.layoutsRepo = new LayoutsRepository(inject(OnlineFocusService), inject(HttpClient), inject(CacheStore), inject(Router), inject(MetricsService), inject(AuthService));
    this.pmosRepo = new PmosRepository(inject(OnlineFocusService), inject(HttpClient), inject(CacheStore), inject(Router), inject(MetricsService), inject(AuthService));
    this.domainsRepo = new DomainsRepository(inject(OnlineFocusService), inject(HttpClient), inject(CacheStore), inject(Router), inject(MetricsService), inject(AuthService));
    this.peopleRepo = new PeopleRepository(inject(OnlineFocusService), inject(HttpClient), inject(CacheStore), inject(Router), inject(MetricsService), inject(AuthService));
    this.setup();
  }

  private setup(): void {
    this.logger.debug('ngOnInit');

    this.bcast.onMessage((message) => {
      if (message?.type === WorkspaceEvent.ChangeProject) {
        if (message?.project) {
          this.selectProject(message?.project);
          this.logger.debug('WorkspaceService ChangeProject', message?.project);
        } else {
          this.logger.debug('WorkspaceService ChangeProject: invalid project');
        }
      }
    });
  }

  get tenant_id(): string | undefined {
    return this._tenant_id;
  }

  get project_id(): string | undefined {
    return this._project?.project_id;
  }

  getProjectResourcePath(resource_type: ResourceType): string | undefined {
    return this._project?.location || '' + this._project?.resource_paths.find(rp => rp.resource_type === resource_type)?.path;
  }

  getProjectMembers(): Member[] {
    return this._project?.members || [];
  }

  deInit() {
    this._tenant_id = undefined;
    this._project = undefined;
    this.status = WorkspaceState.NotReady;
    this.bcast.broadcast({type: this.status});
  }

  init(tenant_id: string): boolean {
    if (tenant_id.length == 0) {
      this.status = WorkspaceState.NotReady;
    } else {
      this._tenant_id = tenant_id;
      this.status = WorkspaceState.Ready;
    }
    this.bcast.broadcast({type: this.status});
    return this.status == WorkspaceState.Ready;
  }

  selectProject(project: ProjectDto): boolean {
    this.isReady();
    if (project.id.length == 0) {
      return false;
    } else {
      this._project = project;
      this.status = WorkspaceState.ProjectSelected;
    }
    this.bcast.broadcast({type: this.status});
    return this.status == WorkspaceState.ProjectSelected;
  }

  isReady(): boolean {
    if (this.status == WorkspaceState.Ready ||
      this.status == WorkspaceState.ProjectSelected) {
      return true
    }
    throw new Error('Workspace Service Guard protection');
  }

  private guardProjectOperationOk(): boolean {
    if (this.status == WorkspaceState.ProjectSelected) {
      return true
    }
    throw new Error('Workspace Service Guard protection');
  }

  getItems() {
    this.isReady();
    return new Observable<Item[]>((subscriber) => {
      this.itemsRepo.getAll(this._tenant_id ?? "", {'path': this._project?.location}).subscribe({
        next: (items) => {
          subscriber.next(items);
        },
        error: (err) => {
          if (err.status == 401) {
            this.bcast.broadcast({type: AuthEvent.ApiAuthFail});
          }
          subscriber.error(err);
        },
        complete: () => {
          subscriber.complete();
        }
      })
    })
  }

  getProjects() {
    this.isReady();
    return new Observable<Project[]>((subscriber) => {
      this.projectsRepo.getAll(this._tenant_id ?? "", {'path': '/'}).subscribe({
        next: (project) => {
          subscriber.next(project);
        },
        error: (err) => {
          if (err.status == 401) {
            this.bcast.broadcast({type: AuthEvent.ApiAuthFail});
          }
          subscriber.error(err);
        },
        complete: () => {
          subscriber.complete();
        }
      })
    })
  }

  getPmos() {
    this.guardProjectOperationOk();
    return new Observable<Pmo[]>((subscriber) => {
      this.pmosRepo.getAll(this._tenant_id ?? "", {'path': this._project?.location}).subscribe({
        next: (pmos) => {
          subscriber.next(pmos);
        },
        error: (err) => {
          if (err.status == 401) {
            this.bcast.broadcast({type: AuthEvent.ApiAuthFail});
          }
          subscriber.error(err);
        },
        complete: () => {
          subscriber.complete();
        }
      })
    })
  }

  getLayouts() {
    this.guardProjectOperationOk();
    return new Observable<Layout[]>((subscriber) => {
      this.layoutsRepo.getAll(this._tenant_id ?? "", {'path': this._project?.location}).subscribe({
        next: (layouts) => {
          subscriber.next(layouts);
        },
        error: (err) => {
          if (err.status == 401) {
            this.bcast.broadcast({type: AuthEvent.ApiAuthFail});
          }
          subscriber.error(err);
        },
        complete: () => {
          subscriber.complete();
        }
      })
    })
  }

  getDomains() {
    this.isReady();
    return new Observable<Domain[]>((subscriber) => {
      this.domainsRepo.getAll(this._tenant_id ?? "", {'path': '/'}).subscribe({
        next: (pmos) => {
          subscriber.next(pmos);
        },
        error: (err) => {
          if (err.status == 401) {
            this.bcast.broadcast({type: AuthEvent.ApiAuthFail});
          }
          subscriber.error(err);
        },
        complete: () => {
          subscriber.complete();
        }
      })
    })
  }

  getPeople() {
    this.isReady();
    return new Observable<Person[]>((subscriber) => {
      this.peopleRepo.getAll(this._tenant_id ?? "", {'path': '/'}).subscribe({
        next: (pmos) => {
          subscriber.next(pmos);
        },
        error: (err) => {
          if (err.status == 401) {
            this.bcast.broadcast({type: AuthEvent.ApiAuthFail});
          }
          subscriber.error(err);
        },
        complete: () => {
          subscriber.complete();
        }
      })
    })
  }

  getNextPmoKey(kind: Kind): Promise<number> {
    return new Promise((resolve, reject) => {
      let max_id = 0;
      this.getPmos().subscribe({
        next: (pmo) => {
          pmo
            .filter((p) => p.kind == kind)
            .forEach((p) => {
              let [k, v] = p.key.split('.')
              let id = Number.parseFloat(v);
              if (!Number.isNaN(id) && id >= max_id) {
                max_id = id;
              }
            });
        },
        complete: () => {
          resolve(max_id);
        },
        error: (err) => {
          reject(err);
        }
      })
    })
  }
}
