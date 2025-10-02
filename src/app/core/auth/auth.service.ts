import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CacheStore } from '../infra/repo/cache-store';

export interface Session {
  user: { email: string };
  tenant: string;
  token?: string;
  createdAt: number;
}

const SESSION_KEY = 'session';
const BROADCAST_LOGOUT = 'logout';
const BROADCAST_TENANT = 'tenant-change';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly session$ = new BehaviorSubject<Session | null>(this.restore());
  /** Observable stream to monitor authentication/session changes */
  readonly authChanges$ = this.session$.asObservable();
  private bc?: BroadcastChannel;

  constructor(private cache: CacheStore) {
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
    if ('BroadcastChannel' in window) {
      this.bc = new BroadcastChannel('auth');
      this.bc.onmessage = (ev) => {
        if (ev.data?.type === BROADCAST_LOGOUT) {
          this.clearCaches();
          this.session$.next(null);
        }
        if (ev.data?.type === BROADCAST_TENANT) {
          this.clearCaches();
        }
      };
    }
  }

  get session(): Session | null {
    return this.session$.value;
  }

  isAuthenticated(): boolean {
    return !!this.session$.value;
  }

  login(email: string, password: string, tenant: string) {
    // For now, accept any credentials and create a local session
    const sess: Session = { user: { email }, tenant, createdAt: Date.now() };
    this.session$.next(sess);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    // Signal tenant as it could affect caches
    this.broadcast({ type: BROADCAST_TENANT, tenant });
  }

  logout() {
    this.session$.next(null);
    localStorage.removeItem(SESSION_KEY);
    this.clearCaches();
    // Broadcast to other tabs
    localStorage.setItem(BROADCAST_LOGOUT, Date.now().toString());
    this.broadcast({ type: BROADCAST_LOGOUT });
  }

  switchTenant(tenant: string) {
    const current = this.session$.value;
    if (!current) return;
    const updated: Session = { ...current, tenant };
    this.session$.next(updated);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    this.clearCaches();
    localStorage.setItem(BROADCAST_TENANT, tenant);
    this.broadcast({ type: BROADCAST_TENANT, tenant });
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

  private broadcast(message: any) {
    this.bc?.postMessage(message);
  }
}
