import { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  // azurewebsites.net, not api.dominodo.com: F1 supports no custom domain.
  apiBaseUrl: 'https://app-dominodo-api-prod.azurewebsites.net/api/v1',
  domiBaseUrl: 'https://app-dominodo-domi-prod.azurewebsites.net',
  envName: 'Producción',
  // The one environment that is not blue: an orange panel means the changes are real.
  envTone: 'orange',
};
