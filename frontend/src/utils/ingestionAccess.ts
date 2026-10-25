let sessionToken = '';
export function setIngestionToken(value: string) { sessionToken = value; }
/** Token is kept in memory and sent only to the local ingestion API. */
export function ingestionFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (input.startsWith('/api/v1/ingestion/') || input.startsWith('/api/v1/ingestion?')) {
    if (sessionToken) headers.set('X-FiscalStudy-Admin-Token', sessionToken);
  }
  return fetch(input, { ...init, headers });
}
