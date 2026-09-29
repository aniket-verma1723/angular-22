import { NgZone } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { appConfig } from './app.config';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: appConfig.providers,
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('uses zoneless application scheduling even when Zone.js is loaded for legacy test clocks', () => {
    expect(TestBed.inject(NgZone).run(() => NgZone.isInAngularZone())).toBeFalse();
  });

  it('renders the learning shell and navigation landmark', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('app-shell')).not.toBeNull();
    expect(element.querySelector('nav[aria-label="Learning modules"]')).not.toBeNull();
  });

  it('provides a skip link and one main landmark', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('main').length).toBe(1);
    expect(element.querySelector('a[href="#main-content"]')?.textContent).toContain('Skip to content');
  });
});
