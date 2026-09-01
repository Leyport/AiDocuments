import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly auth = inject(AuthService);

  protected signIn(): void {
    this.auth.signInWithGoogle().catch((err: unknown) => console.error('Sign-in failed', err));
  }

  protected signOut(): void {
    this.auth.signOutUser().catch((err: unknown) => console.error('Sign-out failed', err));
  }
}
