import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from './i18n.service';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [],
  template: `
    <label for="lang-select" class="sr-only">Language</label>
    <select id="lang-select" [value]="i18n.current" (change)="switch($event)">
        @for (l of i18n.langs(); track l) {
            <option [value]="l">{{ l.toUpperCase() }}</option>
        } @empty {
            <option disabled>No languages available</option>
        }
    </select>
  `,
  styles: [
    `.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}`
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LanguageSwitcherComponent {
  protected readonly i18n = inject(I18nService);

  switch(event: Event) {
    const lang = (event.target as HTMLSelectElement).value as 'en' | 'it';
    this.i18n.use(lang);
  }
}
