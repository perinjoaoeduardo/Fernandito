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
  ver comportamento detalhado no componente. Também troca de tom sozinho
  conforme a seção por trás dele: a cada scroll, amostra a cor de fundo
  computada num ponto fixo fora da pill (`elementFromPoint` num canto,
  não no próprio nav) e decide clara/escura pela luminância (`> 150` =
  fundo claro). Sobre fundo escuro/verde a pill fica clara (off-white,
  comportamento padrão); sobre fundo claro/off-white ela inverte pra
  verde-escuro, com texto off-white — sempre com a mesma transição suave
  do "shrunk" ao rolar. Funciona pra qualquer seção presente ou futura sem
  precisar marcar cada uma com um data-attribute (é systemic, não
  hardcoded por seção).
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
  `background`: `"verde-escuro"` (default do `cta-destaque`, sem override —
  usado no `FloatingNav` quando a pill está clara) ou `"verde-medio"`
  (override pra contexto já-escuro — Footer, ou o `FloatingNav` quando a
  pill inverteu pra escura — hover vai pra `verde-claro`).
- **`SvgPlaceholder`** (`SvgPlaceholder.tsx`) — placeholder genérico (borda
  tracejada + label) pros SVGs de marca que ainda não chegaram. Dimensionado
  via `className` por quem usa. Sem uso ativo no momento — todo asset que
  o usava (`Logo`, ícone do cavalo no `FloatingNav`/`FooterSection`) já
  recebeu o arquivo real (ver "Assets de logo" abaixo); mantido pra
  próximos assets que ainda não chegaram.
- **`Logo`** (`Logo.tsx`) — wordmark da marca, `/public/logo/fernandito-logo-text.svg`
  via `<img>`. Ver "Assets de logo" abaixo pro resto dos arquivos
  (recebidos e ainda esperados).
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

Todos os arquivos recebidos chegaram com cores aproximadas, fora do hex
exato da paleta (ex: `#3a4936` em vez de `#405139`) — foram todos
corrigidos por substituição direta de cor pra bater exato com `## Cores`
(vetores: replace de string nos hex; raster: remapeamento linear no eixo
escuro→claro via PIL/numpy, preservando o anti-aliasing original).

| Arquivo                             | Uso                                                                                                                                                                   | Status                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `fernandito-logo-text.svg`          | Wordmark "FERNANDITO" — usado por `<Logo />` (Hero)                                                                                                                   | ✅ recebido                |
| `fernandito-horse.svg`              | "Moeda" (medalhão) só com a cabeça do cavalo, sem texto — pra ocasiões pequenas. Usado nas duas pills-cavalo do `FloatingNav` e no símbolo da base do `FooterSection` | ✅ recebido                |
| `fernandito-moeda.svg`              | Mesmo medalhão, com texto ao redor. Usado como o selo da `CartaSection`                                                                                               | ✅ recebido                |
| `fernandito-horse-full.svg`         | Cavalo completo, pose empinada, ilustração maior (não é o medalhão) — uso ainda não definido                                                                          | ✅ recebido, sem uso ainda |
| `fernandito-horse-full.png`         | Mesma ilustração acima, raster em alta resolução (7076×8524) — preferir a versão `.svg` quando der, é ~40x mais leve                                                  | ✅ recebido, sem uso ainda |
| `fernandito-horse-illustration.png` | Mesma ilustração, raster em resolução menor (1088×1312) — redundante com as duas acima, mantido por já ter sido recebido antes                                        | ✅ recebido, sem uso ainda |
| `fernandito-logo-full.svg`          | Lockup completo (ícone + texto juntos)                                                                                                                                | Aguardando arquivo         |
| `fernandito-logo-mono.svg`          | Versão monocromática                                                                                                                                                  | Aguardando arquivo         |
| `fernandito-logo-negative.svg`      | Versão negativa                                                                                                                                                       | Aguardando arquivo         |

