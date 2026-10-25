# scripts/github_issues_sync.ps1
# Script para automação e sincronização de GitHub Issues, Labels e PRs do FiscalStudy
# Repositório: gusty22/sistema-de-estudos-FISCALSTUDY

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Repo = "gusty22/sistema-de-estudos-FISCALSTUDY",
    [switch]$SyncLabels,
    [switch]$SyncIssues
)

Write-Host "=== Sincronizador de Labels e Issues FiscalStudy ===" -ForegroundColor Cyan
Write-Host "Repositório alvo: $Repo" -ForegroundColor Gray

# Catálogo oficial de labels
$labels = @(
    @{ name = "finding:F01"; color = "b60205"; description = "Classificação de questões por assunto" },
    @{ name = "finding:F02"; color = "b60205"; description = "Histórico e segregação de origem real" },
    @{ name = "finding:F03"; color = "b60205"; description = "Hooks condicionais nos modais de abertura" },
    @{ name = "finding:F04"; color = "b60205"; description = "DDLs incompatíveis cadernos e simulados" },
    @{ name = "finding:F05"; color = "b60205"; description = "Busca global vs schema real" },
    @{ name = "finding:F06"; color = "b60205"; description = "Registro append-only da causa do erro" },
    @{ name = "finding:F07"; color = "b60205"; description = "Tempo ativo vs elapsed e sessão do banco" },
    @{ name = "finding:F08"; color = "b60205"; description = "Idempotência atômica e serialização de JSON" },
    @{ name = "finding:F09"; color = "b60205"; description = "Revisões adiadas e respostas não avaliáveis" },
    @{ name = "finding:F13"; color = "b60205"; description = "Segurança e isolamento da restauração de backup" },
    @{ name = "finding:F14"; color = "b60205"; description = "Backup/overview e divergência de datasource" },
    @{ name = "finding:F18"; color = "b60205"; description = "Conformidade e parâmetros do FSRS oficial" },
    @{ name = "finding:F20"; color = "b60205"; description = "Remoção de estimativas falsas e causas inferidas" },
    @{ name = "finding:F29"; color = "b60205"; description = "Unificação da inicialização do schema SQLite" },
    @{ name = "agent:codex"; color = "0052cc"; description = "Atribuído ao agente OpenAI Codex" },
    @{ name = "agent:antigravity"; color = "0e8a16"; description = "Atribuído ao agente Google Antigravity" },
    @{ name = "agent:human"; color = "fbca04"; description = "Ação ou homologação humana obrigatória" },
    @{ name = "area:persistence"; color = "5319e7"; description = "Persistência, DDL e banco SQLite" },
    @{ name = "area:backend"; color = "1d76db"; description = "Spring Boot e serviços de aplicação" },
    @{ name = "area:frontend"; color = "006b75"; description = "React, TypeScript, CSS e UX Calma" },
    @{ name = "area:analytics"; color = "d93f0b"; description = "Motor R, métricas estatísticas e brier scores" },
    @{ name = "priority:critical"; color = "d73a4a"; description = "Impacto crítico na integridade de dados" },
    @{ name = "priority:high"; color = "cfd3d7"; description = "Alta prioridade de desenvolvimento" },
    @{ name = "status:ready"; color = "0e8a16"; description = "Pronta para execução" },
    @{ name = "status:in-review"; color = "fbca04"; description = "Em revisão cruzada / PR aberto" }
)

