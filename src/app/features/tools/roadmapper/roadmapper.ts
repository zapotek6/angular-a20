import {AfterViewInit, Component, ElementRef, inject, Inject, OnInit, Renderer2, ViewChild} from '@angular/core';
import {Pmo} from '../../../core/models/pmo';
import {WorkspaceService, WorkspaceState} from '../../../core/workspace/workspace.service';
import {BroadcasterService} from '../../../core/brodacaster.service';
import {LoggerService} from '../../../core/logger/logger.service';
import {Logger, LogSeverity} from '../../../core/logger/logger';
import {Links} from '../../../core/infra/repo/pagination';
import {ContextMenu} from 'primeng/contextmenu';
import {MenuItem} from 'primeng/api';
import {Menubar} from 'primeng/menubar';
import {PmoEditorService} from '../../../shared/pmo-editor/pmo-editor.service';
import {forkJoin, Subscription} from 'rxjs';
import {Layout, Node as LayoutNode, Position as LayoutPosition} from '../../../core/models/layout';

type Point = { x: number; y: number };

type Size = { w: number; h: number };

class TextMeasure {
  width: number = 0;
  height: number = 0;
  ascent: number = 0;
  descent: number = 0;
}

enum TextVert { TOP, MIDDLE, BOTTOM }

enum TextHoriz { LEFT, CENTER, RIGHT }

class Text {
  text: string = '';
  measure: TextMeasure = new TextMeasure();

  static new(text: string, measure: TextMeasure): Text {
    let t = new Text();
    t.text = text;
    t.measure = measure;
    return t;
  }

  height(): number {
    return this.measure.height;
  }

  width(): number {
    return this.measure.width;
  }
}

class SplitTextInRowResult {
  rows: Text[] = [];
  style?: CSSStyleDeclaration;

  height(): number {
    return this.rows.reduce((acc, row) => acc + row.height(), 0);
  }

  maxWidth(): number {
    return this.rows.reduce(
      (max, row) => Math.max(max, row.width()),
      0
    );
  }
}


interface Pill {
  visible: boolean;
  text: string;
  class: string;
}

interface NodeModel {
  nodeClass: string;
  id: string;
  projectId: string,
  key: string;
  title: string;
  pill?: Pill;
  meta: string;
  ticket: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LinkModel {
  id: string;
  from: string;
  to: string;
}

interface DragState {
  model: NodeModel;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  el: SVGGElement;
}

type StyleContext = {
  styles?: CSSStyleDeclaration,
  remFontSize: number,
  emFontSize: number
}

const svgns = "http://www.w3.org/2000/svg";

export enum RoadMapperEvents { PMO_SELECTED = 'ROADMAPPER-PMO_SELECTED'}

@Component({
  selector: 'app-roadmapper',
  imports: [
    ContextMenu,
    Menubar
  ],
  templateUrl: './roadmapper.html',
  styleUrl: './roadmapper.scss'
})
export class Roadmapper implements OnInit, AfterViewInit {
  private scopeAttrName: string
  @ViewChild('stage', {static: false}) stageRef!: ElementRef<SVGSVGElement>;
  @ViewChild('root', {static: false}) rootRef!: ElementRef<SVGSVGElement>;
  @ViewChild('links', {static: false}) linksRef!: ElementRef<SVGSVGElement>;
  @ViewChild('nodes', {static: false}) nodessRef!: ElementRef<SVGSVGElement>;
  @ViewChild('ctxMenu', {static: false}) ctxMenuRef!: ContextMenu;
  stage?: SVGSVGElement;
  gRoot?: SVGElement;
  gLinks?: SVGElement;
  gNodes?: SVGElement;
  pmos?: Pmo[];
  layouts?: Layout[];
  // Currently applied layout (optional)
  currentLayout?: Layout;

  nodes = new Map<string, NodeModel>();
  links: LinkModel[] = [];
  nodeById = new Map<string, NodeModel>();
  pmosByProjectKey = new Map<string, Pmo>();
  linkEls = new Map<string, SVGPathElement>();
  nodeGroups = new Map<string, SVGGElement>();
  // Expanded SS state and nested ownership mapping
  expandedSS: Set<string> = new Set<string>();
  // Maps nodeId -> owning SSId when the node is drawn nested inside an expanded SS
  nestedNodeOwner: Map<string, string> = new Map<string, string>();
  // Per-SS inner layout positions (local coords within the SS group)
  innerPositionsBySS: Map<string, Map<string, Point>> = new Map();

  // Grid visibility controls
  showPrimaryGrid: boolean = true;
  showSecondaryGrid: boolean = true;

  // Snapping controls
  snapToPrimaryGrid: boolean = false;
  snapToSecondaryGrid: boolean = true;

  private readonly PRIMARY_GRID_SIZE = 100;
  private readonly SECONDARY_GRID_SIZE = 10;

  // Grid pattern refs (for panning sync)
  private gridPattern10?: SVGPatternElement;
  private gridPattern100?: SVGPatternElement;

  canvas?: HTMLCanvasElement;
  ctx?: CanvasRenderingContext2D;

  ctxMenuRowItems: MenuItem[] = [
    { label: 'Refresh',  icon: 'pi pi-refresh',  command: () => this.refresh() },
    { label: 'Edit',     icon: 'pi pi-pencil',   command: () => {} },
    { separator: true },
    { label: 'Delete',   icon: 'pi pi-trash',    command: () => {}, disabled: false },
    {
      label: 'More', icon: 'pi pi-ellipsis-h',
      items: [
        { label: 'Details', icon: 'pi pi-info-circle', command: () => {} }
      ]
    }
  ];

  menuItems: MenuItem[] = [
    {
      label: 'File',
      items: [
        { label: 'New', icon: 'pi pi-fw pi-plus', command: () => {} },
        { label: 'Open', icon: 'pi pi-fw pi-folder-open', command: () => {} },
        { label: 'Save', icon: 'pi pi-fw pi-save', command: () => {} },
        { separator: true },
        { label: 'Exit', icon: 'pi pi-fw pi-times' }
      ]
    },
    {
      label: 'Layout',
      items: [
        { label: 'Save', icon: 'pi pi-fw pi-save' },
        { label: 'Redo', icon: 'pi pi-fw pi-redo' }
      ]
    },
    {
      label: 'Help',
      items: [
        { label: 'About', icon: 'pi pi-fw pi-info' }
      ]
    }
  ];

