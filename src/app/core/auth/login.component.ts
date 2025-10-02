import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {Component, inject} from "@angular/core";
import {TranslateModule} from "@ngx-translate/core";
import {AuthService} from "./auth.service";
import {Router} from "@angular/router";

@Component({
    standalone: true,
    selector: 'app-login',
    imports: [ReactiveFormsModule, TranslateModule],
    templateUrl: './login.component.html',
})
export class LoginComponent {
    private fb = inject(FormBuilder);
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);

    loading = false;
    error: string | null = null;

    form = this.fb.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', Validators.required],
        tenant: ['default', Validators.required],
    });

    isAuthenticated() {
        return this.auth.isAuthenticated();
    }
    onSubmit() {
        if (this.form.invalid) return;
        this.loading = true;
        this.error = null;
        const { email, password, tenant } = this.form.getRawValue();
        this.auth.login(email!, password!, tenant!).subscribe({
            next: () => {
                this.loading = false;
                this.router.navigateByUrl('/home');
            },
            error: (err) => {
                this.loading = false;
                this.error = 'Login failed';
            }
        });
    }

    logout() {
        this.auth.logout().subscribe({
            next: () => this.router.navigateByUrl('/login'),
            error: () => this.router.navigateByUrl('/login')
        });
    }
}
