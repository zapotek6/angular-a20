import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, ChangeDetectorRef} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {AuthEvent, AuthService, BROADCAST_LOGOUT} from '../../core/auth/auth.service';
import {Router} from '@angular/router';
import {filter, Subscription} from 'rxjs';
import {WorkspaceService, WorkspaceState} from '../../core/workspace/workspace.service';
import {ProjectDto, ProjectsRepository} from '../../core/infra/repo/projects.repository';
import {Logger, LogSeverity} from '../../core/logger/logger';
import {LoggerService} from '../../core/logger/logger.service';
import {FormControl, FormGroup, FormsModule, NgControl, ReactiveFormsModule} from '@angular/forms';
import {Lister} from '../tools/lister/lister';
import {BroadcasterService} from '../../core/brodacaster.service';
import {AvailableTools, LeftSidebar} from '../left-sidebar/left-sidebar';
import {Roadmapper} from '../tools/roadmapper/roadmapper';
import {Button} from 'primeng/button';
import {Select, SelectChangeEvent} from 'primeng/select';
import {PmoDetail} from '../tools/roadmapper/pmo-detail/pmo-detail';
import {DomainTreeComponent} from './domain-tree/domain-tree.component';
import {FeatureMatrix} from '../tools/feature-matrix/feature-matrix';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [
    TranslateModule,
    FormsModule,
    ReactiveFormsModule,
    Lister,
    LeftSidebar,
    Roadmapper,
    Select,
    Button,
    PmoDetail,
    DomainTreeComponent,
    FeatureMatrix
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit, OnDestroy {
  private sub?: Subscription;
  ready = false;

  projects: ProjectDto[] = [];
  curr_project_uuid: string | null = null;

  defaultTool: AvailableTools = AvailableTools.LISTER;
  activeTool: AvailableTools | undefined = this.defaultTool;

  logger: Logger;
  private bcast: BroadcasterService;

  constructor(private readonly loggerService: LoggerService,
              private readonly projectsRepo: ProjectsRepository,
              private readonly workspace: WorkspaceService,
              private readonly auth: AuthService,
              private readonly router: Router,
              private readonly cdr: ChangeDetectorRef) {
    this.logger = this.loggerService.createLocalLoggerInstance("HomeComponent", LogSeverity.DEBUG);
    this.logger.enabled = true;
    this.logger.debug('constructor');
    this.bcast = new BroadcasterService(this.logger);
  }

  projectForm = new FormGroup({
    project_id: new FormControl<string | null>(this.curr_project_uuid)
  });

  /*form = new FormGroup({
    project_id: new FormControl<string | null>(this.curr_project_uuid)
  });*/

  ngOnInit(): void {
    this.logger.debug('ngOnInit', "HomeComponent.ngOnInit() called");

    this.bcast.onMessage((message) => {
      if (message?.type === WorkspaceState.Ready) {
        this.logger.debug('WorkspaceService Ready');
      }
      if (message?.type === AvailableTools.LISTER) {
        this.activeTool = AvailableTools.LISTER;
      }
      if (message?.type === AvailableTools.ROADMAPPER) {
        this.activeTool = AvailableTools.ROADMAPPER;
      }
      if (message?.type === AvailableTools.DUMMY) {
        this.activeTool = AvailableTools.DUMMY;
      }
      this.cdr.detectChanges();
    });

    // Watch for logout while on this page
    this.sub = this.auth.authChanges$.subscribe((s) => {
      if (!s) {
        this.router.navigateByUrl('/login');
      }
    });
    this.projectForm.controls.project_id.valueChanges.subscribe(value => {
      if (value) {
        if (this.curr_project_uuid != value) {
          this.curr_project_uuid = value;
          this.onProjectChange({
            originalEvent: undefined,
            value: value,
          })
        }

        this.logger.debug('Reactive form project_id changed:', value);
      }
    });
  }

  ngAfterViewInit(): void {
    this.logger.debug('ngAfterViewInit');

    this.refreshData();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  logout() {
    this.auth.logout();
  }

  isRefreshing = false;
  protected refreshData(): void {
    this.ready = false;
    this.isRefreshing = true;
    this.workspace.init("bsh11");
    this.projectsRepo.getAll(this.workspace.tenant_id ?? "", {'path': '/'}).subscribe({
      next: (projects) => {
        this.projects = projects;
        this.logger.debug('ngAfterViewInit', 'Project fetchAll Success', this.projects);
        this.ready = true;
        this.isRefreshing = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (err.status == 401) {
          this.bcast.broadcast({type: AuthEvent.ApiAuthFail});
          this.logger.err('ngAfterViewInit', 'Project fetchAll Failure', err);
        }
        this.ready = false;
        this.isRefreshing = false;
      }
    })
  }

  onProjectChange(event: SelectChangeEvent) {
    this.logger.debug('onProjectChange', 'Project changed', event);
    let project = this.projects.find(p => p.id == this.curr_project_uuid);
    if (project) {
      this.workspace.init(project.tenant_id);
      this.workspace.selectProject(project);
      this.activeTool = this.defaultTool;
    } else this.workspace.deInit();
  }

  protected readonly AvailableTools = AvailableTools;
  protected readonly filter = filter;
}
