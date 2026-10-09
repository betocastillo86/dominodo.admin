import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { applyEnvTheme } from './app/core/theme/env-theme';
import { resetPoisonedHttpCache } from './app/core/version/cache-heal';

// Before bootstrap so the environment's colour is there on the first paint, with no
// flash of the default blue on the production panel.
applyEnvTheme();

// Fire-and-forget: drops the year-cached index.html that some browsers stored
// before the `no-cache` fix. Deliberately not awaited — it must not hold up
// bootstrap, and a failure just means it retries on the next load.
resetPoisonedHttpCache();

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
