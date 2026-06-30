const ELEMENT_ID = 'login-screen';
export const ACCOUNT_NAME_STORAGE_KEY = 'nj.accountName';

export function mountLoginScreen(onSubmit: (name: string) => void): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;

  const screen = document.createElement('div');
  screen.id = ELEMENT_ID;
  screen.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0a12;color:#eee;z-index:2000';

  const card = document.createElement('div');
  card.style.cssText = 'padding:24px;background:#1a1a2e;border-radius:8px;min-width:280px';

  const title = document.createElement('h1');
  title.textContent = 'Login';
  card.appendChild(title);

  const input = document.createElement('input');
  input.type = 'text';
  input.dataset['role'] = 'account-name';
  input.placeholder = 'Account name';
  card.appendChild(input);

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.dataset['role'] = 'login-submit';
  submit.textContent = 'Enter';
  submit.disabled = true;
  card.appendChild(submit);

  input.addEventListener('input', () => {
    submit.disabled = input.value.trim().length === 0;
  });

  submit.addEventListener('click', () => {
    const name = input.value.trim();
    if (name) onSubmit(name);
  });

  screen.appendChild(card);
  document.body.appendChild(screen);
  return screen;
}

export function hideLoginScreen(): void {
  const el = document.getElementById(ELEMENT_ID);
  if (el) el.remove();
}
