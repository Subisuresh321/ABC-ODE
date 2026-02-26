import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MissionControlComponent } from './mission-control';

describe('MissionControl', () => {
  let component: MissionControlComponent;
  let fixture: ComponentFixture<MissionControlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MissionControlComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MissionControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
