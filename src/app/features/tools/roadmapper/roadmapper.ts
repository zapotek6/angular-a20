import {AfterViewInit, Component, ElementRef, OnInit, Renderer2, ViewChild} from '@angular/core';
import {Pmo} from '../../../core/models/pmo';
import {WorkspaceService, WorkspaceState} from '../../../core/workspace/workspace.service';
import {BroadcasterService} from '../../../core/brodacaster.service';
import {LoggerService} from '../../../core/logger/logger.service';
import {Logger, LogSeverity} from '../../../core/logger/logger';
import {Links} from '../../../core/infra/repo/pagination';

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
  imports: [],
  templateUrl: './roadmapper.html',
  styleUrl: './roadmapper.scss'
})
export class Roadmapper implements OnInit, AfterViewInit {
  private scopeAttrName: string
  @ViewChild('stage', {static: false}) stageRef!: ElementRef<SVGSVGElement>;
  @ViewChild('root', {static: false}) rootRef!: ElementRef<SVGSVGElement>;
  @ViewChild('links', {static: false}) linksRef!: ElementRef<SVGSVGElement>;
  @ViewChild('nodes', {static: false}) nodessRef!: ElementRef<SVGSVGElement>;
  stage?: SVGSVGElement;
  gRoot?: SVGElement;
  gLinks?: SVGElement;
  gNodes?: SVGElement;
  pmos?: Pmo[];

  nodes = new Map<string, NodeModel>();
  links: LinkModel[] = [];
  nodeById = new Map<string, NodeModel>();
  pmosByProjectKey = new Map<string, Pmo>();
  linkEls = new Map<string, SVGPathElement>();
  nodeGroups = new Map<string, SVGGElement>();

  // Grid visibility controls
  showPrimaryGrid: boolean = true;
  showSecondaryGrid: boolean = false;

  // Snapping controls
  snapToPrimaryGrid: boolean = true;
  snapToSecondaryGrid: boolean = false;

  private readonly PRIMARY_GRID_SIZE = 100;
  private readonly SECONDARY_GRID_SIZE = 10;

  // Grid pattern refs (for panning sync)
  private gridPattern10?: SVGPatternElement;
  private gridPattern100?: SVGPatternElement;

  canvas?: HTMLCanvasElement;
  ctx?: CanvasRenderingContext2D;

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
      if (message?.type === WorkspaceState.Ready) {
        this.logger.debug('WorkspaceService Ready');
        this.refresh();
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
  }

  private refresh() {
    this.workspaceService.getPmos().subscribe({
      next: (pmos) => {
        this.pmos = pmos;
        this.pmosByProjectKey = new Map<string, Pmo>(pmos.map(p => [`${p.project_id}::${p.key}`, p]));
      },
      complete: () => {

        let [nodesArray, linksArray] = this.buildNodesAndLinks(this.pmos || []);

        this.nodes = new Map<string, NodeModel>(nodesArray.map(n => [n.id, n]));
        this.nodeById = this.nodes;
        this.links = linksArray;

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
        let a = `${dep.to.project_id}::${dep.to.key}`;
        let b = this.pmosByProjectKey.get(a);
        let link: LinkModel = {
          from: pmo.id,
          id: crypto.randomUUID(),
          to: this.pmosByProjectKey.get(`${dep.to.project_id}::${dep.to.key}`)?.id || "undefined",
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
    this.links.forEach(l => {
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
  private drawNodes(): void {
    this.nodes.forEach(n => {
      const g = this.createEl("g", {class: "pmo", transform: `translate(${n.x},${n.y})`}, this.gNodes);
      this.nodeGroups.set(n.id, g);

      const padding = 12;
      // Pmo
      let pmo = this.createEl("rect", {class: `pmo ${n.nodeClass}`, width: n.w, height: n.h}, g);

      let ctx: StyleContext = {
        emFontSize: this.getEmInPxFromParent(g),
        remFontSize: this.getRemInPx(),
      }

      let o = {x: 0, y: 0};
      let sz = {w: 60 - o.x, h: this.parseCssValueToPx('1.5rem', ctx)};
      this.buildComponent(n.key, 'key', 'key', o, sz, ctx, g);

      o = {x: 60, y: 0};
      sz = {w: n.w - o.x, h: this.parseCssValueToPx('1.5rem', ctx)};
      this.buildComponent('Default', 'pill delayed', 'pill delayed', o, sz, ctx, g);


      o = {x: 0, y: sz.h};
      sz = {w: n.w - o.x, h: this.parseCssValueToPx('3rem', ctx)};
      this.buildComponent(n.title, 'title', 'title', o, sz, ctx, g);

      /*o = { x: 60, y: 0 };
      sz = { w: n.w - o.x, h: n.h };
      this.build('Default', 'pill delayed-text', 'pill delayed', o, sz, this.getRemInPx(), this.getEmInPxFromSelf(g), g);*/

      // Text blocks
      // const padding = 12;

      /*const id = this.createEl("text", {class: "id", x: padding, y: 18}, g);
      id.textContent = n.code;

      const title = this.createEl("text", {class: "title", x: padding, y: 38}, g);
      title.textContent = n.title;

      const meta = this.createEl("text", {class: "meta", x: padding, y: n.h - 14}, g);
      meta.textContent = n.meta;

      if (n.ticket) {
        const ticket = this.createEl("text", {class: "ticket", x: padding, y: n.h - 32}, g);
        ticket.textContent = n.ticket;
      }*/

      this.makeDraggable(g, n);
      this.makeClickable(g, n.id);
    });
  }


  private makeClickable(group: SVGGElement, id: string) {
    group.addEventListener('click', e => {
      this.bcast.broadcast({ type: RoadMapperEvents.PMO_SELECTED, id: id });
    });
  }

  /* ---- Drag logic (pointer events) ---- */
  drag: DragState | null = null;
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
