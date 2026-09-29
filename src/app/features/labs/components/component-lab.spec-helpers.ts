export function labButton(root: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find(node => node.textContent?.trim() === text);
  if (!button) throw new Error(`Missing lab button: ${text}`);
  return button;
}

export function labInput(root: ParentNode, selector: string): HTMLInputElement {
  const input = root.querySelector(selector);
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing lab input: ${selector}`);
  return input;
}

export function labElement(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing lab element: ${selector}`);
  return element;
}
