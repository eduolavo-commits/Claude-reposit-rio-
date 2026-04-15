"""
scraper.py — Automação Playwright para o localizador Mary Kay Brasil.

Responsabilidades:
  - Abrir/fechar o browser Chromium (headless ou visível)
  - search_by_cep(cep)   → list[str]  — busca consultoras por CEP
  - fetch_profile(cid)   → dict|None  — busca dados de uma consultora
  - debug_session(cep)   — abre browser visível e salva HTML para calibração

Configuração dos seletores: edite as constantes no topo de cada método
ou nas constantes de módulo abaixo.
"""
import asyncio
import functools
import random
from pathlib import Path
from typing import Optional

from loguru import logger
from playwright.async_api import (
    Browser,
    BrowserContext,
    Page,
    async_playwright,
)

from config import settings
from parser import extract_cids_from_search_results, parse_profile

# ---------------------------------------------------------------------------
# Seletores CSS — AJUSTE APÓS SESSÃO DE CALIBRAÇÃO (HEADLESS=False)
# ---------------------------------------------------------------------------

# Formulário de busca por CEP
_ZIP_INPUT_SELECTORS = [
    "input[placeholder*='CEP']",
    "input[placeholder*='cep']",
    "input[name*='zip']",
    "input[name*='cep']",
    "input[id*='zip']",
    "input[id*='cep']",
    "input[type='text']",      # fallback genérico — use com cuidado
]

_SEARCH_BTN_SELECTORS = [
    "button[type='submit']",
    "button:has-text('Buscar')",
    "button:has-text('Pesquisar')",
    "button:has-text('Localizar')",
    "button:has-text('Search')",
    "input[type='submit']",
]

# Indicador de resultados carregados
_RESULT_INDICATORS = [
    "a[href*='cid=']",
    "a[href*='/profile']",
    "[data-cid]",
    "[class*='result']",
    "[class*='consultant']",
    "[class*='locator-card']",
]

# Indicador de perfil carregado
_PROFILE_LOADED_INDICATORS = [
    "h1",
    "[class*='consultantName']",
    "[class*='consultant-name']",
    "[class*='profile']",
]

# Banners de cookies comuns
_COOKIE_ACCEPT_SELECTORS = [
    "button:has-text('Aceitar')",
    "button:has-text('Aceitar tudo')",
    "button:has-text('Concordo')",
    "button:has-text('Accept')",
    "button:has-text('Accept All')",
    "#cookie-accept",
    "[class*='cookie'] button",
    "[id*='cookie'] button",
    "[class*='consent'] button",
]

# ---------------------------------------------------------------------------
# Decorador de retry com backoff exponencial
# ---------------------------------------------------------------------------

def _with_retry(max_attempts: int = 3, base_delay: float = 5.0):
    """Aplica retry com backoff exponencial a métodos async."""
    def decorator(fn):
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return await fn(*args, **kwargs)
                except Exception as exc:
                    last_exc = exc
                    if attempt == max_attempts:
                        logger.error(
                            f"{fn.__name__} falhou após {max_attempts} tentativas: {exc}"
                        )
                        return None
                    wait = base_delay * (2 ** (attempt - 1))
                    logger.warning(
                        f"{fn.__name__} tentativa {attempt}/{max_attempts} falhou "
                        f"({exc}), aguardando {wait:.0f}s..."
                    )
                    await asyncio.sleep(wait)
            return None
        return wrapper
    return decorator


# ---------------------------------------------------------------------------
# Classe principal
# ---------------------------------------------------------------------------

