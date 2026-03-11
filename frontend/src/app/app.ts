import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from './auth';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements OnInit {
  isLoggedIn = false;
  heroName = 'Recruit';
  xp = 0;
  currentUserId: string | null = null;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private http: HttpClient,
    private ngZone: NgZone
  ) {}

  async ngOnInit() {
    // Check session on load
    const { data: { user } } = await this.authService.getUser();
    this.isLoggedIn = !!user;

    if (user) {
      this.currentUserId = user.id;
      this.loadUserProfile(user.id);
    }

    // Listen for profile updates
    window.addEventListener('profile-updated', ((event: CustomEvent) => {
      if (event.detail.userId === this.currentUserId) {
        this.loadUserProfile(this.currentUserId!);
      }
    }) as EventListener);
  }

  loadUserProfile(userId: string) {
    this.http.get(`http://127.0.0.1:8000/profile/${userId}`).subscribe({
      next: (data: any) => {
        this.ngZone.run(() => {
          this.heroName = data.hero_name || 'Recruit';
        });
      },
      error: (err) => console.error("Failed to load user profile:", err)
    });
  }

  async logout() {
    await this.authService.signOut();
    this.ngZone.run(() => {
      this.isLoggedIn = false;
      this.heroName = 'Recruit';
      this.xp = 0;
      this.currentUserId = null;
    });
    this.router.navigate(['/login']);
  }
}