  pmoEditorService = inject(PmoEditorService);
  private sub?: Subscription;

  logger: Logger;
  private bcast: BroadcasterService;
  constructor(private readonly loggerService: LoggerService,
              private readonly workspaceService: WorkspaceService,
              private el: ElementRef<HTMLElement>,
              private r: Renderer2) {
    this.logger = this.loggerService.createLocalLoggerInstance("RoadmapperComponent", LogSeverity.DEBUG);
    this.logger.enabled = true;
    this.logger.debug('constructor');

    const host = this.el.nativeElement;
    const attr = Array.from(host.attributes)
      .map(a => a.name)
      .find(n => n.startsWith('_nghost-'))?.replace('_nghost-', '_ngcontent-');
    this.scopeAttrName = attr ?? '';

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d') || undefined;
    this.bcast = new BroadcasterService(this.logger);
  }

  ngOnInit() {
    this.logger.debug('ngOnInit');

    this.bcast.onMessage((message) => {
      if (message?.type === WorkspaceState.ProjectSelected) {
        this.logger.debug('WorkspaceService ProjectSelected');
        this.refresh();
        /*this.workspaceService.getLayouts().subscribe({
          next: (layouts) => {
            this.layouts = this.layouts?.concat(layouts);
          },
          error: (error) => {
            this.logger.err('Error fetching layouts:', error);
          },
          complete: () => {
            if (this.layouts && this.layouts.length > 0) {
              // this.applyLayout(this.layouts[0]);
              this.currentLayout = this.layouts[0];
            }
            this.refresh();
            this.logger.info('Layouts fetched successfully');
          }
        })*/
      }
    });
  }

  ngAfterViewInit() {
    this.stage = this.stageRef.nativeElement;
    this.gRoot = this.rootRef.nativeElement;
    this.gLinks = this.linksRef.nativeElement;
    this.gNodes = this.nodessRef.nativeElement;

    // cache grid patterns and initialize transform to current pan
    this.gridPattern10 = this.stage.querySelector('#grid10') as SVGPatternElement | null || undefined;
    this.gridPattern100 = this.stage.querySelector('#grid100') as SVGPatternElement | null || undefined;
    this.updateGridPatternTransform(this.panOffset.x, this.panOffset.y, this.zoom);

    this.setupSVGPanningEventListeners();
    this.setupSVGZoomEventListeners();

    this.menuItems.filter(m => m.label === 'Layout').forEach(m => {
      m.items?.filter(i => i.label === 'Save').forEach(i => {
        i.command = () => { this.saveLayout(); }
      })
    });


  }

  // Expose an API to apply a layout and redraw
  public setLayout(layout: Layout) {
    this.currentLayout = layout;
    // If nodes/links already exist apply immediately, else it will be applied on next refresh
    if (this.nodes && this.nodes.size > 0) {
      this.applyLayout(layout);
      this.cleanUpNodesAndLinks();
      this.drawNodes();
      this.drawLinks();
    }
  }

  public saveLayout() {
    if (this.currentLayout) {
      let layout = this.getCurrentLayout();
      this.workspaceService.layoutsRepo.update(this.workspaceService.tenant_id ?? "", layout).subscribe({
        next: (layout) => {
          this.currentLayout = layout;
        },
        complete: () => {
          this.logger.info('Layout saved successfully');
        },
        error: (error) => {
          this.logger.err('Error saving layout:', error);
        }
      });
    } else {
      let layout = this.getCurrentLayout();
      this.workspaceService.layoutsRepo.create(this.workspaceService.tenant_id ?? "", layout).subscribe({
        complete: () => {
          this.logger.info('Layout saved successfully');
        },
        error: (error) => {
          this.logger.err('Error saving layout:', error);
        }
      });
    }
  }
  // Return current absolute positions as a Layout
  public getCurrentLayout(name?: string, description?: string): Layout {
    const layout = new Layout();
    layout.name = name ?? (this.currentLayout?.name ?? '');
    layout.description = description ?? (this.currentLayout?.description ?? '');
    layout.nodes = [];
    layout.embedded_layouts = [];
    layout.location = this.currentLayout?.location ?? this.workspaceService.getProjectLocation();

    // Ensure nested ownership is up-to-date
    this.rebuildNestedOwnership();

    // Build nodes entries with absolute positions
    this.nodes.forEach((n) => {
      const ln = new LayoutNode();
      ln.id = n.id;

      // Compute absolute position. If nested under an expanded SS, use SS position + local inner position.
      let absX = n.x;
      let absY = n.y;
      const owner = this.nestedNodeOwner.get(n.id);
      if (owner && owner !== n.id) {
        const local = this.innerPositionsBySS.get(owner)?.get(n.id);
        const ssNode = this.nodeById.get(owner);
        if (local && ssNode) {
          absX = ssNode.x + local.x;
          absY = ssNode.y + local.y;
        }
      }

      ln.pos = new LayoutPosition();
      ln.pos.x = absX;
      ln.pos.y = absY;
      // Persist collapsed state for SS nodes (expandedSS contains expanded ones)
      ln.collapsed = (n.nodeClass === 'ss') ? !this.expandedSS.has(n.id) : false;
      ln.hidden = false;

      layout.nodes.push(ln);
    });

    // pass-through some meta when available
    if (this.currentLayout) {
      layout.id = this.currentLayout.id;
      layout.version = this.currentLayout.version;
      layout.tenant_id = this.currentLayout.tenant_id;
      layout.location = this.currentLayout.location;
      layout.resource_type = this.currentLayout.resource_type;
      layout.created_at = this.currentLayout.created_at;
      layout.updated_at = this.currentLayout.updated_at;
      layout.created_by = this.currentLayout.created_by;
      layout.updated_by = this.currentLayout.updated_by;
    }

    return layout;
  }

