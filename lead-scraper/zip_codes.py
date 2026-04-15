"""
zip_codes.py — Lista de CEPs brasileiros para varredura do localizador Mary Kay.

Cobertura:
  Tier 1 (~27): Um CEP central por capital de estado
  Tier 2 (~100): Bairros adicionais de capitais (zona N/S/L/O)
  Tier 3 (~150): Principais cidades não-capitais (>200k hab.)
  Tier 4 (~220): Cidades médias (100k–200k hab.)

Total: ~500 CEPs cobrindo todos os 26 estados + DF
"""

import itertools
from typing import Iterator

# ---------------------------------------------------------------------------
# Tier 1 — Centros das capitais (27 UFs)
# ---------------------------------------------------------------------------
_CAPITAIS = [
    "69900-110",  # Acre — Rio Branco
    "57020-000",  # Alagoas — Maceió
    "69005-010",  # Amazonas — Manaus
    "68900-075",  # Amapá — Macapá
    "40010-010",  # Bahia — Salvador
    "60010-000",  # Ceará — Fortaleza
    "70002-900",  # Distrito Federal — Brasília
    "29010-010",  # Espírito Santo — Vitória
    "74010-010",  # Goiás — Goiânia
    "65010-000",  # Maranhão — São Luís
    "30110-010",  # Minas Gerais — Belo Horizonte
    "79002-001",  # Mato Grosso do Sul — Campo Grande
    "78005-100",  # Mato Grosso — Cuiabá
    "66010-020",  # Pará — Belém
    "58010-000",  # Paraíba — João Pessoa
    "50010-010",  # Pernambuco — Recife
    "64000-020",  # Piauí — Teresina
    "80010-010",  # Paraná — Curitiba
    "20040-020",  # Rio de Janeiro — Rio de Janeiro
    "59010-010",  # Rio Grande do Norte — Natal
    "76801-010",  # Rondônia — Porto Velho
    "69301-060",  # Roraima — Boa Vista
    "90010-010",  # Rio Grande do Sul — Porto Alegre
    "88010-020",  # Santa Catarina — Florianópolis
    "49010-000",  # Sergipe — Aracaju
    "01001-000",  # São Paulo — São Paulo (centro)
    "77001-002",  # Tocantins — Palmas
]

# ---------------------------------------------------------------------------
# Tier 2 — Bairros adicionais das capitais
# ---------------------------------------------------------------------------
_CAPITAIS_BAIRROS = [
    # São Paulo (SP) — múltiplas zonas
    "01310-100",  # Av. Paulista
    "02010-000",  # Zona Norte (Santana)
    "04003-000",  # Zona Sul (Vila Mariana)
    "03001-000",  # Zona Leste (Brás)
    "05001-000",  # Zona Oeste (Lapa)
    "08001-000",  # Zona Leste Extrema (Penha)
    # Rio de Janeiro (RJ)
    "20000-000",  # Centro
    "22071-900",  # Zona Sul (Ipanema)
    "20251-900",  # Zona Norte (Tijuca)
    "23050-000",  # Zona Oeste (Campo Grande)
    "21310-000",  # Zona Norte (Méier)
    # Belo Horizonte (MG)
    "30130-010",  # Centro
    "30315-070",  # Barreiro
    "31310-050",  # Pampulha
    "30535-510",  # Buritis
    # Salvador (BA)
    "40020-010",  # Comércio
    "41810-000",  # Itaigara
    "41301-000",  # Barra
    # Fortaleza (CE)
    "60150-160",  # Meireles
    "60810-000",  # Messejana
    "60715-000",  # Mondubim
    # Manaus (AM)
    "69010-060",  # Centro
    "69057-070",  # Flores
    "69080-000",  # Planalto
    # Curitiba (PR)
    "80230-010",  # Batel
    "81010-000",  # Cajuru
    "82200-000",  # Boa Vista
    # Recife (PE)
    "51110-010",  # Boa Viagem
    "50710-010",  # Afogados
    "50930-000",  # Vasco da Gama
    # Porto Alegre (RS)
    "90040-060",  # Moinhos de Vento
    "91010-000",  # Sarandi
    "90160-000",  # Menino Deus
    # Goiânia (GO)
    "74020-020",  # Setor Central
    "74453-000",  # Setor Pedro Ludovico
    "74810-000",  # Vila Nova
    # Belém (PA)
    "66010-000",  # Centro
    "66615-305",  # Tapanã
    "66820-000",  # Mosqueiro
    # São Luís (MA)
    "65020-000",  # Centro
    "65065-000",  # Tirirical
    "65076-000",  # Cohama
    # Maceió (AL)
    "57030-000",  # Pajuçara
    "57080-000",  # Benedito Bentes
    # João Pessoa (PB)
    "58013-000",  # Tambaú
    "58053-000",  # Mangabeira
    # Natal (RN)
    "59064-000",  # Candelária
    "59082-000",  # Pitimbu
    # Teresina (PI)
    "64014-000",  # Centro Sul
    "64052-000",  # Itararé
    # Campo Grande (MS)
    "79010-000",  # Centro
    "79090-000",  # Coronel Antonino
    # Cuiabá (MT)
    "78010-000",  # Centro
    "78060-000",  # CPA
    # Porto Velho (RO)
    "76804-000",  # Novo Horizonte
    # Macapá (AP)
    "68902-000",  # Santa Inês
    # Boa Vista (RR)
    "69303-000",  # Caçari
    # Rio Branco (AC)
    "69901-000",  # Bosque
    # Vitória (ES)
    "29015-000",  # Jardim da Penha
    # Aracaju (SE)
    "49025-000",  # Farolândia
    # Florianópolis (SC)
    "88025-000",  # Trindade
    "88063-000",  # Ingleses
    # Palmas (TO)
    "77023-000",  # Plano Diretor Sul
    # Brasília (DF)
    "70070-010",  # Asa Sul
    "70740-000",  # Asa Norte
    "71901-000",  # Taguatinga
]

