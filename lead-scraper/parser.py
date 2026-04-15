"""
parser.py — Extração de dados de HTML usando BeautifulSoup.

Dois pontos de entrada públicos:
  - extract_cids_from_search_results(html) → list[str]
  - parse_profile(html, cid, profile_url)   → dict

Os seletores CSS estão separados em constantes para fácil calibração
após a sessão de debug com HEADLESS=False.
"""
import re
from typing import Optional

from bs4 import BeautifulSoup
from loguru import logger

# ---------------------------------------------------------------------------
# Padrões regex
# ---------------------------------------------------------------------------

_UUID_PATTERN = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE,
)

_PHONE_PATTERN = re.compile(
    r"\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}"
)

_CEP_PATTERN = re.compile(r"\d{5}-?\d{3}")

# ---------------------------------------------------------------------------
# Seletores CSS — AJUSTE AQUI após sessão de calibração com HEADLESS=False
# ---------------------------------------------------------------------------

# Página de resultados de busca
_RESULT_LINK_SELECTORS = [
    "a[href*='cid=']",          # Link direto com ?cid=UUID
    "a[href*='/profile']",      # Links de perfil em geral
    "[data-cid]",               # Atributo data-cid nos cards
]

# Página de perfil individual
_NAME_SELECTORS = [
    "h1",
    ".consultant-name",
    "[class*='consultantName']",
    "[class*='consultant-name']",
    "[class*='profile-name']",
    "[class*='profileName']",
    "[class*='name']",
]

_TITLE_SELECTORS = [
    ".consultant-title",
    "[class*='consultantTitle']",
    "[class*='consultant-title']",
    "[class*='profile-title']",
    "[class*='profileTitle']",
    "[class*='title']",
]

_LOCATION_SELECTORS = [
    "[class*='location']",
    "[class*='address']",
    "[class*='cidade']",
    "[class*='city']",
    "address",
]

_SERVICES_SELECTORS = [
    "[class*='service']",
    "[class*='servico']",
    "[class*='offering']",
]

_DELIVERY_SELECTORS = [
    "[class*='delivery']",
    "[class*='entrega']",
    "[class*='shipping']",
]


# ---------------------------------------------------------------------------
# Função 1: extrai CIDs da página de resultados
# ---------------------------------------------------------------------------

def extract_cids_from_search_results(html: str) -> list[str]:
    """
    Analisa o HTML da página de busca por CEP e retorna lista de CIDs únicos.

    Estratégias (em ordem de confiabilidade):
    1. href de links contendo '?cid=<UUID>'
    2. Atributos data-cid nos cards
    3. Qualquer UUID em hrefs de links /profile
    """
    soup = BeautifulSoup(html, "html.parser")
    cids: list[str] = []
    seen: set[str] = set()

    def _add(cid: str) -> None:
        cid = cid.lower().strip()
        if cid and cid not in seen:
            seen.add(cid)
            cids.append(cid)

    # Estratégia 1 & 3: href com UUID
    for tag in soup.find_all(href=True):
        href: str = tag["href"]
        if "cid=" in href or "/profile" in href:
            match = _UUID_PATTERN.search(href)
            if match:
                _add(match.group(0))

    # Estratégia 2: atributo data-cid
    for tag in soup.find_all(attrs={"data-cid": True}):
        _add(str(tag["data-cid"]))

    if cids:
        logger.debug(f"extract_cids: encontrados {len(cids)} CID(s)")
    else:
        logger.debug("extract_cids: nenhum CID encontrado no HTML — seletores precisam calibração?")

    return cids


# ---------------------------------------------------------------------------
# Função 2: parseia a página de perfil de uma consultora
# ---------------------------------------------------------------------------

def parse_profile(html: str, cid: str, profile_url: str) -> dict:
    """
    Extrai todos os campos públicos de uma página de perfil de consultora.

    Retorna dict com campos:
      cid, name, title, city, state, zip_code,
      phones, instagram, services, delivery_options, profile_url
    """
    soup = BeautifulSoup(html, "html.parser")

    name = _extract_name(soup)
    title = _extract_title(soup)
    city, state, zip_code = _extract_location(soup)
    phones = _extract_phones(soup)
    instagram = _extract_instagram(soup)
    services = _extract_list_section(soup, _SERVICES_SELECTORS)
    delivery_options = _extract_list_section(soup, _DELIVERY_SELECTORS)

    lead = {
        "cid": cid,
        "name": name,
        "title": title,
        "city": city,
        "state": state,
        "zip_code": zip_code,
        "phones": phones,
        "instagram": instagram,
        "services": services,
        "delivery_options": delivery_options,
        "profile_url": profile_url,
    }

    if not name:
        logger.warning(
            f"parse_profile: nome vazio para CID {cid} — "
            "verifique os seletores CSS em _NAME_SELECTORS"
        )

    logger.debug(
        f"Perfil parseado: cid={cid} name='{name}' city='{city}' "
        f"phones={phones} instagram='{instagram}'"
    )
    return lead


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _first_text(soup: BeautifulSoup, selectors: list[str]) -> str:
    """Retorna o texto do primeiro elemento encontrado pelos seletores."""
    for sel in selectors:
        try:
            el = soup.select_one(sel)
            if el:
                text = el.get_text(separator=" ", strip=True)
                if text:
                    return text
        except Exception:
            continue
    return ""


