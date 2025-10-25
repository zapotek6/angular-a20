import {Injectable} from '@angular/core';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {PmoEditorDialogComponent} from './pmo-editor-dialog.component';

@Injectable({ providedIn: 'root' })
export class PmoEditorService {
  constructor(private readonly dialog: DialogService) {}

  edit(pmoId: string, options?: { header?: string; width?: string }): DynamicDialogRef<PmoEditorDialogComponent> | null {
    return this.dialog.open(PmoEditorDialogComponent, {
      header: options?.header ?? 'Edit PMO',
      width: options?.width ?? '1200px',
      data: { mode: 'edit', pmoId },
      closable: false,
      dismissableMask: false,
      modal: true
    });
  }

  create(options?: { header?: string; width?: string }): DynamicDialogRef<PmoEditorDialogComponent> | null {
    return this.dialog.open(PmoEditorDialogComponent, {
      header: options?.header ?? 'Create PMO',
      width: options?.width ?? '1200px',
      data: { mode: 'create' },
      closable: false,
      dismissableMask: false,
      modal: true
    });
  }
}
