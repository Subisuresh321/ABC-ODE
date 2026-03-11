import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../auth';

@Component({
  selector: 'app-editprofile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './editprofile.html',
  styleUrl: './editprofile.css'
})
export class EditprofileComponent implements OnInit {
  userId: string | null = null;
  heroName: string = '';
  age: number | null = null;
  schoolName: string = '';
  avatarPreview: string | null = null;
  avatarFile: File | null = null;
  
  isSaving: boolean = false;
  showSuccess: boolean = false;
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    this.route.params.subscribe(params => {
      this.userId = params['id'];
      if (this.userId) {
        this.loadUserProfile();
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  // Get the JWT token from the current session using the new getSession method
  private async getAuthToken(): Promise<string | null> {
    try {
      const { data: { session } } = await this.authService.getSession();
      return session?.access_token || null;
    } catch (error) {
      console.error("Error getting auth token:", error);
      return null;
    }
  }

  loadUserProfile() {
    this.http.get(`http://127.0.0.1:8000/profile/${this.userId}`).subscribe({
      next: (data: any) => {
        this.heroName = data.hero_name || '';
        this.age = data.age || null;
        this.schoolName = data.school_name || '';
        if (data.avatar_url) {
          this.avatarPreview = data.avatar_url;
        }
      },
      error: (err) => {
        console.error("Failed to load profile:", err);
        this.errorMessage = "Could not load profile data";
      }
    });
  }

  onAvatarSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        this.errorMessage = 'Please select an image file! 📸';
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        this.errorMessage = 'Image size should be less than 5MB! 📏';
        return;
      }

      this.avatarFile = file;
      
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.avatarPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  async saveProfile() {
    if (!this.userId) return;

    this.isSaving = true;
    this.errorMessage = '';
    this.showSuccess = false;

    try {
      // Get the auth token using the new getSession method
      const token = await this.getAuthToken();
      
      if (!token) {
        this.errorMessage = 'Not authenticated. Please log in again.';
        this.isSaving = false;
        return;
      }
      
      const formData = new FormData();
      formData.append('user_id', this.userId);
      formData.append('hero_name', this.heroName);
      formData.append('age', this.age?.toString() || '');
      formData.append('school_name', this.schoolName || '');
      
      if (this.avatarFile) {
        formData.append('avatar', this.avatarFile);
      }

      // Add authorization header with the token
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`
      });

      console.log('Saving profile with token:', token.substring(0, 20) + '...'); // Debug log

      this.http.post('http://127.0.0.1:8000/update-profile', formData, { headers })
        .subscribe({
          next: (response: any) => {
            console.log('Profile saved successfully:', response);
            this.isSaving = false;
            this.showSuccess = true;
            
            setTimeout(() => {
              this.showSuccess = false;
            }, 3000);

            window.dispatchEvent(new CustomEvent('profile-updated', { 
              detail: { userId: this.userId } 
            }));
          },
          error: (err) => {
            this.isSaving = false;
            console.error('Update error full:', err);
            this.errorMessage = err.error?.detail || 'Failed to update profile. Please try again!';
          }
        });
    } catch (error) {
      this.isSaving = false;
      console.error('Unexpected error:', error);
      this.errorMessage = 'An unexpected error occurred';
    }
  }

  goBack() {
    this.router.navigate(['/profile', this.userId]);
  }
}