import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PmoCard } from './pmo-card';

describe('PmoCard', () => {
  let component: PmoCard;
  let fixture: ComponentFixture<PmoCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PmoCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PmoCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
