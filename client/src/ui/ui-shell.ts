const ELEMENT_ID = 'ui-shell';

export function mountUiShell(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;

  const shell = document.createElement('div');
  shell.id = ELEMENT_ID;
  shell.dataset['role'] = 'ui-shell';
  shell.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:15';
  document.body.appendChild(shell);
  return shell;
}
