import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

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
  username = '';  // New field
  age: number | null = null;  // New field
  schoolName = '';  // New field
  password = '';
  confirmPassword = '';
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  
  // Validation flags
  showPassword = false;
  showConfirmPassword = false;
  
  // Password validation flags
  hasMinLength = false;
  hasUpperCase = false;
  hasLowerCase = false;
  hasNumber = false;
  hasSpecialChar = false;
  isEmailValid = true;
  isUsernameValid = true;  // New validation flag
  isAgeValid = true;  // New validation flag
  doPasswordsMatch = true;

  private motivationalMessages = [
    "💫 Every great coder started with a single line!",
    "🚀 Ready to launch your coding journey?",
    "⭐ Heroes aren't born, they're coded!",
    "🛸 The galaxy needs your coding skills!",
    "🎮 Level up your life with code!",
    "💡 Today's first step, tomorrow's superpower!"
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient
  ) {}

  toggleMode() {
    this.isLogin = !this.isLogin;
    this.resetForm();
  }

  resetForm() {
    this.errorMessage = '';
    this.successMessage = '';
    this.email = '';
    this.username = '';
    this.age = null;
    this.schoolName = '';
    this.password = '';
    this.confirmPassword = '';
    this.resetPasswordValidation();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  getMotivationalMessage(): string {
    const randomIndex = Math.floor(Math.random() * this.motivationalMessages.length);
    return this.motivationalMessages[randomIndex];
  }

  // Password strength calculation
  get passwordStrength(): { percentage: number; color: string; label: string } {
    if (!this.password) {
      return { percentage: 0, color: '#95A5A6', label: 'No password' };
    }

    let strength = 0;
    if (this.hasMinLength) strength += 20;
    if (this.hasUpperCase) strength += 20;
    if (this.hasLowerCase) strength += 20;
    if (this.hasNumber) strength += 20;
    if (this.hasSpecialChar) strength += 20;

    if (strength <= 20) {
      return { percentage: strength, color: '#E74C3C', label: 'Very Weak' };
    } else if (strength <= 40) {
      return { percentage: strength, color: '#E67E22', label: 'Weak' };
    } else if (strength <= 60) {
      return { percentage: strength, color: '#F39C12', label: 'Fair' };
    } else if (strength <= 80) {
      return { percentage: strength, color: '#2ECC71', label: 'Good' };
    } else {
      return { percentage: strength, color: '#27AE60', label: 'Excellent!' };
    }
  }

  // Validation methods
  validateEmail() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.isEmailValid = emailRegex.test(this.email);
  }

  validateUsername() {
    this.isUsernameValid = this.username.length >= 3;
  }

  validateAge() {
    if (this.age) {
      this.isAgeValid = this.age >= 5 && this.age <= 120;
    } else {
      this.isAgeValid = true; // Age is optional
    }
  }

  validatePassword() {
    this.hasMinLength = this.password.length >= 8;
    this.hasUpperCase = /[A-Z]/.test(this.password);
    this.hasLowerCase = /[a-z]/.test(this.password);
    this.hasNumber = /\d/.test(this.password);
    this.hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(this.password);
    
    if (!this.isLogin) {
      this.validateConfirmPassword();
    }
  }

  validateConfirmPassword() {
    this.doPasswordsMatch = this.password === this.confirmPassword;
  }

  resetPasswordValidation() {
    this.hasMinLength = false;
    this.hasUpperCase = false;
    this.hasLowerCase = false;
    this.hasNumber = false;
    this.hasSpecialChar = false;
    this.doPasswordsMatch = true;
    this.isEmailValid = true;
    this.isUsernameValid = true;
    this.isAgeValid = true;
  }

  isFormValid(): boolean {
    if (!this.email || !this.password) {
      return false;
    }

    if (!this.isEmailValid) {
      return false;
    }

    if (this.isLogin) {
      return true; // Login only needs email and password
    }

    // Registration validation
    if (!this.username || !this.isUsernameValid) {
      return false;
    }

    if (!this.isAgeValid) {
      return false;
    }

    // Password rules
    return this.hasMinLength && 
           this.hasUpperCase && 
           this.hasLowerCase && 
           this.hasNumber && 
           this.hasSpecialChar && 
           this.doPasswordsMatch &&
           this.confirmPassword.length > 0;
  }

  validateForm(): boolean {
    this.validateEmail();
    
    if (!this.email) {
      this.errorMessage = 'Please enter your email! 📧';
      return false;
    }
    
    if (!this.isEmailValid) {
      this.errorMessage = 'Please enter a valid email address! 📧';
      return false;
    }
    
    if (!this.password) {
      this.errorMessage = 'Please enter your password! 🔐';
      return false;
    }

    if (!this.isLogin) {
      // Validate username
      this.validateUsername();
      if (!this.username) {
        this.errorMessage = 'Please choose a hero name! 🦸';
        return false;
      }
      if (!this.isUsernameValid) {
        this.errorMessage = 'Hero name must be at least 3 characters! 📏';
        return false;
      }

      // Validate age if provided
      this.validateAge();
      if (this.age && !this.isAgeValid) {
        this.errorMessage = 'Age must be between 5 and 120! 🎂';
        return false;
      }

      // Validate password
      this.validatePassword();
      if (!this.hasMinLength || !this.hasUpperCase || !this.hasLowerCase || !this.hasNumber || !this.hasSpecialChar) {
        this.errorMessage = 'Please follow all password rules! ⚡';
        return false;
      }
      
      if (!this.confirmPassword) {
        this.errorMessage = 'Please confirm your password! 🔒';
        return false;
      }
      
      this.validateConfirmPassword();
      if (!this.doPasswordsMatch) {
        this.errorMessage = 'Passwords do not match! 🔒';
        return false;
      }
    }
    
    return true;
  }

  async handleAuth() {
    this.errorMessage = '';
    this.successMessage = '';
    
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;

    if (this.isLogin) {
      await this.handleLogin();
    } else {
      await this.handleSignUp();
    }

    this.isLoading = false;
  }

  async handleLogin() {
    try {
      const { data, error } = await this.authService.signIn(this.email, this.password);
      
      if (error) {
        if (error.message.includes('Email not confirmed')) {
          this.errorMessage = 'Please confirm your email first! 📧 Check your inbox.';
        } else if (error.message.includes('Invalid login credentials')) {
          this.errorMessage = 'Oops! Wrong email or password. Try again! 🔑';
        } else {
          this.errorMessage = error.message || 'Login failed. Please try again!';
        }
        return;
      }
      
      if (data?.user) {
        // Fetch profile to check role
        this.http.get(`http://127.0.0.1:8000/profile/${data.user.id}`).subscribe({
          next: (profile: any) => {
            window.dispatchEvent(new CustomEvent('user-logged-in', { 
              detail: { userId: data.user.id } 
            }));
            
            if (profile.role === 'admin') {
              this.router.navigate(['/admin']);
            } else {
              this.router.navigate(['/']);
            }
          },
          error: () => {
            window.dispatchEvent(new CustomEvent('user-logged-in', { 
              detail: { userId: data.user.id } 
            }));
            this.router.navigate(['/']);
          }
        });
      }
    } catch (error: any) {
      this.errorMessage = '🚨 Connection error. Please try again!';
      console.error('Login error:', error);
    }
  }

  async handleSignUp() {
    try {
      // First, sign up the user
      const { data, error } = await this.authService.signUp(this.email, this.password);
      
      if (error) {
        if (error.message.includes('User already registered')) {
          this.errorMessage = 'A hero with this email already exists! Try logging in. 🦸';
        } else {
          this.errorMessage = error.message || 'Registration failed. Please try again!';
        }
        return;
      }
      
      if (data?.user) {
        // Create profile with username, age, school

        await new Promise(resolve => setTimeout(resolve, 1000));
        const profileData = {
          user_id: data.user.id,
          hero_name: this.username,
          age: this.age,
          school_name: this.schoolName
        };

        this.http.post('http://127.0.0.1:8000/create-profile', profileData).subscribe({
          next: () => {
            this.successMessage = '✨ Welcome to the academy! Please check your email to confirm your account.';
            this.isLogin = true;
            this.resetForm();
          },
          error: (err) => {
            console.error('Profile creation error:', err);
            this.errorMessage = 'Account created but profile setup failed. Please contact support.';
          }
        });
      }
      
    } catch (error: any) {
      this.errorMessage = '🚨 Connection error. Please try again!';
      console.error('Signup error:', error);
    }
  }
}