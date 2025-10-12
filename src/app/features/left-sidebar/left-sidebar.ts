import {ChangeDetectionStrategy, Component} from '@angular/core';
import {Logger, LogSeverity} from '../../core/logger/logger';
import {BroadcasterService} from '../../core/brodacaster.service';
import {LoggerService} from '../../core/logger/logger.service';
import {WorkspaceService} from '../../core/workspace/workspace.service';
import {NgOptimizedImage} from '@angular/common';

export enum AvailableTools { LISTER = 'TOOL-ACTIVATE-LISTER', ROADMAPPER = 'TOOL-ACTIVATE-ROADMAPPER', DUMMY = 'TOOL-ACTIVATE-DUMMY'}

@Component({
  selector: 'app-left-sidebar',
  imports: [],
  templateUrl: './left-sidebar.html',
  styleUrl: './left-sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeftSidebar {
  private readonly logger: Logger;
  private bcast: BroadcasterService;

  constructor(private readonly loggerService: LoggerService,
              private readonly Workspace: WorkspaceService,) {
    this.logger = this.loggerService.createLocalLoggerInstance("LeftSidebarComponent", LogSeverity.DEBUG);
    this.logger.enabled = true;
    this.logger.debug('constructor');
    this.bcast = new BroadcasterService(this.logger);
  }

  protected activateTool(tool: AvailableTools) {
    this.logger.debug('activateTool', tool);
    this.bcast.broadcast({type: tool});
  }

  protected readonly AvailableTools = AvailableTools;
}
