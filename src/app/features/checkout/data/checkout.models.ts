export interface CheckoutItem { readonly id: number; readonly quantity: number; }
export interface CheckoutRequest { readonly userId: number; readonly products: readonly CheckoutItem[]; }
export interface ReceiptLine extends CheckoutItem {
  readonly title: string;
  readonly unitPriceCents: number;
  readonly totalCents: number;
}
export interface CheckoutReceipt {
  readonly id: number;
  readonly userId: number;
  readonly lines: readonly ReceiptLine[];
  readonly subtotalCents: number;
  readonly discountedTotalCents: number;
  readonly totalQuantity: number;
}
export interface CheckoutResult {
  readonly receipt: CheckoutReceipt;
  readonly source: 'remote' | 'mock';
}