  private applyLayout(layout: Layout) {
    const byId = new Map<string, LayoutNode>();
    (layout.nodes || []).forEach(n => byId.set(n.id, n));

    // Apply positions to all known nodes
    this.nodes.forEach((n, id) => {
      const ln = byId.get(id);
      if (ln && ln.pos) {
        n.x = ln.pos.x;
        n.y = ln.pos.y;
      }
    });

    // Rebuild SS expanded/collapsed state based on layout's collapsed flag
    this.expandedSS.clear();
    this.nodes.forEach((n, id) => {
      if (n.nodeClass === 'ss') {
        const ln = byId.get(id);
        if (ln && typeof ln.collapsed === 'boolean') {
          if (!ln.collapsed) this.expandedSS.add(id);
        }
      }
    });

    // Initialize inner local positions from absolute positions for each expanded SS
    this.innerPositionsBySS.clear();
    this.expandedSS.forEach(ssId => {
      const ssNode = this.nodeById.get(ssId);
      if (!ssNode) return;
      const deps = Array.from(this.collectDependencies(ssId));
      const posMap = new Map<string, Point>();
      deps.forEach(depId => {
        const depLayout = byId.get(depId);
        if (!depLayout || !depLayout.pos) return;
        // Convert absolute pos to local within SS
        posMap.set(depId, {
          x: depLayout.pos.x - ssNode.x,
          y: depLayout.pos.y - ssNode.y,
        });
      });
      this.innerPositionsBySS.set(ssId, posMap);
    });

    this.currentLayout = layout;
    // Note: container sizes are recomputed in drawExpandedSS based on inner positions
  }

  private refresh() {
    this.sub = forkJoin({
      pmos: this.workspaceService.getPmos(),
      layouts: this.workspaceService.getLayouts(),
    }).subscribe({
      next: ({pmos, layouts}) => {
        this.pmos = pmos;
        this.pmosByProjectKey = new Map<string, Pmo>(pmos.map(p => [`${p.project_id}::${p.key}`, p]));
        this.layouts = this.layouts?.concat(layouts) || layouts;
        },
      complete: () => {
        if (this.layouts && this.layouts.length > 0) {
          this.currentLayout = this.layouts[0];
        }

        let [nodesArray, linksArray] = this.buildNodesAndLinks(this.pmos || []);

        this.nodes = new Map<string, NodeModel>(nodesArray.map(n => [n.id, n]));
        this.nodeById = this.nodes;
        this.links = linksArray;

        // If a layout has been selected/applied, use it to position nodes and set SS states
        if (this.currentLayout) {
          this.applyLayout(this.currentLayout);
        }

        this.cleanUpNodesAndLinks();
        this.drawNodes();
        this.drawLinks();
      }
    });
  }

  private convertPmoToNode(pmo: Pmo, position: Point, size: Size): NodeModel {
    let node: NodeModel = {
      nodeClass: `${pmo.kind.toLowerCase()}`,
      projectId: pmo.project_id,
      key: pmo.key,
      id: pmo.id,
      meta: '',
      pill: {
        visible: false,
        text: "",
        class: ""
      },
      ticket: '',
      title: pmo.name,
      x: position.x,
      y: position.y,
      w: size.w,
      h: size.h,
    };
    return node;
  }

  private buildNodesAndLinks(pmos: Pmo[]): [NodeModel[], LinkModel[]] {
    let nodes: NodeModel[] = [];

    let pos = {x: 100, y: 100};
    let sz = {w: 200, h: 100};
    nodes = pmos.map(pmo => {
      let node = this.convertPmoToNode(pmo,pos, sz);
      pos.x += 100;
      pos.y += 100;
      return node;
    });

    let linksModel: LinkModel[] = [];

    pmos.map(pmo => {
      let links = pmo.links.map(dep => {
        let link: LinkModel = {
          from: pmo.id,
          id: crypto.randomUUID(),
          to: dep.to.id,
        }
        return link;
      });

      linksModel = linksModel.concat(links);
    });

    return [nodes, linksModel];
  }

  private createEl<K extends keyof SVGElementTagNameMap>(
    name: K,
    attrs: Record<string, string | number> = {},
    parent?: SVGElement | null
  ): SVGElementTagNameMap[K] {
    const el = document.createElementNS(svgns, name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));

    // add _ngcontent- to let the component's css apply to the elements added at runtime
    if (this.scopeAttrName) el.setAttribute(this.scopeAttrName, '');

    if (parent) parent.appendChild(el);
    return el;
  }

  private centerRight(n: NodeModel): Point {
    return {x: n.x + n.w, y: n.y + n.h / 2};
  }

  private centerLeft(n: NodeModel): Point {
    return {x: n.x, y: n.y + n.h / 2};
  }

  /** Smooth cubic Bezier path from src→dst */
  private linkPath(src: NodeModel, dst: NodeModel): string {
    const p0 = this.centerRight(src);
    const p1 = this.centerLeft(dst);
    const dx = (p1.x - p0.x) * 0.35; // curvature
    const c1 = {x: p0.x + dx, y: p0.y};
    const c2 = {x: p1.x - dx, y: p1.y};
    return `M ${p0.x} ${p0.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p1.x} ${p1.y}`;
  }

  private drawLinks(): void {
    // Redraw top-level links only for nodes that are not nested inside an expanded SS
    // Clear existing links elements each time to avoid stale paths
    this.gLinks?.replaceChildren();
    this.linkEls.clear();

    this.links.forEach(l => {
      // Skip links where either endpoint is nested inside an expanded SS
      const ownerFrom = this.nestedNodeOwner.get(l.from);
      const ownerTo = this.nestedNodeOwner.get(l.to);
      if ((ownerFrom && ownerFrom !== l.from) || (ownerTo && ownerTo !== l.to)) return;

      const s = this.nodeById.get(l.from);
      const t = this.nodeById.get(l.to);
      if (!s || !t) return;
      let path = this.linkEls.get(l.id);
      if (!path) {
        path = this.createEl("path", {class: "link", "marker-end": "url(#arrow)"}, this.gLinks);
        this.linkEls.set(l.id, path);
      }
      path.setAttribute("d", this.linkPath(s, t));
    });
  }

