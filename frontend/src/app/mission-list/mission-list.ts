import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { AuthService } from '../auth';

@Component({
  selector: 'app-mission-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mission-list.html', // Matches your tree
  styleUrl: './mission-list.css'    // Matches your tree
})
export class MissionListComponent implements OnInit {
  missions: any[] = [];
  leaderboard: any[] = [];
  heroName: string = 'Commander';
  currentUserId: string | null = null;

  dailyTip: string = "";
  private tips: string[] = [
    "⚡ SYSTEM: Use print() to debug your logic gates.",
    "🛸 PROPULSION: Faster code uses fewer loops.",
    "🐍 CORE: Python was named after a comedy group, not a snake.",
    "💎 PROTOCOL: Meaningful variable names prevent system crashes.",
    "🧩 NEURAL: Break big problems into small functions."
  ];

 constructor(
    private http: HttpClient,
    private authService: AuthService // Ensure AuthService is injected
  ) {}

  async ngOnInit(): Promise<void> {
    
    const { data: { user } } = await this.authService.getUser();
    if (user) {
      this.currentUserId = user.id;
      
      this.http.get(`http://127.0.0.1:8000/profile/${this.currentUserId}`).subscribe({
        next: (profile: any) => {
          if (profile && profile.hero_name) {
            this.heroName = profile.hero_name || 'Hero';
          }
        }
      });
    }
    //Mission Loader
    this.http.get('http://127.0.0.1:8000/missions').subscribe({
      next: (data: any) => this.missions = data,
      error: (err) => console.error("Lobby failed to load", err)
    });
    //LeaderBoard
    this.http.get('http://127.0.0.1:8000/leaderboard').subscribe({
      next: (data: any) => this.leaderboard = data,
      error: (err) => console.error("Leaderboard failed to load", err)
    });
  }
}