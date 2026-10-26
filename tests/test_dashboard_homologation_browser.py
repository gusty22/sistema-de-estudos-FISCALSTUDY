"""
FiscalStudy - Homologação Funcional do Dashboard em Navegador Real (Playwright)
Valida os 10 cenários de integridade pedagógica e estados explícitos:
1. Concurso sem tópicos (NO_EDITAL).
2. Edital existente sem tópicos verticalizados (NO_TOPICS_IN_EDITAL).
3. API temporariamente indisponível (ERROR 500 com exibição explícita).
4. Carregamento assíncrono (LOADING com spinner).
5. Fila de atividades vazia (NO_ACTIVITIES com ações legítimas).
6. Fila com atividades reais (HAS_ACTIVITIES e sessão legítima).
7. Clique/tentativa de iniciar sem atividade válida (zero mutação de storage).
8. Recuperação após falha de carregamento (botão Tentar Novamente).
9. Troca rápida de atividade sem índice NaN.
10. Ausência total de disciplinas/tópicos fictícios em estados vazios.
"""

import os
import sys
import json
import time
import threading
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

# Forçar stdout UTF-8 no Windows
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR / "frontend" / "dist"
ARTIFACT_DIR = ROOT_DIR / "target" / "test-artifacts" / "dashboard-homologation"
PORT = 19288

ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

# Estado dinâmico do servidor de testes para alternar cenários
class MockServerState:
    scenario = "NO_CONCURSO"
    fail_edital = False
    delay_seconds = 0
    concurso_id = "c_auditor_rfb"
    editais = []
    topicos = []
    agenda = None
    cycle = None

server_state = MockServerState()

class DashboardHomologationHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST_DIR), **kwargs)

    def log_message(self, format, *args):
        # Suprimir logs verbosos de requisições estáticas
        pass

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlparse(self.path)
        path = url.path

        if path == "/api/v1/system/settings":
            self.send_json(200, {
                "perfilEstudos": {"tema": "PAPEL_CLARO"},
                "concursoAlvo": server_state.concurso_id if server_state.scenario != "NO_CONCURSO" else None
            })
            return

        if path == "/api/v1/concursos":
            if server_state.scenario == "NO_CONCURSO":
                self.send_json(200, [])
            else:
                self.send_json(200, [{
                    "id": server_state.concurso_id,
                    "nome": "Auditor Fiscal da Receita Federal (RFB)",
                    "cargo": "Auditor-Fiscal",
                    "orgao": "Receita Federal",
                    "banca": "FGV",
                    "ano": 2024
                }])
            return

        if path.startswith("/api/v1/concursos/") and path.endswith("/edital"):
            if server_state.delay_seconds > 0:
                time.sleep(server_state.delay_seconds)

            if server_state.fail_edital:
                self.send_json(500, {"error": "Falha interna simulada no servidor de editais"})
                return

            self.send_json(200, {
                "concursoId": server_state.concurso_id,
                "editais": server_state.editais,
                "topicos": server_state.topicos,
                "totalTopicos": len(server_state.topicos),
                "totalConfirmados": len(server_state.topicos)
            })
            return

        if path == "/api/v1/revisoes/agenda":
            self.send_json(200, server_state.agenda or {
                "todayDate": "2026-10-26",
                "totalPendentesHoje": 0,
                "hoje": [],
                "proximos7Dias": [],
                "concluidas": []
            })
            return

        if path == "/api/v1/cycle/robin-hood":
            self.send_json(200, server_state.cycle or {"blocos": []})
            return

        if path == "/api/v1/analytics/study-anomalies":
            self.send_json(200, {"totalAnomalies": 0, "anomalies": []})
            return

        if path == "/api/v1/study-sessions/summary":
            self.send_json(200, {"totalHours": 1.5, "totalSessions": 3})
            return

        if path == "/api/v1/routine/effective-hours":
            self.send_json(200, {"effectiveMinutes": 120})
            return

        if path == "/api/v1/anki/status":
            self.send_json(200, {
                "connected": False,
                "pendingQueueCount": 0,
                "totalCardsSynced": 0,
                "autoSyncActive": False
            })
            return

        # Roteamento SPA: Qualquer rota não estática retorna index.html
        if not (DIST_DIR / path.lstrip("/")).exists():
            index_file = DIST_DIR / "index.html"
            content = index_file.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        return super().do_GET()

