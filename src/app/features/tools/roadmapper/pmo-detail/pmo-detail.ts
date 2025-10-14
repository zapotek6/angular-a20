import {AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {Logger, LogSeverity} from '../../../../core/logger/logger';
import {BroadcasterService} from '../../../../core/brodacaster.service';
import {LoggerService} from '../../../../core/logger/logger.service';
import {WorkspaceService, WorkspaceState} from '../../../../core/workspace/workspace.service';
import {AuthEvent, AuthService} from '../../../../core/auth/auth.service';
import {Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {Pmo} from '../../../../core/models/pmo';
import {RoadMapperEvents} from '../roadmapper';
import {Tag} from 'primeng/tag';
import {FormsModule} from '@angular/forms';
import {InputTextModule} from 'primeng/inputtext';
import {IftaLabel} from 'primeng/iftalabel';

@Component({
  selector: 'app-pmo-detail',
  imports: [
    Tag,
    InputTextModule,
    FormsModule,
    IftaLabel
  ],
  templateUrl: './pmo-detail.html',
  styleUrl: './pmo-detail.css'
})
export class PmoDetail implements OnInit, AfterViewInit, OnDestroy {
  private sub?: Subscription;
  logger: Logger;
  private bcast: BroadcasterService;

  pmoId?: string;
  pmo?: Pmo;
  constructor(private readonly loggerService: LoggerService,
              private readonly workspace: WorkspaceService,
              private readonly auth: AuthService,
              private readonly router: Router,
              private readonly cdr: ChangeDetectorRef) {
    this.logger = this.loggerService.createLocalLoggerInstance("PmoDetailComponent", LogSeverity.DEBUG);
    this.logger.enabled = true;
    this.logger.debug('constructor');
    this.bcast = new BroadcasterService(this.logger);
  }

  ngOnInit(): void {
    this.logger.debug('ngOnInit');

    this.bcast.onMessage((message) => {
      if (message?.type === WorkspaceState.Ready) {
        this.logger.debug('WorkspaceService Ready');
      }
      if (message?.type === RoadMapperEvents.PMO_SELECTED) {
        if (message?.id) {
          this.pmoId = message.id;
          this.refreshData(message.id);
        } else {
          this.logger.warn("Invalid pmo id");
        }
      }
     /* if (message?.type === AvailableTools.LISTER) {
        this.activeTool = AvailableTools.LISTER;
      }
      if (message?.type === AvailableTools.ROADMAPPER) {
        this.activeTool = AvailableTools.ROADMAPPER;
      }
      if (message?.type === AvailableTools.DUMMY) {
        this.activeTool = AvailableTools.DUMMY;
      }*/

    });

    // Watch for logout while on this page
    this.sub = this.auth.authChanges$.subscribe((s) => {
      if (!s) {
        this.router.navigateByUrl('/login');
      }
    });
  }

  ngAfterViewInit(): void {
    this.logger.debug('ngAfterViewInit');
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  logout() {
    this.auth.logout();
  }

  ready = false;
  isRefreshing = false;
  protected refreshData(pmoId: string): void {
    this.ready = false;
    this.isRefreshing = true;
    this.workspace.getPmos().subscribe({
      next: (pmos) => {
        this.pmo = pmos.find(pmo => pmo.id == pmoId);
        this.logger.debug(`refreshData ${pmoId}`, this.pmo);
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
}
