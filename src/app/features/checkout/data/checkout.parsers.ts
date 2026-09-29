import { ApiError } from '../../../core/http/api-error';
import { MAX_CART_LINES, MAX_CART_QUANTITY } from '../../cart/data/cart.service';
import type { CheckoutReceipt, CheckoutRequest } from './checkout.models';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected object');
  return value;
}
function integer(value: unknown, minimum = 1, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error('Invalid integer');
  return value;
}
function money(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid money');
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || cents > 1_000_000_000_000 || Math.abs(value * 100 - cents) > 0.001) throw new Error('Invalid cents');
  return cents;
}
function items(value: unknown): unknown[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_CART_LINES) throw new Error('Invalid products');
  return value;
}

export function parseCheckoutRequest(value: unknown): CheckoutRequest {
  try {
    const raw = record(value);
    const products = items(raw['products']).map(value => {
      const item = record(value);
      return { id: integer(item['id']), quantity: integer(item['quantity'], 1, MAX_CART_QUANTITY) };
    });
    if (new Set(products.map(item => item.id)).size !== products.length) throw new Error('Duplicate product');
    return { userId: integer(raw['userId']), products };
  } catch {
    throw new ApiError('validation', 'Checkout needs a demo user and 1–100 distinct products with whole quantities from 1 to 99.');
  }
}

export function parseCheckoutReceipt(value: unknown, request: CheckoutRequest): CheckoutReceipt {
  try {
    const raw = record(value);
    const requested = new Map(request.products.map(item => [item.id, item.quantity]));
    const lines = items(raw['products']).map(value => {
      const item = record(value);
      const id = integer(item['id']);
      const quantity = integer(item['quantity'], 1, MAX_CART_QUANTITY);
      const title = item['title'];
      if (typeof title !== 'string' || !title.trim() || title.length > 500 || requested.get(id) !== quantity) throw new Error('Unexpected product');
      const unitPriceCents = money(item['price']);
      const totalCents = money(item['total']);
      if (unitPriceCents > 100_000_000 || totalCents !== unitPriceCents * quantity) throw new Error('Inconsistent line');
      return { id, quantity, title: title.trim(), unitPriceCents, totalCents };
    });
    const userId = integer(raw['userId']);
    const subtotalCents = money(raw['total']);
    const discountedTotalCents = money(raw['discountedTotal']);
    const totalQuantity = integer(raw['totalQuantity']);
    if (userId !== request.userId || lines.length !== requested.size || new Set(lines.map(line => line.id)).size !== lines.length ||
        integer(raw['totalProducts']) !== lines.length || totalQuantity !== lines.reduce((sum, line) => sum + line.quantity, 0) ||
        subtotalCents !== lines.reduce((sum, line) => sum + line.totalCents, 0) || discountedTotalCents > subtotalCents) {
      throw new Error('Inconsistent receipt');
    }
    return { id: integer(raw['id']), userId, lines, subtotalCents, discountedTotalCents, totalQuantity };
  } catch {
    throw new ApiError('format', 'The service returned an invalid or mismatched checkout receipt. Your cart has been kept.');
  }
}
