import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CodemirrorModule } from '@ctrl/ngx-codemirror';
import { AuthService } from '../auth';

import 'codemirror/mode/python/python';

@Component({
  selector: 'app-profile-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, CodemirrorModule],
  templateUrl: './profile-detail.html',
  styleUrl: './profile-detail.css'
})
export class ProfileDetailComponent implements OnInit {
  heroData: any = null;
  selectedSub: any = null;
  userRole: string = 'student';
  isLoading: boolean = true;

  readonlyOptions = {
    lineNumbers: true,
    theme: 'dracula',
    mode: 'python',
    readOnly: true,
    indentUnit: 4,
    lineWrapping: true,
    foldGutter: true,
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter']
  };

  // Emoji mapping for speed metaphors
  private metaphorEmojis: { [key: string]: string } = {
    'Cheetah': '🐆',
    'Human': '🏃',
    'Snail': '🐌',
    'Eagle': '🦅',
    'Turtle': '🐢',
    'Rocket': '🚀',
    'Flash': '⚡',
    'Tortoise': '🐢',
    'Hare': '🐇'
  };

  // Color mapping for difficulties
  private difficultyColors: { [key: string]: string } = {
    'Easy': '#2ECC71',
    'Medium': '#F39C12',
    'Hard': '#E74C3C',
    'easy': '#2ECC71',
    'medium': '#F39C12',
    'hard': '#E74C3C'
  };

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    try {
      // Get current user's role
      const { data: { user } } = await this.authService.getUser();
      if (user) {
        this.loadUserRole(user.id);
      }

      // Load profile data
      this.route.params.subscribe(params => {
        const userId = params['id'];
        if (userId && userId !== 'undefined') {
          this.loadProfile(userId);
        } else {
          this.router.navigate(['/']);
        }
      });
    } catch (error) {
      console.error("Auth error:", error);
      this.isLoading = false;
    }
  }

  loadUserRole(userId: string) {
    this.http.get(`http://127.0.0.1:8000/profile/${userId}`).subscribe({
      next: (profile: any) => {
        this.userRole = profile.role || 'student';
      },
      error: (err) => console.error("Role fetch failed:", err)
    });
  }

  loadProfile(userId: string) {
    this.http.get(`http://127.0.0.1:8000/user-profile/${userId}`).subscribe({
      next: (res: any) => {
        this.heroData = res;
        if (res.submissions?.length > 0) {
          // Sort submissions by date (newest first)
          this.heroData.submissions.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          this.selectedSub = this.heroData.submissions[0];
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error("Profile Fetch Failed:", err);
        this.isLoading = false;
        alert("🚨 Failed to load hero profile! Please try again.");
      }
    });
  }

  selectSubmission(submission: any) {
    this.selectedSub = submission;
  }

  // Method to get emoji for speed metaphor
  getMetaphorEmoji(metaphor: string): string {
    if (!metaphor) return '⚡';
    
    // Try exact match
    if (this.metaphorEmojis[metaphor]) {
      return this.metaphorEmojis[metaphor];
    }
    
    // Try case-insensitive match
    const lowerMetaphor = metaphor.toLowerCase();
    for (const [key, emoji] of Object.entries(this.metaphorEmojis)) {
      if (key.toLowerCase() === lowerMetaphor) {
        return emoji;
      }
    }
    
    // Default emojis based on speed rating
    if (metaphor.toLowerCase().includes('cheetah') || metaphor.toLowerCase().includes('eagle') || metaphor.toLowerCase().includes('rocket')) {
      return '🚀';
    } else if (metaphor.toLowerCase().includes('human')) {
      return '🏃';
    } else if (metaphor.toLowerCase().includes('snail') || metaphor.toLowerCase().includes('turtle')) {
      return '🐌';
    }
    
    return '⚡'; // Default
  }

  // Method to get color for difficulty
  getDifficultyColor(difficulty: string): string {
    if (!difficulty) return '#7F8C8D';
    
    // Try exact match
    if (this.difficultyColors[difficulty]) {
      return this.difficultyColors[difficulty];
    }
    
    // Try case-insensitive match
    const lowerDifficulty = difficulty.toLowerCase();
    for (const [key, color] of Object.entries(this.difficultyColors)) {
      if (key.toLowerCase() === lowerDifficulty) {
        return color;
      }
    }
    
    return '#7F8C8D'; // Default gray
  }

  // Format date nicely
  formatDate(dateString: string): string {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  goBack() {
    if (this.userRole === 'admin') {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/']);
    }
  }
}