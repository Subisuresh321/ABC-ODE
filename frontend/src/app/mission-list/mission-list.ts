import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth';
import { UserService } from '../user.service';

@Component({
  selector: 'app-mission-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
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
  isAdmin: boolean = false;
  
  // Enquiry properties
  enquiryData = {
    name: '',
    email: '',
    message: ''
  };
  isSubmitting: boolean = false;
  enquirySuccess: boolean = false;
  enquiryError: string = '';
  
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
    private userService: UserService
  ) {}

  async ngOnInit(): Promise<void> {
    this.setDailyTip();
    
    // Subscribe to user updates
    this.userService.user$.subscribe(user => {
      if (user) {
        this.heroName = user.heroName;
        this.xp = user.xp;
        this.currentUserId = user.userId;
        this.enquiryData.name = user.heroName;
      }
    });

    const { data: { user } } = await this.authService.getUser();
    if (user) {
      this.currentUserId = user.id;
      // Load profile through service
      this.userService.loadUserProfile(user.id);
      // Also load profile directly to check admin role
      this.loadUserProfile(user.id);
    }
    
    // Load missions and leaderboard
    this.loadMissions();
    this.loadLeaderboard();
  }
  
  loadUserProfile(userId: string): void {
    this.http.get(`http://127.0.0.1:8000/profile/${userId}`).subscribe({
      next: (profile: any) => {
        if (profile) {
          this.heroName = profile.hero_name || 'Hero';
          this.xp = profile.xp_points || 0;
          this.isAdmin = profile.role === 'admin';
        }
      },
      error: (err) => console.error("Profile failed to load", err)
    });
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

  // Submit Enquiry
  async submitEnquiry() {
    if (!this.enquiryData.name.trim()) {
      this.enquiryError = 'Please enter your name!';
      setTimeout(() => this.enquiryError = '', 3000);
      return;
    }
    
    if (!this.enquiryData.email.trim() || !this.enquiryData.email.includes('@')) {
      this.enquiryError = 'Please enter a valid email address!';
      setTimeout(() => this.enquiryError = '', 3000);
      return;
    }
    
    if (!this.enquiryData.message.trim()) {
      this.enquiryError = 'Please enter your message!';
      setTimeout(() => this.enquiryError = '', 3000);
      return;
    }
    
    this.isSubmitting = true;
    this.enquiryError = '';
    this.enquirySuccess = false;
    
    const payload = {
      user_id: this.currentUserId,
      name: this.enquiryData.name,
      email: this.enquiryData.email,
      message: this.enquiryData.message
    };
    
    console.log('Sending payload:', payload);
    
    this.http.post('http://127.0.0.1:8000/enquiries', payload).subscribe({
      next: (res: any) => {
        console.log('Success:', res);
        this.isSubmitting = false;
        this.enquirySuccess = true;
        this.enquiryData = { name: '', email: '', message: '' };
        if (this.heroName !== 'Commander') {
          this.enquiryData.name = this.heroName;
        }
        setTimeout(() => this.enquirySuccess = false, 5000);
      },
      error: (err) => {
        console.error('Error:', err);
        this.isSubmitting = false;
        this.enquiryError = err.error?.detail || 'Failed to send message. Please try again!';
        setTimeout(() => this.enquiryError = '', 5000);
      }
    });
  }
}