import type { User as FirebaseUser } from 'firebase/auth';
import {
  getFirebaseIdToken,
  getWorkspaceAccessToken,
  initAuthListener,
  signInWithGoogle,
  signOutUser,
} from '../../lib/firebase';
import type { AuthSessionUser, IAuthProvider } from '../contracts';

function toSessionUser(fbUser: FirebaseUser): AuthSessionUser {
  return {
    uid: fbUser.uid,
    email: fbUser.email || `${fbUser.uid}@aprovafoco.app`,
    displayName: fbUser.displayName,
    photoURL: fbUser.photoURL,
  };
}

export class FirebaseAuthAdapter implements IAuthProvider {
  readonly mode = 'firebase' as const;
  readonly supportsGoogleWorkspace = true;

  initAuthListener(
    onAuthenticated: (user: AuthSessionUser) => void,
    onUnauthenticated: () => void
  ): () => void {
    return initAuthListener(
      (fbUser) => onAuthenticated(toSessionUser(fbUser)),
      onUnauthenticated
    );
  }

  async signInWithGoogle() {
    const res = await signInWithGoogle();
    return {
      user: toSessionUser(res.user),
      workspaceToken: res.workspaceToken,
    };
  }

  async getAccessToken(): Promise<string | null> {
    return getFirebaseIdToken();
  }

  getWorkspaceAccessToken(): string | null {
    return getWorkspaceAccessToken();
  }

  async signOut(): Promise<void> {
    await signOutUser();
  }
}
