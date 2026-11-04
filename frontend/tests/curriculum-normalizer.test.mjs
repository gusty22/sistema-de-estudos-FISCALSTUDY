import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCurriculum, cleanJsonString } from '../src/components/onboarding/curriculumNormalizer.ts';

test('curriculumNormalizer: cleanJsonString remove cercas markdown', () => {
  const withFence = '```json\n{"materias": []}\n```';
  assert.equal(cleanJsonString(withFence), '{"materias": []}');

  const withFenceNoLang = '```\n{"materias": []}\n```';
  assert.equal(cleanJsonString(withFenceNoLang), '{"materias": []}');

  const plain = '{"materias": []}';
  assert.equal(cleanJsonString(plain), '{"materias": []}');
});

test('curriculumNormalizer: normaliza com sucesso o JSON estruturado do Gemini fornecido pelo usuario', () => {
  const userJson = {
    materias: [
      {
        id: 'mat_001',
        nome: 'Língua Portuguesa (Português)',
        topicos: [
          { id: 'top_001', nome: 'Compreensão e interpretação de textos', subtopicos: [] },
          { id: 'top_002', nome: 'Gêneros e tipos de textos', subtopicos: [] },
          {
            id: 'top_003',
            nome: 'Variação linguística',
            subtopicos: [{ id: 'sub_001', nome: 'Diversidade de usos da língua' }]
          }
        ]
      },
      {
        id: 'mat_002',
        nome: 'Raciocínio Lógico',
        topicos: [
          {
            id: 'top_019',
            nome: 'Noções básicas da lógica matemática',
            subtopicos: [
              { id: 'sub_015', nome: 'Proposições' },
              { id: 'sub_016', nome: 'Conectivos' }
            ]
          }
        ]
      }
    ]
  };

  const res = normalizeCurriculum(userJson);
  assert.equal(res.success, true);
  if (!res.success) return;

  assert.equal(res.stats.disciplinesCount, 2);
  assert.equal(res.stats.topicsCount, 4);
  assert.equal(res.stats.subtopicsCount, 3);
  assert.equal(res.nodes.length, 2);

  const mat1 = res.nodes[0];
  assert.equal(mat1.id, 'mat_001');
  assert.equal(mat1.title, 'Língua Portuguesa (Português)');
  assert.equal(mat1.level, 'DISCIPLINA');
  assert.equal(mat1.children?.length, 3);

  const top3 = mat1.children?.[2];
  assert.equal(top3?.id, 'top_003');
  assert.equal(top3?.title, 'Variação linguística');
  assert.equal(top3?.level, 'TOPICO');
  assert.equal(top3?.parentId, 'mat_001');
  assert.equal(top3?.children?.length, 1);

  const sub1 = top3?.children?.[0];
  assert.equal(sub1?.id, 'sub_001');
  assert.equal(sub1?.title, 'Diversidade de usos da língua');
  assert.equal(sub1?.level, 'SUBTOPICO');
  assert.equal(sub1?.parentId, 'top_003');
});

test('curriculumNormalizer: aceita string JSON diretamente com cercas markdown', () => {
  const jsonStr = `\`\`\`json
{
  "materias": [
    {
      "nome": "Direito Constitucional",
      "topicos": [
        { "nome": "Direitos Fundamentais" }
      ]
    }
  ]
}
\`\`\``;

  const res = normalizeCurriculum(jsonStr);
  assert.equal(res.success, true);
  if (!res.success) return;

  assert.equal(res.stats.disciplinesCount, 1);
  assert.equal(res.stats.topicsCount, 1);
  assert.equal(res.nodes[0].title, 'Direito Constitucional');
  assert.equal(res.nodes[0].children?.[0].title, 'Direitos Fundamentais');
});

test('curriculumNormalizer: preserva e sanitiza formato nativo CurriculumNode[]', () => {
  const nativeNodes = [
    {
      id: 'node_d1',
      title: 'Direito Tributário',
      level: 'DISCIPLINA',
      weight: 3,
      prerequisites: [],
      active: true,
      children: [
        {
          id: 'node_t1',
          parentId: 'node_d1',
          title: 'Sistema Tributário Nacional',
          level: 'TOPICO',
          weight: 3,
          prerequisites: [],
          active: true
        }
      ]
    }
  ];

  const res = normalizeCurriculum(nativeNodes);
  assert.equal(res.success, true);
  if (!res.success) return;

  assert.equal(res.stats.disciplinesCount, 1);
  assert.equal(res.stats.topicsCount, 1);
  assert.equal(res.nodes[0].title, 'Direito Tributário');
  assert.equal(res.nodes[0].children?.[0].title, 'Sistema Tributário Nacional');
});

test('curriculumNormalizer: normaliza as 10 materias completas do Gemini', () => {
  const fullJson = {
    materias: [
      { id: "mat_001", nome: "Língua Portuguesa (Português)", topicos: [{ id: "top_001", nome: "Interpretação", subtopicos: [] }] },
      { id: "mat_002", nome: "Raciocínio Lógico", topicos: [{ id: "top_019", nome: "Lógica", subtopicos: [] }] },
      { id: "mat_003", nome: "Matemática", topicos: [{ id: "top_023", nome: "Conjuntos", subtopicos: [] }] },
      { id: "mat_004", nome: "Informática", topicos: [{ id: "top_031", nome: "Backup", subtopicos: [] }] },
      { id: "mat_005", nome: "Atualidades e Conhecimentos Gerais", topicos: [{ id: "top_042", nome: "Cultura", subtopicos: [] }] },
      { id: "mat_006", nome: "Direito Constitucional (CF/1988 e Doutrina)", topicos: [{ id: "top_049", nome: "CF", subtopicos: [] }] },
      { id: "mat_007", nome: "Direito Administrativo (Doutrina e Leis Federais)", topicos: [{ id: "top_050", nome: "Poderes", subtopicos: [] }] },
      { id: "mat_008", nome: "Direito Administrativo Municipal", topicos: [{ id: "top_053", nome: "Lei Orgânica", subtopicos: [] }] },
      { id: "mat_009", nome: "Auditoria Privada", topicos: [{ id: "top_058", nome: "Aspectos", subtopicos: [] }] },
      { id: "mat_010", nome: "Estatística", topicos: [{ id: "top_073", nome: "Amostragem", subtopicos: [] }] }
    ]
  };

  const res = normalizeCurriculum(fullJson);
  assert.equal(res.success, true);
  if (!res.success) return;
  assert.equal(res.stats.disciplinesCount, 10);
  assert.equal(res.nodes.length, 10);
  assert.equal(res.nodes[0].title, "Língua Portuguesa (Português)");
  assert.equal(res.nodes[9].title, "Estatística");
});

test('curriculumNormalizer: retorna erro amigável para JSON inválido ou vazio', () => {
  assert.equal(normalizeCurriculum(null).success, false);
  assert.equal(normalizeCurriculum('').success, false);
  assert.equal(normalizeCurriculum('{ invalid json').success, false);
  assert.equal(normalizeCurriculum({}).success, false);
});
