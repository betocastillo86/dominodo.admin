/**
 * Shape shared by every `environment.*.ts` file. Declaring it keeps the three builds in
 * step: a field added here has to be answered in local, stage and prod alike, instead of
 * silently going missing in the one configuration nobody runs by hand.
 */
export interface AppEnvironment {
  production: boolean;
  /** Back ends this build talks to. */
  apiBaseUrl: string;
  domiBaseUrl: string;
  /** Deployment name shown in the panel chrome (Spanish — it is UI copy). */
  envName: string;
  /**
   * Tabler palette applied panel-wide as `data-bs-theme-primary`. Production is tinted
   * apart from the rest so a prod tab never gets mistaken for a test one.
   */
  envTone: EnvTone;
}

/** Palette names Tabler ships in `$extra-colors` / `tabler-themes.scss`. */
export type EnvTone =
  | 'blue'
  | 'azure'
  | 'indigo'
  | 'purple'
  | 'pink'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'teal'
  | 'cyan';
