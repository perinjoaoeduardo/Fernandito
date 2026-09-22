# Fernandito — Design System

Fonte única de verdade do projeto. Todo prompt/feature futura deve seguir os
tokens definidos aqui. Os tokens abaixo estão implementados em
`tailwind.config.ts` e disponíveis como classes utilitárias do Tailwind.

## Cores

| Nome         | Hex       | Classe Tailwind                                               | Uso                                           |
| ------------ | --------- | ------------------------------------------------------------- | --------------------------------------------- |
| verde-escuro | `#243022` | `bg-fernandito-verde-escuro` / `text-fernandito-verde-escuro` | Fundo Hero, texto sobre off-white/verde-claro |
| verde-medio  | `#405139` | `bg-fernandito-verde-medio` / `text-fernandito-verde-medio`   | **Cor principal da marca** — CTAs, destaques  |
| verde-claro  | `#6C7D4F` | `bg-fernandito-verde-claro` / `text-fernandito-verde-claro`   | Fundos secundários, acentos                   |
| off-white    | `#E6E6CB` | `bg-fernandito-off-white` / `text-fernandito-off-white`       | Texto sobre fundos escuros, fundo alternativo |

## Tipografia

- `font-serif` → Instrument Serif, Georgia, serif — **voz rústica/manifesto**
  (ainda placeholder via `next/font/google`; troca só no import em
  `layout.tsx`, os tokens de escala abaixo não mudam)
- `font-sans` → **Courier Prime**, Courier New, monospace — **fonte de texto
  geral do site** (UI, labels, ficha técnica, texto corrido). Carregada via
  `next/font/local` a partir de `public/fonts/CourierPrime-*.ttf`; regular,
  bold, italic e bold-italic são arquivos reais (não negrito/itálico
  sintético do navegador) — `font-bold`/`italic` do Tailwind já pegam o
  arquivo certo automaticamente.
- `font-accent` → **Special Elite**, Courier New, monospace — acompanha a
  Courier Prime, mas **não é fonte de texto corrido**: usar pontualmente
  para dar destaque a um elemento diferenciado dentro do texto (ainda sem
  um local fixo definido — aplicar caso a caso conforme instrução). Só tem
  peso Regular (`public/fonts/SpecialElite-Regular.ttf`).

### Família Rampart — fonte do logo

A Rampart é a fonte que deu origem ao logo da marca. Papel: **texto
próximo/relacionado ao logo** (ainda sem componente fixo definido — aplicar
conforme instrução). É uma família maior, com vários sub-estilos, cada um
seu próprio token (cada `.otf` em `public/fonts/Rampart-*.otf` vira um
font-family separado, exceto Sans/SansBold que são regular/bold da mesma
variante):

| Token                      | Arquivo(s)                                              |
| -------------------------- | ------------------------------------------------------- |
| `font-rampart`             | `Rampart-Regular.otf`                                   |
| `font-rampart-sans`        | `Rampart-Sans.otf` (400) + `Rampart-SansBold.otf` (700) |
| `font-rampart-stamp`       | `Rampart-Stamp.otf`                                     |
| `font-rampart-spurs`       | `Rampart-Spurs.otf`                                     |
| `font-rampart-spurs-stamp` | `Rampart-SpursStamp.otf`                                |

Papel específico de cada sub-estilo dentro da família ainda não foi
definido — aguardando instrução de uso.

### Escala (classes `text-*` do Tailwind)

| Token        | Tamanho                    | line-height | Uso típico                                                                                                                                      |
| ------------ | -------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `display-xl` | `clamp(4rem, 12vw, 12rem)` | 0.9         | Nome da marca, hero                                                                                                                             |
| `display-lg` | `clamp(3rem, 8vw, 8rem)`   | 0.95        | Títulos de seção grandes                                                                                                                        |
| `display-md` | `clamp(2rem, 5vw, 4rem)`   | 1.05        | Taglines, subtítulos                                                                                                                            |
| `body-lg`    | `1.25rem`                  | 1.5         | Texto de destaque                                                                                                                               |
| `body`       | `1rem`                     | 1.6         | Texto corrido                                                                                                                                   |
| `label`      | `0.75rem`                  | 1.2         | Labels/UI — usar com `uppercase tracking-[0.08em]` (letter-spacing já embutido no token, `tracking-*` é redundante mas documentado por clareza) |

