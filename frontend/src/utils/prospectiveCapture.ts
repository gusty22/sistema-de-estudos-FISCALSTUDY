import { requestJson } from './attemptSubmission.ts';
/** Host configuration only. No localStorage switch or client assertion authorizes capture. */
export async function prospectiveCaptureEnabled(requested = import.meta.env?.VITE_FISCALSTUDY_PROSPECTIVE_CAPTURE === 'true'): Promise<boolean> {
  if (!requested) return false;
  const state = await requestJson('/api/v1/learning-lab/prospective-status');
  if (state.contractVersion !== 'prospective-question-v1' || typeof state.enabled !== 'boolean' ||
      state.can_apply !== false || state.can_schedule !== false) throw new Error('Estado de captura não confirmado.');
  return state.enabled;
}
const PREFIX = 'fiscalstudy:prospective:modal-context:v1:';
export function modalCaptureSession(scope: string, fresh = false): string {
  const key = PREFIX + scope;
  const prior = localStorage.getItem(key);
  if (prior && !fresh) {
    if (!/^modal-[0-9a-f-]{36}$/.test(prior)) throw new Error('Sessão de recuperação inválida.');
    return prior;
  }
  const id = 'modal-' + crypto.randomUUID();
  localStorage.setItem(key, id); // Prior journals remain immutable under their original session IDs.
  return id;
}
