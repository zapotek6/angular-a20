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
      expect(s.selectedLinkIds.length).toBe(0);
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
    expect(service.getSnapshot().selectedLinkIds.length).toBe(0);
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

  it('link selection API should be mutually exclusive and removable', () => {
    const a = service.addCardAt(0, 0);
    const b = service.addCardAt(20, 0);
    const linkId = service.addLink(a, 'right', b, 'left')!;
    // Select card then select link → card selection cleared
    service.setSelection([a]);
    expect(service.getSnapshot().selectedCardIds).toEqual([a]);
    service.setLinkSelection([linkId]);
    expect(service.getSnapshot().selectedCardIds.length).toBe(0);
    expect(service.getSnapshot().selectedLinkIds).toEqual([linkId]);
    // Toggle link selection
    service.toggleLinkSelection(linkId);
    expect(service.getSnapshot().selectedLinkIds.length).toBe(0);
    // Toggle again should select
    service.toggleLinkSelection(linkId);
    expect(service.getSnapshot().selectedLinkIds).toEqual([linkId]);
    // Card selection should clear link selection
    service.setSelection([b]);
    expect(service.getSnapshot().selectedLinkIds.length).toBe(0);
    expect(service.getSnapshot().selectedCardIds).toEqual([b]);
    // removeSelected should delete selected links and clear both
    const l2 = service.addLink(a, 'right', b, 'left')!;
    service.setLinkSelection([l2]);
    service.removeSelected();
    expect(service.getSnapshot().links.find(l => l.id === l2)).toBeUndefined();
    expect(service.getSnapshot().selectedCardIds.length).toBe(0);
    expect(service.getSnapshot().selectedLinkIds.length).toBe(0);
  });

  it('commitReconnect fixes the specified endpoint and updates ids', () => {
    const a = service.addCardAt(0, 0);
    const b = service.addCardAt(20, 0);
    const linkId = service.addLink(a, 'right', b, 'left')!;
    let ln = service.getSnapshot().links.find(l => l.id === linkId)!;
    // Reconnect target end on the same target card to a different CP
    service.commitReconnect(linkId, 'target', b, 'right');
    ln = service.getSnapshot().links.find(l => l.id === linkId)!;
    expect(ln.targetCardId).toBe(b);
    expect(ln.targetPointId).toBe('right');
    expect(ln.targetAnchor).toBe('fixed');
    // Reconnect source end to a different CP on source card
    service.commitReconnect(linkId, 'source', a, 'left');
    ln = service.getSnapshot().links.find(l => l.id === linkId)!;
    expect(ln.sourceCardId).toBe(a);
    expect(ln.sourcePointId).toBe('left');
    expect(ln.sourceAnchor).toBe('fixed');
  });

  it('commitReconnect does not allow self-links (both ends on same card)', () => {
    const a = service.addCardAt(0, 0);
    const b = service.addCardAt(20, 0);
    const linkId = service.addLink(a, 'right', b, 'left')!;
    // Try to move target to the same card as source (would create self-link) → should be ignored
    service.commitReconnect(linkId, 'target', a, 'left');
    const ln = service.getSnapshot().links.find(l => l.id === linkId)!;
    expect(ln.sourceCardId).toBe(a);
    expect(ln.targetCardId).toBe(b); // unchanged
  });

  it('new cards have default rectStyle border properties', () => {
    const id = service.addCardAt(5, 5);
    const c = service.getSnapshot().cards.find(x => x.id === id)!;
    expect(c.rectStyle).toBeTruthy();
    expect(c.rectStyle?.cornerRadiusUnits).toBe(0);
    expect(c.rectStyle?.borderColor).toBe('#888');
    expect(c.rectStyle?.borderWidthUnits).toBeCloseTo(0.2);
    expect(c.rectStyle?.borderDash).toBe('solid');
    expect(c.rectStyle?.borderLineJoin).toBe('round');
    expect(c.rectStyle?.borderLineCap).toBe('round');
  });

  it('updateCard persists rectStyle border changes', () => {
    const id = service.addCardAt(0, 0);
    const orig = service.getSnapshot().cards.find(c => c.id === id)!;
    service.updateCard(id, { rectStyle: { ...(orig.rectStyle || {}), borderColor: '#123456', borderDash: 'dashed', borderWidthUnits: 0.7 } });
    const c2 = service.getSnapshot().cards.find(c => c.id === id)!;
    expect(c2.rectStyle?.borderColor).toBe('#123456');
    expect(c2.rectStyle?.borderDash).toBe('dashed');
    expect(c2.rectStyle?.borderWidthUnits).toBeCloseTo(0.7);
  });
});
