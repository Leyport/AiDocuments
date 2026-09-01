import { Service, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user } from '@angular/fire/auth';

@Service()
export class AuthService {
  private readonly auth = inject(Auth);

  readonly currentUser = toSignal(user(this.auth), { initialValue: undefined });

  signInWithGoogle(): Promise<void> {
    return signInWithPopup(this.auth, new GoogleAuthProvider()).then(() => undefined);
  }

  signOutUser(): Promise<void> {
    return signOut(this.auth);
  }
}
