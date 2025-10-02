import { Routes } from '@angular/router';
import {LoginComponent} from './core/auth/login.component';
import {HomeComponent} from './home/home.component';
import {authGuard} from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' }
];