class MaryKayScraper:
    """Gerencia um browser Playwright e expõe métodos de scraping."""

    def __init__(self) -> None:
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._cookie_dismissed: bool = False

    # ------------------------------------------------------------------
    # Ciclo de vida do browser
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Inicia o Playwright e lança o Chromium."""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=settings.headless,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
            ],
        )
        self._context = await self._browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
            viewport={"width": 1280, "height": 800},
        )
        # Bloqueia recursos desnecessários para ganhar velocidade
        await self._context.route(
            "**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,otf}",
            lambda route, _: route.abort(),
        )
        logger.info(
            f"Browser iniciado (headless={settings.headless})"
        )

    async def stop(self) -> None:
        """Encerra o browser com segurança."""
        try:
            if self._context:
                await self._context.close()
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()
        except Exception as exc:
            logger.warning(f"Erro ao encerrar browser: {exc}")
        logger.info("Browser encerrado.")

    # ------------------------------------------------------------------
    # Método 1: busca por CEP
    # ------------------------------------------------------------------

    @_with_retry(max_attempts=3, base_delay=5.0)
    async def search_by_cep(self, cep: str) -> list[str]:
        """
        Navega ao localizador, insere o CEP e retorna lista de CIDs.

        Args:
            cep: CEP no formato '01001-000' ou '01001000'

        Returns:
            Lista de UUIDs das consultoras encontradas.
        """
        cep_clean = cep.replace("-", "").strip()
        page = await self._context.new_page()
        try:
            # 1. Navega ao localizador
            await page.goto(
                settings.locator_base_url,
                wait_until="domcontentloaded",
                timeout=30_000,
            )

            # 2. Dispensa banner de cookies (uma vez por sessão)
            if not self._cookie_dismissed:
                await self._dismiss_cookies(page)
                self._cookie_dismissed = True

            # 3. Localiza o campo de CEP
            zip_input = await self._find_element(page, _ZIP_INPUT_SELECTORS, timeout=10_000)
            if not zip_input:
                logger.warning(f"CEP {cep}: campo de input não encontrado.")
                return []

            await zip_input.click()
            await zip_input.fill("")
            await zip_input.type(cep_clean, delay=80)  # digita como humano

            # 4. Submete a busca
            submitted = await self._submit_search(page, zip_input)
            if not submitted:
                logger.warning(f"CEP {cep}: não foi possível submeter o formulário.")
                return []

            # 5. Aguarda resultados
            try:
                await page.wait_for_selector(
                    ", ".join(_RESULT_INDICATORS),
                    timeout=20_000,
                )
            except Exception:
                logger.info(f"CEP {cep}: sem resultados ou timeout aguardando cards.")
                return []

            # Scroll para garantir lazy-loading
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(1.5)

            html = await page.content()
            cids = extract_cids_from_search_results(html)
            logger.info(f"CEP {cep}: {len(cids)} consultora(s) encontrada(s).")
            return cids

        except Exception as exc:
            logger.error(f"search_by_cep({cep}) erro: {exc}")
            raise
        finally:
            await page.close()
            await self._random_delay()

    # ------------------------------------------------------------------
    # Método 2: busca perfil individual
    # ------------------------------------------------------------------

    @_with_retry(max_attempts=3, base_delay=5.0)
    async def fetch_profile(self, cid: str) -> Optional[dict]:
        """
        Busca e parseia a página de perfil de uma consultora.

        Args:
            cid: UUID da consultora (ex: '017da79e-921a-4744-ae74-81f0393aaca0')

        Returns:
            Dict com dados do lead ou None em caso de erro.
        """
        url = (
            f"{settings.profile_base_url}"
            f"?cid={cid}&fromLocator=True&searchMethod=zip%20code"
        )
        page = await self._context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)

            # Aguarda o nome da consultora aparecer
            try:
                await page.wait_for_selector(
                    ", ".join(_PROFILE_LOADED_INDICATORS),
                    timeout=15_000,
                )
            except Exception:
                logger.warning(f"Perfil {cid}: timeout aguardando conteúdo — possível 404?")

            html = await page.content()
            lead = parse_profile(html, cid=cid, profile_url=url)
            return lead

        except Exception as exc:
            logger.error(f"fetch_profile({cid}) erro: {exc}")
            raise
        finally:
            await page.close()
            await self._random_delay()

    # ------------------------------------------------------------------
    # Sessão de debug (calibração dos seletores)
    # ------------------------------------------------------------------

    async def debug_session(self, cep: str = "01001-000") -> None:
        """
        Abre o browser VISIVELMENTE, faz uma busca pelo CEP informado e
        salva os HTMLs em arquivos locais para inspeção.

        Uso:
            import asyncio
            from scraper import MaryKayScraper
            asyncio.run(MaryKayScraper().debug_session("01001-000"))
        """
        logger.info("=== MODO DEBUG — browser visível ===")
        # Força headless=False independente do .env
        orig_headless = settings.headless
        object.__setattr__(settings, "headless", False)

        try:
            await self.start()
            page = await self._context.new_page()

            logger.info(f"Abrindo localizador para CEP {cep} ...")
            await page.goto(settings.locator_base_url, wait_until="networkidle", timeout=30_000)

            search_html = await page.content()
            Path("debug_search_page.html").write_text(search_html, encoding="utf-8")
            logger.info("HTML da página de busca salvo em: debug_search_page.html")

            # Extrai CIDs para testar perfil
            cids = extract_cids_from_search_results(search_html)
            logger.info(f"CIDs encontrados na página de busca: {cids}")

            if cids:
                profile_cid = cids[0]
                profile_url = (
                    f"{settings.profile_base_url}"
                    f"?cid={profile_cid}&fromLocator=True&searchMethod=zip%20code"
                )
                logger.info(f"Abrindo perfil: {profile_url}")
                await page.goto(profile_url, wait_until="networkidle", timeout=30_000)
                profile_html = await page.content()
                Path("debug_profile_page.html").write_text(profile_html, encoding="utf-8")
                logger.info("HTML do perfil salvo em: debug_profile_page.html")

            logger.info("Debug concluído. Verifique os arquivos HTML e ajuste os seletores em parser.py")
            await page.close()
        finally:
            await self.stop()
            object.__setattr__(settings, "headless", orig_headless)

    # ------------------------------------------------------------------
    # Helpers internos
    # ------------------------------------------------------------------

    async def _dismiss_cookies(self, page: Page) -> None:
        """Tenta dispensar banners de cookies comuns."""
        for sel in _COOKIE_ACCEPT_SELECTORS:
            try:
                btn = await page.wait_for_selector(sel, timeout=3_000)
                if btn:
                    await btn.click()
                    logger.debug(f"Cookie banner dispensado via '{sel}'")
                    await asyncio.sleep(0.5)
                    return
            except Exception:
                continue

    async def _find_element(self, page: Page, selectors: list[str], timeout: int = 10_000):
        """Tenta cada seletor em ordem e retorna o primeiro elemento encontrado."""
        for sel in selectors:
            try:
                el = await page.wait_for_selector(sel, timeout=timeout // len(selectors))
                if el:
                    return el
            except Exception:
                continue
        return None

    async def _submit_search(self, page: Page, zip_input) -> bool:
        """Tenta clicar em um botão de busca ou pressionar Enter."""
        # Tenta botão de submit
        for sel in _SEARCH_BTN_SELECTORS:
            try:
                btn = await page.wait_for_selector(sel, timeout=3_000)
                if btn:
                    await btn.click()
                    return True
            except Exception:
                continue

        # Fallback: pressiona Enter no campo
        try:
            await zip_input.press("Enter")
            return True
        except Exception:
            return False

    async def _random_delay(self) -> None:
        """Aguarda um tempo aleatório entre requests para respeitar o servidor."""
        delay = random.uniform(settings.request_delay_min, settings.request_delay_max)
        await asyncio.sleep(delay)
