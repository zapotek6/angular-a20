import { Injectable, NgZone } from '@angular/core';
import { fromEvent, merge, Observable, shareReplay } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OnlineFocusService {
  readonly triggers$: Observable<Event>;

  constructor(zone: NgZone) {
    this.triggers$ = zone.runOutsideAngular(() =>
      merge(fromEvent(window, 'focus'), fromEvent(window, 'online')).pipe(shareReplay({ bufferSize: 1, refCount: true }))
    );
  }
}
