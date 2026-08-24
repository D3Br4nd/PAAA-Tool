// See https://svelte.dev/docs/kit/types#app
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface SessionUser {
      id: string;
      email: string | null;
      name: string | null;
      avatarUrl: string | null;
      role: 'admin' | 'staff' | 'player';
      teamId: string | null;
      authMethod: 'code' | 'password';
    }
    interface Locals {
      user: SessionUser | null;
      sessionId: string | null;
      team: {
        id: string;
        name: string;
        joinCode: string;
        scoreCache: number;
        color: string;
        avatarUrl: string | null;
        description: string | null;
        currentPhaseId: string | null;
      } | null;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export { };
