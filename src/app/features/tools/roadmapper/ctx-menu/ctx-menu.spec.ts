import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CtxMenu } from './ctx-menu';

describe('CtxMenu', () => {
  let component: CtxMenu;
  let fixture: ComponentFixture<CtxMenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CtxMenu]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CtxMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
