import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { AdminNavbarComponent } from './admin-navbar/admin-navbar';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminNavbarComponent],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit {
  activeTab: string = 'users';
  
  // Users State
  allUsers: any[] = [];
  filteredUsers: any[] = [];
  searchTerm: string = '';

  // Enquiries State
  allEnquiries: any[] = [];
  filteredEnquiries: any[] = [];
  enquiryFilter: string = 'all';
  selectedEnquiry: any = null;
  showReplyModal: boolean = false;
  replyMessage: string = '';

  // Missions State
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

  testCasesList: any[] = [{ input: '', expected: '' }];
  hintsList: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadUsers();
    this.loadEnquiries();
  }

  onTabChange(tab: string) {
    this.activeTab = tab;
    if (tab === 'enquiries') {
      this.loadEnquiries();
    }
  }

  // Users Methods
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

  // Enquiries Methods
  loadEnquiries() {
    this.http.get('http://127.0.0.1:8000/admin/enquiries').subscribe({
      next: (data: any) => {
        this.allEnquiries = data;
        this.filterEnquiries();
      },
      error: (err) => console.error('Failed to load enquiries', err)
    });
  }

  filterEnquiries() {
    if (this.enquiryFilter === 'all') {
      this.filteredEnquiries = this.allEnquiries;
    } else {
      this.filteredEnquiries = this.allEnquiries.filter(e => e.status === this.enquiryFilter);
    }
  }

  selectEnquiry(enquiry: any) {
    this.selectedEnquiry = enquiry;
    this.replyMessage = enquiry.reply_message || '';
    
    if (enquiry.status === 'pending') {
      this.updateEnquiryStatus(enquiry.id, 'read');
    }
    
    this.showReplyModal = true;
  }

  updateEnquiryStatus(enquiryId: string, status: string) {
    const payload = { status: status };
    this.http.put(`http://127.0.0.1:8000/admin/enquiries/${enquiryId}/status`, payload).subscribe({
      next: () => {
        const enquiry = this.allEnquiries.find(e => e.id === enquiryId);
        if (enquiry) {
          enquiry.status = status;
          this.filterEnquiries();
        }
      },
      error: (err) => console.error('Failed to update status', err)
    });
  }

  sendReply() {
    if (!this.replyMessage.trim() || !this.selectedEnquiry) return;

    const payload = {
      reply_message: this.replyMessage,
      status: 'replied'
    };

    this.http.put(`http://127.0.0.1:8000/admin/enquiries/${this.selectedEnquiry.id}/reply`, payload).subscribe({
      next: () => {
        const enquiry = this.allEnquiries.find(e => e.id === this.selectedEnquiry.id);
        if (enquiry) {
          enquiry.reply_message = this.replyMessage;
          enquiry.status = 'replied';
          enquiry.replied_at = new Date().toISOString();
        }
        this.filterEnquiries();
        this.closeReplyModal();
        alert('✅ Reply sent successfully!');
      },
      error: (err) => {
        console.error('Failed to send reply', err);
        alert('❌ Failed to send reply. Please try again.');
      }
    });
  }

  closeReplyModal() {
    this.showReplyModal = false;
    this.selectedEnquiry = null;
    this.replyMessage = '';
  }

  closeModalOnBackdrop(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.closeReplyModal();
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return '⏳';
      case 'read': return '📖';
      case 'replied': return '✅';
      case 'closed': return '🔒';
      default: return '📬';
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  // Mission Methods
  addTestCase() {
    this.testCasesList.push({ input: '', expected: '' });
  }

  removeTestCase(index: number) {
    this.testCasesList.splice(index, 1);
  }

  addHint() {
    this.hintsList.push({ text: '' });
  }

  removeHint(index: number) {
    this.hintsList.splice(index, 1);
  }

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

    const validTestCases = this.testCasesList.filter(t => t.input && t.expected);
    
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