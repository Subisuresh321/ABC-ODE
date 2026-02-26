import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from './auth';

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

  constructor(private authService: AuthService, private router: Router) {}

  async ngOnInit() {
    // Check session on load
    const { data: { user } } = await this.authService.getUser();
    this.isLoggedIn = !!user;

    if (user) {
      // Fetch basic stats for the navbar
      // Note: In a final version, we'd use a shared service for this!
      fetch(`http://127.0.0.1:8000/profile/${user.id}`)
        .then(res => res.json())
        .then(data => {
          this.heroName = data.hero_name;
          this.xp = data.xp_points || 0;
        });
    }
  }

  async logout() {
    await this.authService.signOut();
    this.isLoggedIn = false;
    this.router.navigate(['/login']).then(() => {
      window.location.reload(); // Refresh to clear all app states
    });
  }
}