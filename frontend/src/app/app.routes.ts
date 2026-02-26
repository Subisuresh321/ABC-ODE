import { Routes } from '@angular/router';
import { MissionListComponent } from './mission-list/mission-list';
import { MissionControlComponent } from './mission-control/mission-control';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard';
import { AuthComponent } from './auth/auth';
import { ProfileDetailComponent } from './profile-detail/profile-detail';
import { adminGuard } from './admin.guard';

export const routes: Routes = [
  { path: '', component: MissionListComponent },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [adminGuard] },
  { path: '', component: MissionListComponent },
  { path: 'mission/:id', component: MissionControlComponent },
  { path: 'admin', component: AdminDashboardComponent },
  { path: 'login', component: AuthComponent },
  { path: '', component: MissionListComponent },
  { path: 'profile/:id', component: ProfileDetailComponent }
];