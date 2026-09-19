import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Proyecto } from './proyecto';

describe('Proyecto', () => {
  let component: Proyecto;
  let fixture: ComponentFixture<Proyecto>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Proyecto]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Proyecto);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
