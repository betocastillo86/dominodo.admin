export const environment = {
  production: true,
  // The prod API runs on a Free (F1) App Service plan, which supports no custom domain — hence the
  // azurewebsites.net host rather than api.dominodo.com.
  apiBaseUrl: 'https://app-dominodo-api-prod.azurewebsites.net/api/v1',
  domiBaseUrl: 'https://app-dominodo-domi-prod.azurewebsites.net',
};
