import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeatureMatrix } from './feature-matrix';

describe('FeatureMatrix', () => {
  let component: FeatureMatrix;
  let fixture: ComponentFixture<FeatureMatrix>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureMatrix]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeatureMatrix);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
