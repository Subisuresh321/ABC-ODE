import { Routes } from '@angular/router';
import { MissionListComponent } from './mission-list/mission-list';
import { MissionControlComponent } from './mission-control/mission-control';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard';
import { AuthComponent } from './auth/auth';
import { ProfileDetailComponent } from './profile-detail/profile-detail';
import { EditprofileComponent } from './editprofile/editprofile';
import { adminGuard } from './admin.guard';

export const routes: Routes = [
  { path: '', component: MissionListComponent },
  { path: 'mission/:id', component: MissionControlComponent },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [adminGuard] },
  { path: 'login', component: AuthComponent },
  { path: 'profile/:id', component: ProfileDetailComponent },
  { path: 'edit-profile/:id', component: EditprofileComponent }, 
  { path: '**', redirectTo: '' }
];