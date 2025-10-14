import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PmoDetail } from './pmo-detail';

describe('PmoDetail', () => {
  let component: PmoDetail;
  let fixture: ComponentFixture<PmoDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PmoDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PmoDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
