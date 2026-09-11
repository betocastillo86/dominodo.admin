export const environment = {
  production: true,
  // Stage API (Azure App Service).
  apiBaseUrl: 'https://app-dominodo-api-stage.azurewebsites.net/api/v1',
  // Stage Domi — its own Azure App Service, probed by the dashboard at /health/ready.
  domiBaseUrl: 'https://app-dominodo-domi-stage.azurewebsites.net',
};
