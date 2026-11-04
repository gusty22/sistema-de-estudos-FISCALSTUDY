import type { CurriculumNode } from './AssistenteObjetivoWizard';

export interface CurriculumStats {
  disciplinesCount: number;
  topicsCount: number;
  subtopicsCount: number;
  totalNodes: number;
}

export type NormalizeResult =
  | { success: true; nodes: CurriculumNode[]; stats: CurriculumStats }
  | { success: false; error: string };

/**
 * Remove blocos de formatação markdown (```json ... ```) caso o usuário
 * tenha colado a resposta do Gemini ou ChatGPT diretamente.
 */
export function cleanJsonString(input: string): string {
  let clean = input.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return clean;
}

/**
 * Normaliza qualquer estrutura de currículo para o formato canônico CurriculumNode[].
 * Suporta:
 * 1. Formato Gemini / LLM: { "materias": [ { "id": "...", "nome": "...", "topicos": [...] } ] }
 * 2. Formato nativo: CurriculumNode[]
 * 3. Lista linear de matérias: [ { "nome": "...", "topicos": [...] } ]
 * 4. Dicionário chave-valor: { "Disciplina": ["Tópico 1", "Tópico 2"] }
 * 5. Lista tabular / verticalizada: [ { "disciplina": "...", "topico": "..." } ]
 */
