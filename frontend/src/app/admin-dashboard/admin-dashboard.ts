import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router'; // For [routerLink]

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

  // --- Mission Creator State (Preserving your code) ---
  newMission = {
    title: '', story: '', category: 'Logic', difficulty: 'Beginner',
    starter_code: 'def solve():\n    # Write code here\n    pass',
    test_cases: '[{"input": "1, 2", "expected": "3"}]',
    xp_reward: 50
  };

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
      u.hero_name.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  saveMission() {
    const payload = { ...this.newMission, test_cases: JSON.parse(this.newMission.test_cases) };
    this.http.post('http://127.0.0.1:8000/mission', payload).subscribe({
      next: () => alert('Mission successfully added to the Vault!'),
      error: (err) => console.error('Failed to save mission', err)
    });
  }
}