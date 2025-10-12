import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Roadmapper } from './roadmapper';

describe('Roadmapper', () => {
  let component: Roadmapper;
  let fixture: ComponentFixture<Roadmapper>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Roadmapper]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Roadmapper);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
