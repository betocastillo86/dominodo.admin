import { Injectable, signal } from '@angular/core';

export type NotificationType = 'error' | 'success' | 'info';

export interface AppNotification {
  id: number;
  type: NotificationType;
  message: string;
}

/**
 * Minimal signal-based notification bus. The error interceptor pushes messages
 * here; a toast/UI component (later phase) renders `items`.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly _items = signal<AppNotification[]>([]);
  readonly items = this._items.asReadonly();

  private sequence = 0;

  error(message: string): void {
    this.push('error', message);
  }

  success(message: string): void {
    this.push('success', message);
  }

  info(message: string): void {
    this.push('info', message);
  }

  dismiss(id: number): void {
    this._items.update((list) => list.filter((n) => n.id !== id));
  }

  private push(type: NotificationType, message: string): void {
    const id = ++this.sequence;
    this._items.update((list) => [...list, { id, type, message }]);
  }
}
