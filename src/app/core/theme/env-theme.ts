import { environment } from '../../../environments/environment';

/**
 * Tints the whole panel with the colour of the environment this build points at.
 *
 * Tabler resolves `--tblr-primary` from a `data-bs-theme-primary` attribute on any
 * ancestor, so one attribute on `<html>` re-colours buttons, links, the active sidebar
 * item and every badge at once. That is the point: production is orange, everything else
 * stays blue, and a prod tab is never mistaken for a test one.
 *
 * Called from `main.ts` before bootstrap so the colour is in place on the first paint.
 */
export function applyEnvTheme(): void {
  document.documentElement.dataset['bsThemePrimary'] = environment.envTone;
}
