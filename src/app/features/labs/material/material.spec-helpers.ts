export function materialElement(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLElement)) throw new Error(`Expected gallery element: ${selector}`);
  return element;
}

export function materialButton(root: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find(item => item.textContent?.trim() === text);
  if (!button) throw new Error(`Expected gallery button: ${text}`);
  return button;
}
