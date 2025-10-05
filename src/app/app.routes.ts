import { Routes } from '@angular/router';
import {LoginComponent} from './features/login/login.component';
import {HomeComponent} from './features/home/home.component';
import {authGuard} from './core/auth/auth.guard';
import {Development} from './dev/development/development';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'dev', component: Development },
  { path: 'home', component: HomeComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' }
];
