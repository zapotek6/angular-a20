import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {etagInterceptor} from './core/infra/http/etag.interceptor';
import {provideTranslateService} from '@ngx-translate/core';
import {provideTranslateHttpLoader} from '@ngx-translate/http-loader';
import {AuthService} from './core/auth/auth.service';
import {CacheStore} from './core/infra/repo/cache-store';
import {MetricsService} from './utils/metrics.service';
import {OnlineFocusService} from './utils/online-focus.service';
import {I18nService} from './i18n/i18n.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([etagInterceptor])),
    provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
    ...provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix: '.json' }),
    I18nService,
    AuthService,
    CacheStore,
    MetricsService,
    OnlineFocusService
  ]
};
