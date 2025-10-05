import {inject, Injectable} from '@angular/core';
import {ItemsRepository} from '../infra/repo/items.repository';
import {Project, ProjectsRepository} from '../infra/repo/projects.repository';
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

export enum WorkspaceState { NotReady = 'WORKSPACE-NOTREADY', Ready = 'WORKSPACE-READY'}

@Injectable({providedIn: 'root'})
export class WorkspaceService {
  auth: AuthService = inject(AuthService);
  itemsRepo: ItemsRepository;
  projectsRepo: ProjectsRepository;
  tenant_id?: string;
  status= WorkspaceState.NotReady;
  project?: Project;
  logger: Logger;
  bcast: BroadcasterService;

  constructor(private readonly loggerService: LoggerService) {
    this.logger = loggerService.createLocalLoggerInstance("WorkspaceService", LogSeverity.DEBUG);
    this.logger.enabled = false;
    this.bcast = new BroadcasterService(this.logger);
    this.itemsRepo = new ItemsRepository(inject(OnlineFocusService), inject(HttpClient), inject(CacheStore), inject(Router), inject(MetricsService), inject(AuthService));
    this.projectsRepo = new ProjectsRepository(inject(OnlineFocusService), inject(HttpClient), inject(CacheStore), inject(Router), inject(MetricsService), inject(AuthService));

  }

  deInit() {
    this.tenant_id = undefined;
    this.project = undefined;
    this.status = WorkspaceState.NotReady;
    this.bcast.broadcast({type: this.status});
  }

  init(tenant_id: string, project: Project): boolean {
    if (tenant_id.length == 0 || project.id.length == 0) {
      this.status = WorkspaceState.NotReady;
    } else {
      this.tenant_id = tenant_id;
      this.project = project;
      this.status = WorkspaceState.Ready;
    }
    this.bcast.broadcast({type: this.status});

    return this.status == WorkspaceState.Ready;
  }

  private guardOk(): boolean {
    if (this.status == WorkspaceState.Ready) {
      return true
    }
    throw new Error('Workspace Service Guard protection');
  }

  getItems() {
    this.guardOk();
    return new Observable<Item[]>((subscriber) => {
      this.itemsRepo.getAll(this.tenant_id ?? "", {'path': this.project?.location}).subscribe({
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

  /*fetchAll(): Observable<boolean> {
    this.guardOk();

    return forkJoin({
      items: this.itemsRepo.getAll(this.tenant_id ?? "", {'path': this.project?.location}),      // http observable
    }).pipe(
      // if any inner fails, forkJoin errors -> catch once here
      tap(() => {
        this.is_data_ready = true;
        this.broadcast({type: WorkspaceState.Ready});
      }),
      mapTo(true),
      catchError(err => {
        this.logger.err('fetchAll failed', err);
        return of(false);
      })
    );
  }*/

}
