"""
dashboard.py — Painel web em tempo real para monitorar o scraper de leads.

Endpoints:
  GET /               → HTML do dashboard
  GET /api/stats      → estatísticas do DB + log
  GET /api/leads      → tabela paginada com busca (?q=, ?state=, ?page=, ?limit=)
  GET /api/leads/export.csv → download completo em CSV
  GET /api/stream     → SSE: tail do log em tempo real
  GET /api/health     → status do processo scraper

Como executar:
  python3 dashboard.py
  # Abre em http://localhost:8000
"""
import asyncio
import csv
import glob
import io
import json
import os
import re
import sqlite3
from datetime import date
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).parent
DB_PATH  = BASE_DIR / "leads.db"
LOGS_DIR = BASE_DIR / "logs"
TEMPLATES_DIR = BASE_DIR / "templates"

app = FastAPI(title="Mary Kay Scraper Dashboard")


# ---------------------------------------------------------------------------
# Helpers de banco
# ---------------------------------------------------------------------------

def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _parse_json_field(value):
    if not value:
        return []
    try:
        return json.loads(value)
    except Exception:
        return [value]


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    for field in ("phones", "services", "delivery_options"):
        d[field] = _parse_json_field(d.get(field))
    return d


# ---------------------------------------------------------------------------
# Helpers de log
# ---------------------------------------------------------------------------

def _current_log_path() -> Path | None:
    today = date.today().strftime("%Y-%m-%d")
    p = LOGS_DIR / f"scraper_{today}.log"
    return p if p.exists() else None


