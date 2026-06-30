export function attachPanelChrome(
  panel: HTMLElement,
  title: string,
  onClose: () => void
): void {
  if (panel.querySelector('[data-role="panel-title"]')) return;

  const titleBar = document.createElement('div');
  titleBar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px';

  const titleEl = document.createElement('span');
  titleEl.dataset['role'] = 'panel-title';
  titleEl.textContent = title;
  titleEl.style.cssText = 'font-weight:bold;font-size:16px';
  titleBar.appendChild(titleEl);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.dataset['role'] = 'panel-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', onClose);
  titleBar.appendChild(closeBtn);

  panel.insertBefore(titleBar, panel.firstChild);
}
