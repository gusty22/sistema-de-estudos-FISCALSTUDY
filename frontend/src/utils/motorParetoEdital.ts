/**
 * Motor de Ingestão e Matriz de Pareto do Sistema FiscalStudy
 * Converte edital bruto e quadro de pontuações em Edital Verticalizado Ponderado.
 */

export interface DisciplinaConfig {
  id: string;
  nome: string;
  questoes: number;
  peso: number;
  complexidade: number; // 1.0 a 1.5
  dominioInicial: number; // 0 a 100%
}

export interface ParetoTopicResult {
  id: string;
  disciplina: string;
  topicoPrincipal: string;
  subtopicoArtigos: string;
  classePareto: 'A' | 'B' | 'C';
  incidenciaEstimada: number; // % histórica dentro da matéria
  pesoRelativoProva: number; // % da matéria no total da prova
  focoEstrategico: 'Teoria' | 'Lei Seca' | 'Questões';
  justificativa?: string;
}

export interface QuartetoAlocacaoItem {
  disciplina: string;
  pontos: number;
  pesoRelativoProva: number; // %
  volumeTopicos: number;
  complexidade: number;
  dominioInicial: number;
  scoreFinal: number;
  tempoRecomendadoPercent: number; // % da carga horária semanal
  horasSugeridasSemanais?: number;
}

export interface MotorParetoOutput {
  disciplinasCalculadas: Array<{
    nome: string;
    questoes: number;
    peso: number;
    pontos: number;
    pesoRelativo: number;
  }>;
  totalPontosProva: number;
  totalQuestoes: number;
  topicos: ParetoTopicResult[];
  quartetoAlocacao: QuartetoAlocacaoItem[];
  coberturaClasseA: number; // % de tópicos ou pontos na classe A
}