def _parse_log_stats() -> dict:
    """Lê o log do dia e extrai contagens via regex."""
    stats = {
        "ceps_processados": 0,
        "leads_novos": 0,
        "erros": 0,
        "syncs": 0,
        "last_sync": None,
    }
    log_path = _current_log_path()
    if not log_path:
        return stats

    try:
        with open(log_path, encoding="utf-8") as f:
            for line in f:
                if "CEP " in line and "consultora" in line:
                    stats["ceps_processados"] += 1
                if "NOVO LEAD #" in line:
                    stats["leads_novos"] += 1
                if "| ERROR" in line or "| CRITICAL" in line:
                    stats["erros"] += 1
                if "Sync concluída:" in line:
                    stats["syncs"] += 1
                    # Extrai timestamp da linha: "2026-04-15 19:01:30 | INFO..."
                    m = re.match(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", line)
                    if m:
                        stats["last_sync"] = m.group(1)
    except Exception:
        pass

    return stats


def _tail_log(n: int = 50) -> list[str]:
    """Retorna as últimas n linhas do log atual."""
    log_path = _current_log_path()
    if not log_path:
        return []
    try:
        with open(log_path, encoding="utf-8") as f:
            lines = f.readlines()
        return [l.rstrip() for l in lines[-n:]]
    except Exception:
        return []


def _scraper_pid() -> int | None:
    """Tenta encontrar o PID do processo main.py rodando."""
    try:
        import subprocess
        result = subprocess.run(
            ["pgrep", "-f", "python.*main.py"],
            capture_output=True, text=True
        )
        pids = [int(p) for p in result.stdout.strip().splitlines() if p.strip()]
        return pids[0] if pids else None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Rotas
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def index():
    html_path = TEMPLATES_DIR / "index.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@app.get("/api/health")
async def health():
    pid = _scraper_pid()
    return {"scraper_running": pid is not None, "pid": pid}


@app.get("/api/stats")
async def stats():
    conn = _get_conn()
    try:
        total = conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
        today_count = conn.execute(
            "SELECT COUNT(*) FROM leads WHERE date(first_seen) = date('now')"
        ).fetchone()[0]

        by_state = [
            {"state": row[0] or "?", "count": row[1]}
            for row in conn.execute(
                "SELECT state, COUNT(*) as cnt FROM leads GROUP BY state ORDER BY cnt DESC LIMIT 30"
            ).fetchall()
        ]

        last_lead = conn.execute(
            "SELECT name, city, state, last_updated FROM leads ORDER BY last_updated DESC LIMIT 1"
        ).fetchone()
        last_lead_info = dict(last_lead) if last_lead else None

    finally:
        conn.close()

    log_stats = _parse_log_stats()
    pid = _scraper_pid()

    return {
        "total_leads":        total,
        "leads_hoje":         today_count,
        "estados_cobertos":   len(by_state),
        "leads_por_estado":   by_state,
        "ceps_processados":   log_stats["ceps_processados"],
        "leads_novos_log":    log_stats["leads_novos"],
        "erros":              log_stats["erros"],
        "syncs":              log_stats["syncs"],
        "last_sync":          log_stats["last_sync"],
        "last_lead":          last_lead_info,
        "scraper_ativo":      pid is not None,
    }


@app.get("/api/leads")
async def leads(q: str = "", state: str = "", page: int = 1, limit: int = 50):
    conn = _get_conn()
    try:
        conditions = []
        params = []

        if q:
            conditions.append(
                "(name LIKE ? OR city LIKE ? OR instagram LIKE ? OR zip_code LIKE ?)"
            )
            like = f"%{q}%"
            params.extend([like, like, like, like])

        if state:
            conditions.append("state = ?")
            params.append(state.upper())

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        total_row = conn.execute(
            f"SELECT COUNT(*) FROM leads {where}", params
        ).fetchone()
        total = total_row[0]

        offset = (page - 1) * limit
        rows = conn.execute(
            f"SELECT * FROM leads {where} ORDER BY first_seen DESC LIMIT ? OFFSET ?",
            params + [limit, offset],
        ).fetchall()

        items = [_row_to_dict(r) for r in rows]
    finally:
        conn.close()

    return {
        "total":   total,
        "page":    page,
        "limit":   limit,
        "pages":   (total + limit - 1) // limit,
        "items":   items,
    }


@app.get("/api/leads/export.csv")
async def export_csv():
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM leads ORDER BY first_seen DESC"
        ).fetchall()
        all_leads = [_row_to_dict(r) for r in rows]
    finally:
        conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "CID", "Nome", "Título", "Cidade", "Estado", "CEP",
        "Telefone 1", "Telefone 2", "Instagram",
        "Serviços", "Entrega", "URL", "Primeira vez visto", "Atualizado em"
    ])
    for lead in all_leads:
        phones = lead.get("phones", [])
        writer.writerow([
            lead.get("cid", ""),
            lead.get("name", ""),
            lead.get("title", ""),
            lead.get("city", ""),
            lead.get("state", ""),
            lead.get("zip_code", ""),
            phones[0] if len(phones) > 0 else "",
            phones[1] if len(phones) > 1 else "",
            lead.get("instagram", ""),
            " | ".join(lead.get("services", [])),
            " | ".join(lead.get("delivery_options", [])),
            lead.get("profile_url", ""),
            lead.get("first_seen", ""),
            lead.get("last_updated", ""),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads_marykay.csv"},
    )


@app.get("/api/stream")
async def stream(request: Request):
    """SSE: faz tail do log em tempo real."""

    async def event_generator():
        # Histórico inicial (últimas 50 linhas)
        for line in _tail_log(50):
            if line.strip():
                payload = json.dumps({"line": line, "initial": True})
                yield f"data: {payload}\n\n"
        await asyncio.sleep(0.1)

        # Tail contínuo: abre o arquivo e fica esperando novas linhas
        log_path = _current_log_path()
        if not log_path:
            # Aguarda até o log aparecer
            for _ in range(60):
                await asyncio.sleep(5)
                log_path = _current_log_path()
                if log_path:
                    break
            else:
                return

        try:
            with open(log_path, encoding="utf-8") as f:
                f.seek(0, 2)  # vai para o final
                while True:
                    if await request.is_disconnected():
                        break
                    line = f.readline()
                    if line:
                        payload = json.dumps({"line": line.rstrip(), "initial": False})
                        yield f"data: {payload}\n\n"
                    else:
                        # Verifica se o log rotacionou (novo dia)
                        new_path = _current_log_path()
                        if new_path and new_path != log_path:
                            break
                        await asyncio.sleep(0.5)
        except Exception:
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        "dashboard:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="warning",
    )
