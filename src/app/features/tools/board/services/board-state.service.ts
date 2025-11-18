import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {
  BoardState,
  CardModel,
  DEFAULT_BOARD_ID,
  MIN_CARD_SIZE_UNITS,
  LinkLabel,
  LinkModel,
  LinkStyle,
  UNIT_TO_PX_AT_100
} from '../models/board.models';

@Injectable({providedIn: 'root'})
export class BoardStateService {
  private readonly subject = new BehaviorSubject<BoardState>({
    boardId: DEFAULT_BOARD_ID,
    cards: [],
    selectedCardIds: [],
    selectedLinkIds: [],
    viewport: {zoom: 1, offsetX: 0, offsetY: 0},
    links: [],
  });

  readonly state$ = this.subject.asObservable();

  private get snapshot(): BoardState {
    return this.subject.getValue();
  }

  // Expose read-only snapshot for components that need immediate values
  getSnapshot(): BoardState { return this.subject.getValue(); }

  private setState(mutator: (s: BoardState) => BoardState | void) {
    const current = this.snapshot;
    const draft: BoardState = {
      boardId: current.boardId,
      cards: [...current.cards],
      selectedCardIds: [...current.selectedCardIds],
      selectedLinkIds: [...current.selectedLinkIds],
      viewport: {...current.viewport},
      links: [...current.links],
    };
    const res = mutator(draft);
    this.subject.next((res as BoardState) || draft);
  }