  private fitTextToRect(textEl: SVGTextElement, rectWidth: number) {
    const text = textEl.textContent || "";
    const bbox = textEl.getBBox();
    if (bbox.width > rectWidth - 10) {
      let truncated = text;
      while (textEl.getBBox().width > rectWidth - 10 && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
        textEl.textContent = truncated + "…";
      }
    }
  }

  private measureTextCanvas(
    text: string,
    font: string
  ): { width: number; height: number; ascent: number; descent: number } {
    // Create an offscreen canvas

    if (!this.ctx) {
      throw new Error('2D canvas context not supported');
    }

    // Define the font (same syntax as CSS)
    this.ctx.font = `${font}`;

    // Measure text metrics
    const metrics = this.ctx.measureText(text);

    // Compute height from ascent + descent
    const ascent = metrics.actualBoundingBoxAscent;
    const descent = metrics.actualBoundingBoxDescent;

    return {
      width: metrics.width,
      height: ascent + descent,
      ascent,
      descent,
    };
  }

  private parseCssValueToPx = (cssValue: string, ctx: StyleContext): number => {
    let value = parseFloat(cssValue);
    let unit = cssValue.replace(/[0-9.\-]/g, '').trim();
    switch (unit) {
      case 'px':
      case '':
        return value;
      case 'rem':
        return value * ctx.remFontSize;
      case 'em':
        return value * ctx.emFontSize;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }
  };

  private sumCssValuesToPx(ctx: StyleContext, ...cssValues: string[]): number {
    let sum = 0;
    cssValues.forEach((value, i) => {
      sum += this.parseCssValueToPx(value, ctx);
    });

    return sum;
  }

  private splitsText(text: string): string[] {
    return text.split(/\s+/);
  }

  private splitsTextInRows(text: string, style: CSSStyleDeclaration, maxWidth: number): SplitTextInRowResult {
    let splitTextInRows: SplitTextInRowResult = new SplitTextInRowResult();
    splitTextInRows.style = style;
    //let rows: Text[] = [];
    let fragments = this.splitsText(text);
    let rowId = 0;
    splitTextInRows.rows[rowId] = new Text();
    for (let fragment of fragments) {
      let measure = splitTextInRows.rows[rowId].text + ' ' + fragment;
      let textSize = this.measureTextCanvas(measure, style.font);
      if (textSize.width > maxWidth) { // Freeze the rows[rowId], start new row and add the
        rowId++;
        splitTextInRows.rows[rowId] = Text.new(fragment, this.measureTextCanvas(fragment, style.font));
      } else {
        splitTextInRows.rows[rowId].text = splitTextInRows.rows[rowId].text + ' ' + fragment;
        splitTextInRows.rows[rowId].measure = this.measureTextCanvas(splitTextInRows.rows[rowId].text, style.font);
      }
    }

    return splitTextInRows;
  }

  private removeLastWord(text: string): string {
    const parts = text.trim().split(/\s+/);   // split on one or more spaces
    parts.pop();                              // remove the last word
    return parts.join(' ');
  }

  private ellipsizeRows(splitRowsResult: SplitTextInRowResult, maxHeight: number, ctx: StyleContext): Text[] {
    if (splitRowsResult.style === undefined || splitRowsResult.style.font === undefined) {
      throw new Error('style not defined (CSSStyleDeclaration)');
    }
    let rows: Text[] = [];
    let height = 0;
    for (let row of splitRowsResult.rows) {
      height += this.parseCssValueToPx(splitRowsResult.style.lineHeight, ctx);
      if (height > maxHeight) {
        let lastId = rows.length - 1;
        rows[lastId].text = this.removeLastWord(rows[lastId].text) + ' ...';
        rows[lastId].measure = this.measureTextCanvas(rows[lastId].text, splitRowsResult.style.font);
        return rows;
      }
      rows.push(row);
    }
    return rows;
  }

  private getTextPosition(ctx: StyleContext) {

    if (!ctx.styles) throw new Error('style not defined');
    return {
      horizontal: {
        align: ctx.styles.textAlign,
        indent: this.parseCssValueToPx(ctx.styles.textIndent, ctx),
        paddingLeft: this.parseCssValueToPx(ctx.styles.paddingLeft, ctx),
        paddingRight: this.parseCssValueToPx(ctx.styles.paddingRight, ctx)
      },
      vertical: {
        align: ctx.styles.verticalAlign,
        lineHeight: this.parseCssValueToPx(ctx.styles.lineHeight, ctx),
        paddingTop: this.parseCssValueToPx(ctx.styles.paddingTop, ctx),
        paddingBottom: this.parseCssValueToPx(ctx.styles.paddingBottom, ctx)
      }
    };
  }

  private buildComponent(text: string, textClass: string, rectClass: string, origin: Point, size: Size, ctx: StyleContext, parent: SVGElement): SVGGElement {
    const group = this.createEl("g", {transform: `translate(${origin.x}, ${origin.y})`}, parent);

    this.createEl("rect", {class: rectClass, width: size.w, height: size.h}, group);

    const pill_text = this.createEl("text", {class: textClass}, group)
    const style = window.getComputedStyle(pill_text);

    let textCtx: StyleContext = {
      emFontSize: ctx.emFontSize,
      remFontSize: ctx.remFontSize,
      styles: style,
    };
    let textPosition = this.getTextPosition(textCtx)

    let splitResult = this.splitsTextInRows(text, style, size.w);
    let ellipsizedRows = this.ellipsizeRows(splitResult, size.h, ctx);
    ellipsizedRows.forEach((row, i) => {
      let tspan = this.createEl("tspan", {x: 0, dy: `${style.lineHeight}`}, pill_text);

      let space = size.w - row.width() - textPosition.horizontal.paddingLeft - textPosition.horizontal.paddingRight;
      let translate_x = 0;
      let translate_y = 0;
      if (textPosition.horizontal.align == 'center') translate_x = space / 2;
      tspan.setAttribute('x', `${translate_x}`)
      tspan.textContent = row.text;
    })

    let textSize = this.measureTextCanvas(pill_text.textContent, style.font);

    //pill_text.setAttribute('transform', `translate(${(size.w - textSize.width) / 2}, ${this.sumCssValuesToPx(remFontSize, emFontSize, String(textSize.ascent), style.paddingTop)})`);

    // gPill.appendChild(pill);
    group.appendChild(pill_text);
    parent.appendChild(group);

    return group;
  }

