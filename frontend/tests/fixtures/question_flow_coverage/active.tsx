// Test-only entry, excluded from the production bundle. Refuse ordinary personal content.
import {createRoot} from 'react-dom/client';
import SessaoEstudoAtiva from '../../../src/components/timer/SessaoEstudoAtiva';
import {SimplifiedModeProvider} from '../../../src/context/SimplifiedModeContext';
import '../../../src/index.css';
const data = await (await fetch('/api/v1/bank/questions?size=5')).json();
const questions = data.questions || data.items;
if (!questions?.length || !questions.every((q: {statement:string}) => q.statement.startsWith('SYNTHETIC_FLOW'))) {
  throw new Error('Synthetic fixture data required; this entry cannot run a personal session.');
}
createRoot(document.getElementById('root')!).render(<SimplifiedModeProvider>
  <SessaoEstudoAtiva activeConcurso={null} onBack={() => {}} onFinishSession={() => {}} />
</SimplifiedModeProvider>);
