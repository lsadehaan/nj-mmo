export interface TradeSendHandlers {
  sendTradeConfirm: () => void;
  sendTradeCancel: () => void;
}

const ELEMENT_ID = 'trade-window';

export function mountTradeWindow(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;
  const panel = document.createElement('div');
  panel.id = ELEMENT_ID;
  panel.hidden = true;
  panel.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#222;color:#fff;padding:12px;z-index:60';
  panel.innerHTML =
    '<div data-role="status">closed</div><button data-role="confirm">Confirm</button><button data-role="cancel">Cancel</button>';
  document.body.appendChild(panel);
  return panel;
}

export function wireTradeWindow(handlers: TradeSendHandlers): void {
  const panel = mountTradeWindow();
  (panel.querySelector('[data-role="confirm"]') as HTMLButtonElement).onclick = () =>
    handlers.sendTradeConfirm();
  (panel.querySelector('[data-role="cancel"]') as HTMLButtonElement).onclick = () =>
    handlers.sendTradeCancel();
}

export function renderTradeWindow(status: string, visible: boolean): void {
  const panel = mountTradeWindow();
  panel.hidden = !visible;
  const el = panel.querySelector('[data-role="status"]')!;
  el.textContent = status;
}
