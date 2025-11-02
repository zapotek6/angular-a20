import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, tap } from 'rxjs';
import { CacheStore } from '../infra/repo/cache-store';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {BroadcasterService} from '../brodacaster.service';
import {Logger, LogSeverity} from '../logger/logger';
import {LoggerService} from '../logger/logger.service';
import {Router} from '@angular/router';
import {environment} from '../../../environments/environment';

export interface Session {
  user: { email: string };
  tenant: string;
  token?: string;
  createdAt: number;
}

const SESSION_KEY = 'session';
export enum AuthState { NotAuthenticated, Authenticating, Authenticated}
export enum AuthEvent { Login = 'AUTH-LOGIN', Logout = 'AUTH_LOGOUT', ApiAuthFail = 'AUTH-APIAUTHFAIL'}
export const BROADCAST_LOGOUT = 'logout';
const BROADCAST_TENANT = 'tenant-change';

const XSRF_COOKIE_NAME = 'XSRF-TOKEN';
const XSRF_HEADER_NAME = 'X-XSRF-TOKEN';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly session$ = new BehaviorSubject<Session | null>(this.restore());
  /** Observable stream to monitor authentication/session changes */
  readonly authChanges$ = this.session$.asObservable();

  private readonly http = inject(HttpClient);
  private logger: Logger;
  private bcast: BroadcasterService;

  constructor(private readonly loggerService: LoggerService,
              private cache: CacheStore,
              private readonly router: Router) {
    this.logger = this.loggerService.createLocalLoggerInstance("AuthService", LogSeverity.DEBUG);
    this.logger.enabled = true;
    this.logger.debug('constructor');
    this.bcast = new BroadcasterService(this.logger);
    // Listen for storage events from other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === BROADCAST_LOGOUT) {
        this.clearCaches();
        this.session$.next(null);
      }
      if (e.key === BROADCAST_TENANT) {
        this.clearCaches();
      }
    });
    // Listen for BroadcastChannel messages
      this.bcast.onMessage((data) => {
        if (data?.type === BROADCAST_LOGOUT) {
          this.clearCaches();
          this.session$.next(null);
        }
        if (data?.type === BROADCAST_TENANT) {
          this.clearCaches();
        }
        if (data?.type === AuthEvent.ApiAuthFail) {
          this.clearCaches();
          this.logout().subscribe({
            next: () => {
              localStorage.removeItem(SESSION_KEY);
              this.bcast.broadcast({ type: AuthEvent.Logout });
              this.router.navigateByUrl('/login');
            },
            error: (err) => {
              this.logger.err('ApiAuthFail', err);
            }
          });
        }
      });
  }

  get session(): Session | null {
    return this.session$.value;
  }

  isAuthenticated(): boolean {
    return !!this.session$.value;
  }

  login(email: string, password: string, tenant: string): Observable<void> {
    const basic = 'Basic ' + btoa(`${email}:${password}`);
    const headers = new HttpHeaders({
      'authorization': basic,
      'content-type': 'application/json'
    });
    return this.http
      .post(environment.apiUrl +'/api/auth/login', { username: email, password }, { headers, withCredentials: true })
      .pipe(
        tap(() => {
          const sess: Session = { user: { email }, tenant, createdAt: Date.now() };
          this.session$.next(sess);
          localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
          // Signal tenant as it could affect caches
          this.bcast.broadcast({ type: BROADCAST_TENANT, tenant });
        }),
        map(() => void 0)
      );
  }

  logout(): Observable<void> {
    const sess = this.session$.value;
    const auth = sess?.token;
    const xsrf = this.get_xsrf_token() ?? '';
    const headersObj: Record<string, string> = {};
    if (auth) headersObj['authorization'] = auth;
    if (xsrf) headersObj['x-xsrf-token'] = xsrf;
    const headers = new HttpHeaders(headersObj);

    return this.http.post(environment.apiUrl + '/api/auth/logout', {}, { headers, withCredentials: true }).pipe(
      catchError((err) => {
        // Even if network fails, proceed to clear client state to avoid being stuck
        return new Observable<void>((subscriber) => {
          subscriber.next();
          subscriber.complete();
        });
      }),
      tap(() => {
        this.session$.next(null);
        localStorage.removeItem(SESSION_KEY);
        this.clearCaches();
        // Broadcast to other tabs
        localStorage.setItem(BROADCAST_LOGOUT, Date.now().toString());
        this.bcast.broadcast({ type: BROADCAST_LOGOUT });
      }),
      map(() => void 0)
    );
  }

  private getCookie(name: string): string | null {
    const cname = name + '=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let c of ca) {
      while (c.startsWith(' ')) c = c.substring(1);
      if (c.startsWith(cname)) return c.substring(cname.length, c.length);
    }
    return null;
  }

  get_xsrf_token(): string {
    const token = this.getCookie(XSRF_COOKIE_NAME);
    if (!token) return "XSRF token was not found"; //throw new Error('XSRF token not found');
    return token.split(';')[0];
  }

  get_xsrf_header_name(): string {
    return XSRF_HEADER_NAME;
  }

  switchTenant(tenant: string) {
    const current = this.session$.value;
    if (!current) return;
    const updated: Session = { ...current, tenant };
    this.session$.next(updated);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    this.clearCaches();
    localStorage.setItem(BROADCAST_TENANT, tenant);
    this.bcast.broadcast({ type: BROADCAST_TENANT, tenant });
  }

  private restore(): Session | null {
    const s = localStorage.getItem(SESSION_KEY);
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }

  private clearCaches() {
    this.cache.clearAll('auth-change');
  }
}
