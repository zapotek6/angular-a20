import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

const STORAGE_KEY = 'lang';

@Injectable({ providedIn: 'root' })
export class I18nService {
  constructor(private translate: TranslateService) {
    const saved = localStorage.getItem(STORAGE_KEY) || 'en';
    translate.addLangs(['en', 'it']);
    translate.setDefaultLang('en');
    translate.use(saved);
  }

  get current(): string {
    return this.translate.currentLang || this.translate.defaultLang || 'en';
  }

  use(lang: 'en' | 'it') {
    this.translate.use(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  langs(): readonly string[] {
    return this.translate.getLangs();
  }
}
