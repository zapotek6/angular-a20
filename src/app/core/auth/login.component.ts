import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {Component, inject} from "@angular/core";
import {TranslateModule} from "@ngx-translate/core";
import {AuthService} from "./auth.service";
import {Router} from "@angular/router";

@Component({
    standalone: true,
    selector: 'app-login',
    imports: [ReactiveFormsModule, TranslateModule],
    template: `
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <label>
                {{ 'login.email' | translate }}
                <input type="email" formControlName="email" required />
            </label>
            <br />
            <label>
                {{ 'login.password' | translate }}
                <input type="password" formControlName="password" required />
            </label>
            <br />
            <label>
                {{ 'login.tenant' | translate }}
                <input formControlName="tenant" required />
            </label>
            <br />
            <button type="submit">{{ 'login.submit' | translate }}</button>
        </form>`,
    /* ... */
})
export class LoginComponent {
    private fb = inject(FormBuilder);
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);

    form = this.fb.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', Validators.required],
        tenant: ['default', Validators.required],
    });

    onSubmit() {
        if (this.form.invalid) return;
        const { email, password, tenant } = this.form.getRawValue();
        this.auth.login(email!, password!, tenant!);
        this.router.navigateByUrl('/home');
    }
}