  private getRemInPx(): number {
    return parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  private getEmInPxFromParent(child: Element): number {
    const parent = child.parentElement!;
    return parseFloat(getComputedStyle(parent).fontSize);
  }

  private getEmInPxFromSelf(child: Element): number {
    return parseFloat(getComputedStyle(child).fontSize);
  }

  private cleanUpNodesAndLinks() {
    this.gNodes?.replaceChildren();
    this.gLinks?.replaceChildren();
  }

  private rebuildNestedOwnership(): void {
    this.nestedNodeOwner.clear();
    // For each currently expanded SS, collect its dependencies and register ownership
    Array.from(this.nodes.values())
      .filter(node => node.nodeClass === 'ss')
      .forEach(node => {
        this.expandedSS.add(node.id);
      const deps = this.collectDependencies(node.id);
      deps.forEach(depId => {
        if (depId !== node.id && !this.nestedNodeOwner.has(depId)) {
          this.nestedNodeOwner.set(depId, node.id);
        }
      });
    });
  }

  private collectDependencies(rootId: string): Set<string> {
    const visited = new Set<string>();
    const queue: string[] = [rootId];
    while (queue.length) {
      const cur = queue.shift()!;
      // follow links where cur is the source
      this.links.forEach(l => {
        if (l.from === cur) {
          const to = l.to;
          if (!visited.has(to) && to !== rootId) {
            visited.add(to);
            queue.push(to);
          }
        }
      });
    }
    return visited;
  }

  private drawDefaultNode(n: NodeModel): void {
    const g = this.createEl("g", {class: "pmo", transform: `translate(${n.x},${n.y})`}, this.gNodes);
    this.nodeGroups.set(n.id, g);

    // Base rectangle
    this.createEl("rect", {class: `pmo ${n.nodeClass}`, width: n.w, height: n.h}, g);

    const ctx: StyleContext = {
      emFontSize: this.getEmInPxFromParent(g),
      remFontSize: this.getRemInPx(),
    };

    // Header: key + pill row
    let o = {x: 0, y: 0};
    let sz = {w: 60 - o.x, h: this.parseCssValueToPx('1.5rem', ctx)};
    this.buildComponent(n.key, 'key', 'key', o, sz, ctx, g);

    o = {x: 60, y: 0};
    sz = {w: n.w - o.x, h: this.parseCssValueToPx('1.5rem', ctx)};
    this.buildComponent('Default', 'pill delayed', 'pill delayed', o, sz, ctx, g);

    // Title row
    o = {x: 0, y: sz.h};
    sz = {w: n.w - o.x, h: this.parseCssValueToPx('3rem', ctx)};
    this.buildComponent(n.title, 'title', 'title', o, sz, ctx, g);

    this.makeDraggable(g, n);
    this.makeClickable(g, n);
    this.setupCtxMenuForNode(g, n);
  }

  private drawExpandedSS(n: NodeModel): void {
    const g = this.createEl("g", {class: "pmo ss expanded", transform: `translate(${n.x},${n.y})`}, this.gNodes);
    this.nodeGroups.set(n.id, g);

    // Compute text/layout context
    const ctx: StyleContext = {
      emFontSize: this.getEmInPxFromParent(g),
      remFontSize: this.getRemInPx(),
    };

    // Header heights
    const headerRowH = this.parseCssValueToPx('1.5rem', ctx);
    const titleRowH = this.parseCssValueToPx('3rem', ctx);
    const headerH = headerRowH + titleRowH;

    // Gather dependencies (direct + indirect)
    const deps = Array.from(this.collectDependencies(n.id)).filter(id => this.nodeById.has(id));

    // Inner node card size + padding
    const childW = 180;
    const childH = 100;
    const gap = 20;

    // Prepare header + base rect first; size will use current n.w/n.h
    const rect = this.createEl("rect", {class: `pmo ${n.nodeClass}`, width: n.w, height: n.h}, g);

    // Header content (top-left corner)
    let o = {x: 0, y: 0};
    let sz = {w: 60 - o.x, h: headerRowH};
    this.buildComponent(n.key, 'key', 'key', o, sz, ctx, g);

    o = {x: 60, y: 0};
    sz = {w: n.w - o.x - headerRowH, h: headerRowH};
    this.buildComponent('SS', 'pill delayed', 'pill delayed', o, sz, ctx, g);

    // Toggle button at top-right corner
    const btnSize = headerRowH * 0.8;
    const btnX = n.w - btnSize - 6;
    const btnY = (headerRowH - btnSize) / 2;
    const toggle = this.createEl('rect', {x: btnX, y: btnY, width: btnSize, height: btnSize, rx: 4, ry: 4, class: 'toggle'}, g);
    const symbol = this.createEl('text', {class: 'toggle-symbol'}, g);
    symbol.setAttribute('x', String(btnX + btnSize / 2));
    symbol.setAttribute('y', String(btnY + btnSize / 2 + 4));
    symbol.setAttribute('text-anchor', 'middle');
    symbol.textContent = '−';
    toggle.style.cursor = 'pointer';
    symbol.style.cursor = 'pointer';
    const toggleHandler = (e: Event) => {
      e.stopPropagation();
      if (this.expandedSS.has(n.id)) {
        this.expandedSS.delete(n.id);
      } else {
        this.expandedSS.add(n.id);
      }
      this.cleanUpNodesAndLinks();
      this.drawNodes();
      this.drawLinks();
    };
    toggle.addEventListener('click', toggleHandler);
    symbol.addEventListener('click', toggleHandler);

    // Title row beneath
    o = {x: 0, y: headerRowH};
    sz = {w: n.w - o.x, h: titleRowH};
    this.buildComponent(n.title, 'title', 'title', o, sz, ctx, g);

    // Draw inner nodes group
    const innerGroup = this.createEl('g', {class: 'ss-inner'}, g);

    // Default grid positions as a fallback for nodes without stored layout
    const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(deps.length))));
    const startX = gap;
    const startY = headerH + gap;

    // Retrieve or initialize per-SS positions
    let posMap = this.innerPositionsBySS.get(n.id);
    if (!posMap) {
      posMap = new Map<string, Point>();
      this.innerPositionsBySS.set(n.id, posMap);
    }

    // Initialize missing entries using grid
    deps.forEach((id, index) => {
      if (!posMap!.has(id)) {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = startX + col * (childW + gap);
        const y = startY + row * (childH + gap);
        posMap!.set(id, {x, y});
      }
    });

    // Local reference for quick access during rendering/drag
    const localPos = posMap;

    // Compute bounds from positions to resize container
    const bounds = (() => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      deps.forEach(id => {
        const p = localPos.get(id);
        if (!p) return;
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x + childW);
        maxY = Math.max(maxY, p.y + childH);
      });
      if (!isFinite(minX)) { minX = startX; minY = startY; maxX = minX; maxY = minY; }
      const innerW = (maxX - minX) + gap;
      const innerH = (maxY - minY) + gap;
      return { minX, minY, maxX, maxY, innerW, innerH };
    })();

    // Resize SS container to fit inner nodes (keep at least current size)
    const contentW = Math.max(n.w, bounds.innerW + gap); // extra padding
    const contentH = Math.max(n.h, headerH + bounds.innerH + gap);
    n.w = contentW;
    n.h = contentH;
    rect.setAttribute('width', String(n.w));
    rect.setAttribute('height', String(n.h));
    // update toggle x since width may have changed
    const newBtnX = n.w - btnSize - 6;
    toggle.setAttribute('x', String(newBtnX));
    symbol.setAttribute('x', String(newBtnX + btnSize / 2));

    // Create inner link layer
    const innerLinksGroup = this.createEl('g', {class: 'ss-inner-links'}, innerGroup);

    // Helper to (re)draw inner links
    const redrawInnerLinks = () => {
      innerLinksGroup.replaceChildren();
      const ilinks = this.links.filter(l => deps.includes(l.from) && deps.includes(l.to));
      ilinks.forEach(l => {
        const p0 = localPos.get(l.from);
        const p1 = localPos.get(l.to);
        if (!p0 || !p1) return;
        const src: NodeModel = {x: p0.x, y: p0.y, w: childW, h: childH} as any;
        const dst: NodeModel = {x: p1.x, y: p1.y, w: childW, h: childH} as any;
        const path = this.createEl('path', {class: 'link', 'marker-end': 'url(#arrow)'}, innerLinksGroup);
        path.setAttribute('d', this.linkPath(src, dst));
      });
    };

    // Render children (and make them draggable)
    deps.forEach((id) => {
      const child = this.nodeById.get(id)!;
      const p = localPos.get(id)!;
      const cg = this.createEl('g', {transform: `translate(${p.x},${p.y})`}, innerGroup);
      // child rectangle
      this.createEl('rect', {class: `pmo ${child.nodeClass}`, width: childW, height: childH}, cg);
      // child key and title minimal info
      const cctx: StyleContext = { emFontSize: this.getEmInPxFromParent(cg), remFontSize: this.getRemInPx() } as any;
      let co = {x: 4, y: 2};
      let csz = {w: childW - 8, h: this.parseCssValueToPx('1.2rem', ctx)};
      this.buildComponent(child.key, 'key', 'key', co, csz, cctx, cg);
      co = {x: 4, y: csz.h};
      csz = {w: childW - 8, h: this.parseCssValueToPx('2rem', ctx)};
      this.buildComponent(child.title, 'title', 'title', co, csz, cctx, cg);

      // Make inner draggable within the SS bounds
      this.makeInnerDraggable(
        cg as SVGGElement,
        n,
        id,
        localPos,
        {childW, childH, padding: gap, headerH},
        { rect, toggle, symbol, btnSize },
        () => {
          // onMove
          redrawInnerLinks();
        },
        () => {
          // onEnd: finalize container size to the minimal area that contains all children
          // with a uniform gap on every side (and room for the header/toggle)
          let maxRight = 0;
          let maxBottom = 0;
          deps.forEach(did => {
            const lp = localPos.get(did);
            if (!lp) return;
            maxRight = Math.max(maxRight, lp.x + childW);
            maxBottom = Math.max(maxBottom, lp.y + childH);
          });

          // If there are no deps, keep a minimal inner area equal to padding box
          const innerRequiredW = (deps.length === 0) ? (gap * 2) : (maxRight + gap);
          const innerRequiredH = (deps.length === 0) ? (gap * 2) : (maxBottom + gap);

          // Minimal width to keep header controls visible (leave space for toggle on the right)
          const minHeaderW = btnSize + 6 + gap; // left gap + toggle + right margin

          const newW = Math.max(minHeaderW, innerRequiredW);
          const newH = Math.max(headerH + gap, headerH + innerRequiredH);

          n.w = newW;
          n.h = newH;
          rect.setAttribute('width', String(newW));
          rect.setAttribute('height', String(newH));
          const bx = newW - btnSize - 6;
          toggle.setAttribute('x', String(bx));
          symbol.setAttribute('x', String(bx + btnSize / 2));

          // Ensure inner links reflect final positions/sizes
          redrawInnerLinks();
        }
      );
    });

    // Initial inner link draw
    redrawInnerLinks();

    this.makeDraggable(g, n);
    this.makeClickable(g, n);
    this.setupCtxMenuForNode(g, n);
  }

  private drawNodes(): void {
    // Rebuild nested ownership mapping based on current expanded SS
    this.rebuildNestedOwnership();

    this.nodes.forEach(n => {
      // If the node is owned (nested) by an expanded SS, skip drawing it at top level
      const owner = this.nestedNodeOwner.get(n.id);
      if (owner && owner !== n.id) return;

      if (n.nodeClass === 'ss' && this.expandedSS.has(n.id)) {
        this.drawExpandedSS(n);
      } else {
        // collapsed SS or non-SS: draw default
        // For SS collapsed, add an expand toggle button
        this.drawDefaultNode(n);
        if (n.nodeClass === 'ss') {
          const g = this.nodeGroups.get(n.id)!;
          const ctx: StyleContext = { emFontSize: this.getEmInPxFromParent(g), remFontSize: this.getRemInPx() } as any;
          const headerRowH = this.parseCssValueToPx('1.5rem', ctx);
          const btnSize = headerRowH * 0.8;
          const btnX = n.w - btnSize - 6;
          const btnY = (headerRowH - btnSize) / 2;
          const toggle = this.createEl('rect', {x: btnX, y: btnY, width: btnSize, height: btnSize, rx: 4, ry: 4, class: 'toggle'}, g);
          const symbol = this.createEl('text', {class: 'toggle-symbol'}, g);
          symbol.setAttribute('x', String(btnX + btnSize / 2));
          symbol.setAttribute('y', String(btnY + btnSize / 2 + 4));
          symbol.setAttribute('text-anchor', 'middle');
          symbol.textContent = '+';
          toggle.style.cursor = 'pointer';
          symbol.style.cursor = 'pointer';
          const toggleHandler = (e: Event) => {
            e.stopPropagation();
            this.expandedSS.add(n.id);
            this.cleanUpNodesAndLinks();
            this.drawNodes();
            this.drawLinks();
          };
          toggle.addEventListener('click', toggleHandler);
          symbol.addEventListener('click', toggleHandler);
        }
      }
    });
  }


  private makeClickable(group: SVGGElement, node: NodeModel) {
    group.addEventListener('click', e => {
      this.bcast.broadcast({ type: RoadMapperEvents.PMO_SELECTED, id: node.id });
    });
    group.addEventListener('dblclick', e => {
      this.pmoEditorService.edit(node.id)
      //this.bcast.broadcast({ type: RoadMapperEvents.PMO_SELECTED, id: id });
    });
  }

  /* ---- Drag logic (pointer events) ---- */
  drag: DragState | null = null;
  // Inner drag state for nodes inside an expanded SS
  private innerDrag: { ssId: string; nodeId: string; startX: number; startY: number; origX: number; origY: number; el: SVGGElement; } | null = null;

  private makeDraggable(group: SVGGElement, model: NodeModel): void {
    group.style.cursor = "grab";

    group.addEventListener("pointerdown", (e: PointerEvent) => {
      this.drag = {
        model,
        startX: e.clientX,
        startY: e.clientY,
        origX: model.x,
        origY: model.y,
        el: group
      };
      group.setPointerCapture(e.pointerId);
      group.classList.add("dragging");
    });

    group.addEventListener("pointermove", (e: PointerEvent) => {
      if (!this.drag || this.isPanning) return;
      const dx = e.clientX - this.drag.startX;
      const dy = e.clientY - this.drag.startY;
      this.drag.model.x = this.drag.origX + dx;
      this.drag.model.y = this.drag.origY + dy;
      this.drag.el.setAttribute("transform", `translate(${this.drag.model.x},${this.drag.model.y})`);
      this.drawLinks(); // live update
    });

    group.addEventListener("pointerup", (e: PointerEvent) => {
      if (!this.drag || this.isPanning) return;
      group.releasePointerCapture(e.pointerId);
      group.classList.remove("dragging");
      // Snap to grid if enabled
      const grid = this.getActiveSnapGrid();
      if (grid) {
        this.drag.model.x = this.snapValue(this.drag.model.x, grid);
        this.drag.model.y = this.snapValue(this.drag.model.y, grid);
        this.drag.el.setAttribute("transform", `translate(${this.drag.model.x},${this.drag.model.y})`);
        this.drawLinks();
      }
      this.drag = null;
      // Persist here if needed
    });
  }

  // Make a dependency node inside an expanded SS draggable within the SS
  private makeInnerDraggable(cg: SVGGElement,
                             ssNode: NodeModel,
                             childId: string,
                             posMap: Map<string, Point>,
                             opts: { childW: number; childH: number; padding: number; headerH: number },
                             ui: { rect: SVGRectElement; toggle: SVGRectElement; symbol: SVGTextElement; btnSize: number },
                             onMove?: () => void,
                             onEnd?: () => void): void {
    cg.style.cursor = 'grab';

    const getBounds = () => {
      // Movement bounds: inside the SS rect minus padding and header
      const minX = opts.padding;
      const minY = opts.headerH + opts.padding;
      const maxX = Math.max(minX, ssNode.w - opts.childW - opts.padding);
      const maxY = Math.max(minY, ssNode.h - opts.childH - opts.padding);
      return {minX, minY, maxX, maxY};
    };

    const onPointerDown = (e: PointerEvent) => {
      e.stopPropagation();
      const p = posMap.get(childId) || {x: opts.padding, y: opts.headerH + opts.padding};
      this.innerDrag = {
        ssId: ssNode.id,
        nodeId: childId,
        startX: e.clientX,
        startY: e.clientY,
        origX: p.x,
        origY: p.y,
        el: cg
      };
      cg.setPointerCapture(e.pointerId);
      cg.classList.add('dragging');
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.innerDrag) return;
      e.stopPropagation();
      const dx = e.clientX - this.innerDrag.startX;
      const dy = e.clientY - this.innerDrag.startY;
      let nx = this.innerDrag.origX + dx;
      let ny = this.innerDrag.origY + dy;
      // optional snapping using active grid
      const grid = this.getActiveSnapGrid();
      if (grid) {
        nx = this.snapValue(nx, grid);
        ny = this.snapValue(ny, grid);
      }
      // Enforce minimum bounds (header + padding), allow overflow to trigger live growth
      const b = getBounds();
      nx = Math.max(b.minX, nx);
      ny = Math.max(b.minY, ny);

      // Live grow SS container if dragging beyond current bounds
      const neededW = nx + opts.childW + opts.padding;
      if (neededW > ssNode.w) {
        ssNode.w = neededW;
        ui.rect.setAttribute('width', String(ssNode.w));
        const bx = ssNode.w - ui.btnSize - 6;
        ui.toggle.setAttribute('x', String(bx));
        ui.symbol.setAttribute('x', String(bx + ui.btnSize / 2));
      }
      const neededH = ny + opts.childH + opts.padding;
      const minH = opts.headerH + opts.padding + opts.childH + opts.padding; // at least header + one child + padding
      const targetH = Math.max(neededH, minH);
      if (targetH > ssNode.h) {
        ssNode.h = targetH;
        ui.rect.setAttribute('height', String(ssNode.h));
      }

      // persist local pos
      posMap.set(childId, {x: nx, y: ny});
      // update transform
      this.innerDrag.el.setAttribute('transform', `translate(${nx},${ny})`);
      if (onMove) onMove();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!this.innerDrag) return;
      e.stopPropagation();
      cg.releasePointerCapture(e.pointerId);
      cg.classList.remove('dragging');
      // ensure map saved (already updated on move)
      if (onEnd) onEnd();
      this.innerDrag = null;
    };

    cg.addEventListener('pointerdown', onPointerDown);
    cg.addEventListener('pointermove', onPointerMove);
    cg.addEventListener('pointerup', onPointerUp);
  }