// Frequências históricas e regras de Pareto da Área Fiscal
const PARETO_RULES_FISCAL: Record<string, Array<{
  pattern: RegExp;
  classe: 'A' | 'B' | 'C';
  incidencia: number;
  foco: 'Teoria' | 'Lei Seca' | 'Questões';
  artigosPadrao?: string;
}>> = {
  'TI': [
    { pattern: /banco de dados|sql|sgbd|modelagem relacional|data warehouse|etl|nosql|postgre|oracle/i, classe: 'A', incidencia: 34.0, foco: 'Teoria' },
    { pattern: /linguagen.*programa|python|java|javascript|l[oó]gica de programa|desenvolvimento/i, classe: 'A', incidencia: 22.0, foco: 'Questões' },
    { pattern: /itil|cobit|governan[çc]a|gest[ãa]o de ti|pmbok/i, classe: 'B', incidencia: 15.0, foco: 'Teoria' },
    { pattern: /seguran[çc]a da informa|criptografia|iso 2700|malware|firewall|lgpd/i, classe: 'B', incidencia: 13.0, foco: 'Teoria' },
    { pattern: /redes|protocolo|tcp\/ip|nuvem|cloud|devops|computa[çc][ãa]o em nuvem/i, classe: 'C', incidencia: 8.0, foco: 'Teoria' },
  ],
  'Contabilidade': [
    { pattern: /ativo|ativo n[ãa]o circulante|ativo circulante|deprecia|imobilizado|intang[íi]vel/i, classe: 'A', incidencia: 22.5, foco: 'Teoria' },
    { pattern: /demonstra[çc][õo]es cont[áa]beis|balan[çc]o patrimonial|dre|dfc|dmpl|dva|notas explicativas/i, classe: 'A', incidencia: 20.2, foco: 'Questões' },
    { pattern: /estoque|peps|ueps|custo m[ée]dio|invent[áa]rio/i, classe: 'B', incidencia: 14.0, foco: 'Questões' },
    { pattern: /contabilidade b[áa]sica|conceito|objetivo|fato cont[áa]bil|lan[çc]amento|partidas dobradas/i, classe: 'B', incidencia: 12.9, foco: 'Teoria' },
    { pattern: /cpc|pronunciamento|cpc 00|cpc 16|cpc 27|cpc 01|cpc 25|ajuste a valor presente/i, classe: 'C', incidencia: 9.0, foco: 'Teoria' },
    { pattern: /an[áa]lise das demonstra|an[áa]lise de balan[çc]o|índice de liquidez/i, classe: 'C', incidencia: 6.0, foco: 'Questões' },
  ],
  'Direito Constitucional': [
    { pattern: /direitos e garantias fundamentais|direitos individuais|coletivos|sociais|nacionalidade|direitos pol[íi]ticos|rem[ée]dios constitucionais/i, classe: 'A', incidencia: 24.8, foco: 'Lei Seca', artigosPadrao: 'Arts. 5º a 17 da CF/88' },
    { pattern: /organiza[çc][ãa]o dos poderes|poder legislativo|poder executivo|poder judici[áa]rio|fun[çc][õo]es essenciais/i, classe: 'B', incidencia: 14.0, foco: 'Lei Seca', artigosPadrao: 'Arts. 44 a 135 da CF/88' },
    { pattern: /organiza[çc][ãa]o do estado|uni[ãa]o|estados|munic[íi]pios|distrito federal|reparti[çc][ãa]o de compet[êe]ncias/i, classe: 'B', incidencia: 13.2, foco: 'Lei Seca', artigosPadrao: 'Arts. 18 a 43 da CF/88' },
    { pattern: /tributa[çc][ãa]o e or[çc]amento|sistema tribut[áa]rio nacional|finan[çc]as p[úu]blicas|or[çc]amento p[úu]blico/i, classe: 'B', incidencia: 11.6, foco: 'Lei Seca', artigosPadrao: 'Arts. 145 a 169 da CF/88' },
    { pattern: /controle de constitucionalidade|adi|adc|ado|adpf|difuso|concentrado/i, classe: 'C', incidencia: 9.3, foco: 'Teoria', artigosPadrao: 'Arts. 102 e 103 da CF/88' },
    { pattern: /ordem econ[ôo]mica|defesa do estado|seguran[çc]a p[úu]blica/i, classe: 'C', incidencia: 5.0, foco: 'Lei Seca', artigosPadrao: 'Arts. 136 a 144, 170 a 192 da CF/88' },
  ],
  'Direito Tributário': [
    { pattern: /cr[ée]dito tribut[áa]rio|lan[çc]amento|suspens[ãa]o|extin[çc][ãa]o|exclus[ãa]o|prescri[çc][ãa]o|decad[êe]ncia|garantias/i, classe: 'A', incidencia: 19.1, foco: 'Lei Seca', artigosPadrao: 'Arts. 139 a 193 do CTN' },
    { pattern: /limita[çc][õo]es constitucionais|princ[íi]pios tribut[áa]rios|imunidades tribut[áa]rias/i, classe: 'B', incidencia: 13.7, foco: 'Lei Seca', artigosPadrao: 'Arts. 150 a 152 da CF/88' },
    { pattern: /obriga[çc][ãa]o tribut[áa]ria|fato gerador|sujeito ativo|sujeito passivo|responsabilidade tribut[áa]ria|solidariedade/i, classe: 'B', incidencia: 13.1, foco: 'Lei Seca', artigosPadrao: 'Arts. 113 a 138 do CTN' },
    { pattern: /legisla[çc][ãa]o tribut[áa]ria|fontes|vig[êe]ncia|aplica[çc][ãa]o|interpreta[çc][ãa]o|integra[çc][ãa]o/i, classe: 'B', incidencia: 11.5, foco: 'Lei Seca', artigosPadrao: 'Arts. 96 a 112 do CTN' },
    { pattern: /impostos em esp[ée]cie|ir|ipi|icms|iss|itcmd|iptu|ipva|itbi/i, classe: 'B', incidencia: 10.4, foco: 'Lei Seca', artigosPadrao: 'CF/88 e Leis Complementares' },
    { pattern: /administra[çc][ãa]o tribut[áa]ria|fiscaliza[çc][ãa]o|d[íi]vida ativa|certid[õo]es/i, classe: 'C', incidencia: 6.0, foco: 'Lei Seca', artigosPadrao: 'Arts. 194 a 208 do CTN' },
  ],
  'Português': [
    { pattern: /interpreta[çc][ãa]o de texto|compreens[ãa]o|tipologia textual|g[êe]neros textuais/i, classe: 'A', incidencia: 29.3, foco: 'Questões' },
    { pattern: /morfologia|classes de palavras|substantivo|adjetivo|verbo|conjun[çc][ãa]o|pronomes|coloca[çc][ãa]o pronominal/i, classe: 'B', incidencia: 10.4, foco: 'Questões' },
    { pattern: /concord[âa]ncia|concord[âa]ncia verbal|concord[âa]ncia nominal/i, classe: 'C', incidencia: 7.2, foco: 'Questões' },
    { pattern: /coer[êe]ncia e coes[ãa]o|conectivos|coes[ãa]o referencial|sequencial/i, classe: 'C', incidencia: 6.4, foco: 'Questões' },
    { pattern: /reescrit[ura]|par[áa]frase|corre[çc][ãa]o gramatical|pontua[çc][ãa]o/i, classe: 'C', incidencia: 6.0, foco: 'Questões' },
    { pattern: /sintaxe|reg[êe]ncia|crase|termos da ora[çc][ãa]o/i, classe: 'C', incidencia: 5.5, foco: 'Questões' },
  ],
  'Matemática Financeira/Estatística': [
    { pattern: /juros simples|juros compostos|taxa nominal|taxa efetiva|desconto|equival[êe]ncia de capitais|anuidade|rendas uniformes/i, classe: 'A', incidencia: 35.5, foco: 'Questões' },
    { pattern: /amostragem|medidas descritivas|m[ée]dia|mediana|moda|vari[âa]ncia|desvio padr[ãa]o|coeficiente de varia[çc][ãa]o/i, classe: 'A', incidencia: 22.0, foco: 'Questões' },
    { pattern: /probabilidade|distribui[çc][ãa]o normal|distribui[çc][ãa]o binomial|poisson/i, classe: 'B', incidencia: 16.0, foco: 'Questões' },
    { pattern: /sistema de amortiza[çc][ãa]o|tabela price|sac|sistema franc[êe]s/i, classe: 'B', incidencia: 12.0, foco: 'Questões' },
    { pattern: /infer[êe]ncia estat[íi]stica|intervalo de confian[çc]a|teste de hip[óo]tese|regress[ãa]o linear/i, classe: 'C', incidencia: 8.5, foco: 'Teoria' },
  ],
  'Direito Administrativo': [
    { pattern: /licita[çc][õo]es|contratos|lei 14\.133|lei 8\.666|inexigibilidade|dispensa|modalidades/i, classe: 'A', incidencia: 15.4, foco: 'Lei Seca', artigosPadrao: 'Lei nº 14.133/2021' },
    { pattern: /organiza[çc][ãa]o administrativa|administra[çc][ãa]o direta|indireta|autarquias|funda[çc][õo]es|empresas p[úu]blicas|sem/i, classe: 'B', incidencia: 11.0, foco: 'Teoria' },
    { pattern: /agentes p[úu]blicos|servidores|regime jur[íi]dico|lei 8\.112|cargo|emprego|fun[çc][ãa]o/i, classe: 'B', incidencia: 11.0, foco: 'Lei Seca', artigosPadrao: 'Arts. 37 a 41 da CF/88 e Lei 8.112' },
    { pattern: /servi[çc]os p[úu]blicos|concess[ãa]o|permiss[ãa]o|autoriza[çc][ãa]o|lei 8\.987/i, classe: 'C', incidencia: 7.4, foco: 'Lei Seca', artigosPadrao: 'Lei nº 8.987/1995' },
    { pattern: /atos administrativos|requisitos|atributos|convalida[çc][ãa]o|revoga[çc][ãa]o|anula[çc][ãa]o/i, classe: 'C', incidencia: 6.6, foco: 'Teoria' },
    { pattern: /poderes da administra|poder de pol[íi]cia|disciplinar|regulamentar|hier[áa]rquico/i, classe: 'C', incidencia: 6.0, foco: 'Teoria' },
    { pattern: /responsabilidade civil do estado|improbidade administrativa|lei 8\.429/i, classe: 'C', incidencia: 5.5, foco: 'Lei Seca', artigosPadrao: 'Art. 37, §6º da CF/88 e Lei 8.429' },
  ],
};

