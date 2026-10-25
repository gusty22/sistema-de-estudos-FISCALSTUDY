import { useEffect, useState } from 'react';
import { requestJson } from '../../utils/attemptSubmission';
interface Topic { id: string; disciplina: string; assunto: string; subassunto?: string }
interface Item { id: string; enunciado: string; disciplina?: string; arquivo_origem?: string; numero_original?: number }
export function QuestionClassificationPanel({ concursoId, onClose }: { concursoId?: string; onClose: () => void }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [coverage, setCoverage] = useState<any>(null);
  const [selected, setSelected] = useState('');
  const [topicId, setTopicId] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [evidence, setEvidence] = useState('');
  const [confidence, setConfidence] = useState(0.8);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const scope = concursoId ? '?concursoId=' + encodeURIComponent(concursoId) : '';
  const load = async () => {
    const [nextTopics, nextItems, nextCoverage] = await Promise.all([
      requestJson('/api/v1/question-classification/topics' + scope),
      requestJson('/api/v1/question-classification/questions?unclassified=true&limit=50'),
      requestJson('/api/v1/question-classification/coverage' + scope)
    ]);
    setTopics(nextTopics); setItems(nextItems); setCoverage(nextCoverage);
  };
  useEffect(() => { load().catch(e => setError(e.message)); }, [concursoId]);
  useEffect(() => {
    setHistory([]);
    if (selected) requestJson('/api/v1/question-classification/questions/' + encodeURIComponent(selected)).then(setHistory).catch(e => setError(e.message));
  }, [selected]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  const save = async (status: string) => {
    setBusy(true); setError('');
    try {
      await requestJson('/api/v1/question-classification/questions/' + encodeURIComponent(selected), {
        method: 'POST', body: JSON.stringify({ topicId, status, confidence, origin: 'HUMAN', reviewer, evidence })
      });
      await load();
      setHistory(await requestJson('/api/v1/question-classification/questions/' + encodeURIComponent(selected)));
      setEvidence('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha de conexão'); }
    finally { setBusy(false); }
  };
  const item = items.find(q => q.id === selected);
  return <div className="resolucao-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
    <section role="dialog" aria-modal="true" aria-labelledby="classification-title" className="resolucao-modal-container" style={{ padding: '1.5rem', overflowY: 'auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between' }}><h2 id="classification-title">Classificação de questões por tópico</h2><button onClick={onClose} aria-label="Fechar classificação">Fechar</button></header>
      <p>Vínculos sugeridos não são utilizados como confirmação de domínio. A confiança é uma avaliação declarada, ainda sem validação de acurácia.</p>
      {coverage && <p>{coverage.classifiedQuestions} de {coverage.totalQuestions} questões com vínculo confirmado no escopo; {coverage.unclassifiedQuestions} sem confirmação. {coverage.suggestedLinks} sugestões.</p>}
      {error && <p role="alert">{error}</p>}
      <label>Questões ainda não classificadas (primeiras 50)<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Selecione</option>{items.map(q => <option key={q.id} value={q.id}>{q.disciplina || 'Sem disciplina'} — {q.enunciado.slice(0, 110)}</option>)}</select></label>
      {item && <><p style={{ whiteSpace: 'pre-wrap' }}>{item.enunciado}</p><p>Origem: {item.arquivo_origem || 'Não informada'}; questão {item.numero_original ?? 'não informada'}.</p></>}
      <div style={{ display: 'grid', gap: '0.8rem', margin: '1rem 0' }}>
        <label>Tópico do edital<select value={topicId} onChange={e => setTopicId(e.target.value)}><option value="">Selecione</option>{topics.map(t => <option key={t.id} value={t.id}>{t.disciplina} — {t.assunto}{t.subassunto ? ' / ' + t.subassunto : ''}</option>)}</select></label>
        <label>Revisor<input value={reviewer} onChange={e => setReviewer(e.target.value)} /></label>
        <label>Evidência e justificativa<textarea value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Explique o vínculo com o tópico e indique fonte recuperável quando disponível." /></label>
        <label>Confiança declarada (0–1)<input type="number" min="0" max="1" step="0.05" value={confidence} onChange={e => setConfidence(Number(e.target.value))} /></label>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>{[['SUGGESTED', 'Salvar sugestão'], ['CONFIRMED', 'Confirmar vínculo'], ['REJECTED', 'Rejeitar vínculo']].map(([status, label]) => <button key={status} disabled={busy || !selected || !topicId || !reviewer.trim() || !evidence.trim()} onClick={() => save(status)}>{label}</button>)}</div>
      <h3>Histórico de curadoria</h3><ul>{history.map(h => <li key={h.id}>{h.status}: {h.disciplina} — {h.assunto}; confiança {h.confidence}; revisor {h.reviewer || 'não informado'}; {h.evidence}</li>)}</ul>
    </section>
  </div>;
}
