"""
database.py — Gerencia o banco de dados SQLite local.

Responsabilidades:
- Criar tabela `leads` com schema completo
- UPSERT de leads preservando `first_seen`
- Leitura de todos os leads para sync com Sheets
"""
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from loguru import logger


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS leads (
    cid              TEXT PRIMARY KEY,
    name             TEXT,
    title            TEXT,
    city             TEXT,
    state            TEXT,
    zip_code         TEXT,
    phones           TEXT,           -- JSON array: ["(11) 99999-9999"]
    instagram        TEXT,
    services         TEXT,           -- JSON array: ["Maquiagem"]
    delivery_options TEXT,           -- JSON array: ["Entrega domicílio"]
    profile_url      TEXT,
    first_seen       TEXT,           -- ISO 8601
    last_updated     TEXT            -- ISO 8601
);
"""

_CREATE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_leads_state   ON leads(state);",
    "CREATE INDEX IF NOT EXISTS idx_leads_zip     ON leads(zip_code);",
    "CREATE INDEX IF NOT EXISTS idx_leads_name    ON leads(name);",
]

_UPSERT = """
INSERT INTO leads
    (cid, name, title, city, state, zip_code, phones, instagram,
     services, delivery_options, profile_url, first_seen, last_updated)
VALUES
    (?,?,?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(cid) DO UPDATE SET
    name             = excluded.name,
    title            = excluded.title,
    city             = excluded.city,
    state            = excluded.state,
    zip_code         = excluded.zip_code,
    phones           = excluded.phones,
    instagram        = excluded.instagram,
    services         = excluded.services,
    delivery_options = excluded.delivery_options,
    profile_url      = excluded.profile_url,
    last_updated     = excluded.last_updated;
"""


# ---------------------------------------------------------------------------
# Funções públicas
# ---------------------------------------------------------------------------

def init_db(db_path: str) -> sqlite3.Connection:
    """Cria/abre o banco, aplica schema e retorna a conexão."""
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row

    # WAL mode: permite leituras concorrentes enquanto escrevemos
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")

    conn.execute(_CREATE_TABLE)
    for idx_sql in _CREATE_INDEXES:
        conn.execute(idx_sql)
    conn.commit()

    count = conn.execute("SELECT COUNT(*) FROM leads;").fetchone()[0]
    logger.info(f"Banco inicializado: {db_path} ({count} leads existentes)")
    return conn


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


def upsert_lead(conn: sqlite3.Connection, lead: dict) -> bool:
    """
    Insere ou atualiza um lead.
    Preserva `first_seen` em caso de atualização.
    Retorna True se o lead é NOVO, False se já existia.
    """
    cid = lead.get("cid", "").strip()
    if not cid:
        logger.warning("upsert_lead: lead sem CID, ignorado.")
        return False

    existing = conn.execute(
        "SELECT first_seen FROM leads WHERE cid = ?", (cid,)
    ).fetchone()

    is_new = existing is None
    first_seen = existing["first_seen"] if existing else _now_iso()
    now = _now_iso()

    conn.execute(
        _UPSERT,
        (
            cid,
            lead.get("name", ""),
            lead.get("title", ""),
            lead.get("city", ""),
            lead.get("state", ""),
            lead.get("zip_code", ""),
            json.dumps(lead.get("phones", []), ensure_ascii=False),
            lead.get("instagram", ""),
            json.dumps(lead.get("services", []), ensure_ascii=False),
            json.dumps(lead.get("delivery_options", []), ensure_ascii=False),
            lead.get("profile_url", ""),
            first_seen,
            now,
        ),
    )
    conn.commit()
    return is_new


def get_all_leads(conn: sqlite3.Connection) -> list[dict]:
    """Retorna todos os leads como lista de dicts (com listas decodificadas)."""
    rows = conn.execute(
        "SELECT * FROM leads ORDER BY first_seen DESC;"
    ).fetchall()

    result = []
    for row in rows:
        d = dict(row)
        d["phones"] = _safe_json_loads(d.get("phones", "[]"))
        d["services"] = _safe_json_loads(d.get("services", "[]"))
        d["delivery_options"] = _safe_json_loads(d.get("delivery_options", "[]"))
        result.append(d)
    return result


def lead_exists(conn: sqlite3.Connection, cid: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM leads WHERE cid = ?", (cid,)
    ).fetchone()
    return row is not None


def get_lead_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM leads;").fetchone()[0]


def close_db(conn: sqlite3.Connection) -> None:
    conn.close()


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _safe_json_loads(value: Optional[str]) -> list:
    if not value:
        return []
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return []
