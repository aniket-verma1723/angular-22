import { Service, computed, signal } from '@angular/core';
import type { ProductSummary } from '../../products/data/product.models';

export const MAX_CART_QUANTITY = 99;
export const MAX_CART_LINES = 100;
const MAX_UNIT_CENTS = 100_000_000;

export interface CartLine {
  readonly productId: number;
  readonly title: string;
  readonly thumbnail: string;
  readonly unitPriceCents: number;
  readonly stock: number;
  readonly quantity: number;
}

export type CartResult = { readonly ok: true } | { readonly ok: false; readonly message: string };
const success: CartResult = { ok: true };
const failure = (message: string): CartResult => ({ ok: false, message });

@Service()
export class CartService {
  private readonly state = signal<readonly CartLine[]>([]);
  readonly lines = this.state.asReadonly();
  readonly itemCount = computed(() => this.lines().reduce((sum, line) => sum + line.quantity, 0));
  readonly subtotalCents = computed(() => this.lines().reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0));
  readonly quantityById = computed<ReadonlyMap<number, number>>(() => new Map(this.lines().map(line => [line.productId, line.quantity])));
  readonly limitsById = computed<ReadonlyMap<number, number>>(() => new Map(this.lines().map(line => [line.productId, Math.min(line.stock, MAX_CART_QUANTITY)])));

  add(product: ProductSummary, quantity = 1): CartResult {
    if (!Number.isSafeInteger(product.id) || product.id < 1 || !product.title.trim() ||
        !Number.isSafeInteger(product.stock) || product.stock < 0 || !Number.isFinite(product.price) || product.price < 0) {
      return failure('This product cannot be added to the demo cart.');
    }
    const existing = this.lines().find(line => line.productId === product.id);
    const stock = existing?.stock ?? product.stock;
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || !this.validQuantity(nextQuantity, stock)) {
      return failure(`Choose a whole quantity from 1 to ${Math.min(stock, MAX_CART_QUANTITY)}. Out-of-stock products cannot be added.`);
    }
    if (existing) return this.setQuantity(product.id, nextQuantity);
    if (this.lines().length >= MAX_CART_LINES) return failure('The demo cart supports up to 100 different products.');
    // Round once at the boundary, then use integer cents for every calculation.
    const unitPriceCents = Math.round((product.price + Number.EPSILON * product.price) * 100);
    if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents > MAX_UNIT_CENTS) {
      return failure('This price exceeds the demo limit of USD 1,000,000 per item.');
    }
    this.commit([...this.lines(), { productId: product.id, title: product.title, thumbnail: product.thumbnail,
      unitPriceCents, stock, quantity }]);
    return success;
  }

  setQuantity(productId: number, quantity: number): CartResult {
    const line = this.lines().find(item => item.productId === productId);
    if (!line) return failure('This product is no longer in the cart.');
    if (!this.validQuantity(quantity, line.stock)) return failure(`Choose a whole quantity from 1 to ${Math.min(line.stock, MAX_CART_QUANTITY)}.`);
    if (quantity !== line.quantity) this.commit(this.lines().map(item => item.productId === productId ? { ...item, quantity } : item));
    return success;
  }

  remove(productId: number): void { this.commit(this.lines().filter(line => line.productId !== productId)); }
  clear(): void { this.commit([]); }

  // Compare the immutable snapshot by identity: a late receipt must never erase a newer cart.
  clearSubmitted(snapshot: readonly CartLine[]): boolean {
    if (this.lines() !== snapshot) return false;
    this.clear();
    return true;
  }

  private validQuantity(quantity: number, stock: number): boolean {
    return Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= Math.min(stock, MAX_CART_QUANTITY);
  }

  private commit(lines: readonly CartLine[]): void {
    this.state.set(Object.freeze(lines.map(line => Object.freeze(line))));
  }
}
