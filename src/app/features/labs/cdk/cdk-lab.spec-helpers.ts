/** Assertions against this lab's own DOM, not private Material/CDK selectors. */
export function labElement<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Expected lab element: ${selector}`);
  return element;
}

export function labButton(root: ParentNode, label: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find(value => value.textContent?.trim() === label);
  if (!button) throw new Error(`Expected lab button: ${label}`);
  return button;
}
