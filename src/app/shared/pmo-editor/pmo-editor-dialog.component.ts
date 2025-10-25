import {ChangeDetectionStrategy, Component, inject, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {InputNumberModule} from 'primeng/inputnumber';
import {CheckboxModule} from 'primeng/checkbox';
import {SelectModule} from 'primeng/select';
import {Tab, TabList, TabPanel, TabPanels, Tabs} from 'primeng/tabs';
import {DynamicDialogConfig, DynamicDialogModule, DynamicDialogRef} from 'primeng/dynamicdialog';
import {WorkspaceService} from '../../core/workspace/workspace.service';
import {Category, Kind, Link, Pmo, ResourceEstimation} from '../../core/models/pmo';
import {Editor} from 'primeng/editor';
import {ResourceType} from '../../core/models/types';
import {IftaLabel} from 'primeng/iftalabel';

interface DialogData { mode: 'create'|'edit'; pmoId?: string }

@Component({
  selector: 'app-pmo-editor-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ButtonModule, InputTextModule, InputNumberModule, CheckboxModule, SelectModule, Tabs, TabPanel, DynamicDialogModule, Tab, TabList, TabPanels, Editor, IftaLabel],
  templateUrl: './pmo-editor-dialog.component.html',
  styleUrls: ['./pmo-editor-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PmoEditorDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  protected readonly ws = inject(WorkspaceService);
  private readonly config = inject(DynamicDialogConfig);
  private readonly ref = inject(DynamicDialogRef);

  activeTab= "0";
  mode: 'create'|'edit' = 'edit';
  pmo?: Pmo;
  allPmos: Pmo[] = [];
  kindOptions: {label: string, value: Kind}[] = [
    {label: 'ML', value: 'ML'},
    {label: 'SS', value: 'SS'},
    {label: 'TS', value: 'TS'},
    {label: 'RK', value: 'RK'},
    {label: 'AS', value: 'AS'},
    {label: 'ID', value: 'ID'},
  ];
  categoryOptions: {label: string, value: Category}[] = [
    {label: 'ATD', value: 'ATD'},
    {label: 'ANA', value: 'ANA'},
    {label: 'QUA', value: 'QUA'},
    {label: 'QAA', value: 'QAA'},
    {label: 'ORG', value: 'ORG'},
    {label: 'DEV', value: 'DEV'},
  ];

  form: FormGroup = this.fb.group({
    project_id: [{value: '', disabled: true}],
    kind: ['TS', []],
    key: [{value: '', disabled: true}],
    active: [true],
    category: ['DEV'],
    component: [''],
    domain: [''],
    name: [''],
    description: [''],
    owner_email: ['', []],
    estimations: this.fb.array([]),
    links: this.fb.array([]),

    // meta (read-only)
    id: [{value: '', disabled: true}],
    version: [{value: 0, disabled: true}],
    tenant_id: [{value: '', disabled: true}],
    location: [{value: '', disabled: true}],
    resource_type: [{value: '', disabled: true}],
    created_at: [{value: '', disabled: true}],
    updated_at: [{value: '', disabled: true}],
    created_by: [{value: '', disabled: true}],
    updated_by: [{value: '', disabled: true}],
  });

  // Temporary add-estimation form
  addEstForm: FormGroup = this.fb.group({
    resource_email: ['', [Validators.required, Validators.email]],
    effort_o: [0, [Validators.required]],
    effort_m: [0, [Validators.required]],
    effort_p: [0, [Validators.required]],
  });

  get estimationsFA(): FormArray<FormGroup> { return this.form.get('estimations') as FormArray<FormGroup>; }
  get linksFA(): FormArray<FormGroup> { return this.form.get('links') as FormArray<FormGroup>; }

  // Helper to satisfy strict [formControl] typing in templates
  fc(name: string): FormControl {
    return this.form.get(name) as FormControl;
  }
  fca(group: AbstractControl, name: string): FormControl {
    return group.get(name) as FormControl;
  }

  ngOnInit(): void {
    const data = (this.config.data ?? {}) as DialogData;
    this.mode = data.mode ?? 'edit';

    // Load all PMOs for links dropdown and, if needed, load selected PMO
    this.ws.getPmos().subscribe({
      next: (pmos) => {
        this.allPmos = pmos;
        if (this.mode === 'edit' && data.pmoId) {
          this.pmo = pmos.find(p => p.id === data.pmoId);
          if (this.pmo) this.patchFormFromModel(this.pmo);
        } else if (this.mode === 'create') {
          const p = new Pmo();
          p.project_id = this.ws.project_id ?? '';
          p.active = true;
          p.category = 'DEV';
          p.kind = 'TS';
          p.key = '';
          this.pmo = p;
          this.patchFormFromModel(p);
          // kind selection enabled, key will be generated when kind changes
          this.form.get('project_id')?.enable(); // display as readonly but allow default assignment
          this.form.get('project_id')?.disable();
        }
        // React to kind selection to generate key for new PMO
        if (this.mode === 'create') {
          this.form.get('kind')?.valueChanges.subscribe(async (k: Kind) => {
            if (!k) return;
            const max = await this.ws.getNextPmoKey(k);
            const next = (max || 0) + 1;
            this.form.get('key')?.setValue(`${k}.${next}`);
          });
        } else {
          // existing: kind and key are readonly
          this.form.get('kind')?.disable();
          this.form.get('key')?.disable();
          this.form.get('project_id')?.disable();
        }
      }
    });
  }

  private patchFormFromModel(p: Pmo) {
    this.form.patchValue({
      project_id: p.project_id,
      kind: p.kind,
      key: p.key,
      active: p.active,
      category: p.category,
      component: p.component,
      domain: p.domain,
      name: p.name,
      description: p.description,
      owner_email: p.owner_email,
      id: p.id,
      version: p.version,
      tenant_id: p.tenant_id,
      location: p.location,
      resource_type: p.resource_type,
      created_at: p.created_at,
      updated_at: p.updated_at,
      created_by: p.created_by,
      updated_by: p.updated_by,
    });

    // estimations
    this.estimationsFA.clear();
    (p.estimations ?? []).forEach(e => this.estimationsFA.push(this.buildEstimationFG(e)));

    // links (UI shows only selection by key; keep FormGroup with to.id and computed fields hidden)
    this.linksFA.clear();
    (p.links ?? []).forEach(l => this.linksFA.push(this.buildLinkFG(l)));
  }

  private buildEstimationFG(e?: ResourceEstimation): FormGroup {
    return this.fb.group({
      resource_email: [e?.resource_email ?? '', [Validators.required, Validators.email]],
      effort_o: [e?.effort_o ?? 0, [Validators.required]],
      effort_m: [e?.effort_m ?? 0, [Validators.required]],
      effort_p: [e?.effort_p ?? 0, [Validators.required]],
    });
  }

  private buildLinkFG(l?: Link): FormGroup {
    // Store only the target id/key for UI, but keep computed full struct in the value
    return this.fb.group({
      to_id: [l?.to?.id ?? '', [Validators.required]],
    });
  }

  addEstimation() {
    if (this.addEstForm.invalid) return;
    this.estimationsFA.push(this.buildEstimationFG(this.addEstForm.getRawValue()));
    this.addEstForm.reset({ resource_email: '', effort_o: 0, effort_m: 0, effort_p: 0 });
  }

  removeEstimation(i: number) {
    this.estimationsFA.removeAt(i);
  }

  addLinkByPmo(targetId: string) {
    if (!targetId) return;
    // Disallow self-link
    const selfId = this.form.get('id')?.value as string;
    if (selfId && targetId === selfId) return;
    // Do not duplicate
    const exists = this.linksFA.controls.some(c => (c.get('to_id')?.value as string) === targetId);
    if (exists) return;
    this.linksFA.push(this.buildLinkFG({ to: { tenant_id: this.ws.tenant_id ?? '', id: targetId, project_id: this.ws.project_id ?? '', name: '' }, from: { tenant_id: this.ws.tenant_id ?? '', id: selfId ?? '', project_id: this.ws.project_id ?? '', name: '' }, kind: 'Dependency' } as any));
  }

  removeLink(i: number) {
    this.linksFA.removeAt(i);
  }

  getPmoKeyById(id?: string): string {
    if (!id) return '';
    const p = this.allPmos.find(x => x.id === id);
    return p?.key ?? '';
  }

  cancel() {
    this.ref.close();
  }

  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Build PMO payload from form
    const f = this.form.getRawValue();
    const model = new Pmo();
    Object.assign(model, this.pmo ?? {});
    model.project_id = f.project_id ?? (this.ws.project_id ?? '');
    model.kind = f.kind;
    model.key = f.key;
    model.active = !!f.active;
    model.category = f.category;
    model.component = f.component ?? '';
    model.domain = f.domain ?? '';
    model.name = f.name ?? '';
    model.description = f.description ?? '';
    model.owner_email = f.owner_email ?? '';
    model.estimations = this.estimationsFA.getRawValue() as unknown as ResourceEstimation[];
    model.location = this.ws.getProjectResourcePath(ResourceType.Pmo) || '';

    // Build links struct from selected target ids
    const targetIds: string[] = this.linksFA.getRawValue().map((x: any) => x.to_id);
    model.links = targetIds.map((tid) => {
      const to = this.allPmos.find(p => p.id === tid);
      const link: Link = new Link();
      link.kind = 'Dependency';
      link.from.tenant_id = this.ws.tenant_id ?? '';
      link.from.project_id = model.project_id;
      link.from.id = model.id; // may be empty for new; adjust after create
      link.from.name = '';
      link.to.tenant_id = this.ws.tenant_id ?? '';
      link.to.project_id = to?.project_id ?? model.project_id;
      link.to.id = tid;
      link.to.name = to?.name ?? '';
      return link;
    });

    // Persist using repository via WorkspaceService
    const tenant = this.ws.tenant_id ?? '';
    if (this.mode === 'create' || !model.id) {
      // ensure key set for new
      if (!model.key) {
        const max = await this.ws.getNextPmoKey(model.kind);
        const next = (max || 0) + 1;
        model.key = `${model.kind}.${next}`;
      }
      this.ws.pmosRepo.create(tenant, model).subscribe({
        next: (saved) => {
          // fix links from.id if needed and update
          if (saved && saved.id && (model.links?.length ?? 0) > 0) {
            const needsFromFix = saved.links.some(l => !l.from?.id);
            if (needsFromFix) {
              saved.links = saved.links.map(l => ({...l, from: { ...(l.from ?? {}), id: saved.id, project_id: saved.project_id }} as any));
              this.ws.pmosRepo.update(tenant, saved).subscribe({ next: (finalSaved) => this.ref.close(finalSaved), error: () => this.ref.close(saved) });
              return;
            }
          }
          this.ref.close(saved);
        },
        error: (err) => {
          console.error('Create PMO failed', err);
        }
      });
    } else {
      this.ws.pmosRepo.update(tenant, model).subscribe({
        next: (saved) => this.ref.close(saved),
        error: (err) => { console.error('Update PMO failed', err); }
      });
    }
  }
}
