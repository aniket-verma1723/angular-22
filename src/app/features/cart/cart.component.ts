import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { CartService } from './data/cart.service';
import { QuantityControlComponent } from './ui/quantity-control.component';
import { UsdCentsPipe } from './ui/usd-cents.pipe';

@Component({
  selector: 'app-cart',
  imports: [MatButton, MatCard, MatCardContent, RouterLink, QuantityControlComponent, UsdCentsPipe],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css'
})
export class CartComponent {
  protected readonly cart = inject(CartService);
  protected readonly message = signal('');
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');
  private readonly clearButton = viewChild<MatButton, ElementRef<HTMLButtonElement>>('clearButton', { read: ElementRef });
  protected readonly confirmClear = signal(false);

  protected setQuantity(id: number, quantity: number): void {
    const result = this.cart.setQuantity(id, quantity);
    this.message.set(result.ok ? 'Quantity updated.' : result.message);
  }

  protected remove(id: number, title: string): void {
    this.cart.remove(id);
    this.message.set(`${title} removed from your cart.`);
    this.heading()?.nativeElement.focus({ preventScroll: true });
  }

  protected clear(): void {
    this.cart.clear();
    this.confirmClear.set(false);
    this.message.set('Cart cleared.');
    this.heading()?.nativeElement.focus({ preventScroll: true });
  }

  protected keepCart(): void {
    this.confirmClear.set(false);
    this.clearButton()?.nativeElement.focus();
  }
}