  // Cards
  private newId(): string {
    try {
      // @ts-ignore
      if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
        // @ts-ignore
        return globalThis.crypto.randomUUID();
      }
    } catch {}
    return 'c_' + Math.round(performance.now()) + '_' + Math.round(Math.random() * 1e9);
  }

  addCardAt(xUnits: number, yUnits: number, opts?: Partial<Omit<CardModel, 'id'|'boardId'|'x'|'y'|'width'|'height'>> & {width?: number;height?: number}): string {
    const id = this.newId();
    const width = opts?.width ?? MIN_CARD_SIZE_UNITS;
    const height = opts?.height ?? MIN_CARD_SIZE_UNITS;
    const title = opts?.title ?? 'New card';
    const body = opts?.body ?? '';
    const color = opts?.color ?? '#ffffff';
    const shape = (opts as any)?.shape ?? 'rect';
    this.setState(s => {
      s.cards.push({id, boardId: s.boardId, x: xUnits, y: yUnits, width, height, title, body, color, shape});
      s.selectedCardIds = [id];
    });
    return id;
  }

  updateCard(id: string, patch: Partial<CardModel>) {
    this.setState(s => {
      const i = s.cards.findIndex(c => c.id === id);
      if (i >= 0) s.cards[i] = {...s.cards[i], ...patch};
    });
  }

  removeSelected() {
    this.setState(s => {
      const selectedCardSet = new Set(s.selectedCardIds);
      const selectedLinkSet = new Set(s.selectedLinkIds);
      const deletedIds = new Set<string>();
      s.cards = s.cards.filter(c => {
        const keep = !selectedCardSet.has(c.id);
        if (!keep) deletedIds.add(c.id);
        return keep;
      });
      // First remove explicitly selected links
      s.links = s.links.filter(l => !selectedLinkSet.has(l.id));
      // Then remove any links attached to deleted cards
      if (deletedIds.size) {
        s.links = s.links.filter(l => !deletedIds.has(l.sourceCardId) && !deletedIds.has(l.targetCardId));
      }
      s.selectedCardIds = [];
      s.selectedLinkIds = [];
    });
  }

  // Selection
  setSelection(ids: string[]) {
    this.setState(s => { s.selectedCardIds = Array.from(new Set(ids)); s.selectedLinkIds = []; });
  }
  clearSelection() { this.setState(s => { s.selectedCardIds = []; s.selectedLinkIds = []; }); }
  toggleSelection(id: string) {
    this.setState(s => {
      const set = new Set(s.selectedCardIds);
      if (set.has(id)) set.delete(id); else set.add(id);
      s.selectedCardIds = Array.from(set);
      s.selectedLinkIds = [];
    });
  }

  // Movement
  moveSelected(dxUnits: number, dyUnits: number) {
    if (!dxUnits && !dyUnits) return;
    this.setState(s => {
      const set = new Set(s.selectedCardIds);
      s.cards = s.cards.map(c => set.has(c.id) ? {...c, x: c.x + dxUnits, y: c.y + dyUnits} : c);
    });
  }

  nudgeSelected(dxUnits: number, dyUnits: number) { this.moveSelected(dxUnits, dyUnits); }

  // Resize: enforce min size; optionally keep aspect ratio by caller.
  resizeCard(id: string, x: number, y: number, width: number, height: number) {
    const w = Math.max(width, MIN_CARD_SIZE_UNITS);
    const h = Math.max(height, MIN_CARD_SIZE_UNITS);
    this.updateCard(id, {x, y, width: w, height: h});
  }

  // Viewport
  setZoom(zoom: number) {
    const z = Math.max(0.1, Math.min(zoom, 8));
    this.setState(s => { s.viewport.zoom = z; });
  }

  setPan(offsetX: number, offsetY: number) {
    this.setState(s => { s.viewport.offsetX = offsetX; s.viewport.offsetY = offsetY; });
  }

  panBy(dx: number, dy: number) {
    this.setState(s => { s.viewport.offsetX += dx; s.viewport.offsetY += dy; });
  }

  // Utilities
  getCardById(id: string): CardModel | undefined { return this.snapshot.cards.find(c => c.id === id); }

  // Links
  private newLinkId(): string {
    try {
      // @ts-ignore
      if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
        // @ts-ignore
        return globalThis.crypto.randomUUID();
      }
    } catch {}
    return 'l_' + Math.round(performance.now()) + '_' + Math.round(Math.random() * 1e9);
  }

  addLink(sourceCardId: string, sourcePointId: string, targetCardId: string, targetPointId: string, opts?: Partial<LinkStyle> & { labelText?: string }): string | null {
    const s = this.snapshot;
    const src = s.cards.find(c => c.id === sourceCardId);
    const tgt = s.cards.find(c => c.id === targetCardId);
    if (!src || !tgt) return null;
    // Disallow self-link in this iteration
    if (sourceCardId === targetCardId) return null;
    const id = this.newLinkId();
    const style: LinkStyle = {
      color: opts?.color ?? '#546e7a',
      width: opts?.width ?? 0.5,
      dash: opts?.dash ?? 'solid',
      arrowHead: opts?.arrowHead ?? 'filled',
      arrowTail: opts?.arrowTail ?? 'none',
    };
    const label: LinkLabel | undefined = opts?.labelText != null ? { text: opts.labelText, t: 0.5 } : undefined;
    const link: LinkModel = {
      id,
      boardId: s.boardId,
      sourceCardId, sourcePointId,
      targetCardId, targetPointId,
      style,
      label,
      routing: 'bezier',
      sourceAnchor: 'dynamic',
      targetAnchor: 'dynamic',
    };
    this.setState(st => { st.links = [...st.links, link]; });
    return id;
  }

  updateLink(id: string, patch: Partial<LinkModel>) {
    this.setState(s => {
      const i = s.links.findIndex(l => l.id === id);
      if (i >= 0) s.links[i] = { ...s.links[i], ...patch } as LinkModel;
    });
  }

  removeLink(id: string) {
    this.setState(s => { s.links = s.links.filter(l => l.id !== id); });
  }

  // Reconnect an endpoint of a link to a specific card connection point and fix its anchor
  commitReconnect(linkId: string, end: 'source'|'target', cardId: string, pointId: string): void {
    this.setState(s => {
      const i = s.links.findIndex(l => l.id === linkId);
      if (i < 0) return;
      const ln = s.links[i];
      if (end === 'source') {
        // Disallow self-link in this iteration
        if (cardId === ln.targetCardId) return; // cancel commit
        s.links[i] = { ...ln, sourceCardId: cardId, sourcePointId: pointId, sourceAnchor: 'fixed' };
      } else {
        if (cardId === ln.sourceCardId) return; // cancel commit
        s.links[i] = { ...ln, targetCardId: cardId, targetPointId: pointId, targetAnchor: 'fixed' };
      }
    });
  }

  // Link selection (mutually exclusive with card selection)
  setLinkSelection(ids: string[]) {
    this.setState(s => {
      s.selectedLinkIds = Array.from(new Set(ids));
      s.selectedCardIds = [];
    });
  }

  toggleLinkSelection(id: string) {
    this.setState(s => {
      const set = new Set(s.selectedLinkIds);
      if (set.has(id)) set.delete(id); else set.add(id);
      s.selectedLinkIds = Array.from(set);
      s.selectedCardIds = [];
    });
  }
}
