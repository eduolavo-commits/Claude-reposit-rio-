"""
scraper.py — Automação Playwright para o localizador Mary Kay Brasil.

Fluxo real do site (confirmado por inspeção do HTML):
  1. Acessa /pt-br/locator
  2. Preenche #PostalCode (5 dígitos) + #PostalCodeExtenstion (3 dígitos)
  3. Clica em input#searchByPostalCodeorRgnandCityBtn
  4. Resultados aparecem em #searchresult com links de vanity URL
  5. Para cada vanity URL, visita o perfil e extrai todos os dados
  6. CID é extraído do próprio HTML do perfil (link self-ref ou img src)
"""
import asyncio
import functools
import random
from typing import Optional

from loguru import logger
from playwright.async_api import Browser, BrowserContext, Page, async_playwright

from config import settings
from parser import extract_profile_urls_from_search, parse_profile

# ---------------------------------------------------------------------------
# Seletores confirmados pela inspeção do HTML real
# ---------------------------------------------------------------------------

_ZIP_MAIN_INPUT  = "input#PostalCode"            # 5 primeiros dígitos
_ZIP_EXT_INPUT   = "input#PostalCodeExtenstion"  # 3 últimos dígitos
_ZIP_RADIO       = "input#Postalcode"            # seleciona modo CEP
_SEARCH_BTN      = "input#searchByPostalCodeorRgnandCityBtn"
_RESULTS_ANCHOR  = "a[href*='/locator/profile']"

# Indicadores de que o perfil foi carregado
_PROFILE_READY   = "h1, .ibc-title, .ibc-name"


# ---------------------------------------------------------------------------
# Decorador de retry com backoff exponencial
# ---------------------------------------------------------------------------

