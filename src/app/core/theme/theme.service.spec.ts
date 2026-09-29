import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('defaults to system preferences', () => {
    const theme = TestBed.inject(ThemeService);
    TestBed.tick();
    expect(theme.preference()).toBe('system');
    expect(TestBed.inject(DOCUMENT).documentElement.getAttribute('data-theme')).toBe('system');
  });

  for (const preference of ['light', 'dark', 'system']) {
    it(`applies ${preference} to the document root, including overlay ancestors`, () => {
      const theme = TestBed.inject(ThemeService);
      theme.setPreference(preference);
      TestBed.tick();
      expect(theme.preference()).toBe(preference);
      expect(TestBed.inject(DOCUMENT).documentElement.getAttribute('data-theme')).toBe(preference);
    });
  }

  it('ignores unknown preference values', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setPreference('dark');
    theme.setPreference('unexpected');
    expect(theme.preference()).toBe('dark');
  });

  it('restores the original root attribute when its owner is destroyed', () => {
    const root = TestBed.inject(DOCUMENT).documentElement;
    const previous = root.getAttribute('data-theme');
    TestBed.inject(ThemeService).setPreference('dark');
    TestBed.tick();
    TestBed.resetTestingModule();
    expect(root.getAttribute('data-theme')).toBe(previous);
  });
});
