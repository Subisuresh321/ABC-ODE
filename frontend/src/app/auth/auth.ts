import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth'; 
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http'; // 1. Import HttpClient

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.html',
  styleUrl: './auth.css'
})
export class AuthComponent {
  isLogin = true;
  email = '';
  password = '';

  // 2. Inject HttpClient in the constructor
  constructor(
    private authService: AuthService, 
    private router: Router,
    private http: HttpClient 
  ) {}

  async handleAuth() {
    if (this.isLogin) {
      const { data, error } = await this.authService.signIn(this.email, this.password);
      
      if (error) {
        alert(error.message);
      } else if (data?.user) {
        // Fetch the profile from our FastAPI backend to check the role
        this.http.get(`http://127.0.0.1:8000/profile/${data.user.id}`).subscribe({
          next: (profile: any) => {
            // Check the role column from Supabase
            if (profile.role === 'admin') {
              this.router.navigate(['/admin']).then(() => window.location.reload());
            } else {
              this.router.navigate(['/']).then(() => window.location.reload());
            }
          },
          error: () => this.router.navigate(['/']).then(() => window.location.reload())
        });
      }
    } else {
      // 3. Removed the stray "/" that was causing the regex error
      const { data, error } = await this.authService.signUp(this.email, this.password);
      if (error) {
        alert(error.message);
      } else {
        alert('Check your email for the confirmation link!');
      }
    }
  }
}