import { TestBed } from '@angular/core/testing';
import { UsdCentsPipe } from './usd-cents.pipe';

describe('UsdCentsPipe', () => {
  it('formats integer cents including zero and rejects invalid values', () => {
    const pipe = TestBed.runInInjectionContext(() => new UsdCentsPipe());
    expect(pipe.transform(0)).toBe('$0.00');
    expect(pipe.transform(123456)).toBe('$1,234.56');
    for (const value of [NaN, Infinity, -1, 1.5]) expect(pipe.transform(value)).toBe('—');
  });
});
