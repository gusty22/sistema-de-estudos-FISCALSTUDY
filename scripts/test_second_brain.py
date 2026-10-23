#!/usr/bin/env python3
"""
test_second_brain.py - Suíte completa de testes automatizados do Segundo Cérebro Técnico.
Testa:
1. obsidian_kb.py: Relevância semântica, expansão morfológica, ranking com BM25 + Boosts.
2. obsidian_kb.py (Resiliência): Vault ausente, banco ausente, termos sem match.
3. measure_tokens.py: Leitura real do transcript.jsonl sem duplicação de cache.
4. second_brain_bridge.py: Integração Obsidian + Graphify e tratamento de símbolos inexistentes.
"""

import sys
import unittest
import json
from pathlib import Path

# Ajuste de encoding no Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "scripts"))

import obsidian_kb
import measure_tokens
import second_brain_bridge

class TestObsidianKBRelevance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db_path = BASE_DIR / "graphify-out" / "obsidian_fts.db"
        obsidian_kb.sync_vault(obsidian_kb.DEFAULT_VAULT_PATH, cls.db_path, verbose=False)

    def test_query_ciclo_4_estagios(self):
        """Consulta 'ciclo de aprendizagem em 4 estágios' DEVE ter 'Ciclo em 4 Estágios' em 1º lugar."""
        results = obsidian_kb.search_vault("ciclo de aprendizagem em 4 estágios", self.db_path, limit=3)
        self.assertGreater(len(results), 0, "Deveria retornar resultados para ciclo em 4 estágios")
        self.assertEqual(results[0]["title"], "Ciclo em 4 Estágios", 
                         f"Esperado 'Ciclo em 4 Estágios' no topo, mas obteve: {results[0]['title']}")
        self.assertGreater(results[0]["score"], 20.0, "O score deve refletir o boost de título e frase")

    def test_query_retrieval_practice_english_alias(self):
        """Consulta usando 'retrieval practice' DEVE priorizar 'Recuperação Ativa'."""
        results = obsidian_kb.search_vault("retrieval practice e reconhecimento passivo", self.db_path, limit=3)
        self.assertGreater(len(results), 0)
        self.assertEqual(results[0]["title"], "Recuperação Ativa",
                         f"Esperado 'Recuperação Ativa' no topo, mas obteve: {results[0]['title']}")

    def test_query_variacoes_plural_singular(self):
        """Variações morfológicas (ex: 'revisão' vs 'revisões') devem recuperar notas correlatas."""
        results_singular = obsidian_kb.search_vault("revisão adaptativa", self.db_path, limit=5)
        results_plural = obsidian_kb.search_vault("revisões adaptativas", self.db_path, limit=5)
        
        titles_sing = [r["title"] for r in results_singular]
        titles_plur = [r["title"] for r in results_plural]
        
        self.assertIn("Módulos F a J (Inteligência)", titles_sing)
        self.assertIn("Módulos F a J (Inteligência)", titles_plur)

    def test_query_conceitual_sem_palavras_do_titulo(self):
        """Consulta conceitual que não usa o título exato (ex: 'bloqueio prévio de gabarito')
        deve recuperar 'Recuperação Ativa' devido à relevância da seção."""
        results = obsidian_kb.search_vault("bloqueio prévio de gabaritos e estimativa de confiança", self.db_path, limit=3)
        self.assertGreater(len(results), 0)
        self.assertEqual(results[0]["title"], "Recuperação Ativa")

    def test_query_event_store_imutavel(self):
        """Consulta sobre 'append only' e 'event store' deve priorizar 'Event Store Imutável'."""
        results = obsidian_kb.search_vault("append-only e projeções materializadas", self.db_path, limit=3)
        self.assertGreater(len(results), 0)
        self.assertEqual(results[0]["title"], "Event Store Imutável")

    def test_query_resiliencia_termo_inexistente(self):
        """Busca por termo inexistente deve retornar lista vazia sem lançar exceção."""
        results = obsidian_kb.search_vault("TokenCompletamenteInexistenteXyZ123999", self.db_path, limit=3)
        self.assertEqual(results, [])

    def test_resiliencia_db_ou_vault_ausente(self):
        """Operações com banco ou vault inexistentes devem falhar de forma segura."""
        fake_db = BASE_DIR / "graphify-out" / "non_existent_test.db"
        res = obsidian_kb.search_vault("qualquer coisa", fake_db)
        self.assertEqual(res, [])
        
        fake_vault = BASE_DIR / "non_existent_vault_dir"
        ok = obsidian_kb.sync_vault(fake_vault, fake_db, verbose=False)
        self.assertFalse(ok)

class TestTokenMeasurement(unittest.TestCase):
    def test_measure_tokens_reading(self):
        """Valida que transcript.jsonl é lido corretamente e sem dupla contagem."""
        transcript = measure_tokens.find_latest_transcript()
        self.assertIsNotNone(transcript, "Deveria encontrar o transcript ativo da sessão")
        report = measure_tokens.analyze_transcript(transcript)
        
        self.assertNotIn("error", report)
        self.assertGreater(report["total_steps_with_tokens"], 0)
        self.assertGreater(report["total_new_input_tokens"], 0)
        self.assertGreater(report["total_cache_read_tokens"], 0)
        
        # Consistência: total de contexto = new_input + cache_read
        expected_context = report["total_new_input_tokens"] + report["total_cache_read_tokens"]
        self.assertEqual(report["total_context_tokens_processed"], expected_context,
                         "Total de contexto deve ser a soma exata de new_input com cache_read")

class TestSecondBrainBridge(unittest.TestCase):
    def test_bridge_structure(self):
        """Valida que a bridge executa consultas no Obsidian e Graphify sem lançar exceções."""
        notes = second_brain_bridge.run_obsidian_query("Event Store", limit=2)
        self.assertIsInstance(notes, list)
        self.assertGreater(len(notes), 0)
        
        nodes = second_brain_bridge.run_graphify_query("EventStoreRepository")
        self.assertIsInstance(nodes, list)

    def test_bridge_resilience_inexistent(self):
        """Valida que a bridge lida com símbolos inexistentes com elegância (sem crash)."""
        nodes = second_brain_bridge.run_graphify_query("NonExistentSymbol9999XYZ")
        self.assertEqual(nodes, [])

if __name__ == "__main__":
    unittest.main()
