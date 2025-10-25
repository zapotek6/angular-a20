import {ChangeDetectorRef, Component} from '@angular/core';
import {ContextMenu} from 'primeng/contextmenu';
import {MenuItem} from 'primeng/api';
import {Subscription} from 'rxjs';
import {Logger, LogSeverity} from '../../../../core/logger/logger';
import {BroadcasterService} from '../../../../core/brodacaster.service';
import {LoggerService} from '../../../../core/logger/logger.service';
import {WorkspaceService} from '../../../../core/workspace/workspace.service';
import {AuthService} from '../../../../core/auth/auth.service';
import {Router} from '@angular/router';

@Component({
  selector: 'app-ctx-menu',
  imports: [ContextMenu],
  templateUrl: './ctx-menu.html',
  styleUrl: './ctx-menu.css'
})
export class CtxMenu {
  items: MenuItem[] = [
    { label: 'Refresh',  icon: 'pi pi-refresh',  command: () => this.refresh() },
    { label: 'Edit',     icon: 'pi pi-pencil',   command: () => this.edit() },
    { separator: true },
    { label: 'Delete',   icon: 'pi pi-trash',    command: () => this.remove(), disabled: false },
    {
      label: 'More', icon: 'pi pi-ellipsis-h',
      items: [
        { label: 'Details', icon: 'pi pi-info-circle', command: () => this.details() }
      ]
    }
  ];

  private sub?: Subscription;
  logger: Logger;
  private bcast: BroadcasterService;

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

  onRightClick(ev: MouseEvent, cm: ContextMenu) {
    ev.preventDefault();           // prevent the browser default menu
    cm.show(ev);                   // open PrimeNG menu at cursor position
  }

  refresh() { /* ... */ }
  edit()    { /* ... */ }
  remove()  { /* ... */ }
  details() { /* ... */ }
}
