import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'documents',
    loadChildren: () => import('./documents/documents.routes').then((m) => m.DOCUMENTS_ROUTES)
  },
  { path: '', redirectTo: 'documents', pathMatch: 'full' }
];
