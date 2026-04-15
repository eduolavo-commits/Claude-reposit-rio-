"""
main.py — Entry point do sistema de scraping de leads Mary Kay Brasil.

Arquitetura:
  - Loop assíncrono contínuo: itera CEPs buscando leads novos
  - APScheduler: dispara sync para Google Sheets a cada 1 hora
  - Graceful shutdown em Ctrl+C / SIGTERM

Como executar:
  python main.py

Para debug com browser visível (calibrar seletores):
  python main.py --debug
"""
import asyncio
import sys
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from loguru import logger

from config import settings
from database import get_all_leads, get_lead_count, init_db, upsert_lead
from scraper import MaryKayScraper
from sheets_client import SheetsClient
from zip_codes import get_cep_cycle

# ---------------------------------------------------------------------------
# Estado global do daemon
# ---------------------------------------------------------------------------

_db_conn = None
_scraper: MaryKayScraper = None
_sheets: SheetsClient = None
_cep_iter = None
_stats = {
    "ceps_processados": 0,
    "leads_novos": 0,
    "leads_atualizados": 0,
    "syncs_realizados": 0,
    "erros": 0,
}


# ---------------------------------------------------------------------------
# Job de sincronização com Google Sheets (roda a cada 1 hora)
# ---------------------------------------------------------------------------

async def sync_to_sheets() -> None:
    """Sincroniza todos os leads do SQLite para o Google Sheets."""
    global _db_conn, _sheets, _stats

    logger.info("=== Iniciando sync horária para Google Sheets ===")
    try:
        leads = get_all_leads(_db_conn)
        count = _sheets.sync_leads(leads)
        _stats["syncs_realizados"] += 1
        logger.info(
            f"Sync concluída: {count} leads no Sheets | "
            f"Total no DB: {get_lead_count(_db_conn)} | "
            f"Syncs realizadas: {_stats['syncs_realizados']}"
        )
    except Exception as exc:
        logger.error(f"Sync falhou: {exc}")


# ---------------------------------------------------------------------------
# Loop principal de scraping (roda continuamente)
# ---------------------------------------------------------------------------

async def scraping_loop() -> None:
    """
    Laço infinito que percorre CEPs buscando leads.
    Em caso de erro em um CEP, loga e continua para o próximo.
    """
    global _cep_iter, _db_conn, _scraper, _stats

    logger.info("Loop de scraping iniciado.")

    while True:
        cep = next(_cep_iter)
        _stats["ceps_processados"] += 1

        try:
            # 1. Busca CIDs por CEP
            cids = await _scraper.search_by_cep(cep)

            # 2. Para cada CID, busca e salva o perfil
            for cid in cids:
                try:
                    lead = await _scraper.fetch_profile(cid)
                    if not lead:
                        continue

                    is_new = upsert_lead(_db_conn, lead)
                    if is_new:
                        _stats["leads_novos"] += 1
                        logger.info(
                            f"NOVO LEAD #{_stats['leads_novos']}: "
                            f"{lead.get('name', '?')} | {lead.get('city', '?')} | "
                            f"{lead.get('instagram', '')} | CID={cid}"
                        )
                    else:
                        _stats["leads_atualizados"] += 1
                        logger.debug(
                            f"Atualizado: {lead.get('name', '?')} | CID={cid}"
                        )

                except Exception as exc:
                    _stats["erros"] += 1
                    logger.error(f"Erro ao processar perfil {cid}: {exc}")

        except Exception as exc:
            _stats["erros"] += 1
            logger.error(f"Erro ao buscar CEP {cep}: {exc}")

        # Log de progresso a cada 10 CEPs
        if _stats["ceps_processados"] % 10 == 0:
            logger.info(
                f"Progresso | CEPs: {_stats['ceps_processados']} | "
                f"Novos: {_stats['leads_novos']} | "
                f"Atualizados: {_stats['leads_atualizados']} | "
                f"Erros: {_stats['erros']} | "
                f"Total DB: {get_lead_count(_db_conn)}"
            )


# ---------------------------------------------------------------------------
# Inicialização e shutdown
# ---------------------------------------------------------------------------

def _setup_logging() -> None:
    """Configura loguru: stderr + arquivo rotativo diário."""
    import os
    os.makedirs("logs", exist_ok=True)

    logger.remove()
    logger.add(
        sys.stderr,
        level=settings.log_level,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{line}</cyan> — "
            "<level>{message}</level>"
        ),
        colorize=True,
    )
    logger.add(
        "logs/scraper_{time:YYYY-MM-DD}.log",
        rotation="00:00",        # Rotaciona à meia-noite
        retention="30 days",     # Mantém 30 dias de histórico
        level="DEBUG",
        encoding="utf-8",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{line} — {message}",
    )


async def main() -> None:
    global _db_conn, _scraper, _sheets, _cep_iter

    _setup_logging()

    logger.info("=" * 60)
    logger.info("   Mary Kay Brazil — Sistema de Scraping de Leads")
    logger.info("=" * 60)
    logger.info(f"DB: {settings.db_path}")
    logger.info(f"Headless: {settings.headless}")
    logger.info(f"Log level: {settings.log_level}")

    # Inicializa componentes
    _db_conn = init_db(settings.db_path)
    _scraper = MaryKayScraper()
    _sheets = SheetsClient()
    _cep_iter = get_cep_cycle()

    await _scraper.start()

    # Conecta ao Sheets (valida credenciais antes de começar)
    try:
        _sheets.connect()
        logger.info("Conexão com Google Sheets: OK")
    except Exception as exc:
        logger.error(
            f"Falha ao conectar com Google Sheets: {exc}\n"
            "Verifique credentials.json e GOOGLE_SHEET_ID no .env.\n"
            "O scraper continuará rodando e tentará sincronizar na próxima hora."
        )

    # Configura o APScheduler para sync horária
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        sync_to_sheets,
        trigger=IntervalTrigger(hours=1),
        id="sheets_sync",
        misfire_grace_time=300,   # Tolera até 5 min de atraso
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler iniciado: sync com Sheets a cada 1 hora.")

    # Sync inicial logo após o start
    await sync_to_sheets()

    logger.info("Iniciando loop de scraping... (Ctrl+C para parar)")

    try:
        await scraping_loop()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Shutdown solicitado pelo usuário.")
    except Exception as exc:
        logger.critical(f"Erro fatal no loop principal: {exc}")
    finally:
        logger.info("Encerrando serviços...")
        scheduler.shutdown(wait=False)
        await _scraper.stop()
        if _db_conn:
            _db_conn.close()
        logger.info("Sistema encerrado.")


# ---------------------------------------------------------------------------
# Modo debug (calibração de seletores)
# ---------------------------------------------------------------------------

async def debug_mode(cep: str = "01001-000") -> None:
    """Executa uma sessão de debug para calibrar seletores CSS."""
    _setup_logging()
    scraper = MaryKayScraper()
    await scraper.debug_session(cep)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if "--debug" in sys.argv:
        cep = sys.argv[sys.argv.index("--debug") + 1] if (
            "--debug" in sys.argv
            and sys.argv.index("--debug") + 1 < len(sys.argv)
            and not sys.argv[sys.argv.index("--debug") + 1].startswith("--")
        ) else "01001-000"
        asyncio.run(debug_mode(cep))
    else:
        asyncio.run(main())
