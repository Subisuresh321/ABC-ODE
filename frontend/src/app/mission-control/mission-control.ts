import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CodemirrorModule } from '@ctrl/ngx-codemirror';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth';

import 'codemirror/mode/python/python';

@Component({
  selector: 'app-mission-control',
  standalone: true,
  imports: [CommonModule, FormsModule, CodemirrorModule],
  templateUrl: './mission-control.html',
  styleUrl: './mission-control.css'
})
export class MissionControlComponent implements OnInit {
  mission: any;
  runResult: any;
  currentUserId: string | null = null;
  submissionHistory: any[] = [];
  isRunning: boolean = false;
  showSuccessMessage: boolean = false;

  codeMirrorOptions = {
    lineNumbers: true,
    theme: 'monokai',
    mode: 'python',
    indentUnit: 4,
    lineWrapping: true,
    foldGutter: true,
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter']
  };

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.authService.getUser();
    if (user) {
      this.currentUserId = user.id;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadMission(id);
    }
  }

  loadMission(id: string) {
    this.http.get(`http://127.0.0.1:8000/mission/${id}`).subscribe({
      next: (data: any) => {
        this.mission = data;
        if (this.mission.starter_code) {
          this.mission.starter_code = this.mission.starter_code.replace(/\\n/g, '\n');
        }
        this.loadHistory();
      },
      error: (err) => {
        console.error("Failed to load mission:", err);
        alert("🚨 Failed to load mission! Please try again.");
      }
    });
  }

  runCode() {
    if (!this.currentUserId) {
      alert("Please login to run missions!");
      this.router.navigate(['/login']);
      return;
    }

    this.isRunning = true;
    
    const payload = {
      code: this.mission.starter_code,
      test_cases: this.mission.test_cases,
      user_id: this.currentUserId,
      problem_id: this.mission.id
    };

    this.http.post('http://127.0.0.1:8000/run', payload).subscribe({
      next: (res: any) => {
        this.runResult = res;
        this.isRunning = false;
        
        if (res.status === 'Success') {
          this.handleMissionSuccess();
        }
        
        // Refresh history
        this.loadHistory();
      },
      error: (err) => {
        console.error("Run failed:", err);
        this.isRunning = false;
        alert("🚨 Launch failed! Space communication error.");
      }
    });
  }

  handleMissionSuccess() {
    if (!this.currentUserId || !this.mission) return;

    const xpPayload = {
      user_id: this.currentUserId,
      xp_to_add: this.mission.xp_reward
    };

    this.http.post('http://127.0.0.1:8000/add-xp', xpPayload).subscribe({
      next: (res: any) => {
        this.showSuccessMessage = true;
        setTimeout(() => this.showSuccessMessage = false, 3000);
        
        // Dispatch event to update navbar
        window.dispatchEvent(new CustomEvent('xp-updated', { 
          detail: { userId: this.currentUserId } 
        }));
      },
      error: (err) => console.error("XP update failed:", err)
    });
  }

  loadHistory() {
    if (!this.currentUserId || !this.mission?.id) return;
    
    this.http.get(`http://127.0.0.1:8000/history/${this.currentUserId}/${this.mission.id}`)
      .subscribe({
        next: (data: any) => {
          this.submissionHistory = data;
          console.log("History loaded:", data);
        },
        error: (err) => console.error("History fetch failed", err)
      });
  }

  getMetaphorEmoji(metaphor: string): string {
    if (!metaphor) return '⚡';
    
    const emojis: { [key: string]: string } = {
      'Cheetah': '🐆',
      'Human': '🏃',
      'Snail': '🐌',
      'Eagle': '🦅',
      'Turtle': '🐢',
      'Rocket': '🚀',
      'Flash': '⚡'
    };
    
    // Case-insensitive lookup
    const lowerMetaphor = metaphor.toLowerCase();
    for (const [key, emoji] of Object.entries(emojis)) {
      if (key.toLowerCase() === lowerMetaphor) {
        return emoji;
      }
    }
    
    return '⚡';
  }

  goBack() {
    this.router.navigate(['/']);
  }
}