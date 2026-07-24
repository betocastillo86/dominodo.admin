import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import {
  AdminNotificationTemplateDto,
  AdminNotificationType,
  AdminUpdateNotificationTemplateRequest,
} from './notification-template.models';

/** Data-access for the Notification Templates feature. Exposes list state as signals. */
@Injectable({ providedIn: 'root' })
export class NotificationTemplatesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/notification-templates`;

  private readonly _templates = signal<AdminNotificationTemplateDto[]>([]);
  private readonly _paging = signal<PagedResult<AdminNotificationTemplateDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly templates = this._templates.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Fetch a page of templates and push the result into the state signals. */
  list(
    page: number,
    pageSize: number,
    search?: string,
    active?: boolean,
    type?: AdminNotificationType,
  ): void {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) params = params.set('search', search);
    if (active !== undefined) params = params.set('active', active);
    if (type) params = params.set('type', type);

    this.http
      .get<PagedResult<AdminNotificationTemplateDto>>(this.base, { params })
      .subscribe({
        next: (result) => {
          this._templates.set(result.items);
          this._paging.set(result);
          this._loading.set(false);
        },
        error: (error: unknown) => {
          this._error.set(this.toError(error));
          this._loading.set(false);
        },
      });
  }

  getById(id: string): Observable<AdminNotificationTemplateDto> {
    return this.http.get<AdminNotificationTemplateDto>(`${this.base}/${id}`);
  }

  update(id: string, body: AdminUpdateNotificationTemplateRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, body);
  }

  private toError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? 'No se pudieron cargar las plantillas.';
    }
    return 'No se pudieron cargar las plantillas.';
  }
}
