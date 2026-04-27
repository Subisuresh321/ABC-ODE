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
  allMissions: any[] = [];
  filteredMissions: any[] = [];
  missionSearchTerm: string = '';
  
  // Edit Mission
  showEditModal: boolean = false;
  editingMission: any = null;
  editTestCasesList: any[] = [];
  editHintsList: any[] = [];
  
  // Delete Mission
  showDeleteModal: boolean = false;
  missionToDelete: any = null;

  // Mission Creator State
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
    this.loadMissions();
  }

  onTabChange(tab: string) {
    this.activeTab = tab;
    if (tab === 'enquiries') {
      this.loadEnquiries();
    }
    if (tab === 'manage') {
      this.loadMissions();
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
    const target = event.target as HTMLElement;
    if (target.classList.contains('modal')) {
      this.closeReplyModal();
      this.closeEditModal();
      this.closeDeleteModal();
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

  // Missions Management Methods
  loadMissions() {
    this.http.get('http://127.0.0.1:8000/missions').subscribe({
      next: (data: any) => {
        this.allMissions = data;
        this.filteredMissions = data;
      },
      error: (err) => console.error('Failed to load missions', err)
    });
  }

  filterMissions() {
    if (!this.missionSearchTerm) {
      this.filteredMissions = this.allMissions;
    } else {
      const search = this.missionSearchTerm.toLowerCase();
      this.filteredMissions = this.allMissions.filter(m => 
        m.title?.toLowerCase().includes(search) ||
        m.category?.toLowerCase().includes(search) ||
        m.difficulty?.toLowerCase().includes(search)
      );
    }
  }

  openEditMissionModal(mission: any) {
    this.http.get(`http://127.0.0.1:8000/mission/${mission.id}`).subscribe({
      next: (fullMission: any) => {
        this.editingMission = { ...fullMission };
        if (typeof this.editingMission.test_cases === 'string') {
          this.editingMission.test_cases = JSON.parse(this.editingMission.test_cases);
        }
        this.editTestCasesList = this.editingMission.test_cases?.map((tc: any) => ({ ...tc })) || [{ input: '', expected: '' }];
        this.editHintsList = this.editingMission.hints?.map((h: string) => ({ text: h })) || [];
        this.showEditModal = true;
      },
      error: (err) => {
        console.error('Failed to load mission details', err);
        alert('Failed to load mission details');
      }
    });
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editingMission = null;
    this.editTestCasesList = [];
    this.editHintsList = [];
  }

  addEditTestCase() {
    this.editTestCasesList.push({ input: '', expected: '' });
  }

  removeEditTestCase(index: number) {
    this.editTestCasesList.splice(index, 1);
  }

  addEditHint() {
    this.editHintsList.push({ text: '' });
  }

  removeEditHint(index: number) {
    this.editHintsList.splice(index, 1);
  }

  isEditValid(): boolean {
    return this.editingMission?.title?.trim() &&
           this.editingMission?.story?.trim() &&
           this.editingMission?.category &&
           this.editTestCasesList.some(t => t.input && t.expected);
  }

  updateMission() {
    if (!this.isEditValid()) return;

    const validTestCases = this.editTestCasesList.filter(t => t.input && t.expected);
    const hints = this.editHintsList.filter(h => h.text).map(h => h.text);

    const missionData = {
      title: this.editingMission.title,
      story: this.editingMission.story,
      starter_code: this.editingMission.starter_code,
      difficulty: this.editingMission.difficulty,
      category: this.editingMission.category,
      test_cases: validTestCases,
      xp_reward: this.editingMission.xp_reward,
      hints: hints
    };

    this.http.put(`http://127.0.0.1:8000/mission/${this.editingMission.id}`, missionData).subscribe({
      next: () => {
        alert('✅ Mission updated successfully!');
        this.closeEditModal();
        this.loadMissions();
      },
      error: (err) => {
        console.error('Failed to update mission', err);
        alert('❌ Failed to update mission');
      }
    });
  }

  confirmDeleteMission(mission: any) {
    this.missionToDelete = mission;
    this.showDeleteModal = true;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.missionToDelete = null;
  }

  deleteMission() {
    if (!this.missionToDelete) return;

    this.http.delete(`http://127.0.0.1:8000/mission/${this.missionToDelete.id}`).subscribe({
      next: () => {
        alert('✅ Mission deleted successfully!');
        this.closeDeleteModal();
        this.loadMissions();
      },
      error: (err) => {
        console.error('Failed to delete mission', err);
        alert('❌ Failed to delete mission. It may have submissions. Delete submissions first.');
      }
    });
  }

  // Mission Creator Methods
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
    const hints = this.hintsList.filter(h => h.text).map(h => h.text);
    
    const missionData = {
      title: this.newMission.title,
      story: this.newMission.story,
      starter_code: this.newMission.starter_code,
      difficulty: this.newMission.difficulty,
      category: this.newMission.category,
      test_cases: validTestCases,
      xp_reward: this.newMission.xp_reward,
      hints: hints
    };

    this.http.post('http://127.0.0.1:8000/mission', missionData).subscribe({
      next: () => {
        alert('✅ Mission successfully added to the Vault!');
        this.resetForm();
        this.loadMissions();
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