import {Component, ElementRef, inject, OnInit, Renderer2} from '@angular/core';
import {Logger, LogSeverity} from '../../../core/logger/logger';
import {BroadcasterService} from '../../../core/brodacaster.service';
import {LoggerService} from '../../../core/logger/logger.service';
import {WorkspaceService, WorkspaceState} from '../../../core/workspace/workspace.service';
import {Pmo} from '../../../core/models/pmo';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {TableModule} from 'primeng/table';
import {InputText} from 'primeng/inputtext';
import {FormsModule} from '@angular/forms';
import {Tag} from 'primeng/tag';
import {Moscow} from '../../../core/models/types';

@Component({
  selector: 'app-feature-matrix',
  imports: [
    IconField,
    InputIcon,
    TableModule,
    InputText,
    FormsModule,
    Tag,
  ],
  templateUrl: './feature-matrix.html',
  styleUrl: './feature-matrix.css'
})
export class FeatureMatrix implements OnInit {
  loading = false;

  logger: Logger;
  private bcast: BroadcasterService;

  constructor(private readonly loggerService: LoggerService,
              private readonly workspaceService: WorkspaceService) {
    this.logger = this.loggerService.createLocalLoggerInstance("FeatureMatrixComponent", LogSeverity.DEBUG);
    this.logger.enabled = true;
    this.logger.debug('constructor');

    this.bcast = new BroadcasterService(this.logger);
  }

  ngOnInit() {
    this.logger.debug('ngOnInit');

    this.bcast.onMessage((message) => {
      if (message?.type === WorkspaceState.ProjectSelected) {
        this.logger.debug('WorkspaceService ProjectSelected');
        this.refresh();
      }
    });
  }

  pmos: Pmo[] = [];
  ml: Pmo[] = [];
  ss: Pmo[] = [];

  private refresh() {
    this.workspaceService.getPmos().subscribe({
      next: (pmos) => {
        this.pmos = pmos;
      },
      complete: () => {
        this.ml = this.pmos.filter(pmo => pmo.kind === 'ML');
        this.ss = this.pmos.filter(pmo => pmo.kind === 'SS');
      }
    });
  }

  getSeverity(moscow: Moscow): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" | null | undefined {
    switch (moscow) {
      case Moscow.Must:
        return 'danger';
      case Moscow.Should:
        return 'warn';
      case Moscow.Could:
        return 'info';
      case Moscow.Wont:
        return 'success';
      default:
        return 'success';
    }
  }
  sampleFeatureMatrixData(): FeatureMatrixData {
    let fmdata: FeatureMatrixData = {
      cols: ["ML.1", "ML.2", "ML.3", "ML.4"],
      rows: [{
        pmo_row_id: "",
        key: "SS.1",
        name: "Feature 1",
        prios: [{
          pmo_col_id: "",
          key: "ML.1",
          name: "TWC",
          moscow: Moscow.Wont,
        },{
          pmo_col_id: "",
          key: "ML.2",
          name: "Livly",
          moscow: Moscow.Could,
        },{
            pmo_col_id: "",
            key: "ML.3",
            name: "3rd Party GA",
            moscow: Moscow.Should,
          },{
          pmo_col_id: "",
          key: "ML.4",
          name: "MVP GA",
          moscow: Moscow.Must,
        }],
        components: []
      },{
        pmo_row_id: "",
        key: "SS.2",
        name: "Feature 1",
        prios: [{
          pmo_col_id: "",
          key: "ML.1",
          name: "TWC",
          moscow: Moscow.Must,
        },{
          pmo_col_id: "",
          key: "ML.2",
          name: "Livly",
          moscow: Moscow.Must,
        },{
          pmo_col_id: "",
          key: "ML.3",
          name: "3rd Party GA",
          moscow: Moscow.Must,
        },{
          pmo_col_id: "",
          key: "ML.4",
          name: "MVP GA",
          moscow: Moscow.Must,
        }],
        components: []
      },{
        pmo_row_id: "",
        key: "SS.3",
        name: "Feature 3",
        prios: [{
          pmo_col_id: "",
          key: "ML.1",
          name: "TWC",
          moscow: Moscow.Should,
        },{
          pmo_col_id: "",
          key: "ML.2",
          name: "Livly",
          moscow: Moscow.Should,
        },{
          pmo_col_id: "",
          key: "ML.3",
          name: "3rd Party GA",
          moscow: Moscow.Must,
        },{
          pmo_col_id: "",
          key: "ML.4",
          name: "MVP GA",
          moscow: Moscow.Must,
        }],
        components: []
      },{
        pmo_row_id: "",
        key: "SS.4",
        name: "Feature 4",
        prios: [{
          pmo_col_id: "",
          key: "ML.1",
          name: "TWC",
          moscow: Moscow.Wont,
        },{
          pmo_col_id: "",
          key: "ML.2",
          name: "Livly",
          moscow: Moscow.Wont,
        },{
          pmo_col_id: "",
          key: "ML.3",
          name: "3rd Party GA",
          moscow: Moscow.Wont,
        },{
          pmo_col_id: "",
          key: "ML.4",
          name: "MVP GA",
          moscow: Moscow.Must,
        }],
        components: []
      },{
        pmo_row_id: "",
        key: "SS.5",
        name: "Feature 5",
        prios: [{
          pmo_col_id: "",
          key: "ML.1",
          name: "TWC",
          moscow: Moscow.Wont,
        },{
          pmo_col_id: "",
          key: "ML.2",
          name: "Livly",
          moscow: Moscow.Could,
        },{
          pmo_col_id: "",
          key: "ML.3",
          name: "3rd Party GA",
          moscow: Moscow.Must,
        },{
          pmo_col_id: "",
          key: "ML.4",
          name: "MVP GA",
          moscow: Moscow.Must,
        }],
        components: []
      }]
    }
    return fmdata;
  }
  featureMatrixData: FeatureMatrixData = this.sampleFeatureMatrixData();
}


type FeatureMatrixPrio = {
  pmo_col_id: string,
  key: string,
  name: string,
  moscow: Moscow,
}

type featureMatrixComponent = {
  name: string,
  affected: boolean,
}

type FeatureMatrixRow = {
  pmo_row_id: string,
  key: string,
  name: string,
  prios: FeatureMatrixPrio[],
  components: featureMatrixComponent[],
}

type FeatureMatrixData = {
  rows: FeatureMatrixRow[],
  cols: string[],
}
