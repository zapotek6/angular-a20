import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap, map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { CacheStore } from '../repo/cache-store';
import { MetricsService } from '../../../utils/metrics.service';

export const etagInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const store = inject(CacheStore);
  const metrics = inject(MetricsService);

  let r = req;
  if (req.method === 'GET') {
    const etag = store.getUrlEtag(req.urlWithParams);
    if (etag) {
      r = req.clone({ setHeaders: { 'If-None-Match': etag } });
    }
  }

  return next(r).pipe(
    map((event) => {
      if (event instanceof HttpResponse) {
        const etag = event.headers.get('ETag') || event.headers.get('Etag') || event.headers.get('etag') || undefined;
        if (etag) {
          store.setUrlMeta(req.urlWithParams, { etag });
        }
        if (event.status === 304) {
          metrics.inc('etag_304');
          const cachedBody = store.getUrlBody(req.urlWithParams);
          if (cachedBody !== undefined) {
            return event.clone({ body: cachedBody, status: 200 });
          }
        }
      }
      return event;
    })
  );
};
