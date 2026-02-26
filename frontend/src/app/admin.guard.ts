import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth';
import { from, map, switchMap, of } from 'rxjs';

export const adminGuard = () => {
  const authService = inject(AuthService);
  const http = inject(HttpClient);
  const router = inject(Router);

  // We wrap the Promise from getUser() into an Observable using 'from'
  return from(authService.getUser()).pipe(
    switchMap(response => {
      const user = response.data?.user;
      if (!user) return of(false);
      
      // Check the role in the database
      return http.get(`http://127.0.0.1:8000/profile/${user.id}`).pipe(
        map((p: any) => p.role === 'admin')
      );
    }),
    map(isAdmin => {
      if (isAdmin) return true;
      router.navigate(['/']); // Kick unauthorized users to the lobby
      return false;
    })
  );
};