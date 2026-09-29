export function checkoutRequestFixture() { return { userId: 1, products: [{ id: 1, quantity: 2 }] }; }
export function checkoutReceiptFixture() {
  return { id: 51, userId: 1, products: [{ id: 1, quantity: 2, title: 'Test notebook', price: 12.5, total: 25 }],
    total: 25, discountedTotal: 23, totalProducts: 1, totalQuantity: 2 };
}