// Mapeia sinônimos de nomes de disciplinas para chaves canônicas
function normalizarNomeDisciplina(nome: string): string {
  const n = nome.trim().toLowerCase();
  if (n.includes('tecnologia da informa') || n.includes('ti') || n.includes('inform[áa]tica') || n.includes('ciência de dados')) return 'TI';
  if (n.includes('contabilidade')) return 'Contabilidade';
  if (n.includes('constitucional')) return 'Direito Constitucional';
  if (n.includes('tribut[áa]rio')) return 'Direito Tributário';
  if (n.includes('portugu') || n.includes('l[íi]ngua portuguesa')) return 'Português';
  if (n.includes('financeira') || n.includes('estat[íi]stica') || n.includes('exatas') || n.includes('matem[áa]tica')) return 'Matemática Financeira/Estatística';
  if (n.includes('administrativo')) return 'Direito Administrativo';
  return nome.trim();
}

/**
 * Classifica um tópico com base na Matriz de Pareto da Área Fiscal
 */
export function classificarParetoTopico(disciplina: string, textoTopico: string): {
  classe: 'A' | 'B' | 'C';
  incidencia: number;
  foco: 'Teoria' | 'Lei Seca' | 'Questões';
  artigosSugeridos: string;
} {
  const canonica = normalizarNomeDisciplina(disciplina);
  const regras = PARETO_RULES_FISCAL[canonica];

  // Extração automática de menções a artigos no texto
  const matchArts = textoTopico.match(/(arts?\.?\s*[\d\w\sºª,eao\-\.]+|lei\s+n?º?\s*[\d\.]+\/\d{2,4}|cpc\s+\d+|ctn)/i);
  let artigosDetectados = matchArts ? matchArts[0].trim() : '';

  if (regras && regras.length > 0) {
    for (const regra of regras) {
      if (regra.pattern.test(textoTopico)) {
        return {
          classe: regra.classe,
          incidencia: regra.incidencia,
          foco: regra.foco,
          artigosSugeridos: artigosDetectados || regra.artigosPadrao || '',
        };
      }
    }
  }

  // Regra fallback caso não encontre padrão específico
  const ehDireito = canonica.toLowerCase().includes('direito');
  const ehExatas = canonica.toLowerCase().includes('estat') || canonica.toLowerCase().includes('matem');
  return {
    classe: 'C',
    incidencia: 5.0,
    foco: ehDireito ? 'Lei Seca' : (ehExatas ? 'Questões' : 'Teoria'),
    artigosSugeridos: artigosDetectados || (ehDireito ? 'Legislação correlata' : ''),
  };
}