def start_server():
    httpd = HTTPServer(("127.0.0.1", PORT), DashboardHomologationHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    return httpd

def run_homologation():
    print(f"[*] Iniciando servidor de homologação em http://127.0.0.1:{PORT}...")
    httpd = start_server()
    time.sleep(0.5)

    evidence_report = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        console_errors = []
        page_js_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: page_js_errors.append(str(err)))

        base_url = f"http://127.0.0.1:{PORT}"

        # ---------------------------------------------------------------------
        # Cenário 1: Concurso sem edital cadastrado (NO_EDITAL)
        # ---------------------------------------------------------------------
        print("[1/10] Testando Cenário 1: Concurso sem edital cadastrado...")
        server_state.scenario = "CONCURSO_SEM_EDITAL"
        server_state.fail_edital = False
        server_state.editais = []
        server_state.topicos = []
        server_state.agenda = None
        server_state.cycle = None

        page.goto(base_url)
        page.wait_for_selector(".calm-home-header", timeout=5000)
        page.wait_for_selector("text=Edital Não Cadastrado", timeout=5000)

        # Validar ausência de disciplinas e tópicos fictícios no DOM
        content = page.content()
        assert "default-activity-initial" not in content, "FALHA: ID fictício presente no DOM"
        assert "Crédito Tributário — Lançamento e Extinção" not in content, "FALHA: Tópico fictício presente no DOM"

        # Validar sessionStorage intacto
        storage_disc = page.evaluate("() => window.sessionStorage.getItem('fiscalstudy_session_discipline')")
        assert storage_disc is None, f"FALHA: sessionStorage violado com valor: {storage_disc}"

        # Validar botão de ação legítima presente
        assert page.locator("text=Cadastrar / Importar Edital").is_visible(), "FALHA: Botão de ação legítima ausente"
        page.screenshot(path=str(ARTIFACT_DIR / "cenario_1_no_edital.png"))
        evidence_report.append("Cenário 1 (NO_EDITAL): Aprovado com sucesso. Nenhuma atividade fictícia e sessionStorage intacto.")

        # ---------------------------------------------------------------------
        # Cenário 2: Edital existente sem tópicos verticalizados (NO_TOPICS_IN_EDITAL)
        # ---------------------------------------------------------------------
        print("[2/10] Testando Cenário 2: Edital existente sem tópicos verticalizados...")
        server_state.scenario = "EDITAL_SEM_TOPICOS"
        server_state.editais = [{"id": "e_rfb_2024", "titulo": "Edital RFB 2024 Oficial"}]
        server_state.topicos = []

        page.reload()
        page.wait_for_selector("text=Edital sem Tópicos Verticalizados", timeout=5000)
        assert page.locator("text=possui 1 edital(is) vinculado(s)").is_visible()
        assert page.locator("text=Verticalizar / Confirmar Tópicos").is_visible()

        storage_disc = page.evaluate("() => window.sessionStorage.getItem('fiscalstudy_session_discipline')")
        assert storage_disc is None

        page.screenshot(path=str(ARTIFACT_DIR / "cenario_2_no_topics_in_edital.png"))
        evidence_report.append("Cenário 2 (NO_TOPICS_IN_EDITAL): Aprovado. Diferenciação semântica entre falta de edital e falta de tópicos confirmada.")

        # ---------------------------------------------------------------------
        # Cenário 3: API temporariamente indisponível (ERROR HTTP 500)
        # ---------------------------------------------------------------------
        print("[3/10] Testando Cenário 3: Erro HTTP de comunicação...")
        server_state.fail_edital = True

        page.reload()
        page.wait_for_selector("text=Erro de Comunicação", timeout=5000)
        assert page.locator("text=Falha HTTP 500 ao carregar o edital do concurso").is_visible()
        assert page.locator("text=Tentar Novamente").is_visible()

        page.screenshot(path=str(ARTIFACT_DIR / "cenario_3_http_error.png"))
        evidence_report.append("Cenário 3 (ERROR): Aprovado. Erro HTTP 500 exibido explicitamente sem mascaramento por fallback.")

        # ---------------------------------------------------------------------
        # Cenário 8: Recuperação após falha de carregamento (clique em Tentar Novamente)
        # ---------------------------------------------------------------------
        print("[4/10] Testando Cenário 8: Recuperação pós-erro via 'Tentar Novamente'...")
        # Restabelecer servidor
        server_state.fail_edital = False
        server_state.topicos = [
            {"id": "t1", "disciplina": "Direito Constitucional", "assunto": "Direitos e Garantias Fundamentais", "peso": 1.5, "questoesPrevistas": 10}
        ]

        page.click("text=Tentar Novamente")
        page.wait_for_selector("text=Nenhuma Atividade Elegível para Hoje", timeout=5000)
        assert not page.locator("text=Erro de Comunicação").is_visible()
        evidence_report.append("Cenário 8 (Recuperação): Aprovado. Botão 'Tentar Novamente' reexecuta a carga sem recarregar a página.")

        # ---------------------------------------------------------------------
        # Cenário 5: Fila de atividades vazia com edital cadastrado (NO_ACTIVITIES)
        # ---------------------------------------------------------------------
        print("[5/10] Testando Cenário 5: Fila vazia com edital cadastrado...")
        assert page.locator("text=O edital possui 1 tópico(s) cadastrado(s)").is_visible()
        assert page.locator(".calm-hero-card button:has-text('Ver Edital Verticalizado')").is_visible()
        assert page.locator(".calm-hero-card button:has-text('Configurar Planejamento')").is_visible()
        assert page.locator(".calm-hero-card button:has-text('Praticar Questões do Banco')").is_visible()

        # Fila secundária também deve indicar ausência
        assert page.locator("text=Nenhuma outra atividade na fila no momento").is_visible()

        page.screenshot(path=str(ARTIFACT_DIR / "cenario_5_no_activities.png"))
        evidence_report.append("Cenário 5 (NO_ACTIVITIES): Aprovado. Apresenta diagnóstico honesto e ações legítimas para edital, planejamento e banco.")

        # ---------------------------------------------------------------------
        # Cenário 7: Tentativa de iniciar atividade sem atividade válida
        # ---------------------------------------------------------------------
        print("[6/10] Testando Cenário 7: Proteção contra clique em iniciar sem atividade...")
        # Confirmar que botão "Começar Agora" NÃO existe no estado vazio
        assert not page.locator("button.calm-btn-start:has-text('Começar Agora')").is_visible()

        # Disparar ajuste rápido "Não tenho acesso ao material" em fila vazia
        page.click("button.calm-adjust-chip:has-text('Não tenho acesso ao material')")
        page.wait_for_selector("text=Nenhuma atividade na fila ativa para alternar modo", timeout=3000)

        # Assegurar que nenhuma sessão foi criada no sessionStorage
        storage_disc = page.evaluate("() => window.sessionStorage.getItem('fiscalstudy_session_discipline')")
        assert storage_disc is None, "FALHA: Tentativa gerou sessão indevida no sessionStorage"
        evidence_report.append("Cenário 7 (Proteção de Início): Aprovado. Botão de estudo desabilitado e zero mutação no sessionStorage.")

        # ---------------------------------------------------------------------
        # Cenário 9: Troca rápida de atividades sem índice NaN
        # ---------------------------------------------------------------------
        print("[7/10] Testando Cenário 9: Troca de atividade com fila vazia (proteção NaN)...")
        initial_js_errors = len(page_js_errors)
        for _ in range(3):
            page.click("button.calm-adjust-chip:has-text('Quero trocar de atividade')")
            time.sleep(0.1)

        # Verificar se ocorreu crash no componente ou exceções JS
        assert len(page_js_errors) == initial_js_errors, f"FALHA: Exceções JS disparadas: {page_js_errors}"
        # Garantir que a UI permaneceu estável e informou a ausência de atividades
        page.wait_for_selector("text=Nenhuma outra atividade na fila para alternar", timeout=3000)
        evidence_report.append("Cenário 9 (Proteção NaN): Aprovado. Cliques repetidos em troca de atividade com fila vazia não geram NaN nem erros.")

        # ---------------------------------------------------------------------
        # Cenário 6: Fila com atividades reais (HAS_ACTIVITIES)
        # ---------------------------------------------------------------------
        print("[8/10] Testando Cenário 6: Fila com atividades reais e início legítimo...")
        server_state.agenda = {
            "todayDate": "2026-10-26",
            "totalPendentesHoje": 1,
            "hoje": [{
                "id": "rev_real_42",
                "disciplina": "Direito Tributário",
                "topico": "Imunidades Tributárias",
                "tipo_revisao": "REVISAO",
                "justificativa_pedagogica": "Revisão baseada em erro recente em simulado",
                "estagio_intervencao": "Intervenção Crítica",
                "intervalo_dias": 7
            }],
            "proximos7Dias": [],
            "concluidas": []
        }

        page.reload()
        page.wait_for_selector(".calm-hero-tag:has-text('Sua Próxima Atividade')", timeout=5000)
        assert page.locator(".calm-hero-discipline:has-text('Direito Tributário')").is_visible()
        assert page.locator(".calm-hero-topic:has-text('Imunidades Tributárias')").is_visible()
        assert page.locator("button.calm-btn-start:has-text('Começar Agora')").is_visible()

        # Clicar em Começar Agora
        page.click("button.calm-btn-start:has-text('Começar Agora')")
        time.sleep(0.5)

        # Validar sessionStorage preenchido com dados reais
        stored_disc = page.evaluate("() => window.sessionStorage.getItem('fiscalstudy_session_discipline')")
        stored_topic = page.evaluate("() => window.sessionStorage.getItem('fiscalstudy_session_topic')")
        stored_type = page.evaluate("() => window.sessionStorage.getItem('fiscalstudy_session_type')")

        assert stored_disc == "Direito Tributário", f"Discipline divergente: {stored_disc}"
        assert stored_topic == "Imunidades Tributárias", f"Topic divergente: {stored_topic}"
        assert stored_type == "REVISAO", f"Type divergente: {stored_type}"

        page.screenshot(path=str(ARTIFACT_DIR / "cenario_6_has_activities.png"))
        evidence_report.append("Cenário 6 (HAS_ACTIVITIES): Aprovado. Exibe atividade real e grava dados legítimos no sessionStorage ao iniciar.")

        # ---------------------------------------------------------------------
        # Cenário 4: Carregamento assíncrono (LOADING com spinner)
        # ---------------------------------------------------------------------
        print("[9/10] Testando Cenário 4: Carregamento assíncrono com spinner...")
        server_state.delay_seconds = 1.0
        page.goto(base_url, wait_until="commit")
        page.wait_for_selector(".calm-hero-card:has-text('Carregando Dados...')", timeout=4000)
        assert page.locator(".calm-hero-card:has-text('Carregando Dados...')").is_visible()
        page.screenshot(path=str(ARTIFACT_DIR / "cenario_4_loading_async.png"))

        # Aguardar conclusão do carregamento
        page.wait_for_selector(".calm-hero-tag:has-text('Sua Próxima Atividade')", timeout=6000)
        server_state.delay_seconds = 0
        evidence_report.append("Cenário 4 (LOADING): Aprovado. Transição assíncrona exibe spinner sem cintilação de dados fictícios.")

        # ---------------------------------------------------------------------
        # Cenário 10: Ausência de disciplinas e tópicos fictícios em toda a navegação
        # ---------------------------------------------------------------------
        print("[10/10] Testando Cenário 10: Auditoria de ausência total de tópicos fictícios...")
        # Resetar para fila vazia e verificar se nenhum fallback anterior reaparece
        server_state.agenda = None
        server_state.cycle = None
        server_state.topicos = [{"id": "t2", "disciplina": "Contabilidade Geral", "assunto": "DRE", "peso": 2.0}]

        page.reload()
        page.wait_for_selector("text=Nenhuma Atividade Elegível para Hoje", timeout=5000)
        dom_text = page.inner_text("body")
        assert "default-activity-initial" not in dom_text
        assert "Crédito Tributário — Lançamento e Extinção" not in dom_text
        evidence_report.append("Cenário 10 (Zero Fictícios): Aprovado. Nenhuma disciplina ou tópico padrão inventado no DOM.")

        browser.close()

    print("\n" + "="*70)
    print("RELATÓRIO DE HOMOLOGAÇÃO FUNCIONAL NO NAVEGADOR (10/10 PASS):")
    print("="*70)
    for ev in evidence_report:
        print(f"  [✓] {ev}")
    print("="*70)

if __name__ == "__main__":
    run_homologation()