Todas as classes `display-*` usam `font-serif` por padrão no design; `label`
usa `font-sans`. Aplicar a família manualmente na composição (`font-serif
text-display-xl`, etc.) — o token de tamanho não força a família.

## Spacing

O espaçamento padrão do Tailwind v4 já é gerado dinamicamente em múltiplos de
4px (`--spacing: 0.25rem`), então **nenhum token customizado foi necessário**.
A tabela abaixo é só a referência de conversão usada no design:

| Token | px    | Classe exemplo   |
| ----- | ----- | ---------------- |
| 1     | 4px   | `p-1`, `gap-1`   |
| 2     | 8px   | `p-2`, `gap-2`   |
| 3     | 12px  | `p-3`, `gap-3`   |
| 4     | 16px  | `p-4`, `gap-4`   |
| 6     | 24px  | `p-6`, `gap-6`   |
| 8     | 32px  | `p-8`, `gap-8`   |
| 12    | 48px  | `p-12`, `gap-12` |
| 16    | 64px  | `p-16`, `gap-16` |
| 24    | 96px  | `p-24`, `gap-24` |
| 32    | 128px | `p-32`, `gap-32` |
| 48    | 192px | `p-48`, `gap-48` |

## Radius

| Token  | px     | Classe         |
| ------ | ------ | -------------- |
| `sm`   | 4px    | `rounded-sm`   |
| `md`   | 8px    | `rounded-md`   |
| `lg`   | 16px   | `rounded-lg`   |
| `full` | 9999px | `rounded-full` |

## Interação

Referência canônica pra qualquer estado interativo (hover, focus, active) em
qualquer prompt futuro — ver `tailwind.config.ts` (`transitionDuration`,
`transitionTimingFunction`) e `src/lib/gsap.ts` (`DURATION`, `EASE`, os
mesmos nomes registrados como `CustomEase` pro GSAP usar a curva idêntica).

### Tokens de duração e easing

| Token                | Valor                               | Uso                                             |
| -------------------- | ----------------------------------- | ----------------------------------------------- |
| `duration-fast`      | `150ms`                             | Feedbacks imediatos (press, focus)              |
| `duration-base`      | `300ms`                             | Hover padrão de UI                              |
| `duration-slow`      | `500ms`                             | Transições maiores, entrada de elementos        |
| `ease-out-standard`  | `cubic-bezier(0.22, 1, 0.36, 1)`    | Padrão pra quase tudo                           |
| `ease-out-back`      | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Parcimônia — bounce leve (selos, hover de card) |
| `ease-in-out-smooth` | `cubic-bezier(0.65, 0, 0.35, 1)`    | Loops e yoyos                                   |

Classes Tailwind: `duration-fast/base/slow`, `ease-out-standard/out-back/in-out-smooth`.
Em GSAP: `import { DURATION, EASE } from "@/lib/gsap"` — `EASE.outStandard`
etc. já é o nome registrado via `CustomEase`, mesma curva do CSS.

### Regra geral: nada instantâneo

Nenhum estado interativo troca sem transição. Toda mudança de cor, fundo,
borda, escala ou posição em hover/focus/active passa por `transition` com
no mínimo `duration-fast`. Estados sem transition são bug, não escolha.

## Componentes base (`/src/components/ui`)

- **`Button`** (`Button.tsx`) — 4 variantes, todas com radius-full, padding
  generoso, `transition` base 300ms/`ease-out-standard`:
  - `primary` — fundo `verde-medio` → hover `verde-escuro`. Com a prop
    `icon` + `animatedIcon`, o ícone mora num círculo off-white e desliza
    (clone entra pela esquerda enquanto o original sai pela direita,
    `overflow-hidden` + `group-hover:translate-x-full`) — "isso te leva a
    algum lugar".
  - `secondary` — borda `verde-escuro` 1.5px, transparente. Hover: um span
    absoluto (`scale-x-0 → scale-x-100`, `origin-center`) preenche de
    dentro pra fora, texto vira `off-white` no meio da transição.
  - `ghost` — sem borda/fundo, texto `verde-escuro` → hover `verde-medio` +
    sublinhado (mesma mecânica do `Link` `underline-grow`). Active:
    `opacity-70` (não scale, ao contrário dos outros três).
  - `cta-destaque` — fundo `verde-escuro` sólido → hover `verde-medio` +
    glow (`box-shadow` verde-medio/0.3, blur 20px). **Magnetic hover**
    (desktop + motion only): dentro de 80px do botão, ele "puxa" até 8px
    na direção do cursor via `gsap.quickTo`; desliga sozinho se
    `aria-disabled="true"`. É o botão do WhatsApp e afins.
  - Todas: `active:scale-*` (0.97 padrão, 0.96 no cta-destaque),
    `focus-visible:outline` (2px, 3px no cta-destaque) — cor padrão
    `verde-medio`, sobrescrever via `className` (`!outline-...`) em fundos
    onde verde-medio não contrasta (ex: `FooterSection`, verde-escuro).
