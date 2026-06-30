export interface RestoreExpState {
  xp: number;
  expBeforeDeath: number;
  adena: number;
}

export interface RestoreExpOptions {
  costPerXp?: number;
  minCost?: number;
}

export interface RestoreExpResult {
  ok: boolean;
  xp: number;
  adena: number;
  expBeforeDeath: number;
}

export function calcRestoreExpCost(
  lostExp: number,
  costPerXp = 10,
  minCost = 100
): number {
  if (lostExp <= 0) return 0;
  return Math.max(minCost, lostExp * costPerXp);
}

export function applyRestoreExp(
  state: RestoreExpState,
  opts: RestoreExpOptions = {}
): RestoreExpResult {
  const costPerXp = opts.costPerXp ?? 10;
  const minCost = opts.minCost ?? 100;

  if (state.expBeforeDeath <= state.xp) {
    return {
      ok: false,
      xp: state.xp,
      adena: state.adena,
      expBeforeDeath: state.expBeforeDeath,
    };
  }

  const lostExp = state.expBeforeDeath - state.xp;
  const cost = calcRestoreExpCost(lostExp, costPerXp, minCost);

  if (state.adena < cost) {
    return {
      ok: false,
      xp: state.xp,
      adena: state.adena,
      expBeforeDeath: state.expBeforeDeath,
    };
  }

  return {
    ok: true,
    xp: state.expBeforeDeath,
    adena: state.adena - cost,
    expBeforeDeath: 0,
  };
}
