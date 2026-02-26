import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MissionListComponent } from './mission-list';

describe('MissionList', () => {
  let component: MissionListComponent;
  let fixture: ComponentFixture<MissionListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MissionListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MissionListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
