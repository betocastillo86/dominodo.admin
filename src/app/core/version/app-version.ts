/**
 * Release identifier baked into the bundle at build time.
 *
 * The deploy pipeline replaces the placeholder with `$(Build.BuildId)` (see
 * `pipelines/build-ftp-pipeline.yaml`) in BOTH this file and `public/version.json`,
 * so the value compiled into the bundle and the value published at `/version.json`
 * come from the same build. Comparing them is how the app notices a new release.
 *
 * Local dev builds never run that step, so the placeholder survives — which is
 * exactly how `IS_VERSION_STAMPED` distinguishes dev from a real deploy.
 */
export const APP_VERSION: string = '___buildid___';

/** False in local dev builds, where the placeholder was never replaced. */
export const IS_VERSION_STAMPED = !APP_VERSION.startsWith('___');

/** What to show users: the build id on deployed environments, `dev` locally. */
export const DISPLAY_VERSION = IS_VERSION_STAMPED ? APP_VERSION : 'dev';
