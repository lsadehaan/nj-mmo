import { createIconImg } from './icon-img';

export const KATERINA_NPC_ID = 30004;
export const LECTOR_NPC_ID = 30001;
export const JACKSON_NPC_ID = 30002;
export const SILVIA_NPC_ID = 30003;

export interface ShopItemDisplay {
  itemId: number;
  name: string;
  buyPrice: number;
  sellPrice: number;
}

/** Display catalog — prices validated server-side on buy/sell (AD-001). */
export const KATERINA_SHOP_ITEMS: readonly ShopItemDisplay[] = [
  { itemId: 1060, name: 'Healing Potion', buyPrice: 103, sellPrice: 51 },
  { itemId: 1835, name: 'Soulshot', buyPrice: 8, sellPrice: 4 },
  { itemId: 17, name: 'Wooden Arrow', buyPrice: 2, sellPrice: 1 },
];

export const LECTOR_SHOP_ITEMS: readonly ShopItemDisplay[] = [
  { itemId: 1, name: 'Short Sword', buyPrice: 883, sellPrice: 441 },
  { itemId: 4, name: 'Club', buyPrice: 883, sellPrice: 441 },
  { itemId: 13, name: 'Short Bow', buyPrice: 883, sellPrice: 441 },
];

export const JACKSON_SHOP_ITEMS: readonly ShopItemDisplay[] = [
  { itemId: 21, name: 'Shirt', buyPrice: 169, sellPrice: 84 },
  { itemId: 28, name: 'Pants', buyPrice: 105, sellPrice: 52 },
  { itemId: 1121, name: "Apprentice's Shoes", buyPrice: 8, sellPrice: 4 },
];

export const SILVIA_SHOP_ITEMS: readonly ShopItemDisplay[] = [
  { itemId: 116, name: 'Magic Ring', buyPrice: 37, sellPrice: 18 },
  { itemId: 112, name: "Apprentice's Earring", buyPrice: 56, sellPrice: 28 },
  { itemId: 118, name: 'Necklace of Magic', buyPrice: 75, sellPrice: 37 },
];

export const SHOP_CATALOGS: Record<number, readonly ShopItemDisplay[]> = {
  [KATERINA_NPC_ID]: KATERINA_SHOP_ITEMS,
  [LECTOR_NPC_ID]: LECTOR_SHOP_ITEMS,
  [JACKSON_NPC_ID]: JACKSON_SHOP_ITEMS,
  [SILVIA_NPC_ID]: SILVIA_SHOP_ITEMS,
};

export interface ShopSendHandlers {
  sendBuy: (payload: { npcId: number; itemId: number; quantity: number }) => void;
  sendSell: (payload: { npcId: number; itemId: number; quantity: number }) => void;
}

export interface ShopRenderOptions {
  npcId: number;
  merchantName: string;
  adena: number;
  itemCounts: Record<number, number>;
  visible: boolean;
  handlers: ShopSendHandlers;
}

const ELEMENT_ID = 'shop-window';
const SHOP_ROW_ICON_PX = 32;

/** Builds a catalog row icon — exported for fallback regression tests. */
export function createShopRowIcon(itemId: number, name: string): HTMLImageElement {
  return createIconImg({ kind: 'item', id: itemId, alt: name, sizePx: SHOP_ROW_ICON_PX });
}

export function mountShopWindow(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;

  const panel = document.createElement('div');
  panel.id = ELEMENT_ID;
  panel.hidden = true;
  panel.style.cssText = [
    'position:fixed',
    'top:50%',
    'left:50%',
    'transform:translate(-50%,-50%)',
    'min-width:280px',
    'padding:16px',
    'background:rgba(20,16,10,0.92)',
    'color:#f5e6c8',
    'border:2px solid #8b7355',
    'border-radius:6px',
    'z-index:20',
    'font:14px/1.4 system-ui,sans-serif',
  ].join(';');

  const title = document.createElement('h2');
  title.dataset['role'] = 'title';
  title.style.margin = '0 0 8px';
  panel.appendChild(title);

  const adenaRow = document.createElement('div');
  adenaRow.dataset['role'] = 'adena-row';
  adenaRow.innerHTML = 'Adena: <span data-adena>0</span>';
  panel.appendChild(adenaRow);

  const list = document.createElement('div');
  list.dataset['role'] = 'item-list';
  panel.appendChild(list);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';
  closeBtn.dataset['action'] = 'close';
  closeBtn.style.marginTop = '12px';
  panel.appendChild(closeBtn);

  document.body.appendChild(panel);
  return panel;
}

