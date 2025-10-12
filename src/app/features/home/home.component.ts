import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, ChangeDetectorRef} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {AuthService, BROADCAST_LOGOUT} from '../../core/auth/auth.service';
import {Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {WorkspaceService, WorkspaceState} from '../../core/workspace/workspace.service';
import {ProjectDto, ProjectsRepository} from '../../core/infra/repo/projects.repository';
import {Logger, LogSeverity} from '../../core/logger/logger';
import {LoggerService} from '../../core/logger/logger.service';
import {FormsModule} from '@angular/forms';
import {Lister} from '../tools/lister/lister';
import {BroadcasterService} from '../../core/brodacaster.service';
import {AvailableTools, LeftSidebar} from '../left-sidebar/left-sidebar';
import {Roadmapper} from '../tools/roadmapper/roadmapper';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [TranslateModule, FormsModule, Lister, LeftSidebar, Roadmapper],
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
      });
    // If somehow reached without being authenticated, ensure redirect
    /*if (!this.auth.isAuthenticated()) {
      this.router.navigateByUrl('/login');
      return;
    }*/
    // Watch for logout while on this page
    this.sub = this.auth.authChanges$.subscribe((s) => {
      if (!s) {
        this.router.navigateByUrl('/login');
      }
    });
  }

  ngAfterViewInit(): void {
    this.logger.debug('ngAfterViewInit', "HomeComponent.ngAfterViewInit() called");
    //this.workspace.fetchAll();
    this.projectsRepo.getAll("bsh11", {'path': '/'}).subscribe({
      next: (projects) => {
        this.projects = projects;
        this.logger.debug('ngAfterViewInit', 'Project fetchAll Success', this.projects);
        this.ready = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.logger.err('ngAfterViewInit', 'Project fetchAll Failure', err);
      }
    })
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  logout() {
    this.auth.logout();
  }

  onProjectChange(event: Event) {
    this.logger.debug('onProjectChange','Project changed', event);
    let project = this.projects.find(p => p.id == this.curr_project_uuid);
    if (project) {
      this.workspace.init(project.tenant_id, project);
      this.activeTool = this.defaultTool;
    } else this.workspace.deInit();
  }

  protected readonly AvailableTools = AvailableTools;
}
