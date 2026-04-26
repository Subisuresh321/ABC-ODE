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
  isAdmin: boolean = false;  // Add this property

  constructor(
    private authService: AuthService, 
    private router: Router,
    private http: HttpClient,
    private ngZone: NgZone
  ) {}

  async ngOnInit() {
    // Initial auth check
    await this.checkAuthState();

    // Listen for auth state changes (SIGNED_IN, SIGNED_OUT)
    this.authService.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      
      this.ngZone.run(async () => {
        if (event === 'SIGNED_IN' && session?.user) {
          // User just logged in
          this.isLoggedIn = true;
          this.currentUserId = session.user.id;
          await this.loadUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          // User logged out
          this.isLoggedIn = false;
          this.heroName = 'Recruit';
          this.xp = 0;
          this.currentUserId = null;
          this.isAdmin = false;
        }
      });
    });

    // Listen for custom profile update events
    window.addEventListener('profile-updated', ((event: CustomEvent) => {
      if (event.detail.userId === this.currentUserId) {
        this.loadUserProfile(this.currentUserId!);
      }
    }) as EventListener);
  }

  async checkAuthState() {
    const { data: { user } } = await this.authService.getUser();
    this.isLoggedIn = !!user;

    if (user) {
      this.currentUserId = user.id;
      await this.loadUserProfile(user.id);
    }
  }

  async loadUserProfile(userId: string) {
    return new Promise((resolve) => {
      this.http.get(`http://127.0.0.1:8000/profile/${userId}`).subscribe({
        next: (data: any) => {
          this.ngZone.run(() => {
            this.heroName = data.hero_name || 'Recruit';
            this.xp = data.xp_points || 0;
            this.isAdmin = data.role === 'admin'; // Check if user is admin
          });
          resolve(true);
        },
        error: (err) => {
          console.error("Failed to load user profile:", err);
          resolve(false);
        }
      });
    });
  }

  async logout() {
    await this.authService.signOut();
    // The onAuthStateChange listener will handle the UI update
    this.router.navigate(['/login']);
  }
}