export function normalizeCurriculum(input: unknown): NormalizeResult {
  if (input === null || input === undefined) {
    return { success: false, error: 'Nenhum dado informado para importação.' };
  }

  let data = input;

  // Se for string, tenta fazer o parse JSON tratando possíveis cercas markdown
  if (typeof input === 'string') {
    const cleaned = cleanJsonString(input);
    if (!cleaned) {
      return { success: false, error: 'O conteúdo JSON fornecido está vazio.' };
    }
    try {
      data = JSON.parse(cleaned);
    } catch (err: any) {
      return {
        success: false,
        error: `JSON inválido ou corrompido: ${err?.message || 'erro de sintaxe'}. Verifique se o texto copiado está completo.`
      };
    }
  }

  if (typeof data !== 'object' || data === null) {
    return {
      success: false,
      error: 'Estrutura JSON incompatível. Esperava-se um objeto ou lista contendo matérias e tópicos.'
    };
  }

  // 1. Extração da lista de matérias
  let rawMaterias: any[] | null = null;

  if (Array.isArray(data)) {
    // Pode ser CurriculumNode[] já formatado ou lista de matérias
    rawMaterias = data;
  } else {
    // Objeto contendo uma propriedade com a lista de matérias/disciplinas
    const obj = data as Record<string, any>;
    const candidateKeys = [
      'materias',
      'disciplinas',
      'subjects',
      'conteudo',
      'conteudos',
      'edital',
      'topicos',
      'topics',
      'nodes',
      'items',
      'tree'
    ];

    for (const key of candidateKeys) {
      if (Array.isArray(obj[key])) {
        rawMaterias = obj[key];
        break;
      }
    }

    // Se nenhuma chave conhecida for array, verificar se o objeto é um mapa disciplina -> tópicos
    if (!rawMaterias) {
      const keys = Object.keys(obj);
      if (keys.length > 0 && keys.every(k => Array.isArray(obj[k]) || typeof obj[k] === 'object')) {
        rawMaterias = keys.map((key, idx) => ({
          id: `mat_${idx + 1}`,
          nome: key,
          topicos: Array.isArray(obj[key])
            ? obj[key].map((t: any, tIdx: number) =>
                typeof t === 'string' ? { id: `top_${idx + 1}_${tIdx + 1}`, nome: t } : t
              )
            : [obj[key]]
        }));
      }
    }
  }

  if (!rawMaterias || rawMaterias.length === 0) {
    return {
      success: false,
      error: 'Não foi possível encontrar a lista de matérias ou disciplinas no JSON. Certifique-se de incluir a chave "materias" ou uma lista de conteúdos.'
    };
  }

  // 2. Normalização para CurriculumNode[]
  const normalizedNodes: CurriculumNode[] = [];
  let stats: CurriculumStats = {
    disciplinesCount: 0,
    topicsCount: 0,
    subtopicsCount: 0,
    totalNodes: 0
  };

  // Verifica se já é CurriculumNode[] nativo (possui id, title/nome e level)
  const isNativeCurriculumNode = rawMaterias.some(
    item => item && typeof item === 'object' && ('level' in item || 'children' in item)
  );

  if (isNativeCurriculumNode) {
    function sanitizeNativeNode(node: any, parentId?: string, depth = 0): CurriculumNode | null {
      if (!node || typeof node !== 'object') return null;
      const title = String(node.title || node.nome || node.name || 'Sem título').trim();
      if (!title) return null;

      const id = String(node.id || `node_${depth}_${Math.random().toString(36).substring(2, 8)}`);
      let level = node.level;
      if (!['DISCIPLINA', 'UNIDADE', 'TOPICO', 'SUBTOPICO'].includes(level)) {
        level = depth === 0 ? 'DISCIPLINA' : depth === 1 ? 'TOPICO' : 'SUBTOPICO';
      }

      if (level === 'DISCIPLINA') stats.disciplinesCount++;
      else if (level === 'TOPICO') stats.topicsCount++;
      else if (level === 'SUBTOPICO') stats.subtopicsCount++;
      stats.totalNodes++;

      const rawChildren = node.children || node.topicos || node.subtopicos || [];
      const children: CurriculumNode[] = [];
      if (Array.isArray(rawChildren)) {
        for (const child of rawChildren) {
          const sanitizedChild = sanitizeNativeNode(child, id, depth + 1);
          if (sanitizedChild) children.push(sanitizedChild);
        }
      }

      return {
        id,
        parentId,
        title,
        level,
        description: node.description ? String(node.description) : undefined,
        sourceText: node.sourceText ? String(node.sourceText) : undefined,
        weight: typeof node.weight === 'number' ? node.weight : (typeof node.peso === 'number' ? node.peso : 2),
        prerequisites: Array.isArray(node.prerequisites) ? node.prerequisites.map(String) : [],
        active: node.active !== false,
        children: children.length > 0 ? children : undefined
      };
    }

    for (const item of rawMaterias) {
      const node = sanitizeNativeNode(item);
      if (node) normalizedNodes.push(node);
    }
  } else {
    // Formato hierárquico padrão (materias -> topicos -> subtopicos)
    for (let mIdx = 0; mIdx < rawMaterias.length; mIdx++) {
      const mat = rawMaterias[mIdx];
      if (!mat || typeof mat !== 'object') continue;

      const matTitle = String(mat.nome || mat.title || mat.name || mat.materia || `Disciplina ${mIdx + 1}`).trim();
      if (!matTitle) continue;

      const matId = String(mat.id || `mat_${mIdx + 1}`);
      stats.disciplinesCount++;
      stats.totalNodes++;

      const rawTopicos = mat.topicos || mat.topics || mat.conteudos || mat.children || [];
      const topicsChildren: CurriculumNode[] = [];

      if (Array.isArray(rawTopicos)) {
        for (let tIdx = 0; tIdx < rawTopicos.length; tIdx++) {
          const top = rawTopicos[tIdx];
          if (!top) continue;

          const topTitle = typeof top === 'string'
            ? top.trim()
            : String(top.nome || top.title || top.name || top.topico || `Tópico ${tIdx + 1}`).trim();

          if (!topTitle) continue;

          const topId = typeof top === 'object' && top.id ? String(top.id) : `${matId}_top_${tIdx + 1}`;
          stats.topicsCount++;
          stats.totalNodes++;

          const rawSubtopicos = typeof top === 'object' ? (top.subtopicos || top.subtopics || top.itens || top.children || []) : [];
          const subChildren: CurriculumNode[] = [];

          if (Array.isArray(rawSubtopicos)) {
            for (let sIdx = 0; sIdx < rawSubtopicos.length; sIdx++) {
              const sub = rawSubtopicos[sIdx];
              if (!sub) continue;

              const subTitle = typeof sub === 'string'
                ? sub.trim()
                : String(sub.nome || sub.title || sub.name || sub.subtopico || `Subtópico ${sIdx + 1}`).trim();

              if (!subTitle) continue;

              const subId = typeof sub === 'object' && sub.id ? String(sub.id) : `${topId}_sub_${sIdx + 1}`;
              stats.subtopicsCount++;
              stats.totalNodes++;

              subChildren.push({
                id: subId,
                parentId: topId,
                title: subTitle,
                level: 'SUBTOPICO',
                weight: typeof sub === 'object' && typeof sub.peso === 'number'
                  ? sub.peso
                  : (typeof sub === 'object' && typeof sub.weight === 'number' ? sub.weight : 2),
                prerequisites: typeof sub === 'object' && Array.isArray(sub.prerequisites) ? sub.prerequisites.map(String) : [],
                active: typeof sub === 'object' ? sub.active !== false : true
              });
            }
          }

          topicsChildren.push({
            id: topId,
            parentId: matId,
            title: topTitle,
            level: 'TOPICO',
            weight: typeof top === 'object' && typeof top.peso === 'number'
              ? top.peso
              : (typeof top === 'object' && typeof top.weight === 'number' ? top.weight : 2),
            prerequisites: typeof top === 'object' && Array.isArray(top.prerequisites) ? top.prerequisites.map(String) : [],
            active: typeof top === 'object' ? top.active !== false : true,
            children: subChildren.length > 0 ? subChildren : undefined
          });
        }
      }

      normalizedNodes.push({
        id: matId,
        title: matTitle,
        level: 'DISCIPLINA',
        weight: typeof mat.peso === 'number' ? mat.peso : (typeof mat.weight === 'number' ? mat.weight : 2),
        prerequisites: Array.isArray(mat.prerequisites) ? mat.prerequisites.map(String) : [],
        active: mat.active !== false,
        children: topicsChildren.length > 0 ? topicsChildren : undefined
      });
    }
  }

  if (normalizedNodes.length === 0) {
    return {
      success: false,
      error: 'Nenhuma matéria válida foi identificada na estrutura informada.'
    };
  }

  return {
    success: true,
    nodes: normalizedNodes,
    stats
  };
}
