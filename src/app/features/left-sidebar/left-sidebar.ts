import {ChangeDetectionStrategy, Component} from '@angular/core';
import {Logger, LogSeverity} from '../../core/logger/logger';
import {BroadcasterService} from '../../core/brodacaster.service';
import {LoggerService} from '../../core/logger/logger.service';

export enum AvailableTools { LISTER = 'TOOL-ACTIVATE-LISTER', DUMMY = 'TOOL-ACTIVATE-DUMMY'}

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

  constructor(private readonly loggerService: LoggerService) {
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
