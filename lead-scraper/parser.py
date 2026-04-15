"""
parser.py — Extração de dados de HTML usando BeautifulSoup.

Seletores calibrados com HTML real do site marykay.com.br (Abril/2026).

Dois pontos de entrada públicos:
  - extract_profile_urls_from_search(html)  → list[str]  (URLs das consultoras)
  - parse_profile(html, profile_url)        → dict       (dados completos)

A função parse_profile também extrai o CID de dentro do HTML do perfil.
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

_PHONE_PATTERN = re.compile(r"\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}")
_CEP_PATTERN   = re.compile(r"\d{5}-?\d{3}")

# Base do site para construir URLs absolutas
_BASE_URL = "https://www.marykay.com.br"


# ---------------------------------------------------------------------------
# Função 1: extrai URLs de perfil da página de resultados de busca por CEP
# ---------------------------------------------------------------------------

def extract_profile_urls_from_search(html: str) -> list[str]:
    """
    Analisa o HTML da página de busca (após submit do formulário de CEP)
    e retorna URLs absolutas dos perfis das consultoras encontradas.

    Estrutura real do site:
      #searchresult  →  <a href="/slug/pt-br/locator/profile?fromLocator=True...">
    """
    soup = BeautifulSoup(html, "html.parser")
    urls: list[str] = []
    seen: set[str] = set()

    # Foco na seção de resultados
    result_section = soup.find(id="searchresult") or soup

    for a in result_section.find_all("a", href=True):
        href: str = a["href"]
        # Links de perfil do localizador (vanity URLs)
        if "/locator/profile" in href and "fromLocator=True" in href:
            # Constrói URL absoluta
            full_url = href if href.startswith("http") else f"{_BASE_URL}{href}"
            # Normaliza: garante que é unique
            key = full_url.split("?")[0]
            if key not in seen:
                seen.add(key)
                urls.append(full_url)

    if urls:
        logger.debug(f"extract_profile_urls: {len(urls)} perfil(is) encontrado(s)")
    else:
        logger.debug("extract_profile_urls: nenhum perfil encontrado nos resultados")

    return urls


# ---------------------------------------------------------------------------
# Função 2: parseia a página de perfil de uma consultora
# ---------------------------------------------------------------------------

def parse_profile(html: str, profile_url: str) -> dict:
    """
    Extrai todos os campos públicos de uma página de perfil de consultora.

    Seletores confirmados com HTML real:
      - h1                    → nome
      - .ibc-title            → título (Consultora / Diretora)
      - .city                 → cidade
      - .state                → estado (UF)
      - .location             → texto com cidade+UF+CEP
      - a[href^="tel:"]       → telefones
      - a[href*="instagram"]  → instagram (excluindo marykaybrasil)
      - .specialties ul li    → especialidades/serviços
      - .options ul li        → opções de entrega
      - a[href*="cid="]       → CID (UUID) da consultora

    Retorna dict com:
      cid, name, title, city, state, zip_code,
      phones, instagram, services, delivery_options, profile_url
    """
    soup = BeautifulSoup(html, "html.parser")

    cid           = _extract_cid(soup, profile_url)
    name          = _extract_name(soup)
    title         = _extract_title(soup)
    city, state, zip_code = _extract_location(soup)
    phones        = _extract_phones(soup)
    instagram     = _extract_instagram(soup)
    services      = _extract_items(soup, ".specialties ul li", ".specialties li")
    delivery_opts = _extract_items(soup, ".options ul li", ".options li")

    lead = {
        "cid":              cid,
        "name":             name,
        "title":            title,
        "city":             city,
        "state":            state,
        "zip_code":         zip_code,
        "phones":           phones,
        "instagram":        instagram,
        "services":         services,
        "delivery_options": delivery_opts,
        "profile_url":      profile_url,
    }

    logger.debug(
        f"Perfil: cid={cid} nome='{name}' cidade='{city}/{state}' "
        f"fones={phones} ig='{instagram}'"
    )
    return lead


# ---------------------------------------------------------------------------
# Helpers internos — todos baseados em seletores confirmados
# ---------------------------------------------------------------------------

def _extract_cid(soup: BeautifulSoup, profile_url: str) -> str:
    """
    Extrai o CID (UUID) da consultora.
    Prioridade:
      1. Link self-referenciante com ?cid=UUID no perfil
      2. UUID em src de imagens de consultora
      3. UUID já presente na profile_url
    """
    # 1. Link com cid= dentro do próprio perfil
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "cid=" in href:
            m = _UUID_PATTERN.search(href)
            if m:
                return m.group(0).lower()

    # 2. UUID em src de imagem do caminho /consultant/images/BR/{uuid}/
    img_cid_pattern = re.compile(
        r"/consultant/images/BR/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/",
        re.IGNORECASE,
    )
    for img in soup.find_all(["img", "meta"], src=True):
        m = img_cid_pattern.search(img.get("src", "") or img.get("content", ""))
        if m:
            return m.group(1).lower()
    for meta in soup.find_all("meta", content=True):
        m = img_cid_pattern.search(meta.get("content", ""))
        if m:
            return m.group(1).lower()

    # 3. UUID na própria URL recebida
    m = _UUID_PATTERN.search(profile_url)
    if m:
        return m.group(0).lower()

    return ""


def _extract_name(soup: BeautifulSoup) -> str:
    """
    Nome da consultora.
    Estrutura real: <div class="ibc-name"><h1 ...>Nome</h1>...
    Fallback: og:title "Nome — Título Perfil"
    """
    # 1. h1 dentro de .ibc-name (o mais confiável)
    el = soup.select_one(".ibc-name h1")
    if el:
        return el.get_text(strip=True)

    # 2. og:title — formato "Nome — Título Perfil"
    og = soup.find("meta", property="og:title") or soup.find("meta", attrs={"property": "og:title"})
    if og and og.get("content"):
        raw = og["content"]
        if " — " in raw:
            return raw.split(" — ")[0].strip()
        if " - " in raw:
            return raw.split(" - ")[0].strip()

    # 3. Qualquer h1 na página (fallback)
    h1 = soup.find("h1")
    if h1:
        return h1.get_text(strip=True)

    return ""


def _extract_title(soup: BeautifulSoup) -> str:
    """Título da consultora — classe .ibc-title."""
    el = soup.select_one(".ibc-title")
    if el:
        return el.get_text(strip=True)
    # Fallback: qualquer elemento com "title" no nome da classe
    el = soup.select_one("[class*='title']")
    if el:
        t = el.get_text(strip=True)
        if len(t) < 80:
            return t
    return ""


def _extract_location(soup: BeautifulSoup) -> tuple[str, str, str]:
    """
    Extrai cidade, estado (UF) e CEP.

    Estrutura real confirmada:
      <span class="city">SAO PAULO,</span>
      <span class="state">SP</span>
      <span class="zip">02316-100</span>
    """
    city     = ""
    state    = ""
    zip_code = ""

    city_el = soup.select_one(".city")
    if city_el:
        city = city_el.get_text(strip=True).rstrip(",").strip()

    state_el = soup.select_one(".state")
    if state_el:
        state = state_el.get_text(strip=True).strip()

    # .zip é o span separado (mais confiável que extrair do .location)
    zip_el = soup.select_one(".zip")
    if zip_el:
        zip_code = zip_el.get_text(strip=True).strip()
    else:
        # Fallback: regex no .location
        loc_el = soup.select_one(".location")
        if loc_el:
            cep_m = _CEP_PATTERN.search(loc_el.get_text(strip=True))
            if cep_m:
                zip_code = cep_m.group(0)

    return city, state, zip_code


def _extract_phones(soup: BeautifulSoup) -> list[str]:
    """Extrai telefones de links tel: (formato real: href='tel:(31) 99132-9302')."""
    phones: list[str] = []
    seen:   set[str]  = set()

    for a in soup.find_all("a", href=True):
        href: str = a["href"]
        if href.startswith("tel:"):
            number = href.replace("tel:", "").strip()
            if number and number not in seen:
                seen.add(number)
                phones.append(number)

    # Fallback: padrão de telefone em texto
    if not phones:
        for text_node in soup.find_all(string=_PHONE_PATTERN):
            for match in _PHONE_PATTERN.finditer(str(text_node)):
                n = match.group(0).strip()
                if n not in seen:
                    seen.add(n)
                    phones.append(n)

    return phones[:5]


def _extract_instagram(soup: BeautifulSoup) -> str:
    """
    Extrai o handle do Instagram (sem @).
    Ignora o perfil oficial marykaybrasil.
    Formato real: href='http://www.instagram.com/samantha_claudia_'
    """
    for a in soup.find_all("a", href=True):
        href: str = a["href"]
        if "instagram.com" in href:
            handle = href.rstrip("/").split("/")[-1].split("?")[0]
            if handle and handle.lower() not in ("", "instagram.com", "marykaybrasil"):
                return handle

    # Fallback: @handle em texto
    ig_pattern = re.compile(r"@([\w.]{3,30})")
    for text_node in soup.find_all(string=ig_pattern):
        m = ig_pattern.search(str(text_node))
        if m:
            return m.group(1)

    return ""


def _extract_items(soup: BeautifulSoup, *selectors: str) -> list[str]:
    """
    Extrai lista de itens por seletores CSS (tenta em ordem).

    Exemplos confirmados:
      '.specialties ul li' → ['Cuidados com a Pele', 'Dicas de Maquiagem', ...]
      '.options ul li'     → ['Entrego na sua Casa', 'Envio pelos Correios', ...]
    """
    for sel in selectors:
        try:
            items = [el.get_text(strip=True) for el in soup.select(sel) if el.get_text(strip=True)]
            if items:
                return items
        except Exception:
            continue
    return []
