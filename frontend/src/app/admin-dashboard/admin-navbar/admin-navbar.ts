import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-navbar.html',
  styleUrl: './admin-navbar.css'
})
export class AdminNavbarComponent {
  @Output() tabChange = new EventEmitter<string>();
  activeTab: string = 'users';

  constructor(private router: Router) {}

  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.tabChange.emit(tab);
  }

  goBackToHome() {
    this.router.navigate(['/']);
  }
}