// ---- PANNING ----
  isPanning = false;
  pan: Point = {x: 0, y: 0};
  panStart: Point = {x: 0, y: 0};
  panOffset: Point = {x: 0, y: 0}; // current translation of the whole diagram

  private updateRootTransform(x: number, y: number, zoom: number) {
    const t = `translate(${x},${y}) scale(${zoom})`;
    this.gRoot?.setAttribute('transform', t);
  }

  private updateGridPatternTransform(x: number, y: number, zoom: number) {
    const t = `translate(${x},${y}) scale(${this.zoom})`;
    this.gridPattern10?.setAttribute('patternTransform', t);
    this.gridPattern100?.setAttribute('patternTransform', t);
  }

  private setupSVGPanningEventListeners() {
    this.stage?.addEventListener("pointerdown", (e: PointerEvent) => {
      if (this.drag) return;
      const target = e.target as Element | null;
      // Start panning only if the click is NOT on a node
      if (target && target.closest(".node")) return;

      this.isPanning = true;
      this.panStart.x = e.clientX;
      this.panStart.y = e.clientY;
      this.stage?.setPointerCapture(e.pointerId);
      (this.stage as SVGSVGElement).style.cursor = "grabbing";
    });

    this.stage?.addEventListener("pointermove", (e: PointerEvent) => {
      if (!this.isPanning || this.drag) return;

      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;

      this.pan.x = this.panOffset.x + dx;
      this.pan.y = this.panOffset.y + dy;

      //this.gRoot?.setAttribute("transform", `translate(${this.pan.x},${this.pan.y}) scale(${this.zoom})`);
      this.updateRootTransform(this.pan.x, this.pan.y, this.zoom);
      // Move grid patterns along with content
      this.updateGridPatternTransform(this.pan.x, this.pan.y, this.zoom);
    });

    this.stage?.addEventListener("pointerup", (e: PointerEvent) => {
      if (!this.isPanning || this.drag) return;

      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;

      this.panOffset.x += dx;
      this.panOffset.y += dy;

      // finalize grid pattern transform to accumulated offset
      this.updateGridPatternTransform(this.panOffset.x, this.panOffset.y, this.zoom);

      this.isPanning = false;
      this.stage?.releasePointerCapture(e.pointerId);
      (this.stage as SVGSVGElement).style.cursor = "default";
    });
  }

  openForNode(ev: MouseEvent, cm: ContextMenu, node: NodeModel) {
    ev.preventDefault();
    cm.show(ev);
  }

  private setupCtxMenuForNode(group: SVGGElement, model: NodeModel) {
      group?.addEventListener("contextmenu", (e: PointerEvent) => {
        if (this.isPanning) return;
        const target = e.target as Element | null;
        // Start panning only if the click is NOT on a node
        if (target && target.closest(".node")) return;

        this.openForNode(e, this.ctxMenuRef, model);
      });
  }

  zoom = 1;
  viewBox = { x: 0, y: 0, w: 2000, h: 2000 };
  private setupSVGZoomEventListeners() {

    this.stage?.addEventListener('wheel', (event) => {
      event.preventDefault();
      const zoomFactor = event.deltaY < 0 ? 0.9 : 1.1;

      // Zoom around center
      const mx = this.viewBox.x + this.viewBox.w / 2;
      const my = this.viewBox.y + this.viewBox.h / 2;

      this.viewBox.w *= zoomFactor;
      this.viewBox.h *= zoomFactor;
      this.viewBox.x = mx - this.viewBox.w / 2;
      this.viewBox.y = my - this.viewBox.h / 2;

      if (event.deltaY < 0) {
        this.zoom -= 0.1;
      } else {
        this.zoom += 0.1
      }

      this.updateRootTransform(this.pan.x, this.pan.y, this.zoom);
      this.updateGridPatternTransform(this.pan.x, this.pan.y, this.zoom);
      // this.stage?.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);
    });
  }

  /*private applyZoom() {
    const baseSize = 100;
    const size = baseSize / this.zoom;
    this.stage?.setAttribute("viewBox", `${100 - size/2} ${100 - size/2} ${size} ${size}`);
  }

  private zoomIn() {
    this.zoom *= 1.2;
    this.applyZoom();
  }

  private zoomOut() {
    this.zoom /= 1.2;
    this.applyZoom();
  }*/

  private getActiveSnapGrid(): number | null {
    if (this.snapToPrimaryGrid) return this.PRIMARY_GRID_SIZE;
    if (this.snapToSecondaryGrid) return this.SECONDARY_GRID_SIZE;
    return null;
  }

  private snapValue(v: number, grid: number): number {
    return Math.round(v / grid) * grid;
  }
}
