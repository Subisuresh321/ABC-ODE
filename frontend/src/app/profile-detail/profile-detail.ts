import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { ActivatedRoute, Router } from '@angular/router'; 
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms'; 
import { CodemirrorModule } from '@ctrl/ngx-codemirror'; 
import { AuthService } from '../auth'; 

@Component({
  selector: 'app-profile-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, CodemirrorModule], 
  templateUrl: './profile-detail.html',
  styleUrl: './profile-detail.css'
})
export class ProfileDetailComponent implements OnInit {
  heroData: any = null;
  selectedSub: any = null;
  userRole: string = 'student'; // This was missing!

  readonlyOptions = {
    lineNumbers: true, theme: 'dracula', mode: 'python',
    readOnly: true, indentUnit: 4
  };

  constructor(
    private route: ActivatedRoute, 
    private http: HttpClient,
    private router: Router,      
    private authService: AuthService 
  ) {}

  async ngOnInit() {
    // Get viewer role
    const { data: { user } } = await this.authService.getUser();
    if (user) {
      this.http.get(`http://127.0.0.1:8000/profile/${user.id}`).subscribe((p: any) => {
        this.userRole = p.role;
      });
    }

    // Load profile
    this.route.params.subscribe(params => {
      const userId = params['id'];
      if (userId && userId !== 'undefined') {
        this.http.get(`http://127.0.0.1:8000/user-profile/${userId}`).subscribe({
          next: (res: any) => {
            this.heroData = res;
            if (res.submissions?.length > 0) {
              this.selectedSub = res.submissions[0];
            }
          },
          error: (err) => console.error("Profile Fetch Failed:", err)
        });
      }
    });
  }

  // This was missing!
  goBack() {
    if (this.userRole === 'admin') {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/']);
    }
  }
}