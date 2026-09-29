import { TestBed } from '@angular/core/testing';
import { productFixture } from '../../../testing/product-fixtures';
import { CartService, MAX_CART_LINES } from './cart.service';

describe('CartService', () => {
  let cart: CartService;
  beforeEach(() => { TestBed.configureTestingModule({}); cart = TestBed.inject(CartService); });

  it('starts empty and derives counts and integer-cent subtotals across products', () => {
    expect(cart.lines()).toEqual([]);
    expect(cart.subtotalCents()).toBe(0);
    cart.add(productFixture({ price: 0.1, stock: 10 }), 3);
    cart.add(productFixture({ id: 2, price: 0.2, stock: 10 }), 2);
    expect(cart.itemCount()).toBe(5);
    expect(cart.subtotalCents()).toBe(70);
    expect(cart.quantityById().get(1)).toBe(3);
  });

  it('merges duplicate IDs without mutating previous snapshots', () => {
    cart.add(productFixture({ stock: 10 }), 2);
    const before = cart.lines();
    cart.add(productFixture({ stock: 10 }));
    expect(cart.lines().length).toBe(1);
    expect(cart.lines()[0]?.quantity).toBe(3);
    expect(before[0]?.quantity).toBe(2);
    expect(cart.lines()).not.toBe(before);
    expect(Object.isFrozen(cart.lines())).toBeTrue();
    expect(Object.isFrozen(cart.lines()[0])).toBeTrue();
  });

  it('preserves first-add price and stock until removal and re-add', () => {
    cart.add(productFixture({ price: 2, stock: 4 }));
    cart.add(productFixture({ price: 9, stock: 20, title: 'Changed' }));
    expect(cart.lines()[0]?.unitPriceCents).toBe(200);
    expect(cart.lines()[0]?.stock).toBe(4);
    expect(cart.limitsById().get(1)).toBe(4);
    expect(cart.setQuantity(1, 5).ok).toBeFalse();
    cart.remove(1);
    cart.add(productFixture({ price: 9, stock: 20 }));
    expect(cart.subtotalCents()).toBe(900);
  });

  for (const quantity of [0, -1, 1.5, NaN, Infinity, 100]) {
    it(`rejects invalid quantity ${quantity} without changing state`, () => {
      cart.add(productFixture({ stock: 200 }));
      const before = cart.lines();
      expect(cart.setQuantity(1, quantity).ok).toBeFalse();
      expect(cart.add(productFixture({ stock: 200 }), quantity).ok).toBeFalse();
      expect(cart.lines()).toBe(before);
    });
  }

  it('rejects stock exhaustion, unknown lines and invalid product boundaries', () => {
    expect(cart.add(productFixture({ stock: 0 })).ok).toBeFalse();
    expect(cart.add(productFixture({ price: -1 })).ok).toBeFalse();
    expect(cart.add(productFixture({ price: NaN })).ok).toBeFalse();
    expect(cart.add(productFixture({ price: 1_000_001 })).ok).toBeFalse();
    expect(cart.add(productFixture({ id: 0 })).ok).toBeFalse();
    expect(cart.add(productFixture({ stock: 1.5 })).ok).toBeFalse();
    expect(cart.setQuantity(123, 2).ok).toBeFalse();
    cart.add(productFixture({ stock: 1 }));
    expect(cart.add(productFixture({ stock: 1 })).ok).toBeFalse();
    expect(cart.itemCount()).toBe(1);
  });

  for (const [price, cents] of [[0, 0], [1.005, 101], [10.075, 1008], [12.34, 1234]]) {
    it(`rounds USD ${price} once to ${cents} cents`, () => {
      cart.add(productFixture({ price, stock: 3 }), 3);
      expect(cart.subtotalCents()).toBe(cents * 3);
    });
  }

  it('caps distinct lines and maintains safe totals at all limits', () => {
    for (let id = 1; id <= MAX_CART_LINES; id++) expect(cart.add(productFixture({ id, price: 1_000_000, stock: 99 }), 99).ok).toBeTrue();
    expect(cart.add(productFixture({ id: 101 })).ok).toBeFalse();
    expect(cart.itemCount()).toBe(9900);
    expect(cart.subtotalCents()).toBe(990_000_000_000);
    expect(Number.isSafeInteger(cart.subtotalCents())).toBeTrue();
  });

  it('updates, removes and clears computed values and isolates new owners', () => {
    cart.add(productFixture({ price: 2, stock: 5 }));
    expect(cart.setQuantity(1, 5).ok).toBeTrue();
    expect(cart.subtotalCents()).toBe(1000);
    const freshOwner = new CartService();
    expect(freshOwner.itemCount()).toBe(0);
    cart.remove(1);
    expect(cart.itemCount()).toBe(0);
    cart.add(productFixture());
    cart.clear(); cart.clear();
    expect(cart.lines()).toEqual([]);
    expect(cart.quantityById().size).toBe(0);
    expect(cart.subtotalCents()).toBe(0);
  });

  it('clears only the exact submitted snapshot, preserving intervening changes', () => {
    cart.add(productFixture()); const submitted = cart.lines();
    cart.setQuantity(1, 2);
    expect(cart.clearSubmitted(submitted)).toBeFalse(); expect(cart.itemCount()).toBe(2);
    expect(cart.clearSubmitted(cart.lines())).toBeTrue(); expect(cart.itemCount()).toBe(0);
  });
});