# Catálogo canônico das 6 tarefas prioritárias e associação a PRs
$issues = @(
    @{
        title = "Fix: Unificação DDL SQLite e inicialização única de schema (F04/F14/F29)"
        labels = @("finding:F04", "finding:F14", "finding:F29", "area:persistence", "priority:critical", "agent:codex", "status:in-review")
        pr = "feature/database-contracts"
        body = "Garante schema unificado SQLite sem divergências DDL entre cadernos, simulados e backup."
    },
    @{
        title = "Fix: Conformidade FSRS e persistência do histórico cognitivo (F02/F18/F20)"
        labels = @("finding:F02", "finding:F18", "finding:F20", "area:backend", "priority:critical", "agent:codex", "status:in-review")
        pr = "feature/learning-backend"
        body = "Implementa modelo FSRS conforme especificação oficial e isolamento da telemetria de estudo real."
    },
    @{
        title = "Fix: Registro append-only da causa de erro com imutabilidade da resposta (F06)"
        labels = @("finding:F06", "area:backend", "priority:high", "agent:codex", "status:in-review")
        pr = "fix/backend-pedagogical-reasons (#9)"
        body = "Separa o evento ANSWER_SUBMITTED de ATTEMPT_ANNOTATED para preservar histórico inalterado."
    },
    @{
        title = "Fix: Idempotência atômica e serialização estável de eventos de tentativa (F08)"
        labels = @("finding:F08", "area:backend", "priority:critical", "agent:codex", "status:in-review")
        pr = "fix/backend-annotation-order (#10)"
        body = "Garante unicidade da chave attempt:UUID no event_store e evita duplicatas por retentativas de rede."
    },
    @{
        title = "Fix: Desacoplamento do motor R de Analytics e resiliência a ausência de runtime (PR #8)"
        labels = @("area:analytics", "priority:high", "agent:codex", "status:in-review")
        pr = "fix/analytics-learning-evidence (#8)"
        body = "Isola a execução do script R assíncrono e impede bloqueios no backend Java quando R não estiver instalado."
    },
    @{
        title = "Fix: Interface calma e acessível para anotação pós-resolução de questões (F03/F07)"
        labels = @("finding:F03", "finding:F07", "area:frontend", "priority:high", "agent:antigravity", "status:ready")
        pr = "fix/frontend-accessibility-flows"
        body = "Implementa navegação por teclado, feedback embutido sem alert() intrusivo e cronometragem de tempo ativo."
    }
)

# Verificação de conectividade e ferramenta GitHub CLI
$hasGh = Get-Command "gh" -ErrorAction SilentlyContinue

function Test-GitHubAuth {
    if (-not $hasGh) { return $false }
    try {
        $status = gh auth status 2>&1
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

$isAuth = Test-GitHubAuth

Write-Host "Ambiente: CLI gh = $(if ($hasGh) {'Disponível'} else {'Ausente'}), Autenticação = $(if ($isAuth) {'Ativa'} else {'Offline / Sem token'})" -ForegroundColor Yellow

if (-not $isAuth) {
    Write-Host "`n[AVISO DE GOVERNANÇA]: Autenticação do GitHub não detectada no ambiente local." -ForegroundColor Cyan
    Write-Host "Modo de simulação ativado por padrão. Nenhuma alteração remota será disparada." -ForegroundColor Cyan
    Write-Host "`nPara sincronizar remotamente quando autenticado, execute:" -ForegroundColor Gray
    Write-Host "  gh auth login" -ForegroundColor Gray
    Write-Host "  .\scripts\github_issues_sync.ps1 -SyncLabels -SyncIssues" -ForegroundColor Gray
}

# Simulação ou Execução das Labels
Write-Host "`n--- Validação de Labels ($($labels.Count) catalogadas) ---" -ForegroundColor Cyan
foreach ($lbl in $labels) {
    if ($PSCmdlet.ShouldProcess("Label: $($lbl.name) (Cor: #$($lbl.color))", "Criar/Garantir no GitHub")) {
        if ($isAuth -and $SyncLabels) {
            gh label create $lbl.name --repo $Repo --color $lbl.color --description $lbl.description --force 2>$null
            Write-Host "  [APLICADO] $($lbl.name)" -ForegroundColor Green
        } else {
            Write-Host "  [SIMULAÇÃO] Label: $($lbl.name) | Desc: $($lbl.description)" -ForegroundColor Gray
        }
    }
}

# Simulação ou Execução das Issues
Write-Host "`n--- Validação de Issues Prioritárias ($($issues.Count) planejadas) ---" -ForegroundColor Cyan
foreach ($iss in $issues) {
    if ($PSCmdlet.ShouldProcess("Issue: $($iss.title) (PR Associado: $($iss.pr))", "Criar/Atualizar no GitHub")) {
        if ($isAuth -and $SyncIssues) {
            $existing = gh issue list --repo $Repo --search $iss.title --json number -q ".[0].number" 2>$null
            if ($existing) {
                Write-Host "  [EXISTENTE] #$existing - $($iss.title)" -ForegroundColor Yellow
            } else {
                $labelsArg = ($iss.labels -join ",")
                $newId = gh issue create --repo $Repo --title $iss.title --body "$($iss.body)`n`n**PR Associado:** $($iss.pr)" --label $labelsArg
                Write-Host "  [CRIADA] $newId - $($iss.title)" -ForegroundColor Green
            }
        } else {
            Write-Host "  [SIMULAÇÃO] $($iss.title)" -ForegroundColor Gray
            Write-Host "     PR: $($iss.pr)" -ForegroundColor DarkGray
            Write-Host "     Labels: $($iss.labels -join ', ')" -ForegroundColor DarkGray
        }
    }
}

Write-Host "`nProcessamento concluído com segurança." -ForegroundColor Green
