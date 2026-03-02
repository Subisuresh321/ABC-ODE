import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private userSubject = new BehaviorSubject<any>(null);
  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {}

  loadUserProfile(userId: string) {
    this.http.get(`http://127.0.0.1:8000/profile/${userId}`).subscribe({
      next: (profile: any) => {
        this.userSubject.next({
          heroName: profile.hero_name || 'Recruit',
          xp: profile.xp_points || 0,
          userId: userId
        });
      },
      error: (err) => console.error("Failed to load user profile:", err)
    });
  }

  updateUserXP(newXP: number) {
    const currentUser = this.userSubject.value;
    if (currentUser) {
      this.userSubject.next({
        ...currentUser,
        xp: newXP
      });
    }
  }

  clearUser() {
    this.userSubject.next(null);
  }
}