- **`Link`** (`Link.tsx`) — link textual com sublinha animada, 2 variantes:
  - `underline-grow` (padrão) — sem sublinha em repouso; cresce da esquerda
    no hover/focus (`origin-left`) e retrai pra direita ao sair
    (`origin-right`) via o clássico truque de trocar `transform-origin`
    entre estado base e `:hover`, sem JS. Uso: prosa, listas.
  - `underline-swap` — sublinha fina permanente + uma segunda, mais grossa
    e `verde-medio`, "sobe" por baixo no hover (`scale-y-0 → scale-y-100`,
    `origin-bottom`). Mais editorial — usado no Footer e adequado a links
    dentro do cartão-carta.
- **`ElevatedCard`** (`ElevatedCard.tsx`) — card com elevação física no
  hover, extraído da `CartaSection`. Props: `elevation` (`"sm"|"md"|"lg"` →
  `-6px`/`-8px`/`-12px`, sombra cresce junto — `md` é o valor original da
  CartaSection), `rotateOnHover` (`-1.5deg`, default `false`). `duration-slow`
  - `ease-out-standard`, desliga sob `prefers-reduced-motion`/sem hover.
    `data-cursor-hover` já embutido (ver `CustomCursor` abaixo).
- **`FloatingNav`** (`FloatingNav.tsx`) — menu flutuante centralizado no topo,
  ver comportamento detalhado no componente.
- **`Container`** (`Container.tsx`) — max-width com padding responsivo,
  usado para limitar a largura de conteúdo dentro das seções full-bleed.
- **`WhatsAppButton`** (`WhatsAppButton.tsx`) — wrapper do `Button` variante
  `cta-destaque` (ícone à esquerda) que lê `NEXT_PUBLIC_WHATSAPP_NUMBER`:
  sem a variável preenchida, renderiza com `aria-disabled="true"` + clique
  bloqueado via `preventDefault` (não usa o atributo `disabled` nativo —
  alguns navegadores suprimem eventos de mouse/hover nele, quebrando o
  tooltip "Em breve" e o CustomCursor); com ela preenchida, vira link pra
  `wa.me/{numero}` com mensagem pré-preenchida. Usar este componente em vez
  de `Button` direto sempre que o CTA for "falar no WhatsApp". Prop
  `background`: `"verde-escuro"` (default do `cta-destaque`, sem overrid —
  usado no `FloatingNav`, pill clara) ou `"verde-medio"` (override pra
  contexto já-escuro — Footer, CTASection —, hover vai pra `verde-claro`).
- **`SvgPlaceholder`** (`SvgPlaceholder.tsx`) — placeholder genérico (borda
  tracejada + label) pros SVGs de marca que ainda não chegaram. Dimensionado
  via `className` por quem usa.
- **`Logo`** (`Logo.tsx`) — lockup completo da marca. Hoje é um
  `SvgPlaceholder` (~4:1, "LOGO SVG AQUI — aguardando arquivo") esperando
  `/public/logo/fernandito-logo-full.svg`. Ver seção "Assets de logo"
  abaixo pros demais arquivos esperados.
- **`CustomCursor`** (`CustomCursor.tsx`) — bolinha de 12px, sempre
  off-white, `mix-blend-mode: difference` permanente. Segue o mouse via
  `gsap.quickTo`; no hover de qualquer `a`/`button`/`[role=button]`/
  `[data-cursor-hover]`, cresce só ~8% (`scale: 1.08`) — sutil, só indica
  "isso é clicável". A identidade visual do hover mora nos componentes
  (`Button`, `Link`, `ElevatedCard`), não no cursor. `[data-cursor-hover]`
  é o opt-in pra divs sem role semântico mas com reação de hover forte
  (o `ElevatedCard` já vem com o atributo). Global (montado 1x no
  `layout.tsx`, não por seção). Só ativa em desktop com hover
  (`supportsHover()`) e fora de `prefers-reduced-motion`; fora disso
  retorna `null` e o cursor nativo continua normal.
