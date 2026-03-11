import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditprofileComponent } from './editprofile';

describe('Editprofile', () => {
  let component: EditprofileComponent;
  let fixture: ComponentFixture<EditprofileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditprofileComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditprofileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
