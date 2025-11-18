import {ChangeDetectionStrategy, Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {BoardStateService} from '../services/board-state.service';
import {Observable} from 'rxjs';
import {BoardState, CardModel} from '../models/board.models';


@Component({
  standalone: true,
  selector: 'app-board-properties',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="board-props">
      @if (state$ | async; as s) {
        @if (s.selectedCardIds.length === 0) {
          <p>No card selected.</p>
        } @else if (s.selectedCardIds.length > 1) {
          <p>Multiple cards selected.</p>
        } @else {
          @let card = getSingleSelected(s);
          @if (card) {
            <div class="field">
              <label>Title</label>
              <input type="text" [ngModel]="card.title" (ngModelChange)="update(card.id, {title: $event})" />
            </div>
            <div class="field">
              <label>Body</label>
              <textarea rows="4" [ngModel]="card.body" (ngModelChange)="update(card.id, {body: $event})"></textarea>
            </div>
            <div class="field">
              <label>Color</label>
              <input type="color" [ngModel]="card.color" (ngModelChange)="update(card.id, {color: $event})" />
            </div>
            <div class="field small">
              <label>Position (x,y)</label>
              <input type="number" [ngModel]="card.x" (ngModelChange)="update(card.id, {x: toNum($event)})" />
              <input type="number" [ngModel]="card.y" (ngModelChange)="update(card.id, {y: toNum($event)})" />
            </div>
            <div class="field small">
              <label>Size (w,h)</label>
              <input type="number" [ngModel]="card.width" (ngModelChange)="update(card.id, {width: toNum($event)})" />
              <input type="number" [ngModel]="card.height" (ngModelChange)="update(card.id, {height: toNum($event)})" />
            </div>
          } @else {
            <p>No card selected.</p>
          }
        }
      }
    </div>
  `,
  styles: [`
    .board-props { padding: 8px; display: block; }
    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
    .field.small { flex-direction: row; align-items: center; gap: 8px; }
    .field.small label { width: 110px; }
    label { font-size: 12px; color: #666; }
    input[type='text'], textarea, input[type='number'] { width: 100%; box-sizing: border-box; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardPropertiesComponent {
  state$: Observable<BoardState>;
  constructor(private readonly board: BoardStateService) {
    this.state$ = this.board.state$;
  }
  getSingleSelected(s: BoardState): CardModel | null {
    if (s.selectedCardIds.length !== 1) return null;
    const id = s.selectedCardIds[0];
    return s.cards.find(c => c.id === id) ?? null;
  }
  update(id: string, patch: Partial<CardModel>) { this.board.updateCard(id, patch); }
  toNum(v: any) { const n = Number(v); return isNaN(n) ? 0 : n; }
}
