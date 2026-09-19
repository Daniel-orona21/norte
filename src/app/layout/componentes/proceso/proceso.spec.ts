import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Proceso } from './proceso';

describe('Proceso', () => {
  let component: Proceso;
  let fixture: ComponentFixture<Proceso>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Proceso]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Proceso);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
