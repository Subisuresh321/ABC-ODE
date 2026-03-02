import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from './auth';
import { UserService } from './user.service'; // Import the service

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
    private userService: UserService  // Inject the service
  ) {}

  async ngOnInit() {
    // Subscribe to user updates
    this.userService.user$.subscribe(user => {
      if (user) {
        this.heroName = user.heroName;
        this.xp = user.xp;
        this.currentUserId = user.userId;
        this.isLoggedIn = true;
      } else {
        this.isLoggedIn = false;
        this.heroName = 'Recruit';
        this.xp = 0;
        this.currentUserId = null;
      }
    });

    // Check session on load
    const { data: { user } } = await this.authService.getUser();
    if (user) {
      this.userService.loadUserProfile(user.id);
    }
  }

  async logout() {
    await this.authService.signOut();
    this.userService.clearUser();
    this.router.navigate(['/login']);
  }
}