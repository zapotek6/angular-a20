import {ChangeDetectionStrategy, Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {BoardStateService} from '../services/board-state.service';
import {Observable} from 'rxjs';
import {BoardState, CardModel, LinkModel, LinkStyle} from '../models/board.models';


@Component({
  standalone: true,
  selector: 'app-board-properties',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="board-props">
      @if (state$ | async; as s) {
        @if ((s.selectedCardIds.length === 0) && (!s.selectedLinkIds || s.selectedLinkIds.length === 0)) {
          <p>No selection.</p>
        } @else if (s.selectedLinkIds && s.selectedLinkIds.length > 1 && s.selectedCardIds.length === 0) {
          <p>Multiple links selected ({{ s.selectedLinkIds.length }} links).</p>
        } @else if (s.selectedLinkIds && s.selectedLinkIds.length === 1 && s.selectedCardIds.length === 0) {
          @let ln = getSingleSelectedLink(s);
          @if (ln) {
            <div class="section-title">Link Properties</div>
            <div class="field">
              <label>Label</label>
              <input type="text" [ngModel]="ln.label?.text || ''" (ngModelChange)="updateLinkLabel(ln, $event)" />
            </div>
            <div class="field">
              <label>Color</label>
              <input type="color" [ngModel]="ln.style.color" (ngModelChange)="updateLinkStyle(ln, {color: $event})" />
            </div>
            <div class="field small">
              <label>Width</label>
              <input type="number" step="0.1" min="0.1" [ngModel]="ln.style.width" (ngModelChange)="updateLinkStyle(ln, {width: toNum($event)})" />
            </div>
            <div class="field">
              <label>Dash</label>
              <select [ngModel]="ln.style.dash || 'solid'" (ngModelChange)="updateLinkStyle(ln, {dash: $event})">
                <option value="solid">solid</option>
                <option value="dashed">dashed</option>
                <option value="dotted">dotted</option>
              </select>
            </div>
            <div class="field small">
              <label>Arrow head</label>
              <select [ngModel]="ln.style.arrowHead || 'none'" (ngModelChange)="updateLinkStyle(ln, {arrowHead: $event})">
                <option value="none">none</option>
                <option value="filled">filled</option>
                <option value="open">open</option>
              </select>
            </div>
            <div class="field small">
              <label>Arrow tail</label>
              <select [ngModel]="ln.style.arrowTail || 'none'" (ngModelChange)="updateLinkStyle(ln, {arrowTail: $event})">
                <option value="none">none</option>
                <option value="filled">filled</option>
                <option value="open">open</option>
              </select>
            </div>
          }
        } @else if (s.selectedCardIds.length > 1) {
          <p>Multiple cards selected.</p>
        } @else {
          @let card = getSingleSelected(s);
          @if (card) {
            <div class="section-title">Card Properties</div>
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
            @if (card.shape === 'rect') {
              <div class="section-title">Rectangle Style</div>
              <div class="field small">
                <label>Corner radius (units)</label>
                <input type="number" step="0.2" min="0"
                       [ngModel]="card.rectStyle?.cornerRadiusUnits || 0"
                       (ngModelChange)="updateRectStyle(card, {cornerRadiusUnits: toNum($event)})" />
              </div>
              <div class="field">
                <label>Border color</label>
                <input type="color" [ngModel]="card.rectStyle?.borderColor || '#888'"
                       (ngModelChange)="updateRectStyle(card, {borderColor: $event})" />
              </div>
              <div class="field small">
                <label>Border width (units)</label>
                <input type="number" step="0.1" min="0"
                       [ngModel]="card.rectStyle?.borderWidthUnits ?? 0.2"
                       (ngModelChange)="updateRectStyle(card, {borderWidthUnits: toNum($event)})" />
              </div>
              <div class="field small">
                <label>Border dash</label>
                <select [ngModel]="card.rectStyle?.borderDash || 'solid'"
                        (ngModelChange)="updateRectStyle(card, {borderDash: $event})">
                  <option value="solid">solid</option>
                  <option value="dashed">dashed</option>
                  <option value="dotted">dotted</option>
                </select>
              </div>
              <div class="field small">
                <label>Line join</label>
                <select [ngModel]="card.rectStyle?.borderLineJoin || 'round'"
                        (ngModelChange)="updateRectStyle(card, {borderLineJoin: $event})">
                  <option value="miter">miter</option>
                  <option value="round">round</option>
                  <option value="bevel">bevel</option>
                </select>
              </div>
              <div class="field small">
                <label>Line cap</label>
                <select [ngModel]="card.rectStyle?.borderLineCap || 'round'"
                        (ngModelChange)="updateRectStyle(card, {borderLineCap: $event})">
                  <option value="butt">butt</option>
                  <option value="round">round</option>
                  <option value="square">square</option>
                </select>
              </div>
            }
            <div class="section-title">Title Style</div>
            <div class="field">
              <label>Font family</label>
              <input type="text" [ngModel]="card.titleStyle?.fontFamily || 'system-ui, sans-serif'"
                     (ngModelChange)="updateTitleStyle(card, {fontFamily: $event})"/>
            </div>
            <div class="field small">
              <label>Font weight</label>
              <select [ngModel]="card.titleStyle?.fontWeight || 600" (ngModelChange)="updateTitleStyle(card, {fontWeight: $event})">
                <option [ngValue]="300">300</option>
                <option [ngValue]="400">400</option>
                <option [ngValue]="500">500</option>
                <option [ngValue]="600">600</option>
                <option [ngValue]="700">700</option>
              </select>
            </div>
            <div class="field small">
              <label>Font style</label>
              <select [ngModel]="card.titleStyle?.fontStyle || 'normal'" (ngModelChange)="updateTitleStyle(card, {fontStyle: $event})">
                <option value="normal">normal</option>
                <option value="italic">italic</option>
              </select>
            </div>
            <div class="field">
              <label>Title color</label>
              <input type="color" [ngModel]="card.titleStyle?.color || '#222'"
                     (ngModelChange)="updateTitleStyle(card, {color: $event})" />
            </div>
            <div class="field small">
              <label>Size mode</label>
              <label><input type="radio" name="title-size-mode" [checked]="(card.titleStyle?.sizeMode || 'auto') === 'auto'"
                            (change)="updateTitleStyle(card, {sizeMode: 'auto'})"/> Auto</label>
              <label><input type="radio" name="title-size-mode" [checked]="(card.titleStyle?.sizeMode || 'auto') === 'fixed'"
                            (change)="updateTitleStyle(card, {sizeMode: 'fixed'})"/> Fixed</label>
            </div>
            @if ((card.titleStyle?.sizeMode || 'auto') === 'fixed') {
              <div class="field small">
                <label>Font size (units)</label>
                <input type="number" step="0.2" min="0.2"
                       [ngModel]="card.titleStyle?.fontSizeUnits || 1.2/10"
                       (ngModelChange)="updateTitleStyle(card, {fontSizeUnits: toNum($event)})"/>
              </div>
            }
            <div class="field small">
              <label>Line height</label>
              <input type="number" step="0.1" min="0.8" [ngModel]="card.titleStyle?.lineHeight || 1.2"
                     (ngModelChange)="updateTitleStyle(card, {lineHeight: toNum($event)})"/>
            </div>
            <div class="field small">
              <label>Title padding (units)</label>
              <input type="number" step="0.2" min="0" [ngModel]="card.titleStyle?.paddingUnits ?? 1"
                     (ngModelChange)="updateTitleStyle(card, {paddingUnits: toNum($event)})"/>
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
            <p>No selection.</p>
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
  getSingleSelectedLink(s: BoardState): LinkModel | null {
    const ids = s.selectedLinkIds || [];
    if (ids.length !== 1) return null;
    const id = ids[0];
    return s.links.find(l => l.id === id) ?? null;
  }
  update(id: string, patch: Partial<CardModel>) { this.board.updateCard(id, patch); }
  updateTitleStyle(card: CardModel, partial: any) {
    const prev = card.titleStyle || {} as any;
    const next = { ...prev, ...partial };
    this.board.updateCard(card.id, { titleStyle: next });
  }
  updateRectStyle(card: CardModel, partial: any) {
    const prev = card.rectStyle || {} as any;
    const next = { ...prev, ...partial };
    this.board.updateCard(card.id, { rectStyle: next });
  }
  updateLinkStyle(ln: LinkModel, partial: Partial<LinkStyle>) {
    const nextStyle: LinkStyle = { ...ln.style, ...partial } as LinkStyle;
    this.board.updateLink(ln.id, { style: nextStyle });
  }
  updateLinkLabel(ln: LinkModel, text: string) {
    const t = ln.label?.t ?? 0.5;
    const trimmed = (text ?? '').trim();
    const next = trimmed.length ? { text: trimmed, t } : undefined;
    this.board.updateLink(ln.id, { label: next });
  }
  toNum(v: any) { const n = Number(v); return isNaN(n) ? 0 : n; }
}
