export const WAREHOUSE_WINDOW_ID = 'warehouse-window';

export interface WarehouseStack {
  itemId: number;
  count: number;
}

export interface WarehouseWindowHandlers {
  sendDeposit: (payload: { itemId: number; quantity: number }) => void;
  sendWithdraw: (payload: { itemId: number; quantity: number }) => void;
}

export interface WarehouseWindowOptions {
  npcId: number;
  inventory: WarehouseStack[];
  warehouse: WarehouseStack[];
  visible: boolean;
  handlers: WarehouseWindowHandlers;
}

export function mountWarehouseWindow(): HTMLElement {
  const existing = document.getElementById(WAREHOUSE_WINDOW_ID);
  if (existing) return existing;

  const panel = document.createElement('div');
  panel.id = WAREHOUSE_WINDOW_ID;
  panel.hidden = true;
  panel.style.cssText = [
    'position:fixed',
    'top:50%',
    'left:50%',
    'transform:translate(-50%,-50%)',
    'min-width:320px',
    'padding:16px',
    'background:rgba(12,28,18,0.94)',
    'color:#e8f5e9',
    'border:2px solid #4caf50',
    'border-radius:6px',
    'z-index:21',
    'font:14px/1.4 system-ui,sans-serif',
  ].join(';');

  const title = document.createElement('h2');
  title.dataset['role'] = 'title';
  title.textContent = 'Warehouse';
  title.style.margin = '0 0 12px';
  panel.appendChild(title);

  const itemSelect = document.createElement('select');
  itemSelect.dataset['role'] = 'item-select';
  itemSelect.style.width = '100%';
  itemSelect.style.marginBottom = '8px';
  panel.appendChild(itemSelect);

  const qty = document.createElement('input');
  qty.type = 'number';
  qty.min = '1';
  qty.value = '1';
  qty.dataset['role'] = 'quantity';
  qty.style.width = '100%';
  qty.style.marginBottom = '8px';
  panel.appendChild(qty);

  const depositBtn = document.createElement('button');
  depositBtn.type = 'button';
  depositBtn.dataset['action'] = 'deposit';
  depositBtn.textContent = 'Deposit';
  depositBtn.style.display = 'block';
  depositBtn.style.marginBottom = '8px';
  panel.appendChild(depositBtn);

  const withdrawBtn = document.createElement('button');
  withdrawBtn.type = 'button';
  withdrawBtn.dataset['action'] = 'withdraw';
  withdrawBtn.textContent = 'Withdraw';
  withdrawBtn.style.display = 'block';
  withdrawBtn.style.marginBottom = '8px';
  panel.appendChild(withdrawBtn);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.dataset['action'] = 'close';
  closeBtn.textContent = 'Close';
  panel.appendChild(closeBtn);

  document.body.appendChild(panel);
  return panel;
}

function fillSelect(select: HTMLSelectElement, stacks: WarehouseStack[], emptyLabel: string): void {
  select.innerHTML = '';
  if (stacks.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = emptyLabel;
    select.appendChild(opt);
    return;
  }
  for (const stack of stacks) {
    const opt = document.createElement('option');
    opt.value = String(stack.itemId);
    opt.textContent = `Item ${stack.itemId} × ${stack.count}`;
    select.appendChild(opt);
  }
}

export function renderWarehouseWindow(options: WarehouseWindowOptions): void {
  const panel = mountWarehouseWindow();
  panel.hidden = !options.visible;
  panel.dataset['npcId'] = String(options.npcId);

  const select = panel.querySelector('[data-role="item-select"]') as HTMLSelectElement | null;
  const qty = panel.querySelector('[data-role="quantity"]') as HTMLInputElement | null;
  const depositBtn = panel.querySelector('[data-action="deposit"]');
  const withdrawBtn = panel.querySelector('[data-action="withdraw"]');
  const closeBtn = panel.querySelector('[data-action="close"]');

  if (select) {
    fillSelect(select, [...options.inventory, ...options.warehouse], 'No items');
  }

  if (depositBtn && !depositBtn.hasAttribute('data-bound')) {
    depositBtn.setAttribute('data-bound', 'true');
    depositBtn.addEventListener('click', () => {
      const itemId = Number(select?.value);
      const quantity = Number(qty?.value ?? 1);
      if (!itemId || quantity <= 0) return;
      options.handlers.sendDeposit({ itemId, quantity });
    });
  }

  if (withdrawBtn && !withdrawBtn.hasAttribute('data-bound')) {
    withdrawBtn.setAttribute('data-bound', 'true');
    withdrawBtn.addEventListener('click', () => {
      const itemId = Number(select?.value);
      const quantity = Number(qty?.value ?? 1);
      if (!itemId || quantity <= 0) return;
      options.handlers.sendWithdraw({ itemId, quantity });
    });
  }

  if (closeBtn && !closeBtn.hasAttribute('data-bound')) {
    closeBtn.setAttribute('data-bound', 'true');
    closeBtn.addEventListener('click', () => {
      panel.hidden = true;
    });
  }
}

export function setWarehouseWindowVisible(visible: boolean): void {
  const panel = mountWarehouseWindow();
  panel.hidden = !visible;
}

export function isWarehouseDepositEnabled(): boolean {
  const panel = document.getElementById(WAREHOUSE_WINDOW_ID);
  const deposit = panel?.querySelector('[data-action="deposit"]') as HTMLButtonElement | null;
  return deposit !== null && !deposit.disabled;
}
