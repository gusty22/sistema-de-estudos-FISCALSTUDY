import QuestionViewer from './components/QuestionViewer';

function App() {
  return (
    <div className="App">
      <header style={{ padding: '2rem 1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.025em', background: 'linear-gradient(to right, #60a5fa, #3b82f6)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
          FiscalStudy
        </h1>
        <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Sistema Pessoal de Preparação Adaptativa</p>
      </header>
      <QuestionViewer />
    </div>
  );
}

export default App;
