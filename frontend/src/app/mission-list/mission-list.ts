import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { AuthService } from '../auth';
import { UserService } from '../user.service'; // Import the service

@Component({
  selector: 'app-mission-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mission-list.html',
  styleUrl: './mission-list.css'
})
export class MissionListComponent implements OnInit {
  missions: any[] = [];
  leaderboard: any[] = [];
  heroName: string = 'Commander';
  xp: number = 0;
  currentUserId: string | null = null;
  dailyTip: string = "";
  isLoading: boolean = true;
  
  private tips: string[] = [
    "⚡ Use print() to see what your code is doing!",
    "🛸 Shorter code runs faster - like a rocket!",
    "🐍 Python loves when you use good variable names!",
    "💎 Always test your code - be a code detective!",
    "🧩 Break big problems into tiny pieces!"
  ];
  
  private emojis: string[] = ['🚀', '👾', '🤖', '🎮', '💻', '🛸', '🌟', '⭐', '🐍', '⚡'];

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private userService: UserService // Inject the service
  ) {}

  async ngOnInit(): Promise<void> {
    this.setDailyTip();
    
    // Subscribe to user updates
    this.userService.user$.subscribe(user => {
      if (user) {
        this.heroName = user.heroName;
        this.xp = user.xp;
        this.currentUserId = user.userId;
      }
    });

    const { data: { user } } = await this.authService.getUser();
    if (user) {
      this.currentUserId = user.id;
      // Load profile through service
      this.userService.loadUserProfile(user.id);
    }
    
    // Load missions and leaderboard
    this.loadMissions();
    this.loadLeaderboard();
  }
  
  getLevel(xp: number): number {
    return Math.floor(xp / 100) + 1;
  }
  
  getRandomEmoji(): string {
    return this.emojis[Math.floor(Math.random() * this.emojis.length)];
  }
  
  private setDailyTip(): void {
    const today = new Date().toDateString();
    const tipIndex = Math.abs(this.hashCode(today)) % this.tips.length;
    this.dailyTip = this.tips[tipIndex];
  }
  
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
  
  private loadMissions(): void {
    this.http.get('http://127.0.0.1:8000/missions').subscribe({
      next: (data: any) => {
        this.missions = data || [];
        this.checkLoadingComplete();
      },
      error: (err) => {
        console.error("Missions failed to load", err);
        this.missions = [];
        this.checkLoadingComplete();
      }
    });
  }
  
  private loadLeaderboard(): void {
    this.http.get('http://127.0.0.1:8000/leaderboard').subscribe({
      next: (data: any) => {
        this.leaderboard = data || [];
        this.checkLoadingComplete();
      },
      error: (err) => {
        console.error("Leaderboard failed to load", err);
        this.leaderboard = [];
        this.checkLoadingComplete();
      }
    });
  }
  
  private checkLoadingComplete(): void {
    if (this.missions.length > 0 || this.leaderboard.length > 0) {
      this.isLoading = false;
    } else {
      setTimeout(() => this.isLoading = false, 3000);
    }
  }
}