def _extract_name(soup: BeautifulSoup) -> str:
    text = _first_text(soup, _NAME_SELECTORS)
    # Remove títulos comuns que possam estar embutidos no h1
    for suffix in [" - Mary Kay", " | Mary Kay", " – Mary Kay"]:
        if suffix in text:
            text = text.split(suffix)[0].strip()
    return text


def _extract_title(soup: BeautifulSoup) -> str:
    return _first_text(soup, _TITLE_SELECTORS)


def _extract_location(soup: BeautifulSoup) -> tuple[str, str, str]:
    """Tenta extrair cidade, estado (sigla) e CEP do bloco de localização."""
    city, state, zip_code = "", "", ""

    location_text = _first_text(soup, _LOCATION_SELECTORS)

    # Tenta extrair CEP do texto (formato 00000-000)
    cep_match = _CEP_PATTERN.search(location_text)
    if cep_match:
        zip_code = cep_match.group(0)

    # Padrão: "Cidade - UF" ou "Cidade, UF"
    city_state_pattern = re.search(
        r"([A-ZÀ-Ÿa-zà-ÿ\s]+)\s*[-,]\s*([A-Z]{2})", location_text
    )
    if city_state_pattern:
        city = city_state_pattern.group(1).strip()
        state = city_state_pattern.group(2).strip()

    # Fallback: busca tags separadas por cidade e estado
    if not city:
        for sel in ["[class*='city']", "[class*='cidade']"]:
            try:
                el = soup.select_one(sel)
                if el:
                    city = el.get_text(strip=True)
                    break
            except Exception:
                pass

    if not state:
        for sel in ["[class*='state']", "[class*='estado']"]:
            try:
                el = soup.select_one(sel)
                if el:
                    state = el.get_text(strip=True)
                    break
            except Exception:
                pass

    return city, state, zip_code


def _extract_phones(soup: BeautifulSoup) -> list[str]:
    """Extrai telefones de links tel: e texto com padrão de fone."""
    phones: list[str] = []
    seen: set[str] = set()

    def _add_phone(raw: str) -> None:
        # Normaliza: mantém apenas dígitos + parênteses + traço + espaço
        cleaned = raw.replace("tel:", "").strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            phones.append(cleaned)

    # Links tel:
    for a in soup.find_all("a", href=True):
        href: str = a["href"]
        if href.startswith("tel:"):
            _add_phone(href)

    # Texto da página com padrão de telefone
    for text_node in soup.find_all(string=_PHONE_PATTERN):
        for match in _PHONE_PATTERN.finditer(text_node):
            _add_phone(match.group(0))

    return phones[:5]  # limita a 5 telefones por segurança


def _extract_instagram(soup: BeautifulSoup) -> str:
    """Extrai handle do Instagram (sem @)."""
    # Links para instagram.com
    for a in soup.find_all("a", href=True):
        href: str = a["href"]
        if "instagram.com" in href:
            handle = href.rstrip("/").split("/")[-1]
            # Remove query strings
            handle = handle.split("?")[0]
            if handle and handle not in ("", "instagram.com"):
                return handle

    # Texto com @handle
    ig_pattern = re.compile(r"@([\w.]{3,30})")
    for text_node in soup.find_all(string=ig_pattern):
        match = ig_pattern.search(str(text_node))
        if match:
            return match.group(1)

    return ""


def _extract_list_section(soup: BeautifulSoup, selectors: list[str]) -> list[str]:
    """Extrai itens de uma seção de lista (serviços, entregas, etc.)."""
    items: list[str] = []

    for sel in selectors:
        try:
            section = soup.select_one(sel)
            if not section:
                continue
            # Tenta li filhos
            lis = section.find_all("li")
            if lis:
                items = [li.get_text(strip=True) for li in lis if li.get_text(strip=True)]
            else:
                # Fallback: texto direto da seção
                text = section.get_text(separator="\n", strip=True)
                items = [t for t in text.splitlines() if t]
            if items:
                break
        except Exception:
            continue

    return items
