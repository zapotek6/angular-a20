import {
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnChanges,
  OnInit,
  SimpleChanges
} from '@angular/core';
import {WorkspaceService, WorkspaceState} from '../../../core/workspace/workspace.service';
import {LoggerService} from '../../../core/logger/logger.service';
import {Logger, LogSeverity} from '../../../core/logger/logger';
import {PmoCard} from './pmo-card/pmo-card';
import {BroadcasterService} from '../../../core/brodacaster.service';
import {AvailableTools, LeftSidebar} from '../../left-sidebar/left-sidebar';
import {ReactiveFormsModule} from '@angular/forms';
import {Pmo} from '../../../core/models/pmo';

@Component({
  selector: 'app-lister',
  imports: [
    PmoCard,
    ReactiveFormsModule
  ],
  templateUrl: './lister.html',
  styleUrl: './lister.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Lister implements OnInit, OnChanges, AfterContentInit {
  pmos?: Pmo[];
  logger: Logger;
  bcast: BroadcasterService;

  constructor(private readonly workspace: WorkspaceService,
              private readonly loggerService: LoggerService,
              private readonly cdr: ChangeDetectorRef,) {
    this.logger = this.loggerService.createLocalLoggerInstance("ListerComponent", LogSeverity.DEBUG);
    this.logger.enabled = true;
    this.logger.debug('constructor');
    this.bcast = new BroadcasterService(this.logger);
  }

  ngAfterContentInit(): void {
        //throw new Error("Method not implemented.");
    }

  ngOnChanges(changes: SimpleChanges): void {
    this.logger.debug('ngOnChanges', changes);
    // this.refreshData();
    // this.cdr.detectChanges();
    }

  ngOnInit() {
    this.logger.debug('ngOnInit');
    this.bcast.onMessage((message) => {
      this.logger.debug("onMessage", message);
      if (message?.type === WorkspaceState.Ready) {
        this.logger.debug('WorkspaceService Ready');
        this.refreshData();
      }
      if (message?.type === WorkspaceState.NotReady) {
        this.logger.debug('WorkspaceService NotReady');
        this.cleanUp();
      }
      if (message?.type === AvailableTools.LISTER) {
        this.logger.debug('Ativate LISTER');
        this.refreshData();
      }
    });
  }

  cleanUp() {
    this.logger.debug('cleanUp');
    this.pmos = undefined;
    this.cdr.detectChanges();
  }
  refreshData() {
    this.workspace.getPmos().subscribe({
      next: (pmos) => {
        this.pmos = [...pmos];
        this.cdr.detectChanges();
        this.logger.debug('refreshData', 'Pmo read Success', this.pmos);
      },
      error: (err) => {
        this.logger.err('refreshData', 'Pmo read Failure', err);
      }
    })
  }
}
