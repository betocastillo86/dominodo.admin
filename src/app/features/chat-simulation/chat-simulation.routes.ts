import { Routes } from '@angular/router';

export const chatSimulationRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./chat-simulation/chat-simulation.component').then(
        (m) => m.ChatSimulationComponent,
      ),
  },
];