export function renderShopWindow(options: ShopRenderOptions): void {
  const panel = mountShopWindow();
  panel.hidden = !options.visible;

  const title = panel.querySelector('[data-role="title"]');
  if (title) title.textContent = `${options.merchantName} — Shop`;

  const adenaRow = panel.querySelector('[data-role="adena-row"]');
  if (adenaRow instanceof HTMLElement) {
    adenaRow.innerHTML = '';
    adenaRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
    const adenaIcon = createIconImg({
      kind: 'item',
      id: 57,
      alt: 'Adena',
      sizePx: 24,
    });
    adenaRow.appendChild(adenaIcon);
    const adenaText = document.createElement('span');
    adenaText.innerHTML = 'Adena: <span data-adena>0</span>';
    adenaRow.appendChild(adenaText);
  }

  const adenaEl = panel.querySelector('[data-adena]');
  if (adenaEl) adenaEl.textContent = String(options.adena);

  const catalog = SHOP_CATALOGS[options.npcId] ?? KATERINA_SHOP_ITEMS;

  const list = panel.querySelector('[data-role="item-list"]');
  if (!list) return;
  list.innerHTML = '';

  for (const item of catalog) {
    const owned = options.itemCounts[item.itemId] ?? 0;
    const row = document.createElement('div');
    row.dataset['shopItemId'] = String(item.itemId);
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0;';

    row.appendChild(createShopRowIcon(item.itemId, item.name));

    const label = document.createElement('span');
    label.style.flex = '1';
    label.textContent = `${item.name} (owned: ${owned})`;
    row.appendChild(label);

    const buyPrice = document.createElement('span');
    buyPrice.dataset['buyPrice'] = 'true';
    buyPrice.textContent = String(item.buyPrice);
    buyPrice.hidden = true;
    row.appendChild(buyPrice);

    const buyBtn = document.createElement('button');
    buyBtn.type = 'button';
    buyBtn.dataset['action'] = 'buy';
    buyBtn.textContent = `Buy ${item.buyPrice}`;
    buyBtn.addEventListener('click', () => {
      options.handlers.sendBuy({
        npcId: options.npcId,
        itemId: item.itemId,
        quantity: 1,
      });
    });
    row.appendChild(buyBtn);

    const sellBtn = document.createElement('button');
    sellBtn.type = 'button';
    sellBtn.dataset['action'] = 'sell';
    sellBtn.textContent = `Sell ${item.sellPrice}`;
    sellBtn.disabled = owned <= 0;
    sellBtn.addEventListener('click', () => {
      options.handlers.sendSell({
        npcId: options.npcId,
        itemId: item.itemId,
        quantity: 1,
      });
    });
    row.appendChild(sellBtn);

    list.appendChild(row);
  }

  const closeBtn = panel.querySelector('[data-action="close"]');
  if (closeBtn && !closeBtn.hasAttribute('data-bound')) {
    closeBtn.setAttribute('data-bound', 'true');
    closeBtn.addEventListener('click', () => {
      panel.hidden = true;
      panel.dispatchEvent(new CustomEvent('shop-close'));
    });
  }
}

export function setShopVisible(visible: boolean): void {
  const panel = mountShopWindow();
  panel.hidden = !visible;
}

export function isShopVisible(): boolean {
  const panel = document.getElementById(ELEMENT_ID);
  return panel !== null && !panel.hidden;
}
