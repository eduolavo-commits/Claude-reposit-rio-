"""
config.py — Carrega todas as configurações a partir do arquivo .env.
Todos os outros módulos importam `settings` daqui.
"""
import os
from dataclasses import dataclass
from pathlib import Path
from dotenv import load_dotenv

# Carrega .env do mesmo diretório que este arquivo
_env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_env_path)


@dataclass(frozen=True)
class Settings:
    google_credentials_json: str
    google_sheet_id: str
    sheet_tab_name: str
    db_path: str
    request_delay_min: float
    request_delay_max: float
    batch_size: int
    log_level: str
    headless: bool
    locator_base_url: str
    profile_base_url: str


settings = Settings(
    google_credentials_json=os.getenv("GOOGLE_CREDENTIALS_JSON", "credentials.json"),
    google_sheet_id=os.getenv("GOOGLE_SHEET_ID", ""),
    sheet_tab_name=os.getenv("SHEET_TAB_NAME", "Leads"),
    db_path=os.getenv("DB_PATH", "leads.db"),
    request_delay_min=float(os.getenv("REQUEST_DELAY_MIN", "2")),
    request_delay_max=float(os.getenv("REQUEST_DELAY_MAX", "5")),
    batch_size=int(os.getenv("BATCH_SIZE", "50")),
    log_level=os.getenv("LOG_LEVEL", "INFO"),
    headless=os.getenv("HEADLESS", "True").strip().lower() == "true",
    locator_base_url=os.getenv("LOCATOR_BASE_URL", "https://www.marykay.com.br/pt-br/locator"),
    profile_base_url=os.getenv("PROFILE_BASE_URL", "https://www.marykay.com.br/pt-br/locator/profile"),
)
