"""
sheets_client.py — Sincronização com Google Sheets via API v4 (gspread).

Fluxo:
  1. Autentica via Service Account JSON
  2. Abre a planilha pelo GOOGLE_SHEET_ID
  3. sync_leads(leads) → limpa e reescreve todas as linhas de uma vez
     (2 chamadas API por sync — bem abaixo dos limites de quota)

Setup necessário (uma única vez):
  - Crie um projeto no Google Cloud Console
  - Ative "Google Sheets API" e "Google Drive API"
  - Crie uma Service Account → baixe o JSON → salve como credentials.json
  - Compartilhe a planilha com o e-mail da service account (permissão Editor)
  - Coloque o Sheet ID no .env (GOOGLE_SHEET_ID)
"""
import json
import time
from typing import Optional

import gspread
from google.oauth2.service_account import Credentials
from loguru import logger

from config import settings

# ---------------------------------------------------------------------------
# Configuração de escopos e cabeçalhos
# ---------------------------------------------------------------------------

_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]

# Cabeçalhos exibidos na primeira linha da aba
HEADERS = [
    "CID",
    "Nome",
    "Título",
    "Cidade",
    "Estado",
    "CEP",
    "Telefone 1",
    "Telefone 2",
    "Instagram",
    "Serviços",
    "Entrega",
    "URL",
    "Primeira vez visto",
    "Atualizado em",
]


# ---------------------------------------------------------------------------
# Classe principal
# ---------------------------------------------------------------------------

class SheetsClient:
    """
    Cliente para o Google Sheets.

    Uso:
        client = SheetsClient()
        client.connect()
        client.sync_leads(leads)
    """

    def __init__(self) -> None:
        self._gc: Optional[gspread.Client] = None
        self._sheet: Optional[gspread.Worksheet] = None

    def connect(self) -> None:
        """Autentica e abre a aba de destino (cria se não existir)."""
        if not settings.google_sheet_id:
            raise ValueError(
                "GOOGLE_SHEET_ID não definido no .env — "
                "copie o ID da URL da planilha."
            )

        creds = Credentials.from_service_account_file(
            settings.google_credentials_json, scopes=_SCOPES
        )
        self._gc = gspread.authorize(creds)

        spreadsheet = self._gc.open_by_key(settings.google_sheet_id)

        try:
            self._sheet = spreadsheet.worksheet(settings.sheet_tab_name)
            logger.info(
                f"Sheets: aba '{settings.sheet_tab_name}' aberta "
                f"na planilha {settings.google_sheet_id}"
            )
        except gspread.WorksheetNotFound:
            self._sheet = spreadsheet.add_worksheet(
                title=settings.sheet_tab_name,
                rows=10_000,
                cols=len(HEADERS),
            )
            logger.info(
                f"Sheets: aba '{settings.sheet_tab_name}' criada "
                f"na planilha {settings.google_sheet_id}"
            )

    def sync_leads(self, leads: list[dict]) -> int:
        """
        Substitui todo o conteúdo da aba pelos leads do SQLite.

        Estratégia: clear() + update() em 2 chamadas API.
        Garante que linhas removidas do DB (ex: duplicatas) não persistam.

        Args:
            leads: Lista de dicts retornada por database.get_all_leads()

        Returns:
            Número de linhas escritas (sem contar o cabeçalho).
        """
        if not self._sheet:
            self.connect()

        rows = [HEADERS]
        for lead in leads:
            phones: list = lead.get("phones", [])
            services: list = lead.get("services", [])
            delivery: list = lead.get("delivery_options", [])

            rows.append([
                lead.get("cid", ""),
                lead.get("name", ""),
                lead.get("title", ""),
                lead.get("city", ""),
                lead.get("state", ""),
                lead.get("zip_code", ""),
                phones[0] if len(phones) > 0 else "",
                phones[1] if len(phones) > 1 else "",
                lead.get("instagram", ""),
                ", ".join(str(s) for s in services),
                ", ".join(str(d) for d in delivery),
                lead.get("profile_url", ""),
                lead.get("first_seen", ""),
                lead.get("last_updated", ""),
            ])

        try:
            self._sheet.clear()
            self._sheet.update(rows, "A1")
            logger.info(
                f"Sheets sync concluída: {len(leads)} leads escritos "
                f"na aba '{settings.sheet_tab_name}'"
            )
            return len(leads)

        except gspread.exceptions.APIError as exc:
            # Quota excedida (HTTP 429) — aguarda e tenta mais uma vez
            if hasattr(exc, "response") and exc.response.status_code == 429:
                logger.warning("Sheets: quota excedida (429), aguardando 60s...")
                time.sleep(60)
                try:
                    self._sheet.clear()
                    self._sheet.update(rows, "A1")
                    logger.info(f"Sheets sync (retry): {len(leads)} leads escritos")
                    return len(leads)
                except Exception as retry_exc:
                    logger.error(f"Sheets sync falhou no retry: {retry_exc}")
                    return 0
            else:
                logger.error(f"Sheets APIError: {exc}")
                return 0

        except Exception as exc:
            logger.error(f"Sheets sync erro inesperado: {exc}")
            return 0

    def get_lead_count_in_sheet(self) -> int:
        """Retorna o número de linhas de dados na aba (sem contar cabeçalho)."""
        if not self._sheet:
            self.connect()
        all_values = self._sheet.get_all_values()
        return max(0, len(all_values) - 1)  # -1 para remover o cabeçalho
