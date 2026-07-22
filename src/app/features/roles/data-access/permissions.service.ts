import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PermissionDto } from './permission.models';

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/permissions`;

  list(): Observable<PermissionDto[]> {
    return this.http.get<PermissionDto[]>(this.base);
  }
}
