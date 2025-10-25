import {Component, inject, signal} from '@angular/core';
import {Router, RouterOutlet} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {I18nService} from './i18n/i18n.service';
import {AuthService} from './core/auth/auth.service';
import {LanguageSwitcherComponent} from './i18n/language-switcher.component';
import {LoginComponent} from './features/login/login.component';
import {environment} from '../environments/environment';
import {DynamicDialogModule} from 'primeng/dynamicdialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, DynamicDialogModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('a20');
  private readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    console.log(environment.production);
  }
  logout() {
    this.auth.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login')
    });
  }
}
