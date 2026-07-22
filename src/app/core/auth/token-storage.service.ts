import { Injectable } from '@angular/core';
import { AuthTokens } from './auth.models';

const STORAGE_KEY = 'dominodo.admin.tokens';

/** Persists the auth token envelope in `localStorage`. */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  read(): AuthTokens | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthTokens;
    } catch {
      return null;
    }
  }

  save(tokens: AuthTokens): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