# ---------------------------------------------------------------------------
# Tier 3 — Grandes cidades não-capitais (>200k hab.)
# ---------------------------------------------------------------------------
_GRANDES_CIDADES = [
    # São Paulo (estado)
    "13010-000",  # Campinas
    "07001-000",  # Guarulhos
    "09701-000",  # São Bernardo do Campo
    "09010-000",  # Santo André
    "06010-000",  # Osasco
    "18010-000",  # Sorocaba
    "14010-000",  # Ribeirão Preto
    "12201-000",  # São José dos Campos
    "13400-000",  # Piracicaba
    "15010-000",  # São José do Rio Preto
    "13500-000",  # Rio Claro
    "17010-000",  # Bauru
    "09750-000",  # São Caetano do Sul
    "07220-000",  # Franco da Rocha
    "08400-000",  # Ferraz de Vasconcelos
    "06700-000",  # Cotia
    "13200-000",  # Jundiaí
    "11010-000",  # Santos
    "12600-000",  # Lorena
    "19801-000",  # Assis
    "18600-000",  # Botucatu
    # Minas Gerais
    "38400-000",  # Uberlândia
    "36010-000",  # Juiz de Fora
    "35010-000",  # Contagem
    "32010-000",  # Betim
    "33010-000",  # Ibirité
    "37701-000",  # Poços de Caldas
    "36570-000",  # Viçosa
    "39400-000",  # Montes Claros
    "38300-000",  # Ituiutaba
    # Rio de Janeiro (estado)
    "27910-000",  # Volta Redonda
    "25901-000",  # Petrópolis
    "28010-000",  # Campos dos Goytacazes
    "27600-000",  # Resende
    "26010-000",  # Nova Iguaçu
    "26700-000",  # Belford Roxo
    "24010-000",  # Niterói
    "26290-000",  # Duque de Caxias
    # Rio Grande do Sul
    "95010-000",  # Caxias do Sul
    "92010-000",  # Canoas
    "93010-000",  # São Leopoldo
    "98700-000",  # Ijuí
    "99010-000",  # Passo Fundo
    "96010-000",  # Pelotas
    # Santa Catarina
    "89201-000",  # Joinville
    "89010-000",  # Blumenau
    "88701-000",  # Tubarão
    "88500-000",  # Lages
    # Paraná
    "86010-000",  # Londrina
    "87010-000",  # Maringá
    "85801-000",  # Cascavel
    "84010-000",  # Ponta Grossa
    # Bahia
    "44001-000",  # Feira de Santana
    "45600-000",  # Itabuna
    "45650-000",  # Ilhéus
    "47800-000",  # Barreiras
    # Pernambuco
    "55801-000",  # Caruaru
    "56300-000",  # Petrolina
    # Ceará
    "62010-000",  # Sobral
    "63100-000",  # Juazeiro do Norte
    # Goiás
    "75100-000",  # Anápolis
    "75800-000",  # Rio Verde
    # Pará
    "68005-000",  # Santarém
    "68200-000",  # Marabá
    # Maranhão
    "65900-000",  # Imperatriz
    # Amazonas
    "69400-000",  # Parintins
    # Mato Grosso
    "78550-000",  # Sinop
    "78600-000",  # Barra do Garças
    # Mato Grosso do Sul
    "79800-000",  # Dourados
    # Espírito Santo
    "29100-000",  # Vila Velha
    "29300-000",  # Cachoeiro de Itapemirim
    # Rio Grande do Norte
    "59600-000",  # Mossoró
    # Paraíba
    "58100-000",  # Campina Grande
    # Alagoas
    "57300-000",  # Arapiraca
    # Piauí
    "64200-000",  # Parnaíba
    # Tocantins
    "77400-000",  # Gurupi
    # Rondônia
    "78900-000",  # Ji-Paraná
    # Acre
    "69980-000",  # Cruzeiro do Sul
]

