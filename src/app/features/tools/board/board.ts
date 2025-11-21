import {ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {BoardStateService} from './services/board-state.service';
import {BoardState, CardModel, LinkModel, MIN_CARD_SIZE_UNITS, UNIT_TO_PX_AT_100} from './models/board.models';
import {bezierForEndpoints, buildBezierPathD, computeEndpoints, cubicPoint, getConnectionPoints, nearestConnectionPoint, toCardAbsoluteUnits} from './services/board-geometry';
import {map, Observable} from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-board',
  imports: [CommonModule],
  templateUrl: './board.html',
  styleUrl: './board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Board {
  state$: Observable<BoardState>;
  ppu$: Observable<number>; // pixels per unit based on zoom

  // UI interaction state
  private dragging = false;
  private resizing: { cardId: string; handle: string; startX: number; startY: number; startW: number; startH: number; startMouseX: number; startMouseY: number; keepRatio: boolean } | null = null;
  protected marquee: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private pan: { startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null = null;
  private spacePressed = false;
  selectionPaddingUnits = 0.5; // visual padding around selection in board units
  titlePaddingUnits = 1; // inner padding for title area within a card (board units)

  // Hover and linking state
  protected hoverCardId: string | null = null;
  protected hoverTargetCardId: string | null = null;
  protected hoverTargetCpId: string | null = null;
  protected linkDraft: { sourceCardId: string; sourcePointId: string; from: {x:number;y:number}; to: {x:number;y:number} } | null = null;
  protected hoverNearCp = false; // computed cursor hint
  protected endpointDrag: { linkId: string; end: 'source'|'target'; fixed: {x:number;y:number; cpId?: string}; to: {x:number;y:number}; hoverCardId?: string|null; hoverCpId?: string|null } | null = null;
  private endpointMoveListener?: (e: MouseEvent)=>void;
  private endpointUpListener?: (e: MouseEvent)=>void;

  // Unified interaction mode to serialize gestures
  private interactionMode: 'idle' | 'marquee' | 'pan' | 'drag-card' | 'resize-card' | 'create-link' | 'reconnect-endpoint' = 'idle';

  @ViewChild('svgRoot', {static: true}) svgRoot?: ElementRef<SVGSVGElement>;
  @ViewChild('root', {static: true}) root?: ElementRef<HTMLDivElement>;

  constructor(public readonly board: BoardStateService) {
    this.state$ = this.board.state$;
    this.ppu$ = this.board.state$.pipe(map(s => UNIT_TO_PX_AT_100 * s.viewport.zoom));
  }

  focusRoot() {
    this.root?.nativeElement?.focus();
  }

  // Toolbar actions
  addCard(center = true) {
    const el = this.svgRoot?.nativeElement;
    const s = this.board.getSnapshot();
    const ppu = UNIT_TO_PX_AT_100 * s.viewport.zoom;
    let xUnits = 0, yUnits = 0;
    if (el && center) {
      const rect = el.getBoundingClientRect();
      const vbw = el.viewBox?.baseVal?.width || 2000;
      const vbh = el.viewBox?.baseVal?.height || 2000;
      const cx = vbw / rect.width; // px -> user units
      const cy = vbh / rect.height;
      const sx_u = (rect.width / 2) * cx;
      const sy_u = (rect.height / 2) * cy;
      xUnits = (sx_u - s.viewport.offsetX) / (ppu * cx) - MIN_CARD_SIZE_UNITS / 2;
      yUnits = (sy_u - s.viewport.offsetY) / (ppu * cy) - MIN_CARD_SIZE_UNITS / 2;
    }
    this.board.addCardAt(xUnits, yUnits);
  }

  zoomIn() { this.adjustZoom(1.1); }
  zoomOut() { this.adjustZoom(1/1.1); }
  resetZoom() { this.board.setZoom(1); this.board.setPan(0, 0); }
  deleteSelection() { this.board.removeSelected(); }

  private adjustZoom(factor: number, centerAt?: {sx: number; sy: number}) {
    const s = this.board.getSnapshot();
    const oldZoom = s.viewport.zoom;
    const newZoom = Math.max(0.1, Math.min(oldZoom * factor, 8));
    const svg = this.svgRoot?.nativeElement;
    const rect = svg?.getBoundingClientRect();
    const hasVB = !!(svg && (svg as any).viewBox && (svg as any).viewBox.baseVal && (svg as any).viewBox.baseVal.width);
    const vbw = hasVB ? (svg as any).viewBox.baseVal.width : 0;
    const vbh = hasVB ? (svg as any).viewBox.baseVal.height : 0;
    const cx = rect ? (hasVB ? (vbw / rect.width) : 1) : 1; // px->user units (x) when viewBox present
    const cy = rect ? (hasVB ? (vbh / rect.height) : 1) : 1;
    let {offsetX, offsetY} = s.viewport; // stored in SVG user units
    if (centerAt && rect) {
      const sx_u = centerAt.sx * cx;
      const sy_u = centerAt.sy * cy;
      const oldKx = (UNIT_TO_PX_AT_100 * oldZoom) * cx; // userUnits per board unit along X
      const oldKy = (UNIT_TO_PX_AT_100 * oldZoom) * cy;
      const newKx = (UNIT_TO_PX_AT_100 * newZoom) * cx;
      const newKy = (UNIT_TO_PX_AT_100 * newZoom) * cy;
      offsetX = sx_u - (sx_u - offsetX) * (newKx / oldKx);
      offsetY = sy_u - (sy_u - offsetY) * (newKy / oldKy);
    }
    this.board.setZoom(newZoom);
    this.board.setPan(offsetX, offsetY);
  }

  // Coordinate helpers
  private screenToBoard(event: MouseEvent, s: BoardState) {
    const svg = this.svgRoot?.nativeElement;
    const rect = svg?.getBoundingClientRect();
    const hasVB = !!(svg && (svg as any).viewBox && (svg as any).viewBox.baseVal && (svg as any).viewBox.baseVal.width);
    const vbw = hasVB ? (svg as any).viewBox.baseVal.width : 0;
    const vbh = hasVB ? (svg as any).viewBox.baseVal.height : 0;
    const cx = rect ? (hasVB ? (vbw / rect.width) : 1) : 1; // px -> user units scale
    const cy = rect ? (hasVB ? (vbh / rect.height) : 1) : 1;
    const ppu = UNIT_TO_PX_AT_100 * s.viewport.zoom; // screen px per board unit
    const sx = (event.offsetX ?? 0);
    const sy = (event.offsetY ?? 0);
    // Convert screen px to SVG user units, subtract pan in user units, then to board units
    const ux = sx * cx;
    const uy = sy * cy;
    const x = (ux - s.viewport.offsetX) / ppu;
    const y = (uy - s.viewport.offsetY) / ppu;
    return {x, y, sx, sy, ppu, cx, cy};
  }


  // Events
  onWheel(event: WheelEvent) {
    if (!event.ctrlKey) return; // let page scroll otherwise
    event.preventDefault();
    this.adjustZoom(event.deltaY < 0 ? 1.1 : 0.9, {sx: (event as any).offsetX ?? 0, sy: (event as any).offsetY ?? 0});
  }

   onBackgroundPointerDown(ev: MouseEvent) {
    if (this.interactionMode !== 'idle') return; // suppress while any interaction active
    const s = this.board.getSnapshot();
    // Strategy: Space + drag pans; plain drag starts marquee selection
    if (ev.button === 0 && !ev.ctrlKey && !ev.shiftKey && !this.spacePressed) {
      // Background click/drag starts marquee: clear both selections first
      this.board.clearSelection();
      const {x, y} = this.screenToBoard(ev, s);
      this.marquee = {x0: x, y0: y, x1: x, y1: y};
      this.interactionMode = 'marquee';
    } else if (ev.button === 0 && this.spacePressed) {
      this.pan = {startX: ev.clientX, startY: ev.clientY, startOffsetX: s.viewport.offsetX, startOffsetY: s.viewport.offsetY};
      this.interactionMode = 'pan';
    }
  }

  onBackgroundPointerMove(ev: MouseEvent) {
    const s = this.board.getSnapshot();
    const pos = this.screenToBoard(ev, s);
    if (this.linkDraft) {
      this.linkDraft.to = {x: pos.x, y: pos.y};
      // update hover target card + nearest cp preview
      const card = this.getCardAtPoint(s, pos.x, pos.y);
      if (card) {
        this.hoverTargetCardId = card.id;
        const cp = nearestConnectionPoint(card, pos.x, pos.y);
        this.hoverTargetCpId = cp.id;
      } else {
        this.hoverTargetCardId = null;
        this.hoverTargetCpId = null;
      }
      return;
    }
    if (this.endpointDrag) {
      this.endpointDrag.to = {x: pos.x, y: pos.y};
      const card = this.getCardAtPoint(s, pos.x, pos.y);
      if (card) {
        this.hoverTargetCardId = card.id;
        const cp = nearestConnectionPoint(card, pos.x, pos.y);
        this.hoverTargetCpId = cp.id;
        this.endpointDrag.hoverCardId = card.id;
        this.endpointDrag.hoverCpId = cp.id;
      } else {
        this.hoverTargetCardId = null;
        this.hoverTargetCpId = null;
        this.endpointDrag.hoverCardId = null;
        this.endpointDrag.hoverCpId = null;
      }
      return;
    }
    if (this.marquee) {
      this.marquee.x1 = pos.x; this.marquee.y1 = pos.y;
    }
    if (this.pan) {
      const svg = this.svgRoot?.nativeElement;
      const rect = svg?.getBoundingClientRect();
      const hasVB = !!(svg && (svg as any).viewBox && (svg as any).viewBox.baseVal && (svg as any).viewBox.baseVal.width);
      const vbw = hasVB ? (svg as any).viewBox.baseVal.width : 0;
      const vbh = hasVB ? (svg as any).viewBox.baseVal.height : 0;
      const cx = rect ? (hasVB ? (vbw / rect.width) : 1) : 1;
      const cy = rect ? (hasVB ? (vbh / rect.height) : 1) : 1;
      const dx = ev.clientX - this.pan.startX;
      const dy = ev.clientY - this.pan.startY;
      // convert mouse pixel delta to SVG user units
      this.board.setPan(this.pan.startOffsetX + dx * cx, this.pan.startOffsetY + dy * cy);
      // While panning, suppress hover hints
      this.hoverNearCp = false;
      this.hoverCardId = null;
      this.hoverTargetCardId = null;
      this.hoverTargetCpId = null;
      return;
    }
    // Update hover hints when idle (not dragging/resizing/panning/linking)
    if (!this.dragging && !this.resizing) {
      this.updateHoverState(s, pos.x, pos.y);
    }
  }

  onBackgroundPointerUp(ev: MouseEvent) {
    const s = this.board.getSnapshot();
    if (this.marquee) {
      const x0 = Math.min(this.marquee.x0, this.marquee.x1);
      const y0 = Math.min(this.marquee.y0, this.marquee.y1);
      const x1 = Math.max(this.marquee.x0, this.marquee.x1);
      const y1 = Math.max(this.marquee.y0, this.marquee.y1);
      const ids = s.cards.filter(c => this.rectsIntersect({x: c.x, y: c.y, w: c.width, h: c.height}, {x: x0, y: y0, w: x1 - x0, h: y1 - y0})).map(c => c.id);
      this.board.setSelection(ids);
    }
    this.marquee = null;
    this.pan = null;
    this.interactionMode = 'idle';
    // Refresh hover after interactions end
    const pos = this.screenToBoard(ev, s);
    this.updateHoverState(s, pos.x, pos.y);
  }

  onCardPointerDown(ev: MouseEvent, card: CardModel) {
    ev.stopPropagation();
    const s = this.board.getSnapshot();
    if (ev.ctrlKey) {
      this.board.toggleSelection(card.id);
    } else {
      const alreadySelected = s.selectedCardIds.includes(card.id);
      if (!alreadySelected) this.board.setSelection([card.id]);
    }
    // Start dragging
    this.dragging = true;
    this.interactionMode = 'drag-card';
    (document as any).addEventListener('mousemove', this.boundOnDragMove);
    (document as any).addEventListener('mouseup', this.boundOnDragEnd, {once: true});
    this.dragStart = {sx: ev.clientX, sy: ev.clientY};
  }

  private dragStart: {sx: number; sy: number} | null = null;
  private boundOnDragMove = (e: MouseEvent) => this.onDragMove(e);
  private boundOnDragEnd = (e: MouseEvent) => this.onDragEnd(e);

  private onDragMove(ev: MouseEvent) {
    const s = this.board.getSnapshot();
    if (!this.dragging || !this.dragStart) return;
    const dx = ev.clientX - this.dragStart.sx;
    const dy = ev.clientY - this.dragStart.sy;
    const ppu = UNIT_TO_PX_AT_100 * s.viewport.zoom;
    this.board.moveSelected(dx / ppu, dy / ppu);
    // Reset baseline so next move applies incremental delta only
    this.dragStart.sx = ev.clientX;
    this.dragStart.sy = ev.clientY;
  }
  private onDragEnd(ev: MouseEvent) {
    this.dragging = false;
    this.dragStart = null;
    this.interactionMode = 'idle';
    (document as any).removeEventListener('mousemove', this.boundOnDragMove);
  }

  // Resize handles
  startResize(ev: MouseEvent, card: CardModel, handle: string) {
    ev.stopPropagation();
    const s = this.board.getSnapshot();
    if (s.selectedCardIds.length !== 1 || s.selectedCardIds[0] !== card.id) this.board.setSelection([card.id]);
    this.resizing = {
      cardId: card.id,
      handle,
      startX: card.x,
      startY: card.y,
      startW: card.width,
      startH: card.height,
      startMouseX: ev.clientX,
      startMouseY: ev.clientY,
      keepRatio: ev.shiftKey
    };
    this.interactionMode = 'resize-card';
    (document as any).addEventListener('mousemove', this.boundOnResizeMove);
    (document as any).addEventListener('mouseup', this.boundOnResizeEnd, {once: true});
  }

  private boundOnResizeMove = (e: MouseEvent) => this.onResizeMove(e);
  private boundOnResizeEnd = (e: MouseEvent) => this.onResizeEnd(e);

  private onResizeMove(ev: MouseEvent) {
    if (!this.resizing) return;
    const s = this.board.getSnapshot();
    const {cardId, handle, startX, startY, startW, startH, startMouseX, startMouseY} = this.resizing;
    const dxPx = ev.clientX - startMouseX;
    const dyPx = ev.clientY - startMouseY;
    const ppu = UNIT_TO_PX_AT_100 * s.viewport.zoom;
    let dx = dxPx / ppu;
    let dy = dyPx / ppu;
    let x = startX, y = startY, w = startW, h = startH;
    const ratio = startW / startH;
    const applyRatio = (primary: 'w'|'h') => {
      if (!ev.shiftKey) return; // live Shift toggling
      if (primary === 'w') h = w / ratio; else w = h * ratio;
    };
    if (handle.includes('e')) { w = startW + dx; applyRatio('w'); }
    if (handle.includes('s')) { h = startH + dy; applyRatio('h'); }
    if (handle.includes('w')) { w = startW - dx; x = startX + dx; applyRatio('w'); }
    if (handle.includes('n')) { h = startH - dy; y = startY + dy; applyRatio('h'); }
    this.board.resizeCard(cardId, x, y, w, h);
  }
  private onResizeEnd(ev: MouseEvent) {
    this.resizing = null;
    this.interactionMode = 'idle';
    (document as any).removeEventListener('mousemove', this.boundOnResizeMove);
  }

  // Keyboard
  @HostListener('window:keydown', ['$event'])
  onKey(ev: KeyboardEvent) {
    const s = this.board.getSnapshot();
    if (ev.code === 'Space') { this.spacePressed = true; ev.preventDefault(); }
    if (ev.key === 'Delete' || ev.key === 'Backspace') { this.board.removeSelected(); ev.preventDefault(); }
    if (ev.key === 'Escape') { this.marquee = null; this.resizing = null; this.dragging = false; this.linkDraft = null;
      // cancel endpoint drag
      this.endpointDrag = null; this.endpointMoveListener && (document as any).removeEventListener('mousemove', this.endpointMoveListener); this.endpointUpListener && (document as any).removeEventListener('mouseup', this.endpointUpListener);
      this.endpointMoveListener = undefined; this.endpointUpListener = undefined;
      this.hoverTargetCardId = null; this.hoverTargetCpId = null; this.hoverNearCp = false; this.board.clearSelection(); this.interactionMode = 'idle'; }
    const step = 1;
    if (ev.key === 'ArrowLeft') { this.board.nudgeSelected(-step, 0); ev.preventDefault(); }
    if (ev.key === 'ArrowRight') { this.board.nudgeSelected(step, 0); ev.preventDefault(); }
    if (ev.key === 'ArrowUp') { this.board.nudgeSelected(0, -step); ev.preventDefault(); }
    if (ev.key === 'ArrowDown') { this.board.nudgeSelected(0, step); ev.preventDefault(); }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(ev: KeyboardEvent) {
    if (ev.code === 'Space') { this.spacePressed = false; ev.preventDefault(); }
  }

  // Utils
  trackById(i: number, c: CardModel) { return c.id; }
  rectsIntersect(a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  getSingleSelected(s: BoardState): CardModel | null {
    if (s.selectedCardIds.length !== 1) return null;
    const id = s.selectedCardIds[0];
    return s.cards.find(c => c.id === id) ?? null;
  }

  getSelectionBounds(s: BoardState): {x:number;y:number;w:number;h:number}|null {
    if (s.selectedCardIds.length < 2) return null;
    const set = new Set(s.selectedCardIds);
    const sel = s.cards.filter(c => set.has(c.id));
    if (!sel.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of sel) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + c.width);
      maxY = Math.max(maxY, c.y + c.height);
    }
    return {x: minX, y: minY, w: maxX - minX, h: maxY - minY};
  }

  protected readonly Math = Math;

  // Hover helpers
  private updateHoverState(s: BoardState, x: number, y: number) {
    // If currently linking, hover is handled elsewhere
    if (this.linkDraft) return;
    // First, check if pointer is inside a card
    let card = this.getCardAtPoint(s, x, y);
    let nearCp = false;
    let nearCardId: string | null = null;
    let nearCpId: string | null = null;
    let bestD2 = Infinity;
    if (card) {
      const cp = nearestConnectionPoint(card, x, y);
      // Suppress hover if this CP coincides with selected link endpoint handle
      if (!this.shouldSuppressCp(s, card.id, cp.id)) {
        const p = toCardAbsoluteUnits(card, cp);
        const dx = p.x - x, dy = p.y - y;
        const d2 = dx*dx + dy*dy;
        const r = (cp.hotRadius ?? 1.2);
        if (d2 <= r*r) {
          nearCp = true; nearCardId = card.id; nearCpId = cp.id; bestD2 = d2;
        }
      }
    }
    // If not inside a card or not near a CP yet, search all cards' CP hot areas
    if (!nearCp) {
      for (const c of s.cards) {
        const cps = getConnectionPoints(c);
        for (const cp of cps) {
          if (this.shouldSuppressCp(s, c.id, cp.id)) continue;
          const p = toCardAbsoluteUnits(c, cp);
          const dx = p.x - x, dy = p.y - y;
          const d2 = dx*dx + dy*dy;
          const r = (cp.hotRadius ?? 1.2);
          if (d2 <= r*r && d2 < bestD2) {
            nearCp = true; nearCardId = c.id; nearCpId = cp.id; bestD2 = d2;
          }
        }
      }
    }
    // Determine hovered card id for showing overlays
    this.hoverCardId = card?.id ?? nearCardId ?? null;
    if (nearCp && nearCardId && nearCpId) {
      this.hoverTargetCardId = nearCardId;
      this.hoverTargetCpId = nearCpId;
    } else {
      this.hoverTargetCardId = null;
      this.hoverTargetCpId = null;
    }
    this.hoverNearCp = nearCp;
  }

  // Return true if the given card connection point should be hidden/disabled
  // because it coincides with the currently selected link's endpoint handle.
  shouldSuppressCp(s: BoardState, cardId: string, cpId: string): boolean {
    const ids = s.selectedLinkIds || [];
    if (ids.length !== 1) return false;
    const ln = s.links.find(l => l.id === ids[0]);
    if (!ln) return false;
    const src = s.cards.find(c => c.id === ln.sourceCardId);
    const tgt = s.cards.find(c => c.id === ln.targetCardId);
    if (!src || !tgt) return false;
    const e = computeEndpoints(ln, src, tgt);
    if (cardId === src.id && cpId === e.srcCp.id) return true;
    if (cardId === tgt.id && cpId === e.tgtCp.id) return true;
    return false;
  }

  startLinkFrom(ev: MouseEvent, card: CardModel, cpId: string) {
    ev.stopPropagation();
    // Only allow starting a new link in idle mode, not during endpoint reconnection or other gestures
    if (this.interactionMode !== 'idle') return;
    const cps = getConnectionPoints(card);
    const cp = cps.find(c => c.id === cpId) || cps[0];
    const from = toCardAbsoluteUnits(card, cp);
    this.linkDraft = { sourceCardId: card.id, sourcePointId: cp.id, from, to: {...from} };
    this.interactionMode = 'create-link';
    // Track mouse move/up globally
    const move = (e: MouseEvent) => {
      const s = this.board.getSnapshot();
      const pos = this.screenToBoard(e, s);
      this.linkDraft && (this.linkDraft.to = {x: pos.x, y: pos.y});
      const targetCard = this.getCardAtPoint(s, pos.x, pos.y);
      if (targetCard && targetCard.id !== card.id) {
        this.hoverTargetCardId = targetCard.id;
        this.hoverTargetCpId = nearestConnectionPoint(targetCard, pos.x, pos.y).id;
      } else {
        this.hoverTargetCardId = null; this.hoverTargetCpId = null;
      }
    };
    const up = (e: MouseEvent) => {
      (document as any).removeEventListener('mousemove', move);
      (document as any).removeEventListener('mouseup', up);
      const s = this.board.getSnapshot();
      const pos = this.screenToBoard(e, s);
      const target = this.getCardAtPoint(s, pos.x, pos.y);
      if (target && target.id !== card.id) {
        const cp2 = nearestConnectionPoint(target, pos.x, pos.y);
        this.board.addLink(card.id, cp.id, target.id, cp2.id);
      }
      this.linkDraft = null; this.hoverTargetCardId = null; this.hoverTargetCpId = null; this.interactionMode = 'idle';
    };
    (document as any).addEventListener('mousemove', move);
    (document as any).addEventListener('mouseup', up, {once: true});
  }

  // Link selection
  onLinkPointerDown(ev: MouseEvent, linkId: string) {
    ev.stopPropagation();
    const s = this.board.getSnapshot();
    if (ev.ctrlKey) {
      this.board.toggleLinkSelection(linkId);
    } else {
      const already = s.selectedLinkIds?.includes(linkId);
      if (!already) this.board.setLinkSelection([linkId]);
    }
  }

  // Hit test in board units
  private getCardAtPoint(s: BoardState, x: number, y: number): CardModel | null {
    for (let i = s.cards.length - 1; i >= 0; i--) {
      const c = s.cards[i];
      if (x >= c.x && x <= c.x + c.width && y >= c.y && y <= c.y + c.height) return c;
    }
    return null;
  }

  // Build SVG path for a link
  getLinkPathD(s: BoardState, link: LinkModel): string | null {
    const src = s.cards.find(c => c.id === link.sourceCardId);
    const tgt = s.cards.find(c => c.id === link.targetCardId);
    if (!src || !tgt) return null;
    // Resolve endpoints honoring anchors (fixed/dynamic)
    const endpoints = computeEndpoints(link, src, tgt);
    const A = { p: endpoints.srcPt, cp: endpoints.srcCp };
    const B = { p: endpoints.tgtPt, cp: endpoints.tgtCp };
    const {p0, p1, p2, p3} = bezierForEndpoints(A, B);
    return buildBezierPathD(p0, p1, p2, p3);
  }

  getDraftPathD(s: BoardState): {d: string; label: {x:number;y:number}} | null {
    if (!this.linkDraft) return null;
    const src = s.cards.find(c => c.id === this.linkDraft!.sourceCardId);
    if (!src) return null;
    const srcCp = (getConnectionPoints(src).find(c => c.id === this.linkDraft!.sourcePointId)) || getConnectionPoints(src)[0];
    const A = { p: this.linkDraft.from, cp: srcCp };
    // create a synthetic CP at target with direction based on vector from A to to
    const to = this.linkDraft.to;
    const dx = to.x - A.p.x, dy = to.y - A.p.y;
    const cpB = { id: 'tmp', relX: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 0) : 0.5, relY: Math.abs(dx) > Math.abs(dy) ? 0.5 : (dy > 0 ? 1 : 0), shape: 'circle' as const };
    const B = { p: to, cp: cpB };
    const {p0, p1, p2, p3} = bezierForEndpoints(A, B);
    const d = buildBezierPathD(p0, p1, p2, p3);
    const mid = cubicPoint(p0, p1, p2, p3, 0.5);
    return { d, label: mid };
  }

  // Link helpers for template
  cps(card: CardModel) { return getConnectionPoints(card); }
  markerEnd(ln: LinkModel): string | null {
    const h = ln.style.arrowHead;
    if (h === 'filled') return 'url(#arrow-head-filled)';
    if (h === 'open') return 'url(#arrow-head-open)';
    return null;
  }
  markerStart(ln: LinkModel): string | null {
    const t = ln.style.arrowTail;
    if (t === 'filled') return 'url(#arrow-tail-filled)';
    if (t === 'open') return 'url(#arrow-tail-open)';
    return null;
  }
  getLinkLabelPos(s: BoardState, ln: LinkModel): {x:number;y:number} | null {
    const src = s.cards.find(c => c.id === ln.sourceCardId);
    const tgt = s.cards.find(c => c.id === ln.targetCardId);
    if (!src || !tgt) return null;
    const endpoints = computeEndpoints(ln, src, tgt);
    const A = { p: endpoints.srcPt, cp: endpoints.srcCp };
    const B = { p: endpoints.tgtPt, cp: endpoints.tgtCp };
    const {p0, p1, p2, p3} = bezierForEndpoints(A, B);
    const t = ln.label?.t ?? 0.5;
    return cubicPoint(p0, p1, p2, p3, t);
  }

  // Endpoint handles helpers
  getLinkEndpoints(s: BoardState, ln: LinkModel): {src:{x:number;y:number;cpId:string}, tgt:{x:number;y:number;cpId:string}} | null {
    const src = s.cards.find(c => c.id === ln.sourceCardId);
    const tgt = s.cards.find(c => c.id === ln.targetCardId);
    if (!src || !tgt) return null;
    const e = computeEndpoints(ln, src, tgt);
    return { src: {x: e.srcPt.x, y: e.srcPt.y, cpId: e.srcCp.id}, tgt: {x: e.tgtPt.x, y: e.tgtPt.y, cpId: e.tgtCp.id} };
  }

  getSingleSelectedLink(s: BoardState): LinkModel | null {
    const ids = s.selectedLinkIds || [];
    if (ids.length !== 1) return null;
    const id = ids[0];
    return s.links.find(l => l.id === id) ?? null;
  }

  getEndpointDraftPathD(s: BoardState): { d: string } | null {
    if (!this.endpointDrag) return null;
    const ln = s.links.find(l => l.id === this.endpointDrag!.linkId);
    if (!ln) return null;
    const src = s.cards.find(c => c.id === ln.sourceCardId);
    const tgt = s.cards.find(c => c.id === ln.targetCardId);
    if (!src || !tgt) return null;
    const e = computeEndpoints(ln, src, tgt);
    // Fixed side (non-dragging end)
    const fixed = this.endpointDrag.end === 'source' ? { p: e.tgtPt, cp: e.tgtCp } : { p: e.srcPt, cp: e.srcCp };
    // Moving side: current mouse pos; synthesize a CP direction based on vector
    const to = this.endpointDrag.to;
    const dx = to.x - fixed.p.x; const dy = to.y - fixed.p.y;
    const isHoriz = Math.abs(dx) > Math.abs(dy);
    const movingCp = { id: 'tmp', relX: isHoriz ? (dx > 0 ? 1 : 0) : 0.5, relY: isHoriz ? 0.5 : (dy > 0 ? 1 : 0), shape: 'circle' as const };
    const A = this.endpointDrag.end === 'source' ? { p: to, cp: movingCp } : fixed;
    const B = this.endpointDrag.end === 'source' ? fixed : { p: to, cp: movingCp };
    const {p0, p1, p2, p3} = bezierForEndpoints(A, B);
    const d = buildBezierPathD(p0, p1, p2, p3);
    return { d };
  }

  onEndpointHandleDown(ev: MouseEvent, ln: LinkModel, end: 'source'|'target') {
    ev.stopPropagation();
    ev.preventDefault();
    // Ensure no residual link drafting remains while editing an endpoint
    this.linkDraft = null;
    if (this.interactionMode !== 'idle') return;
    const s = this.board.getSnapshot();
    const src = s.cards.find(c => c.id === ln.sourceCardId);
    const tgt = s.cards.find(c => c.id === ln.targetCardId);
    if (!src || !tgt) return;
    const e = computeEndpoints(ln, src, tgt);
    const fixedPt = end === 'source' ? e.tgtPt : e.srcPt;
    const dragStart = end === 'source' ? e.srcPt : e.tgtPt;
    this.endpointDrag = { linkId: ln.id, end, fixed: {x: fixedPt.x, y: fixedPt.y}, to: {x: dragStart.x, y: dragStart.y}, hoverCardId: null, hoverCpId: null };
    this.interactionMode = 'reconnect-endpoint';
    // listeners
    this.endpointMoveListener = (moveEv: MouseEvent) => {
      const s2 = this.board.getSnapshot();
      const pos = this.screenToBoard(moveEv, s2);
      if (!this.endpointDrag) return;
      this.endpointDrag.to = {x: pos.x, y: pos.y};
      const card = this.getCardAtPoint(s2, pos.x, pos.y);
      if (card) {
        const cp = nearestConnectionPoint(card, pos.x, pos.y);
        this.endpointDrag.hoverCardId = card.id; this.endpointDrag.hoverCpId = cp.id;
        this.hoverTargetCardId = card.id; this.hoverTargetCpId = cp.id;
      } else {
        this.endpointDrag.hoverCardId = null; this.endpointDrag.hoverCpId = null;
        this.hoverTargetCardId = null; this.hoverTargetCpId = null;
      }
    };
    this.endpointUpListener = (upEv: MouseEvent) => {
      (document as any).removeEventListener('mousemove', this.endpointMoveListener as any);
      (document as any).removeEventListener('mouseup', this.endpointUpListener as any);
      const drag = this.endpointDrag;
      this.endpointDrag = null;
      if (!drag) return;
      const cardId = drag.hoverCardId; const cpId = drag.hoverCpId;
      if (cardId && cpId) {
        this.board.commitReconnect(drag.linkId, drag.end, cardId, cpId);
      }
      this.hoverTargetCardId = null; this.hoverTargetCpId = null;
      this.interactionMode = 'idle';
      this.endpointMoveListener = undefined; this.endpointUpListener = undefined;
    };
    (document as any).addEventListener('mousemove', this.endpointMoveListener);
    (document as any).addEventListener('mouseup', this.endpointUpListener, {once: true});
  }
}
