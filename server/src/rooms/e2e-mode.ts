/** True when flag-gated e2e test intents are allowed (e2e webServer only). */
export function isE2EMode(): boolean {
  return process.env['NJ_E2E'] === '1';
}
