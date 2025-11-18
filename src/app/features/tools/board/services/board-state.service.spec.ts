import {BoardStateService} from './board-state.service';
import {MIN_CARD_SIZE_UNITS} from '../models/board.models';

describe('BoardStateService', () => {
  let service: BoardStateService;

  beforeEach(() => {
    service = new BoardStateService();
  });


  it('should init with default state', (done) => {
    service.state$.subscribe(s => {
      expect(s.boardId).toBeTruthy();
      expect(s.cards.length).toBe(0);
      expect(s.selectedCardIds.length).toBe(0);
      expect(s.viewport.zoom).toBe(1);
      expect(s.viewport.offsetX).toBe(0);
      expect(s.viewport.offsetY).toBe(0);
      done();
    });
  });

  it('should add card and select it', (done) => {
    const id = service.addCardAt(5, 6, {title: 'New card'});
    service.state$.subscribe(s => {
      const c = s.cards.find(c => c.id === id)!;
      expect(c).toBeTruthy();
      expect(c.x).toBe(5);
      expect(c.y).toBe(6);
      expect(c.width).toBe(MIN_CARD_SIZE_UNITS);
      expect(s.selectedCardIds).toEqual([id]);
      done();
    });
  });

  it('should set, toggle, and clear selection', () => {
    const a = service.addCardAt(0, 0);
    const b = service.addCardAt(10, 0);
    service.setSelection([a]);
    expect(service.getSnapshot().selectedCardIds).toEqual([a]);
    service.toggleSelection(b);
    expect(new Set(service.getSnapshot().selectedCardIds)).toEqual(new Set([a, b]));
    service.clearSelection();
    expect(service.getSnapshot().selectedCardIds.length).toBe(0);
  });

  it('should move and nudge selected cards', () => {
    const a = service.addCardAt(1, 2);
    service.setSelection([a]);
    service.moveSelected(3, 4);
    let c = service.getSnapshot().cards.find(c => c.id === a)!;
    expect(c.x).toBeCloseTo(4);
    expect(c.y).toBeCloseTo(6);
    service.nudgeSelected(-1, 2);
    c = service.getSnapshot().cards.find(c => c.id === a)!;
    expect(c.x).toBeCloseTo(3);
    expect(c.y).toBeCloseTo(8);
  });

  it('should enforce minimum size on resize', () => {
    const a = service.addCardAt(0, 0);
    const min = MIN_CARD_SIZE_UNITS;
    service.resizeCard(a, 0, 0, 1, 2);
    const c = service.getSnapshot().cards.find(c => c.id === a)!;
    expect(c.width).toBeGreaterThanOrEqual(min);
    expect(c.height).toBeGreaterThanOrEqual(min);
  });

  it('should delete selected cards', () => {
    const a = service.addCardAt(0, 0);
    service.setSelection([a]);
    service.removeSelected();
    expect(service.getSnapshot().cards.find(c => c.id === a)).toBeUndefined();
    expect(service.getSnapshot().selectedCardIds.length).toBe(0);
  });

  it('should update viewport zoom and pan', () => {
    service.setZoom(2);
    expect(service.getSnapshot().viewport.zoom).toBeCloseTo(2);
    service.setPan(100, -50);
    expect(service.getSnapshot().viewport.offsetX).toBe(100);
    expect(service.getSnapshot().viewport.offsetY).toBe(-50);
    service.panBy(20, 30);
    expect(service.getSnapshot().viewport.offsetX).toBe(120);
    expect(service.getSnapshot().viewport.offsetY).toBe(-20);
    service.setZoom(0.01);
    expect(service.getSnapshot().viewport.zoom).toBeGreaterThanOrEqual(0.1);
    service.setZoom(99);
    expect(service.getSnapshot().viewport.zoom).toBeLessThanOrEqual(8);
  });

  it('should add and remove links', () => {
    const a = service.addCardAt(0, 0);
    const b = service.addCardAt(20, 0);
    // Use default connection point ids (top/right/bottom/left)
    const linkId = service.addLink(a, 'right', b, 'left');
    expect(linkId).toBeTruthy();
    let snap = service.getSnapshot();
    expect(snap.links.length).toBe(1);
    expect(snap.links[0].sourceCardId).toBe(a);
    expect(snap.links[0].targetCardId).toBe(b);
    service.removeLink(snap.links[0].id);
    snap = service.getSnapshot();
    expect(snap.links.length).toBe(0);
  });

  it('removes attached links when deleting cards', () => {
    const a = service.addCardAt(0, 0);
    const b = service.addCardAt(20, 0);
    const c = service.addCardAt(40, 0);
    const l1 = service.addLink(a, 'right', b, 'left');
    const l2 = service.addLink(b, 'right', c, 'left');
    expect(service.getSnapshot().links.length).toBe(2);
    service.setSelection([b]);
    service.removeSelected();
    const snap = service.getSnapshot();
    expect(snap.cards.find(x => x.id === b)).toBeUndefined();
    // Both links touched card b and must be removed
    expect(snap.links.length).toBe(0);
  });
});
