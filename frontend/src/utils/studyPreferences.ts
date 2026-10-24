import { requestJson } from './attemptSubmission.ts';
export interface AppliedStudyPreferences {
  theme: 'paper' | 'night';
  questionFont: string;
  sessionMinutes: number;
  dailyQuestions: number;
}
export function normalizeStudyPreferences(settings: any): AppliedStudyPreferences {
  const profile = settings?.perfilEstudos || {};
  return {
    theme: profile.tema === 'CALMA_NOTURNA' ? 'night' : 'paper',
    questionFont: ({ PADRAO: '1rem', CONFORTAVEL: '1.08rem', GRANDE: '1.18rem' } as Record<string, string>)[profile.tamanhoFonte] || '1.08rem',
    sessionMinutes: [25, 50, 75, 90].includes(profile.duracaoSessaoMinutos) ? profile.duracaoSessaoMinutos : 50,
    dailyQuestions: Math.max(5, Math.min(150, Number(settings?.objetivos?.metaQuestoesDiarias) || 35))
  };
}
export function applyStudyPreferences(settings: any) {
  const prefs = normalizeStudyPreferences(settings);
  document.documentElement.style.setProperty('--question-reading-size', prefs.questionFont);
  localStorage.setItem('fiscalstudy_applied_preferences', JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent('fiscalstudy:preferences-updated', { detail: prefs }));
  return prefs;
}
export async function loadStudyPreferences() {
  const settings = await requestJson('/api/v1/system/settings');
  return applyStudyPreferences(settings);
}
export async function saveStudyPreferences(settings: any) {
  const confirmed = await requestJson('/api/v1/system/settings', { method: 'POST', body: JSON.stringify(settings) });
  // GET is the authority even if the write response only reports status.
  const persisted = confirmed.perfilEstudos ? confirmed : await requestJson('/api/v1/system/settings');
  applyStudyPreferences(persisted);
  return persisted;
}
export function cachedStudyPreferences(): AppliedStudyPreferences {
  try { return JSON.parse(localStorage.getItem('fiscalstudy_applied_preferences') || 'null') || normalizeStudyPreferences(null); }
  catch { return normalizeStudyPreferences(null); }
}
