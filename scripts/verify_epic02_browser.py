import os
import sys
from playwright.sync_api import sync_playwright

def main():
    artifact_dir = r"C:\Users\washi\.gemini\antigravity-ide\brain\7afca2f6-16e4-41bf-93bd-f91564f4dddd"
    os.makedirs(artifact_dir, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        print("1. Acessando frontend em http://localhost:5173...")
        page.goto("http://localhost:5173", wait_until="networkidle")
        page.wait_for_timeout(1500)

        # 2. Navegar para a aba de Analytics / Desempenho
        print("2. Clicando na aba de Analytics/Desempenho...")
        analytics_btn = page.locator("button:has-text('Desempenho'), button:has-text('Analytics'), [data-tab='analytics']").first
        if analytics_btn.count() > 0:
            analytics_btn.click()
            page.wait_for_timeout(1000)

        # 3. Clicar na aba 'Modelo de Conhecimento (EPIC 02)'
        print("3. Clicando na aba Modelo de Conhecimento (EPIC 02)...")
        tab_btn = page.locator("button:has-text('Modelo de Conhecimento'), button:has-text('Evidências de Conhecimento')").first
        if tab_btn.count() > 0:
            tab_btn.click()
            page.wait_for_timeout(1500)

        # 4. Capturar screenshot geral
        overview_path = os.path.join(artifact_dir, "epic02_knowledge_model_overview.png")
        page.screenshot(path=overview_path)
        print(f"Screenshot da visão geral salvo em: {overview_path}")

        # 5. Clicar em 'Evidências & Detalhes' no primeiro tópico
        print("4. Clicando no botão Evidências & Detalhes...")
        inspect_btn = page.locator("button:has-text('Evidências & Detalhes')").first
        if inspect_btn.count() > 0:
            inspect_btn.click()
            page.wait_for_timeout(1000)
            drawer_path = os.path.join(artifact_dir, "epic02_epistemic_drawer.png")
            page.screenshot(path=drawer_path)
            print(f"Screenshot do drawer epistêmico salvo em: {drawer_path}")

        browser.close()
        print("Validação funcional no navegador concluída com êxito!")

if __name__ == "__main__":
    main()