`fernandito-logo-text.svg`, `fernandito-moeda.svg` e `fernandito-horse.svg`
são vetores bem detalhados (472KB–2.3MB) — funcionam normalmente via
`<img>`, mas vale considerar otimizar (`svgo`) antes do lançamento se o
peso da página virar problema. O par `fernandito-horse-full.png`
(11.8MB) é pesado demais pra usar direto na web — se algum dia precisar
dessa ilustração em raster, gerar um resize menor a partir dele primeiro.

## Estrutura de seções (`/src/components/sections`)

Ordem fixa da landing page (ver `src/app/page.tsx`):

1. `HeroSection` — cartão visual **verde-medio** (logo + banner "Fernet y
   Cola" + tagline), efeito "shrink-to-card" ao rolar (inspirado no hero da
   Lassie): a section é `motion-safe:h-[160vh]`, o cartão visual é
   `sticky top-0 h-screen` — enquanto a altura extra rola por baixo,
   `scale`/`border-radius` do cartão animam via `ScrollTrigger` (`scrub`)
   de tela cheia (scale 1, raio 0) até um cartão menor e arredondado
   (`scale 0.9`, raio 40px), revelando o fundo da própria `<section>`
   como moldura. Texto/indicador desvanecem antes do cartão terminar de
   encolher. `prefers-reduced-motion` volta a section pra um `h-screen`
   simples, sem o efeito.

   **Regra da cor da moldura:** o fundo da `<section>` (a moldura revelada)
   tem que ser **sempre a mesma cor de fundo da seção seguinte** — hoje,
   `bg-fernandito-off-white` (a cor da `ManifestoSection`). Não é uma
   sincronia automática: se a cor de fundo da seção que vem depois da Hero
   mudar no futuro, essa classe precisa ser atualizada manualmente junto
   (ver comentário no `className` da section em `HeroSection.tsx`).

   O logo (`Logo.tsx`) e o banner `public/images/fernet-y-cola-banner.png`
   (cores corrigidas pro padrão `#E6E6CB`/`#405139`) ficam empilhados no
   centro do cartão. Abaixo, a tagline usa duas fontes: o texto fixo
   ("Fernet feito com") em `font-rampart-sans` regular, cor off-white; a
   palavra variável usa `RotatingWord.tsx` — um roller vertical (GSAP,
   `y` em `em` por cima de uma pilha de `<span>`, `overflow-hidden`) que
   troca entre ~10 palavras (amor, teimosia, orgulho, raiz, fé, calma,
   coragem, rebeldia, alma, dedicação) em `font-rampart-stamp font-bold`
   (bold sintético — a Stamp só tem peso 400). `prefers-reduced-motion`
   trava a primeira palavra, sem animação.
2. `OQueESection` — fundo off-white, "o que é" o produto em linguagem
   direta (elevator pitch, estilo do segundo bloco da home da Lassie):
   grid com placeholder da lata à esquerda (`border-dashed`, aguardando
   arte — "lata (aguardando arte)") e dois parágrafos curtos à direita,
   revelados letra a letra (SplitText `type: "chars"`, stagger de 0.014s —
   efeito de máquina de escrever, combina com a Courier Prime do
   `font-sans`). Abaixo, uma frase de fechamento grande (`font-serif`,
   reveal por palavra). `prefers-reduced-motion` pula pro estado final.
