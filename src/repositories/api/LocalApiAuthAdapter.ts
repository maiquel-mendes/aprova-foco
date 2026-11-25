import type { AuthSessionUser, IAuthProvider } from '../contracts';

function getApiBaseUrl(): string {
  const base = (import.meta.env.VITE_API_BASE_URL || '').trim();
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

export class LocalApiAuthAdapter implements IAuthProvider {
  readonly mode = 'local' as const;
  readonly supportsGoogleWorkspace = false;

  // Kept strictly in JS memory (never localStorage/sessionStorage)
  private memoryToken: string | null = null;
  private currentUser: AuthSessionUser | null = null;
  private listeners = new Set<{
    onAuthenticated: (user: AuthSessionUser) => void;
    onUnauthenticated: () => void;
  }>();

  private notify() {
    for (const listener of this.listeners) {
      if (this.currentUser) {
        listener.onAuthenticated(this.currentUser);
      } else {
        listener.onUnauthenticated();
      }
    }
  }

  initAuthListener(
    onAuthenticated: (user: AuthSessionUser) => void,
    onUnauthenticated: () => void
  ): () => void {
    const entry = { onAuthenticated, onUnauthenticated };
    this.listeners.add(entry);
    if (this.currentUser) {
      onAuthenticated(this.currentUser);
    } else {
      onUnauthenticated();
    }
    return () => {
      this.listeners.delete(entry);
    };
  }

  async signInWithGoogle(): Promise<{
    user: AuthSessionUser;
    workspaceToken: string | null;
  }> {
    throw new Error(
      'Login Google não está ativo no modo local PostgreSQL. Utilize e-mail e senha.'
    );
  }

  async signInWithPassword(
    email: string,
    password: string
  ): Promise<AuthSessionUser> {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Credenciais inválidas.');
    }
    this.memoryToken = String(data.token || '');
    this.currentUser = data.user as AuthSessionUser;
    this.notify();
    return this.currentUser;
  }

  async registerWithPassword(
    email: string,
    password: string,
    displayName: string
  ): Promise<AuthSessionUser> {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Não foi possível criar a conta.');
    }
    this.memoryToken = String(data.token || '');
    this.currentUser = data.user as AuthSessionUser;
    this.notify();
    return this.currentUser;
  }

  async getAccessToken(): Promise<string | null> {
    return this.memoryToken;
  }

  getWorkspaceAccessToken(): string | null {
    return null;
  }

  async signOut(): Promise<void> {
    this.memoryToken = null;
    this.currentUser = null;
    this.notify();
  }
}
