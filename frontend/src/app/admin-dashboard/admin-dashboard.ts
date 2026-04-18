import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit {
  // --- Member Management State ---
  allUsers: any[] = [];
  filteredUsers: any[] = [];
  searchTerm: string = '';

  // --- Mission Creator State with Interactive Fields ---
  newMission = {
    title: '',
    story: '',
    category: '',
    difficulty: 'Easy',
    starter_code: 'def solve():\n    # Write your code here\n    pass',
    test_cases: [],
    xp_reward: 100,
    hints: []
  };

  // UI Helper Arrays
  testCasesList: any[] = [
    { input: '', expected: '' }
  ];
  
  hintsList: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.http.get('http://127.0.0.1:8000/admin/users').subscribe({
      next: (data: any) => {
        this.allUsers = data;
        this.filteredUsers = data;
      },
      error: (err) => console.error('Failed to load heroes', err)
    });
  }

  applyFilter() {
    this.filteredUsers = this.allUsers.filter(u => 
      u.hero_name?.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  // Test Cases Methods
  addTestCase() {
    this.testCasesList.push({ input: '', expected: '' });
  }

  removeTestCase(index: number) {
    this.testCasesList.splice(index, 1);
  }

  // Hints Methods
  addHint() {
    this.hintsList.push({ text: '' });
  }

  removeHint(index: number) {
    this.hintsList.splice(index, 1);
  }

  // Validation
  isMissionValid(): boolean {
    return this.newMission.title?.trim().length > 0 &&
           this.newMission.story?.trim().length > 0 &&
           this.newMission.category?.length > 0 &&
           this.testCasesList.some(test => test.input && test.expected);
  }

  saveMission() {
    if (!this.isMissionValid()) {
      alert('⚠️ Please fill in all required fields!');
      return;
    }

    // Filter out empty test cases
    const validTestCases = this.testCasesList.filter(t => t.input && t.expected);
    
    // Prepare mission data
    const missionData = {
      title: this.newMission.title,
      story: this.newMission.story,
      starter_code: this.newMission.starter_code,
      difficulty: this.newMission.difficulty,
      category: this.newMission.category,
      test_cases: validTestCases,
      xp_reward: this.newMission.xp_reward,
      hints: this.hintsList.filter(h => h.text).map(h => h.text)
    };

    console.log('Saving mission:', missionData);

    this.http.post('http://127.0.0.1:8000/mission', missionData).subscribe({
      next: () => {
        alert('✅ Mission successfully added to the Vault!');
        this.resetForm();
      },
      error: (err) => {
        console.error('Failed to save mission', err);
        alert('❌ Failed to save mission. Check console for details.');
      }
    });
  }

  resetForm() {
    this.newMission = {
      title: '',
      story: '',
      category: '',
      difficulty: 'Easy',
      starter_code: 'def solve():\n    # Write your code here\n    pass',
      test_cases: [],
      xp_reward: 100,
      hints: []
    };
    this.testCasesList = [{ input: '', expected: '' }];
    this.hintsList = [];
  }
}