export const DEFAULT_MODEL_TIMEOUT_SECONDS = 120;
export const MIN_MODEL_TIMEOUT_SECONDS = 30;
export const MAX_MODEL_TIMEOUT_SECONDS = 300;

// Leave time for local corpus preparation and for the server's timeout error to reach the page.
export function clientTimeoutMs(operation, seconds = DEFAULT_MODEL_TIMEOUT_SECONDS) {
  if (['status', 'config'].includes(operation)) return 15000;
  const bounded = Number.isInteger(seconds) && seconds >= MIN_MODEL_TIMEOUT_SECONDS && seconds <= MAX_MODEL_TIMEOUT_SECONDS
    ? seconds : DEFAULT_MODEL_TIMEOUT_SECONDS;
  return bounded * 1000 + 30000;
}