- **`ScrollProgress`** (`ScrollProgress.tsx`) — barra fixa de 2px no topo
  absoluto da viewport, `verde-medio` + `mix-blend-mode: difference` (some
  o suficiente pra funcionar sobre qualquer fundo). Largura 0–100% via
  `lenis.progress` (fallback pra `scrollY`/`scrollHeight` sem Lenis),
  atualizado por `requestAnimationFrame`. Sob `prefers-reduced-motion` nem
  monta — é adorno de motion, não conteúdo. Global, montado 1x no
  `layout.tsx`.

### Assets de logo (`/public/logo/`)

Pasta criada, arquivos ainda não enviados — nomes esperados quando
chegarem (substituem os placeholders acima):

| Arquivo esperado               | Uso                                                         |
| ------------------------------ | ----------------------------------------------------------- |
| `fernandito-logo-full.svg`     | Lockup completo — usado por `<Logo />`                      |
| `fernandito-logo-text.svg`     | Só o texto "FERNANDITO" + tagline                           |
| `fernandito-horse.svg`         | Símbolo do cavalo isolado — `FloatingNav` (pill 1) usa este |
| `fernandito-logo-mono.svg`     | Versão monocromática                                        |
| `fernandito-logo-negative.svg` | Versão negativa                                             |

### Assets da CartaSection (`/public/carta/`)

Pasta criada, arquivo ainda não enviado. O selo do cartão-carta usa um
placeholder (`div` verde-medio, texto "FOTO SELO") até a foto real chegar
— trocar no `CartaSection.tsx` (elemento com `role="img"`), mantendo o
formato quadrado (a borda serrilhada em `.carta-seal-edge`, `globals.css`,
é um clip-path percentual pensado pra caixa quadrada):

| Arquivo esperado | Uso                                                                  |
| ---------------- | -------------------------------------------------------------------- |
| `selo.jpg`       | Foto do selo — paisagem gaúcha, pôr do sol, cavalo ou a lata em cena |

## Estrutura de seções (`/src/components/sections`)

Ordem fixa da landing page (ver `src/app/page.tsx`):

1. `HeroSection` — fundo **verde-medio**
2. `ManifestoSection` — fundo off-white
3. `CartaSection` — fundo off-white, bloco editorial: epígrafe grande
   (reveal por palavra via SplitText) + cartão-carta (corpo, assinaturas,
   selo com clip-path serrilhado; elevação física no hover, desktop only)
4. `ProdutoSection` — fundo verde-medio
5. `FichaTecnicaSection` — fundo verde-claro
6. `VideoSection` — fundo verde-escuro
7. `CTASection` — fundo verde-medio
8. `FooterSection` — fundo verde-escuro, 5 camadas (labels de canto,
   frase de fechamento, navegação em colunas, CTA WhatsApp, base com
   copyright); grain sutil via CSS/SVG (`.footer-grain` em `globals.css`)

## Infra de animação (`/src/lib`)

- **`gsap.ts`** — registra `ScrollTrigger` e `SplitText` uma única vez
  (client-side) e exporta `gsap` + helpers.
- **`lenis.ts`** — inicializa o Lenis (smooth scroll) e sincroniza com o
  ticker do GSAP, para que `ScrollTrigger` e o scroll suave fiquem no mesmo
  relógio.

Qualquer nova seção com animação deve:

- Importar `gsap`/`ScrollTrigger` de `src/lib/gsap.ts` (nunca importar
  `gsap` "cru" diretamente nos componentes).
- Respeitar `prefers-reduced-motion` (helper `prefersReducedMotion()` em
  `src/lib/gsap.ts`).
- Limpar `ScrollTrigger`/timelines no cleanup do `useEffect`.

## Comportamento de refresh

Decisão explícita: dar refresh na página **sempre volta pro topo**, nunca
mantém a posição de scroll da sessão anterior — landing de página única,
"acordar" no meio do scroll é uma experiência ruim, e a IntroLoader já roda
do zero a cada carregamento mesmo. Implementado em `layout.tsx` via um
`<Script strategy="beforeInteractive">` que desliga `history.scrollRestoration`
e força `scrollTo(0, 0)` antes da hidratação (evita o flash de "restaura no
meio e depois pula pro topo").