3. `ManifestoSection` — fundo off-white, reescrito como poema contínuo de
   scroll simples (substituiu a versão anterior de 5 "macros" pinados em
   tela cheia, considerada grande demais pro conteúdo). Uma lista de
   linhas curtas (array `LINES` no componente — inclui um item
   `{ type: "placeholder" }` no meio, uma caixa tracejada reservando
   espaço pra cenas/sensorial de "ser Fernandito", futuramente fotos/vídeo)
   revela cada linha com fade+y simples (`ScrollTrigger` individual por
   linha, sem pin/scrub) em `text-display-md` — bem mais contido que o
   `display-lg/xl` de antes, pra não pesar o scroll. As duas últimas
   linhas do poema ("Mas, para os que não deixaram passar... Tomam
   Fernandito.") se repetem de propósito logo em seguida, sozinhas, num
   bloco de impacto próprio (`min-h-[70vh] sm:min-h-[80vh]`) com entrada em
   zoom (`scale` 0.85→1) — o único momento "gigante" da seção, contrastando
   com o resto do poema.
4. `CartaSection` — fundo off-white, bloco editorial: epígrafe grande
   (reveal por palavra via SplitText) + cartão-carta (`ElevatedCard`, corpo,
   assinaturas, selo = `fernandito-moeda.svg` rotacionado no canto;
   elevação física no hover, desktop only)
5. `ProdutoSection` — fundo verde-medio
6. `SocialGallerySection` — fundo off-white, leque de 7 fotos sobrepostas
   (rotação alternada, card central maior) que entra em cascata do centro
   pras bordas e se "abre" no hover; vira carrossel com scroll-snap no
   mobile. Ver detalhes na sua própria entrada abaixo.
7. `FichaTecnicaSection` — só o marquee (`font-accent`, texto curto: "Toma
   Fernandito · Fernet y Cola · 350ml · 8% vol." em loop) — a versão
   anterior tinha uma grade de "ficha técnica" completa (specs, ingredientes,
   registro MAPA) abaixo do marquee; foi removida por conter informação
   redundante com `/legal/avisos` e não agregar visualmente. Altura do
   marquee agora vem do padding do conteúdo (`py-6 sm:py-8`), não de `vh` —
   antes ficava alta demais em qualquer viewport.
8. `FooterSection` — fundo verde-escuro, versão compacta (estilo do
    rodapé enxuto da Lassie — substituiu uma versão anterior bem mais alta,
    com labels decorativos nos 4 cantos e `min-h-[90vh]`). Duas colunas no
    topo: frase de fechamento (`font-serif`, reveal por palavra) + CTA
    `WhatsAppButton` à esquerda; grid "Navegar"/"Social" à direita (a
    coluna "Legal", que só linkava pra `/legal/avisos`, foi removida do
    rodapé até existir conteúdo real de privacidade/termos — a rota
    `/legal/avisos` continua existindo, só não tem mais link direto aqui).
    "Social" usa `Link` `underline-grow` (não mais `underline-swap` — sem
    sublinha permanente) com `InstagramIcon` explicitamente à esquerda do
    texto (`<span className="inline-flex items-center gap-2">`, não
    depende do wrapping interno do `Link`). Base do rodapé: `moeda.svg` no
    lugar de um símbolo maior do cavalo + copyright, e um botão "topo"
    (`scrollToTarget("#hero")`) — sem grain overlay, fundo sólido de
    propósito (no futuro entra um placeholder de imagem nessa área).

### Próxima seção planejada — galeria horizontal

Entre `OQueESection`/`ManifestoSection` e `CartaSection`, está planejada uma
galeria horizontal bem animada, referência em `landonorris.com`: fotos em
alturas/colunas variadas que passam horizontalmente conforme rola a página,
com uma troca de cor de fundo no meio do percurso e uma citação+assinatura
central. Ainda não implementada — é um componente novo e visualmente
grande o suficiente pra merecer sua própria rodada de construção/ajuste.

## Páginas legais (`/legal`)

Shell compartilhado (`src/app/legal/layout.tsx` + `LegalSidebar.tsx`):
sidebar fixa com link "← Voltar ao site" e a lista de documentos, área de
conteúdo à direita com título serif grande + "Última atualização" + corpo
em `font-sans`. Layout inspirado no `/legal/privacy` da Lassie, adaptado
pra paleta do site (off-white/verde-escuro em vez de branco/navy).

- **`/legal/avisos`** — único documento existente até agora: as 3
  informações regulatórias que antes ficavam soltas no rodapé (glúten,
  idade mínima, registro MAPA), reescritas como parágrafos curtos. Texto
  gerado a partir do que já existia no site, não é aconselhamento
  jurídico — revisar com um advogado antes de tratar como definitivo.
- **`/legal`** — redireciona pra `/legal/avisos` (`next/navigation`
  `redirect()`).
- Pra adicionar um novo documento (ex: Política de Privacidade, Termos de
  Uso): criar `src/app/legal/<slug>/page.tsx` seguindo o mesmo padrão de
  `avisos/page.tsx`, e adicionar `{ slug, label }` em `LEGAL_DOCS`
  (`LegalSidebar.tsx`) — a sidebar já cresce sozinha a partir dali. **Não
  preencher o conteúdo desses documentos com texto jurídico inventado por
  IA** — usar o texto real fornecido pelo negócio/advogado.
- `Link` (`components/ui/Link.tsx`) agora detecta rotas internas
  (`href` começando com "/", sem `target="_blank"`) e usa `next/link` por
  baixo em vez de `<a>` puro — navegação client-side, sem recarregar a
  página (o que faria a `IntroLoader` tocar de novo a cada clique).

### `SocialGallerySection` — detalhes

Inspirada no "What's up on socials" do site do Lando Norris, adaptada pro
tom rústico da marca (bordas grossas off-white estilo polaroid, sombra dura
sem blur, grain, 2 selos decorativos tipo carimbo em posições fixas).

- **Leque desktop**: 7 cards em `flex` com margin-left negativo pro
  overlap; cada card tem seu próprio `rotate`/`translateY`/`scale` via
  `gsap.set`/`gsap.to` (nunca via className — precisa mudar no hover).
  Rotação por índice `[-12, -8, -4, 0, 4, 8, 12]`, distância do centro em
  "camadas" de `translateY` (14px por camada) e z-index (maior no centro).
  Entrada em cascata (`ScrollTrigger`, uma vez): todos partem de
  opacity 0/scale 0.7/y 40/rotate 0, e animam pra seus valores finais
  agrupados por distância do centro (stagger 0.08s por camada,
  `back.out(1.4)` — dá o leve "assentar" com bounce).
  Hover: card sob o mouse zera a rotação e cresce (+0.08 sobre a própria
  escala-base, não um valor absoluto — o card central já começa maior, um
  alvo fixo de 1.08 encolheria ele), z-index vai pro topo; os DOIS vizinhos
  imediatos se afastam (`translateX` ±15px) pra abrir espaço. Tudo reverte
  no `mouseleave` (z-index só volta ao normal depois que a rotação/escala
  termina de voltar, pra não "furar" atrás do vizinho no meio do caminho).
- **Mobile (< `sm`)**: os dois DOMs (leque e fileira) coexistem, alternados
  via `hidden`/`sm:hidden` — mesmo padrão já usado no `FloatingNav` pras
  pills desktop/mobile. Escolhida a **Opção B** (carrossel com
  `overflow-x-auto` + `snap-x snap-mandatory`) em vez de reduzir pra 3-4
  cards do leque: em tela estreita, cada card do carrossel continua no
  tamanho legível de sempre (o leque forçaria cards minúsculos ou vazaria
  a viewport), é um padrão de swipe que todo mundo já conhece, e não
  disputa o gesto de scroll vertical do Lenis (scroll horizontal num
  container é um eixo totalmente independente). Cada card mantém sua
  própria rotação (mesmo array `ROTATIONS`) sem overlap — "fileira", não
  "leque" —, textura e selo intactos; sem hover (não existe em touch) e
  sem cascata por card, só um fade simples na fileira inteira.
- **Placeholders de foto**: 7 divs com `bg-fernandito-verde-medio`/
  `verde-claro` em variações de opacidade, texto "FOTO 0X" — não há
  arquivos ainda. Quando as fotos reais chegarem, trocar o miolo colorido
  de cada `PhotoCard` (`SocialGallerySection.tsx`) por
  `<img src="/images/social-0X.jpg" />`, mantendo a borda/sombra/grain do
  card por fora.

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
