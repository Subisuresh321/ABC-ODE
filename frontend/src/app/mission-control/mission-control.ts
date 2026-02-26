import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CodemirrorModule } from '@ctrl/ngx-codemirror';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../auth'; // Import your Auth Service

import 'codemirror/mode/python/python';

@Component({
  selector: 'app-mission-control',
  standalone: true,
  imports: [CommonModule, FormsModule, CodemirrorModule, RouterModule],
  templateUrl: './mission-control.html',
  styleUrl: './mission-control.css'
})
export class MissionControlComponent implements OnInit {
  mission: any;
  runResult: any;
  currentUserId: string | null = null; 
  submissionHistory: any[] = [];

  codeMirrorOptions = {
    lineNumbers: true,
    theme: 'monokai',
    mode: 'python',
    indentUnit: 4
  };

  constructor(
    private http: HttpClient, 
    private route: ActivatedRoute,
    private authService: AuthService 
  ) {}

  async ngOnInit() {
    // 1. Get the real logged-in User ID
    const { data: { user } } = await this.authService.getUser();
    if (user) {
      this.currentUserId = user.id;
    }

    // 2. Load the mission
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.http.get(`http://127.0.0.1:8000/mission/${id}`).subscribe({
        next: (data: any) => {
          this.mission = data;
          if (this.mission.starter_code) {
            this.mission.starter_code = this.mission.starter_code.replace(/\\n/g, '\n');
          }
          this.loadHistory();
        }
      });
    }
  }

  runCode() {
    if (!this.currentUserId) {
      alert("Please login to run missions!");
      return;
    }

    const payload = {
      code: this.mission.starter_code,
      test_cases: this.mission.test_cases,
      user_id: this.currentUserId, // Send ID to backend for history logging
      problem_id: this.mission.id
    };

    this.http.post('http://127.0.0.1:8000/run', payload).subscribe({
      next: (res: any) => {
        this.runResult = res;
        if (res.status === 'Success') {
          this.handleMissionSuccess();
        }
      }
    });
  }

  handleMissionSuccess() {
    if (!this.currentUserId) return;

    const xpPayload = {
      user_id: this.currentUserId, // No more hardcoded ID!
      xp_to_add: this.mission.xp_reward
    };

    this.http.post('http://127.0.0.1:8000/add-xp', xpPayload).subscribe({
      next: (res: any) => {
        alert(`MISSION ACCOMPLISHED! 🌟 You earned ${this.mission.xp_reward} XP!`);
      }
    });
  }

  loadHistory() {
  if (!this.currentUserId || !this.mission?.id) return;
  
  this.http.get(`http://127.0.0.1:8000/history/${this.currentUserId}/${this.mission.id}`)
    .subscribe({
      next: (data: any) => this.submissionHistory = data,
      error: (err) => console.error("History fetch failed", err)
    });
}
}