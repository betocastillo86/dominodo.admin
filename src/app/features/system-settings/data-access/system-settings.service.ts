import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import {
  CreateSystemSettingRequest,
  SystemSettingDto,
  UpdateSystemSettingRequest,
} from './system-setting.models';

/** Data-access for the System Settings feature. Exposes list state as signals. */
@Injectable({ providedIn: 'root' })
export class SystemSettingsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/system-settings`;

  private readonly _settings = signal<SystemSettingDto[]>([]);
  private readonly _paging = signal<PagedResult<SystemSettingDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly settings = this._settings.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Fetch a page of settings and push the result into the state signals. */
  list(page: number, pageSize: number, key?: string): void {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (key) params = params.set('key', key);

    this.http.get<PagedResult<SystemSettingDto>>(this.base, { params }).subscribe({
      next: (result) => {
        this._settings.set(result.items);
        this._paging.set(result);
        this._loading.set(false);
      },
      error: (error: unknown) => {
        this._error.set(this.toError(error));
        this._loading.set(false);
      },
    });
  }

  getByKey(key: string): Observable<SystemSettingDto> {
    return this.http.get<SystemSettingDto>(`${this.base}/${encodeURIComponent(key)}`);
  }

  create(body: CreateSystemSettingRequest): Observable<void> {
    return this.http.post<void>(this.base, body);
  }

  update(key: string, body: UpdateSystemSettingRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${encodeURIComponent(key)}`, body);
  }

  private toError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? 'No se pudieron cargar las configuraciones.';
    }
    return 'No se pudieron cargar las configuraciones.';
  }
}
