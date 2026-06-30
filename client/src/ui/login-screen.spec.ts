import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountLoginScreen, ACCOUNT_NAME_STORAGE_KEY, hideLoginScreen } from './login-screen';

describe('login-screen', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('UI28-08: shows login when no account in storage', () => {
    mountLoginScreen(() => undefined);
    expect(document.getElementById('login-screen')).not.toBeNull();
  });

  it('UI28-09: submit stores account and hides login', () => {
    const onDone = vi.fn();
    mountLoginScreen((name) => {
      localStorage.setItem(ACCOUNT_NAME_STORAGE_KEY, name);
      hideLoginScreen();
      onDone(name);
    });
    const input = document.querySelector('[data-role="account-name"]') as HTMLInputElement;
    input.value = 'hero1';
    input.dispatchEvent(new Event('input'));
    (document.querySelector('[data-role="login-submit"]') as HTMLButtonElement).click();
    expect(localStorage.getItem(ACCOUNT_NAME_STORAGE_KEY)).toBe('hero1');
    expect(onDone).toHaveBeenCalledWith('hero1');
  });
});
