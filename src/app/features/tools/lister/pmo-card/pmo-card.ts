import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {Logger, LogSeverity} from '../../../../core/logger/logger';
import {AuthService} from '../../../../core/auth/auth.service';
import {WorkspaceService} from '../../../../core/workspace/workspace.service';
import {LoggerService} from '../../../../core/logger/logger.service';
import {Item} from '../../../../core/models/item';
import {BroadcasterService} from '../../../../core/brodacaster.service';

@Component({
  selector: 'app-pmo-card',
  imports: [
  ],
  templateUrl: './pmo-card.html',
  styleUrl: './pmo-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PmoCard {
  @Input() pmo?: Item;
  logger: Logger;
  bcast: BroadcasterService;

  expand = false;
  constructor(private readonly auth: AuthService,
              private readonly workspace: WorkspaceService,
              private readonly loggerService: LoggerService) {
    this.logger = this.loggerService.createLocalLoggerInstance("PmoCardComponent", LogSeverity.DEBUG);
    this.logger.enabled = true;
    this.logger.debug('constructor');
    this.bcast = new BroadcasterService(this.logger);
  }

  ngOnInit() {
    this.logger.debug('ngOnInit', "PmoCardComponent.ngOnInit() called");
    /*if (this.pmo_uuid) {
      this.workspace.itemsRepo?.read(this.workspace.tenant_id ?? "", this.pmo_uuid).subscribe({
        next: (item) => {
          this.item = item;
          this.logger.debug('ngOnInit', 'Item read Success', this.item);
        },
        error: (err) => {
          this.logger.err('ngOnInit', 'Item read Failure', err);
        }
      })
    }*/
  }

  toggleExpand() {
    this.expand = !this.expand;
  }
}
