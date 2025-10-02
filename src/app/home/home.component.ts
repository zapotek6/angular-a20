import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../core/auth/auth.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [TranslateModule],
  template: `
    <h2>{{ 'home.title' | translate }}</h2>
    <p>{{ 'home.welcome' | translate }}</p>
    <a (click)="logout()">Logout</a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private sub?: Subscription;

  ngOnInit(): void {
    // If somehow reached without being authenticated, ensure redirect
    if (!this.auth.isAuthenticated()) {
      this.router.navigateByUrl('/login');
      return;
    }
    // Watch for logout while on this page
    this.sub = this.auth.authChanges$.subscribe((s) => {
      if (!s) {
        this.router.navigateByUrl('/login');
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  logout() {
    this.auth.logout();
  }
}
