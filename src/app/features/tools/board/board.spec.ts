import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Board } from './board';
import { BoardStateService } from './services/board-state.service';
import { MIN_CARD_SIZE_UNITS } from './models/board.models';


describe('Board', () => {
  let component: Board;
  let fixture: ComponentFixture<Board>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Board]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Board);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('maintains aspect ratio when Shift is pressed during resize (live toggle)', () => {
    const svc = TestBed.inject(BoardStateService);
    const id = svc.addCardAt(0, 0, {width: MIN_CARD_SIZE_UNITS, height: MIN_CARD_SIZE_UNITS});
    svc.setSelection([id]);
    fixture.detectChanges();

    const card = svc.getSnapshot().cards.find(c => c.id === id)!;
    // Start resize on east handle without Shift
    component.startResize(new MouseEvent('mousedown', {clientX: 0, clientY: 0, shiftKey: false}), card, 'e');
    // Move mouse 100px to the right without Shift: width changes, height stays the same
    (component as any).onResizeMove(new MouseEvent('mousemove', {clientX: 100, clientY: 0, shiftKey: false}));
    let c1 = svc.getSnapshot().cards.find(c => c.id === id)!;
    expect(c1.width).toBeGreaterThan(card.width);
    expect(c1.height).toBe(card.height);

    // Now move further while holding Shift: height should match width (keep ratio)
    (component as any).onResizeMove(new MouseEvent('mousemove', {clientX: 200, clientY: 0, shiftKey: true}));
    const c2 = svc.getSnapshot().cards.find(c => c.id === id)!;
    expect(Math.abs(c2.width - c2.height)).toBeLessThan(0.001);

    // End resize to cleanup listeners
    (component as any).onResizeEnd(new MouseEvent('mouseup'));
  });
});