def _with_retry(max_attempts: int = 3, base_delay: float = 5.0):
    def decorator(fn):
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            for attempt in range(1, max_attempts + 1):
                try:
                    return await fn(*args, **kwargs)
                except Exception as exc:
                    if attempt == max_attempts:
                        logger.error(f"{fn.__name__} falhou após {max_attempts} tentativas: {exc}")
                        return [] if "search" in fn.__name__ else None
                    wait = base_delay * (2 ** (attempt - 1))
                    logger.warning(f"{fn.__name__} tentativa {attempt}/{max_attempts} ({exc}), aguardando {wait:.0f}s")
                    await asyncio.sleep(wait)
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
    # Ciclo de vida
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
                "--ignore-certificate-errors",
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
            ignore_https_errors=True,
        )
        # Bloqueia imagens/fontes para acelerar scraping
        await self._context.route(
            "**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,otf}",
            lambda route, _: route.abort(),
        )
        logger.info(f"Browser iniciado (headless={settings.headless})")

    async def stop(self) -> None:
        """Encerra o browser com segurança."""
        for obj in [self._context, self._browser, self._playwright]:
            try:
                if obj:
                    await obj.close() if hasattr(obj, "close") else await obj.stop()
            except Exception:
                pass
        logger.info("Browser encerrado.")

    # ------------------------------------------------------------------
    # Método 1: busca consultoras por CEP
    # ------------------------------------------------------------------

    @_with_retry(max_attempts=3, base_delay=5.0)
    async def search_by_cep(self, cep: str) -> list[str]:
        """
        Busca consultoras no localizador pelo CEP e retorna lista de URLs de perfil.

        Formulário real:
          input#PostalCode         ← 5 primeiros dígitos (ex: "01001")
          input#PostalCodeExtenstion ← 3 últimos dígitos  (ex: "000")
          input#searchByPostalCodeorRgnandCityBtn ← botão submit

        Retorna:
          Lista de URLs absolutas de perfil de consultoras.
        """
        # Separa CEP nos dois campos
        cep_clean = cep.replace("-", "").strip()
        main_part = cep_clean[:5]
        ext_part  = cep_clean[5:] if len(cep_clean) > 5 else "000"

        page = await self._context.new_page()
        try:
            await page.goto(
                settings.locator_base_url,
                wait_until="domcontentloaded",
                timeout=30_000,
            )
            await asyncio.sleep(1.5)

            # Dispensa cookie banner (apenas uma vez por sessão)
            if not self._cookie_dismissed:
                await self._dismiss_cookies(page)
                self._cookie_dismissed = True

            # Fecha qualquer modal sobreposto antes de interagir
            await self._dismiss_modals(page)

            # Seleciona o radio de busca por CEP
            try:
                await page.click(_ZIP_RADIO, timeout=3_000)
            except Exception:
                pass  # radio pode já estar selecionado

            # Preenche os campos de CEP
            await page.fill(_ZIP_MAIN_INPUT, main_part)
            await page.fill(_ZIP_EXT_INPUT, ext_part)

            # Fecha modais de novo antes do submit (podem ter aparecido)
            await self._dismiss_modals(page)

            # Submete o formulário via JavaScript (ignora interceptação por overlay)
            await page.evaluate(
                "document.getElementById('searchByPostalCodeorRgnandCityBtn').click()"
            )
            await asyncio.sleep(6)  # aguarda renderização dos resultados

            # Verifica links de perfil diretamente via query
            links = await page.query_selector_all(_RESULTS_ANCHOR)
            if not links:
                logger.info(f"CEP {cep}: sem resultados.")
                return []

            # Scroll para carregar lazy content
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(1)

            html = await page.content()
            profile_urls = extract_profile_urls_from_search(html)
            logger.info(f"CEP {cep}: {len(profile_urls)} consultora(s) encontrada(s).")
            return profile_urls

        except Exception as exc:
            logger.error(f"search_by_cep({cep}): {exc}")
            raise
        finally:
            await page.close()
            await self._random_delay()

    # ------------------------------------------------------------------
    # Método 2: busca e parseia perfil de consultora
    # ------------------------------------------------------------------

    @_with_retry(max_attempts=3, base_delay=5.0)
    async def fetch_profile(self, profile_url: str) -> Optional[dict]:
        """
        Visita a página de perfil de uma consultora e retorna seus dados.

        Args:
            profile_url: URL absoluta do perfil (vanity ou com cid=)

        Returns:
            Dict com dados do lead, ou None em caso de erro.
        """
        page = await self._context.new_page()
        try:
            await page.goto(profile_url, wait_until="domcontentloaded", timeout=30_000)

            # Aguarda o conteúdo principal carregar
            try:
                await page.wait_for_selector(_PROFILE_READY, timeout=15_000)
            except Exception:
                logger.warning(f"Perfil timeout: {profile_url[:80]}")

            await asyncio.sleep(2)

            html = await page.content()
            lead = parse_profile(html, profile_url=profile_url)

            if not lead.get("cid"):
                logger.warning(f"CID não extraído para: {profile_url[:80]}")

            return lead

        except Exception as exc:
            logger.error(f"fetch_profile({profile_url[:80]}): {exc}")
            raise
        finally:
            await page.close()
            await self._random_delay()

    # ------------------------------------------------------------------
    # Sessão de debug (para calibração de seletores)
    # ------------------------------------------------------------------

    async def debug_session(self, cep: str = "01001-000") -> None:
        """
        Executa uma busca de debug e salva os HTMLs para inspeção.

        Uso:
            python main.py --debug 01001-000
        """
        logger.info("=== MODO DEBUG ===")
        try:
            await self.start()
            profile_urls = await self.search_by_cep(cep)
            logger.info(f"URLs de perfil encontradas: {profile_urls}")

            if profile_urls:
                lead = await self.fetch_profile(profile_urls[0])
                logger.info(f"Lead extraído: {lead}")
        finally:
            await self.stop()

    # ------------------------------------------------------------------
    # Helpers internos
    # ------------------------------------------------------------------

    async def _dismiss_cookies(self, page: Page) -> None:
        """Tenta dispensar banners de cookies comuns."""
        for sel in [
            "button:has-text('Aceitar')",
            "button:has-text('Aceitar tudo')",
            "button:has-text('Concordo')",
            "#cookie-accept",
            "[class*='cookie'] button",
        ]:
            try:
                btn = await page.wait_for_selector(sel, timeout=2_000)
                if btn:
                    await btn.click()
                    await asyncio.sleep(0.5)
                    return
            except Exception:
                continue

    async def _dismiss_modals(self, page: Page) -> None:
        """Fecha modais sobrepostos que bloqueiam cliques no formulário."""
        # Tenta fechar via botão .close dentro de modais
        for sel in [
            "#message-modal .close",
            ".modal.in .close",
            ".modal.show .close",
            ".modal[aria-hidden='false'] .close",
            "button.close",
        ]:
            try:
                btn = await page.query_selector(sel)
                if btn:
                    await btn.click()
                    await asyncio.sleep(0.5)
            except Exception:
                pass

        # Força ocultação via JS de qualquer modal aberto
        try:
            await page.evaluate("""
                document.querySelectorAll('.modal.in, .modal.show, .modal[aria-hidden="false"]')
                    .forEach(m => {
                        m.classList.remove('in', 'show');
                        m.setAttribute('aria-hidden', 'true');
                        m.style.display = 'none';
                    });
                // Remove backdrop
                document.querySelectorAll('.modal-backdrop')
                    .forEach(b => b.remove());
                document.body.classList.remove('modal-open');
            """)
        except Exception:
            pass

    async def _random_delay(self) -> None:
        """Delay aleatório entre requests para não sobrecarregar o servidor."""
        delay = random.uniform(settings.request_delay_min, settings.request_delay_max)
        await asyncio.sleep(delay)