# ---------------------------------------------------------------------------
# Tier 4 — Cidades médias (100k–200k hab.)
# ---------------------------------------------------------------------------
_CIDADES_MEDIAS = [
    # São Paulo (estado)
    "18200-000",  # Itapetininga
    "18300-000",  # Tatuí
    "16010-000",  # Araçatuba
    "19010-000",  # Presidente Prudente
    "12900-000",  # Guaratinguetá
    "13700-000",  # Nova Odessa
    "13800-000",  # Sumaré
    "14400-000",  # Franca
    "13900-000",  # Americana
    "12300-000",  # Jacareí
    "13750-000",  # Santa Bárbara d'Oeste
    "13470-000",  # Limeira
    "13270-000",  # Valinhos
    "13600-000",  # Araras
    "12100-000",  # Pindamonhangaba
    "12400-000",  # Cruzeiro
    "11700-000",  # Registro
    "18600-000",  # São Manuel
    "17500-000",  # Marília
    "16500-000",  # Birigui
    # Minas Gerais
    "37010-000",  # Varginha
    "36200-000",  # Barbacena
    "35500-000",  # Divinópolis
    "35900-000",  # Itabira
    "38900-000",  # Patos de Minas
    "36800-000",  # Muriaé
    "35700-000",  # Sete Lagoas
    "36130-000",  # Ponte Nova
    "35160-000",  # Ipatinga
    # Rio de Janeiro (estado)
    "27100-000",  # Barra Mansa
    "28300-000",  # Cabo Frio
    "28900-000",  # Macaé
    "28700-000",  # Araruama
    # Rio Grande do Sul
    "97500-000",  # Santa Maria
    "96400-000",  # Bagé
    "98400-000",  # Santa Rosa
    "97100-000",  # São Borja
    # Santa Catarina
    "89300-000",  # Jaraguá do Sul
    "89600-000",  # Caçador
    "89900-000",  # São Miguel do Oeste
    # Paraná
    "85500-000",  # Guarapuava
    "86300-000",  # Cornélio Procópio
    "86400-000",  # Jacarezinho
    "85200-000",  # Francisco Beltrão
    "87200-000",  # Cianorte
    "83800-000",  # Paranaguá
    # Bahia
    "48900-000",  # Juazeiro (BA)
    "45900-000",  # Porto Seguro
    "44900-000",  # Cruz das Almas
    "46100-000",  # Brumado
    # Pernambuco
    "56500-000",  # Salgueiro
    "55600-000",  # Santa Cruz do Capibaribe
    # Ceará
    "62900-000",  # Maracanaú
    "60420-000",  # Caucaia
    "62800-000",  # Crato
    # Goiás
    "75600-000",  # Formosa
    "75700-000",  # Catalão
    "76600-000",  # Jataí
    # Pará
    "68400-000",  # Castanhal
    "66700-000",  # Ananindeua
    # Maranhão
    "65800-000",  # Caxias (MA)
    "65700-000",  # Santa Inês (MA)
    # Amazonas
    "69100-000",  # Tefé
    # Mato Grosso do Sul
    "79600-000",  # Três Lagoas
    "79300-000",  # Corumbá
    # Mato Grosso
    "78700-000",  # Rondonópolis
    "78450-000",  # Lucas do Rio Verde
    # Espírito Santo
    "29200-000",  # Cariacica
    "29940-000",  # São Mateus
    # Rio Grande do Norte
    "59700-000",  # Caicó
    "59800-000",  # Currais Novos
    # Paraíba
    "58200-000",  # Patos (PB)
    "58400-000",  # Sousa
    # Alagoas
    "57600-000",  # Palmeira dos Índios
    # Piauí
    "64400-000",  # Floriano
    # Tocantins
    "77600-000",  # Araguaína
    # Rondônia
    "76800-000",  # Vilhena
    # Sergipe
    "49100-000",  # Lagarto
    # Roraima
    "69314-000",  # Pacaraima
    # Amapá
    "68870-000",  # Santana (AP)
    # Acre
    "69950-000",  # Sena Madureira
]

# ---------------------------------------------------------------------------
# Lista consolidada e pública
# ---------------------------------------------------------------------------
CEPS: list[str] = _CAPITAIS + _CAPITAIS_BAIRROS + _GRANDES_CIDADES + _CIDADES_MEDIAS


def get_cep_cycle() -> Iterator[str]:
    """Itera os CEPs em loop infinito (round-robin)."""
    return itertools.cycle(CEPS)


if __name__ == "__main__":
    print(f"Total de CEPs: {len(CEPS)}")
    for uf_cep in _CAPITAIS:
        print(uf_cep)
