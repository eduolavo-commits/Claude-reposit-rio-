# Blackjack Hi-Lo Counter – Extensão Chrome

Contador Hi-Lo automático que roda **dentro do Chrome** e monitora as cartas que aparecem na tela em tempo real.

---

## Como instalar (modo desenvolvedor)

1. Abra o Chrome e acesse `chrome://extensions`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **"Carregar sem compactação"**
4. Selecione a pasta `hilo-counter-extension`
5. A extensão aparece na barra de ferramentas (ícone ♠)

---

## Como funciona

### Detecção automática
O contador usa um **MutationObserver** para monitorar mudanças no DOM da página em tempo real.  
Quando uma nova carta aparece, ele a detecta por:

| Método | Exemplo detectado |
|--------|-------------------|
| Atributo `data-card` / `data-rank` | `data-card="K"` |
| Texto curto em elemento `.card` | `<div class="card">A</div>` |
| Alt de imagem | `<img alt="King of Spades">` |
| Nome do arquivo da imagem | `img/card_K_S.png` |
| `aria-label` / `title` | `aria-label="Ace of Hearts"` |
| Classe CSS | `class="card-K card-spades"` |

### Sistema Hi-Lo

| Carta | Valor |
|-------|-------|
| 2 – 6 | **+1** (conta alta = bom para o jogador) |
| 7 – 9 | **0** (neutro) |
| 10, J, Q, K, A | **-1** |

### Contagem Verdadeira
`Contagem Verdadeira = Contagem Corrida ÷ Baralhos Restantes`

---

## HUD – Interface

O HUD flutua sobre o jogo e pode ser arrastado para qualquer posição.

| Campo | Descrição |
|-------|-----------|
| **Contagem** | Running count atual |
| **Cont. Verdadeira** | True count (contagem ÷ baralhos restantes) |
| **Cartas vistas** | Total de cartas detectadas |
| **Vantagem** | Indicador de vantagem do jogador |
| **Histórico** | Últimas cartas contadas |

### Cores de vantagem
- Verde escuro = favorável para o jogador
- Verde brilhante = muito favorável (+4 ou mais)
- Cinza = neutro
- Vermelho = desfavorável
- Vermelho brilhante = muito desfavorável (-4 ou menos)

---

## Atalhos de teclado

| Atalho | Ação |
|--------|------|
| `Alt + ↑` | Adicionar +1 manualmente |
| `Alt + ↓` | Adicionar -1 manualmente |
| `Alt + →` | Adicionar 0 manualmente |
| `Alt + R` | Resetar contagem |
| `Alt + H` | Ocultar/mostrar HUD |

---

## Auto-detect ON/OFF

O botão **Auto: ON/OFF** no HUD controla se a extensão detecta cartas automaticamente.  
Se o seu jogo não for detectado automaticamente, use o seletor de cartas manual no HUD ou os atalhos de teclado.

---

## Adaptando para seu jogo

Se as cartas do seu jogo não forem detectadas, adicione um dos seguintes atributos HTML às suas cartas:

```html
<!-- Opção 1: data-card -->
<div class="card" data-card="K">...</div>

<!-- Opção 2: data-rank -->
<div class="card" data-rank="A">...</div>

<!-- Opção 3: texto curto com classe card -->
<span class="card-value">10</span>

<!-- Opção 4: aria-label -->
<div class="card" aria-label="King of Spades">...</div>
```

---

## Arquivos da extensão

```
hilo-counter-extension/
├── manifest.json    – configuração da extensão (Manifest V3)
├── content.js       – lógica principal: observer + HUD + contador
├── styles.css       – estilos do HUD
├── popup.html       – popup ao clicar no ícone
├── popup.js         – lógica do popup
├── background.js    – service worker (mínimo)
└── icons/           – ícones SVG da extensão
```