/**
 * Parser de texto bruto de edital estruturando em Disciplina, Tópicos e Subtópicos
 */
export function parsearEditalBruto(
  rawText: string,
  disciplinasConfig: DisciplinaConfig[]
): ParetoTopicResult[] {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results: ParetoTopicResult[] = [];
  let currentDisciplina = disciplinasConfig[0]?.nome || 'Geral';
  let seqId = 1;

  // Mapa de pesos relativos por disciplina
  const totalPontos = disciplinasConfig.reduce((acc, d) => acc + (d.questoes * d.peso), 0) || 1;
  const mapaPesosRelativos: Record<string, number> = {};
  disciplinasConfig.forEach(d => {
    mapaPesosRelativos[d.nome.toLowerCase()] = Math.round(((d.questoes * d.peso) / totalPontos) * 1000) / 10;
  });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detecta se a linha é um cabeçalho de disciplina
    const cleanHeader = line
      .replace(/^(\s*disciplina\s*[:\-–—]\s*|\s*mat[ée]ria\s*[:\-–—]\s*)/i, '')
      .replace(/^[#*\-–—0-9\.\s:]+/, '')
      .trim()
      .toLowerCase();

    const matchedDisc = disciplinasConfig.find(d => {
      const dLower = d.nome.toLowerCase();
      const lineLower = line.toLowerCase();
      return cleanHeader === dLower ||
             cleanHeader.startsWith(dLower + ':') ||
             cleanHeader.startsWith(dLower + ' -') ||
             cleanHeader.startsWith(dLower + ' —') ||
             lineLower.includes('disciplina: ' + dLower) ||
             lineLower.includes('disciplina:' + dLower) ||
             lineLower.includes(dLower + ':');
    });

    if (matchedDisc) {
      currentDisciplina = matchedDisc.nome;
      continue;
    }

    // Ignora linhas que parecem títulos gerais ou avisos
    if (/^(conte[úu]do program[áa]tico|conhecimentos gerais|conhecimentos espec[íi]ficos|anexo)/i.test(line)) {
      continue;
    }

    // Se a linha tem vários tópicos separados por ponto e vírgula ou números (ex: "1. Tópico A. 1.1 Subtópico. 2. Tópico B.")
    const itens = segmentarLinhaEmTopicos(line);

    for (const item of itens) {
      if (!item || item.length < 3) continue;

      const { topico, subtopico } = separarTopicoESubtopico(item);
      const classificacao = classificarParetoTopico(currentDisciplina, `${topico} ${subtopico}`);

      const discKey = currentDisciplina.toLowerCase();
      const pesoRelativo = mapaPesosRelativos[discKey] ?? (
        disciplinasConfig.find(d => normalizarNomeDisciplina(d.nome) === normalizarNomeDisciplina(currentDisciplina))
          ? (disciplinasConfig.find(d => normalizarNomeDisciplina(d.nome) === normalizarNomeDisciplina(currentDisciplina))!.questoes *
             disciplinasConfig.find(d => normalizarNomeDisciplina(d.nome) === normalizarNomeDisciplina(currentDisciplina))!.peso) / totalPontos * 100
          : 5.0
      );

      const idFormatado = `TOP-${String(seqId++).padStart(3, '0')}`;
      const subtopicoCompleto = subtopico 
        ? `${subtopico}${classificacao.artigosSugeridos ? ` (${classificacao.artigosSugeridos})` : ''}`
        : classificacao.artigosSugeridos;

      results.push({
        id: idFormatado,
        disciplina: currentDisciplina,
        topicoPrincipal: topico,
        subtopicoArtigos: subtopicoCompleto || '—',
        classePareto: classificacao.classe,
        incidenciaEstimada: classificacao.incidencia,
        pesoRelativoProva: Math.round(pesoRelativo * 10) / 10,
        focoEstrategico: classificacao.foco,
      });
    }
  }

  return results;
}

/**
 * Segmenta linha por itens numerados ou delimitadores
 */
function segmentarLinhaEmTopicos(line: string): string[] {
  // Se contiver numeração explícita estilo "1 ... 2 ... 3 ..."
  if (/(?:^|\s)\d+\s*[-.]\s+[A-Za-zÀ-ÿ]/.test(line)) {
    const parts = line.split(/(?=(?:^|\s)\d+\s*[-.]\s+[A-Za-zÀ-ÿ])/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }

  // Se for separado por ponto e vírgula
  if (line.includes(';') && line.length > 40) {
    return line.split(';').map(p => p.trim()).filter(Boolean);
  }

  // Se for uma linha única
  return [line];
}

/**
 * Separa Tópico Principal de Subtópico / Artigos correlatos
 */
function separarTopicoESubtopico(texto: string): { topico: string; subtopico: string } {
  // Remove numeração inicial (ex: "1.", "1.1.", "I - ")
  const limpo = texto.replace(/^(\d+[\.\d]*|[A-Z]\s*[-–]|I{1,3}\s*[-–])\s*/i, '').trim();

  // Divide por dois pontos ou travessão se houver
  const divisores = [':', ' - ', ' — '];
  for (const div of divisores) {
    if (limpo.includes(div)) {
      const idx = limpo.indexOf(div);
      return {
        topico: limpo.substring(0, idx).trim(),
        subtopico: limpo.substring(idx + div.length).trim(),
      };
    }
  }

  // Se tiver parênteses com especificações
  const parenMatch = limpo.match(/^([^(]+)\s*\(([^)]+)\)$/);
  if (parenMatch) {
    return {
      topico: parenMatch[1].trim(),
      subtopico: parenMatch[2].trim(),
    };
  }

  return { topico: limpo, subtopico: '' };
}

/**
 * Executa o Diagnóstico do Quarteto de Alocação de Tempo
 * Quarteto: Volume, Incidência/Peso, Complexidade e Domínio Inicial
 */
export function calcularQuartetoAlocacao(
  disciplinasConfig: DisciplinaConfig[],
  topicos: ParetoTopicResult[]
): QuartetoAlocacaoItem[] {
  const totalPontos = disciplinasConfig.reduce((acc, d) => acc + (d.questoes * d.peso), 0) || 1;

  // 1. Contagem de volume por disciplina
  const volumePorDisciplina: Record<string, number> = {};
  topicos.forEach(t => {
    volumePorDisciplina[t.disciplina] = (volumePorDisciplina[t.disciplina] || 0) + 1;
  });

  // 2. Cálculo dos scores intermediários
  const itensCalculados = disciplinasConfig.map(d => {
    const pontos = d.questoes * d.peso;
    const pesoRelativoProva = (pontos / totalPontos) * 100;
    const volume = volumePorDisciplina[d.nome] || 1;

    // Fator de Pareto da disciplina baseado nos tópicos Classe A
    const topicosDaDisc = topicos.filter(t => t.disciplina === d.nome);
    const qtdClasseA = topicosDaDisc.filter(t => t.classePareto === 'A').length;
    const paretoMultiplier = 1 + (qtdClasseA / (topicosDaDisc.length || 1)) * 0.4;

    // Fator de Domínio Inicial (quanto menor o domínio, mais tempo necessita): escala de 0.6x (domínio 100%) a 1.6x (domínio 0%)
    const dominioFator = 1.6 - (Math.min(100, Math.max(0, d.dominioInicial)) / 100);

    // Score = Incidência/Pontos * Complexidade * Fator Domínio * Pareto * log(Volume + 1)
    const scoreFinal = pontos * d.complexidade * dominioFator * paretoMultiplier * Math.log2(volume + 2);

    return {
      disciplina: d.nome,
      pontos,
      pesoRelativoProva: Math.round(pesoRelativoProva * 10) / 10,
      volumeTopicos: volume,
      complexidade: d.complexidade,
      dominioInicial: d.dominioInicial,
      scoreFinal,
      tempoRecomendadoPercent: 0, // calculado abaixo
    };
  });

  // 3. Normalização para 100%
  const somaScores = itensCalculados.reduce((acc, it) => acc + it.scoreFinal, 0) || 1;

  return itensCalculados.map(it => {
    const tempoPercent = Math.round((it.scoreFinal / somaScores) * 1000) / 10;
    // Estimativa baseada em semana típica de 25h líquidas
    const horasSugeridas = Math.round((tempoPercent / 100) * 25 * 10) / 10;
    return {
      ...it,
      tempoRecomendadoPercent: tempoPercent,
      horasSugeridasSemanais: horasSugeridas,
    };
  });
}

/**
 * Pipeline Completo do Motor de Ingestão e Matriz de Pareto
 */
export function executarMotorParetoEdital(
  rawText: string,
  disciplinasConfig: DisciplinaConfig[]
): MotorParetoOutput {
  const totalQuestoes = disciplinasConfig.reduce((acc, d) => acc + d.questoes, 0);
  const totalPontos = disciplinasConfig.reduce((acc, d) => acc + (d.questoes * d.peso), 0);

  const disciplinasCalculadas = disciplinasConfig.map(d => ({
    nome: d.nome,
    questoes: d.questoes,
    peso: d.peso,
    pontos: d.questoes * d.peso,
    pesoRelativo: totalPontos > 0 ? Math.round(((d.questoes * d.peso) / totalPontos) * 1000) / 10 : 0,
  }));

  const topicos = parsearEditalBruto(rawText, disciplinasConfig);
  const quartetoAlocacao = calcularQuartetoAlocacao(disciplinasConfig, topicos);

  const qtdClasseA = topicos.filter(t => t.classePareto === 'A').length;
  const coberturaClasseA = topicos.length > 0 ? Math.round((qtdClasseA / topicos.length) * 100) : 0;

  return {
    disciplinasCalculadas,
    totalPontosProva: totalPontos,
    totalQuestoes,
    topicos,
    quartetoAlocacao,
    coberturaClasseA,
  };
}

/**
 * Gera a tabela estruturada em formato Markdown estrito conforme solicitado
 */
export function exportarTabelaMarkdown(topicos: ParetoTopicResult[]): string {
  let md = '| ID | Disciplina | Tópico | Subtópico / Artigos Correlatos | Classe Pareto (A/B/C) | Peso Relativo Prova (%) | Foco Estratégico (Teoria / Lei Seca / Questões) |\n';
  md += '| :--- | :--- | :--- | :--- | :---: | :---: | :--- |\n';

  topicos.forEach(t => {
    md += `| ${t.id} | ${t.disciplina} | ${t.topicoPrincipal} | ${t.subtopicoArtigos} | **Classe ${t.classePareto}** | ${t.pesoRelativoProva.toFixed(1)}% | ${t.focoEstrategico} |\n`;
  });

  return md;
}

/**
 * Exemplo padrão pré-carregado: Auditor Fiscal (Quadro de Provas + Conteúdo Programático)
 */
export const TEMPLATE_DEFAULT_EDITAL_FISCAL = {
  disciplinas: [
    { id: '1', nome: 'TI', questoes: 20, peso: 2.0, complexidade: 1.35, dominioInicial: 20 },
    { id: '2', nome: 'Contabilidade', questoes: 20, peso: 2.0, complexidade: 1.30, dominioInicial: 35 },
    { id: '3', nome: 'Direito Tributário', questoes: 20, peso: 2.0, complexidade: 1.25, dominioInicial: 50 },
    { id: '4', nome: 'Direito Constitucional', questoes: 15, peso: 1.5, complexidade: 1.15, dominioInicial: 60 },
    { id: '5', nome: 'Direito Administrativo', questoes: 15, peso: 1.5, complexidade: 1.15, dominioInicial: 55 },
    { id: '6', nome: 'Português', questoes: 15, peso: 1.0, complexidade: 1.10, dominioInicial: 70 },
    { id: '7', nome: 'Matemática Financeira/Estatística', questoes: 15, peso: 1.5, complexidade: 1.25, dominioInicial: 30 },
  ],
  rawText: `TI:
1. Banco de Dados: Modelagem relacional, modelo entidade-relacionamento, SQL (DML, DDL), Data Warehouse e ETL.
2. Linguagens de Programação: Estruturas de controle, algoritmos, orientação a objetos em Python e Java.
3. Gestão de TI: Governança, frameworks ITIL v4 e COBIT 2019.
4. Segurança da Informação: Criptografia, ISO 27001, controle de acesso, firewall e LGPD.
5. Redes e Infraestrutura: Protocolos TCP/IP, serviços de rede e computação em nuvem (Cloud/DevOps).

Contabilidade:
1. Ativo: Ativo Circulante, Ativo Não Circulante, Imobilizado e Intangível com testes de recuperabilidade.
2. Demonstrações Contábeis: Balanço Patrimonial, DRE, Demonstração do Fluxo de Caixa (DFC) e DVA.
3. Estoques: Métodos de avaliação PEPS, Custo Médio e inventário permanente.
4. Contabilidade Básica: Fatos contábeis, lançamentos, partidas dobradas e escrituração contábil.
5. Pronunciamentos Técnicos (CPCs): CPC 00 (Estrutura Conceitual), CPC 16 (Estoques) e CPC 27 (Imobilizado).

Direito Constitucional:
1. Direitos e Garantias Fundamentais: Direitos individuais e coletivos (arts. 5º a 17 da CF/88) e remédios constitucionais.
2. Organização dos Poderes: Poder Legislativo, Executivo e Judiciário (arts. 44 a 135 da CF/88).
3. Organização do Estado: Competências privativas, comuns e concorrentes da União, Estados e Municípios (arts. 18 a 43 da CF/88).
4. Sistema Tributário Nacional e Orçamento: Princípios gerais e finanças públicas (arts. 145 a 169 da CF/88).
5. Controle de Constitucionalidade: Controle difuso e concentrado (ADI, ADC, ADPF).

Direito Tributário:
1. Crédito Tributário: Lançamento, hipóteses de suspensão, extinção e exclusão do crédito tributário (arts. 139 a 193 do CTN).
2. Limitações Constitucionais ao Poder de Tributar: Princípios da legalidade, anterioridade e imunidades tributárias.
3. Obrigação Tributária: Fato gerador, sujeito passivo, solidariedade e responsabilidade tributária (arts. 113 a 138 do CTN).
4. Legislação Tributária: Fontes, vigência, aplicação, interpretação e integração (arts. 96 a 112 do CTN).
5. Impostos em Espécie: Impostos da União, dos Estados (ICMS, IPVA, ITCMD) e dos Municípios (ISS, IPTU, ITBI).

Português:
1. Interpretação de Texto: Compreensão, inferência, tipologia textual e coesão.
2. Morfologia: Emprego e flexão das classes de palavras e colocação pronominal.
3. Concordância: Concordância verbal e nominal.
4. Coerência e Coesão: Conectivos, nexos oracionais e referenciação.
5. Reescrita de Frases: Paráfrase, correção gramatical e pontuação.

Matemática Financeira/Estatística:
1. Juros Simples e Compostos: Taxas proporcionais, equivalentes, taxas nominais e efetivas.
2. Amostragem e Medidas Descritivas: Média, mediana, moda, desvio padrão e variância.
3. Sistemas de Amortização: Tabela Price e Sistema de Amortização Constante (SAC).
4. Probabilidade e Distribuição Normal: Variáveis aleatórias, distribuição binomial e normal.

Direito Administrativo:
1. Licitações e Contratos: Modalidades, critérios de julgamento, dispensa e inexigibilidade (Lei nº 14.133/2021).
2. Organização Administrativa: Administração direta e indireta, autarquias, fundações e empresas estatais.
3. Agentes Públicos: Regime jurídico dos servidores públicos civis (Lei nº 8.112/1990 e arts. 37 a 41 da CF/88).
4. Serviços Públicos: Regime de concessão e permissão de serviços públicos (Lei nº 8.987/1995).
5. Atos Administrativos: Elementos, atributos, revogação e anulação.`,
};
