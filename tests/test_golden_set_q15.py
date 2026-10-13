"""Teste de regressão documental estrito para o caso crítico da Questão 15 (IBGP 2023, Cargo 532).

Verifica:
1. Isolamento completo de colunas: cabeçalho 'NOÇÕES DE INFORMÁTICA' NÃO contamina a alternativa D.
2. Higienização de anotações e rabiscos de candidato: enunciado e alternativas sem ruído de caneta.
3. Separação limpa das 4 alternativas (A, B, C, D) mesmo em layout complexo.
4. Preservação literal da impressão da prova: '336' na opção C (sem correção arbitrária para 3.360).
5. Sinalização da divergência matemática (8!/3!2! = 3.360 vs 336 impresso) via flag e status NEEDS_REVIEW.
6. Pareamento seguro com o gabarito preliminar oficial (C).
7. Geração e vinculação da evidência visual da página 6.
"""
import os
import sys
import unittest

# Adiciona diretório ingestion ao path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ingestion")))

from src.pipeline.pipeline_runner import run_pipeline


class GoldenSetQ15RegressionTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.exam_pdf = os.path.abspath(os.path.join(
            os.path.dirname(__file__), "golden-set", "docs",
            "ibgp-2023-prefeitura-de-araguari-mg-tecnico-fiscal-da-receita-municipal-prova.pdf"
        ))
        cls.gabarito_pdf = os.path.abspath(os.path.join(
            os.path.dirname(__file__), "golden-set", "docs",
            "gabarito-preliminar-prova-objetiva-tarde-1.pdf"
        ))
        cls.output_dir = os.path.abspath(os.path.join(
            os.path.dirname(__file__), "..", "ingestion", "output", "test_regression_q15"
        ))
        cls.result = run_pipeline(
            exam_pdf_path=cls.exam_pdf,
            output_dir=cls.output_dir,
            answer_key_pdf_path=cls.gabarito_pdf,
            cargo_codigo="532",
            metadata={"banca": "IBGP", "ano": 2023, "cargo": "Técnico Fiscal"},
            render_evidence=True,
        )

    def test_total_questions_extracted(self):
        self.assertEqual(len(self.result["questions"]), 40)
        self.assertEqual(self.result["summary"]["total_questions"], 40)

    def test_question_15_structure_and_isolation(self):
        q15 = next((q for q in self.result["questions"] if q["numero_original"] == 15), None)
        self.assertIsNotNone(q15, "Questão 15 deve ser extraída")

        # 1. Enunciado limpo
        statement = q15["statement"]
        self.assertIn("ARAGUARI", statement)
        self.assertIn("anagramas", statement.lower())
        self.assertNotIn("NOÇÕES DE INFORMÁTICA", statement)
        self.assertNotIn("bc ;,", statement)
        self.assertNotIn("TiT", statement)

        # 2. Alternativas (exatamente 4)
        options = q15["options"]
        self.assertEqual(len(options), 4, "Questão 15 deve conter exatamente 4 alternativas")

        letters = [o["letter"] for o in options]
        self.assertEqual(letters, ["A", "B", "C", "D"], "Alternativas devem ser A, B, C, D")

        # 3. Opção D livre de contaminação com a disciplina seguinte
        opt_d = next(o for o in options if o["letter"] == "D")
        self.assertIn("560", opt_d["text"])
        self.assertNotIn("NOÇÕES DE INFORMÁTICA", opt_d["text"])
        self.assertNotIn("Informática", opt_d["text"])

        # 4. Opção C com preservação literal e sem rascunho de caneta colado
        opt_c = next(o for o in options if o["letter"] == "C")
        self.assertIn("336", opt_c["text"])
        self.assertNotIn("10,.~rl'l", opt_c["text"])

        # 5. Pareamento com gabarito oficial
        self.assertEqual(q15["correct_option"], "C")
        self.assertEqual(q15["gabarito_status"], "PRELIMINAR")

        # 6. Alerta de divergência matemática e status
        self.assertEqual(q15["status"], "NEEDS_REVIEW")
        has_math_flag = any("MATH_DIVERGENCE_SUSPECTED" in f for f in q15["flags"])
        self.assertTrue(has_math_flag, "Divergência matemática deve ser explicitamente sinalizada")

        # 7. Evidência visual da página 6
        self.assertEqual(q15["evidence_image"], "page_6.png")
        evidence_file = os.path.join(self.output_dir, "evidence", "page_6.png")
        self.assertTrue(os.path.exists(evidence_file), "Arquivo de evidência page_6.png deve existir no disco")


if __name__ == "__main__":
    unittest.main()
