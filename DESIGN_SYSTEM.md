# Fernandito — Design System

Fonte única de verdade do projeto. Todo prompt/feature futura deve seguir os
tokens definidos aqui. Os tokens abaixo estão implementados em
`tailwind.config.ts` e disponíveis como classes utilitárias do Tailwind.

## Conteúdo (`src/content/site.ts`)

Todo texto e toda foto do site mora num arquivo só, `src/content/site.ts`,
separado por seção (`HERO`, `O_QUE_E`, `GALERIA`, `MANIFESTO`, `CONTATO`,
`SOCIAL`, `MARQUEE`, `FOOTER`, `NAV`, `LINKS`). Pra trocar texto, edita a
string ali. Pra trocar foto: salva o arquivo em `public/images/`, preenche
o `src` (ex.: `"/images/galeria-01.jpg"`) e escreve o `alt`. Com `src:
null`, o site mostra o placeholder verde com o nome da foto.

As fotos passam pelo `PhotoSlot` (`components/ui/PhotoSlot.tsx`):
`next/image` com `fill` + `object-cover` e `sizes` por lugar de uso, ou o
placeholder. A lata do "O que é" é a exceção: `object-contain`, porque a
arte tem fundo transparente. Os metadados de SEO (título, descrição,
domínio) continuam em `src/lib/site.ts`.

## Cores

| Nome         | Hex       | Classe Tailwind                                               | Uso                                           |
| ------------ | --------- | ------------------------------------------------------------- | --------------------------------------------- |
| verde-escuro | `#243022` | `bg-fernandito-verde-escuro` / `text-fernandito-verde-escuro` | Fundo Hero, texto sobre off-white/verde-claro |
| verde-medio  | `#405139` | `bg-fernandito-verde-medio` / `text-fernandito-verde-medio`   | **Cor principal da marca** — CTAs, destaques  |
| verde-claro  | `#6C7D4F` | `bg-fernandito-verde-claro` / `text-fernandito-verde-claro`   | Fundos secundários, acentos                   |
| off-white    | `#E6E6CB` | `bg-fernandito-off-white` / `text-fernandito-off-white`       | Texto sobre fundos escuros, fundo alternativo |

## Tipografia

**Só as fontes da marca**: Rampart (família do logo), Courier Prime e
Special Elite. A Instrument Serif (placeholder do Google Fonts que fazia o
papel de `font-serif`) saiu do site inteiro — o token `serif` não existe
mais no `tailwind.config.ts`; não usar `font-serif` (cairia no Georgia
padrão do Tailwind).

- `font-rampart` → **Rampart Regular** — **fonte de título** de todas as
  seções (headlines, título do menu mobile, frase do rodapé). É **só
  caixa-alta** (minúsculas mapeiam pros glifos maiúsculos) mas cobre todos
  os acentos do português. Sem itálico nem bold: ênfase por cor/tamanho.
  Por ser larga em caixa-alta, títulos usam `text-balance` e tamanhos um
  degrau abaixo do que uma serifada pediria. Cuidado com
  `overflow-hidden` em máscaras de animação: corta acento acima da letra
  (dar `pt-[0.14em]` na máscara).
- `font-sans` → **Courier Prime**, Courier New, monospace — **fonte de texto
  geral do site** (UI, labels, ficha técnica, texto corrido). Carregada via
  `next/font/local` a partir de `public/fonts/CourierPrime-*.ttf`; regular,
  bold, italic e bold-italic são arquivos reais (não negrito/itálico
  sintético do navegador) — `font-bold`/`italic` do Tailwind já pegam o
  arquivo certo automaticamente.
- `font-accent` → **Special Elite**, Courier New, monospace — acompanha a
  Courier Prime, mas **não é fonte de texto corrido**: usar pontualmente
  para destaque: assinaturas do Manifesto, "Se interessou?" do Contato,
  legenda do rodapé, carimbos, marquee. Só
  tem peso Regular (`public/fonts/SpecialElite-Regular.ttf`).

### Família Rampart — fonte do logo

A Rampart é a fonte que deu origem ao logo da marca. A Regular é a fonte de
título do site; Sans/Stamp ficam na tagline da Hero. É uma família maior, com vários sub-estilos, cada um
seu próprio token (cada `.otf` em `public/fonts/Rampart-*.otf` vira um
font-family separado, exceto Sans/SansBold que são regular/bold da mesma
variante):

| Token                      | Arquivo(s)                                                  | Preload |
| -------------------------- | ----------------------------------------------------------- | ------- |
| `font-rampart`             | `Rampart-Regular.woff2`                                     | **sim** |
| `font-rampart-sans`        | `Rampart-Sans.woff2` (400) + `Rampart-SansBold.woff2` (700) | **sim** |
| `font-rampart-stamp`       | `Rampart-Stamp.woff2`                                       | **sim** |
| `font-rampart-spurs`       | `Rampart-Spurs.woff2`                                       | não     |
| `font-rampart-spurs-stamp` | `Rampart-SpursStamp.woff2`                                  | não     |

`rampart-spurs` e `rampart-spurs-stamp` seguem sem uso.

### Formato e política de preload

Todas as fontes são servidas em **WOFF2** (os `.otf`/`.ttf` originais
continuam em `/public/fonts` como fonte-verdade). A conversão cortou
**2147KB → 464KB** — a Rampart-Stamp sozinha foi de 690KB pra 96KB. Pra
converter uma fonte nova: `fontTools.ttLib.TTFont(src)`, `flavor="woff2"`,
`save()`.

Todas usam `display: "swap"`. O que muda por fonte é o **preload**: cada
fonte pré-carregada vira um `<link rel=preload>` que disputa banda com o
LCP, então só pré-carrega quem aparece **cedo na rolagem** — Courier Prime
(nav + indicador de scroll), Rampart Sans e Rampart Stamp (tagline da
Hero), e **Rampart Regular** — a fonte de título de toda seção (a SEGUNDA
seção já usa), então sem preload dava tempo de mostrar o fallback num
scroll rápido. As outras levam
`preload: false` em `layout.tsx` e carregam sob demanda quando a seção
entra em cena.

Isso vale especialmente pras Rampart sem uso hoje (`rampart-spurs`,
`rampart-spurs-stamp`): seguem disponíveis como token, mas
sem preload não custam nada até alguém aplicar a classe. **Ao passar a usar
uma delas cedo na rolagem, tire o `preload: false`** — e o contrário
também vale. Regra de bolso: não é só "primeira dobra" que importa, é
"quão rápido um usuário rolando normalmente chega lá".

### Escala (classes `text-*` do Tailwind)

| Token        | Tamanho                        | line-height | Uso típico                                                                                                                                      |
| ------------ | ------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `display-xl` | `clamp(4rem, 12vw, 12rem)`     | 0.9         | Nome da marca, hero                                                                                                                             |
| `display-lg` | `clamp(3rem, 8vw, 8rem)`       | 0.95        | Títulos de seção grandes                                                                                                                        |
| `display-md` | `clamp(2rem, 5vw, 4rem)`       | 1.05        | Taglines, subtítulos                                                                                                                            |
| `display-sm` | `clamp(1.5rem, 3.2vw, 2.5rem)` | 1.1         | Frases de efeito dentro de coluna de texto (O que é, rodapé)                                                                                    |
| `body-lg`    | `1.25rem`                      | 1.5         | Texto de destaque                                                                                                                               |
| `body`       | `1rem`                         | 1.6         | Texto corrido                                                                                                                                   |
| `label`      | `0.75rem`                      | 1.2         | Labels/UI — usar com `uppercase tracking-[0.08em]` (letter-spacing já embutido no token, `tracking-*` é redundante mas documentado por clareza) |

Todas as classes `display-*` usam `font-rampart` no design; `label` usa
`font-sans` (ou `font-accent` em rótulos de seção). Aplicar a família
manualmente na composição (`font-rampart text-display-md`, etc.) — o token
de tamanho não força a família.

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
etc. já é o nome registrado via `CustomEase`, mesma curva do CSS. No
framer-motion (só o `FloatingNav`): `EASE_BEZIER.outStandard`, a mesma curva
em array.

Tokens só do GSAP, pra todas as seções terem o mesmo "peso":

| Token            | Valor  | Uso                                                                  |
| ---------------- | ------ | -------------------------------------------------------------------- |
| `DURATION.enter` | `0.7s` | Entrada única de um bloco (logo da Hero, fileira do tablet, faixa)   |
| `SCRUB.tight`    | `0.4`  | Presos à rolagem que respondem na hora: máquina de escrever, carimbo |
| `SCRUB.base`     | `0.6`  | Blocos entrando com a rolagem (Hero encolhendo, leque, CTA)          |
| `SCRUB.soft`     | `0.8`  | Objetos grandes com peso: cartão do Manifesto, galeria saindo        |

**No toque (`IS_TOUCH`, `pointer: coarse`) os SCRUB caem pra 0.1 / 0.15 /
0.2.** A rolagem do dedo já tem inércia própria; o atraso pensado pra roda
do mouse, por cima dela, virava elástico: a galeria seguia andando ~800ms
depois que o dedo e a inércia paravam (medido com toque simulado). Agora
são ~200ms. `ScrollTrigger.config({ ignoreMobileResize: true })` evita
recálculo quando a barra de endereço muda a altura no meio do gesto.

Regra: hover e troca de estado = `DURATION.base` + `EASE.outStandard`;
entrada = `DURATION.enter` + `EASE.outStandard`; loops = `EASE.inOutSmooth`.
Exceções deliberadas, com curva própria: o giro do cartão
(`back.inOut(1.2)`), o carimbo do selo (`back.out(2.2)`), o seguir do
cursor (`power2`, 0.18s) e as fases internas da galeria.

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
    glow (`box-shadow` verde-medio/0.3, blur 20px). É o botão do WhatsApp
    e afins. **Sem magnetic hover**: o botão "puxando" até 8px na direção
    do cursor ficava se mexendo sozinho — era demais (removido).
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
  verde-escuro, com texto off-white. Fora do topo a pill fica mais opaca
  (0.95), pra ler por cima de qualquer conteúdo. **Recolhe descendo, volta
  subindo**: passando de 160px, rolar pra baixo sobe a nav pra fora da
  tela e rolar pra cima (mais de 6px) traz de volta; ela nunca some na
  Hero, com o menu do celular aberto ou com foco de teclado dentro dela
  (antes ela passava por cima dos títulos durante a leitura). A amostra
  de fundo vem de `backgroundAt` (`src/lib/background.ts`), a mesma usada
  pelo cursor e pelo `ThemeColorSync`. **O segredo**: três toques em menos
  de 0,9s no cavalo do menu fazem o cavalinho da abertura atravessar a
  tela galopando uma vez (`Gallop.tsx`: o mesmo `cavalinho-intro.gif`, já
  em cache pela intro, `fixed` no rodapé da tela, 2,4s da esquerda pra
  direita, some no fim). Um toque só continua sendo "voltar ao topo". Sob
  `prefers-reduced-motion` não acontece nada. Não está anunciado em lugar
  nenhum do site, de propósito.
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
  usado no `FloatingNav` e no `FooterSection`, os dois já verde-escuro por
  trás; ganha uma borda sutil off-white/15 pra não sumir contra o próprio
  fundo) ou `"verde-medio"` (override pra outros contextos escuros — hover
  vai pra `verde-claro`).
- **`SvgPlaceholder`** (`SvgPlaceholder.tsx`) — placeholder genérico (borda
  tracejada + label) pros SVGs de marca que ainda não chegaram. Dimensionado
  via `className` por quem usa. Sem uso ativo no momento — todo asset que
  o usava (`Logo`, ícone do cavalo no `FloatingNav`/`FooterSection`) já
  recebeu o arquivo real (ver "Assets de logo" abaixo); mantido pra
  próximos assets que ainda não chegaram.
- **`Logo`** (`Logo.tsx`) — wordmark da marca, `/public/logo/fernandito-logo-text.svg`
  via `<img>`. Ver "Assets de logo" abaixo pro resto dos arquivos
  (recebidos e ainda esperados).
- **`CustomCursor`** (`CustomCursor.tsx`) — bolinha de 12px, sólida, que
  **troca de cor conforme o fundo**: off-white sobre fundo escuro,
  verde-escuro sobre fundo claro (`data-tone`, amostrado com
  `backgroundAt` no ponto do cursor, no máximo uma vez por quadro, ao
  mover e ao rolar). Um anel fino da cor oposta mantém a bolinha visível
  sobre fotos, que o amostrador não enxerga. Segue o mouse via
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

### Modo pré-lançamento (`PRELAUNCH` em `src/content/site.ts`)

Liga/desliga do site "ainda não lançado". Com `enabled: true` a página
(`src/app/page.tsx`) monta só: Hero → bloco "estamos chegando" (é a
`ContatoSection` com `title`/`text`/`cta` do `PRELAUNCH`, mesma foto e
botão de WhatsApp, mais o link secundário "Siga a gente no Instagram"
— prop `instagram` — ao lado do botão, embaixo dele no celular) → rodapé. Junto:

- Hero: a moldura fica verde-medio (cor da seção seguinte) e o "scroll"
  leva pro `#contato`.
- Menu: sem os links das seções (só cavalo, WhatsApp e Instagram; no
  celular o menu aberto mostra só WhatsApp e Instagram).
- Rodapé: some a coluna "Navegar".

Pra lançar o site completo: `PRELAUNCH.enabled = false` — volta tudo como
era, nada mais precisa mudar. A faixa "Estamos chegando" é outra chave
(`ANNOUNCEMENT`).

### Desempenho no celular (toque)

- `.grain-overlay` some no toque (`@media (pointer: coarse)` no
  `globals.css`): animava sem parar com `mix-blend-overlay` e recompunha as
  fotos por baixo a cada quadro.
- Pills da `FloatingNav`: `backdrop-blur` só com mouse
  (`pointer-fine:backdrop-blur-md`); no toque a pill fica mais opaca no
  topo (0.88 em vez de 0.7) pra continuar legível sem o desfoque.
- `HeroSlideshow`: só a foto ativa (e a que está saindo) fica na
  composição — as outras ficam `invisible`, sem `will-change`; a troca
  pausa com a Hero fora da tela ou a aba escondida.
- Medido (build de produção, celular emulado, CPU 4× mais lenta): parado
  na Hero, pior quadro 33 → 17ms; rolando a página, ~51 → ~54 fps e 18 →
  6–11 quadros lentos. O ganho de GPU (blur/blend) não aparece nesse
  emulador e deve ser maior no aparelho.

### Instagram no menu

- Computador/tablet (md+): círculo só com o ícone, à direita da pill de
  links, mesmo tamanho e cor do cavalo — sempre à mão, menos chamativo que
  o WhatsApp (sem fundo próprio nem texto).
- Menu do celular: botão contornado "@toma.fernandito" logo abaixo do
  WhatsApp (que segue sendo o sólido).

### Fotos de pré-lançamento (placeholder)

Enquanto não tem foto do produto, o site usa fotos de campo/produção como
placeholder, em `public/images/placeholder/` (os JPGs como chegaram, ~2300px no lado
maior), ligadas pelo `src` de cada `photo(...)` em `src/content/site.ts`:
Hero (4 paisagens), Galeria (7), "O que anda rolando" (7, repetindo
algumas), Contato (1). O verso do Manifesto já tem a foto real dos quatro
fundadores (`public/images/fundadores.jpg`; legenda na ordem da foto, da
esquerda pra direita). Trocar uma foto = trocar o arquivo/caminho no
`site.ts`; tirar = `src` volta a `null` e aparece o placeholder com nome.

**Qualidade**: os arquivos ficam como vieram (sem recomprimir antes — cada
compressão a mais tirava nitidez); o `next/image` entrega em qualidade 90
(`PHOTO_QUALITY` em `PhotoSlot.tsx`, liberada em `images.qualities` no
`next.config.ts` — o padrão do Next 16 é só 75). A 1ª foto da galeria abre
em tela cheia, então pede `sizes="120vw"` (a moldura dela tem 120% pro
parallax); com o `sizes` de card o navegador baixava uma versão pequena e
esticava.

**Hero com fotos trocando** (`HeroSlideshow.tsx`): fundo do cartão com as
fotos de `HERO.photos` em fade cruzado (1,4s) a cada 5,5s, cada uma com
zoom lento de 1.06 → 1 (7s) enquanto está na tela, por baixo de um véu
`verde-escuro/55` que mantém o cartão verde e o logo legível. Só começa a
trocar depois da intro (`onIntroComplete`); com reduced motion fica a 1ª.
A 1ª foto é `priority` (vira o LCP da página).

### Faixa de pré-lançamento (`AnnouncementBar.tsx`)

Faixa fina (32px) fixa no topo, em celular e computador: "Estamos
chegando", fundo off-white, texto verde-escuro em Special Elite maiúscula
espaçada, bolinha verde-medio pulsando devagar (`motion-safe`) e sombra
leve embaixo (`0 4px 14px`) — a sombra é o que separa a faixa nas seções
claras. `z-[55]`: acima da nav (50), abaixo da barra de progresso (60), da
cortina do teletransporte (90) e da intro (100). Fica POR CIMA do conteúdo
(não empurra a página): cobre os 32px de cima da Hero e do palco preso da
galeria — aceito por ser temporária. A cor do topo do Safari
(`ThemeColorSync`) passa a pegar a cor da faixa sozinha.

**Liga/desliga**: `ANNOUNCEMENT.enabled` em `src/content/site.ts`. Ligada,
o `layout.tsx` põe `has-announcement` no `<html>`, que define
`--announcement-h: 32px` (senão 0); a `FloatingNav` desce essa altura
(`top-[calc(1rem+var(--announcement-h))]`) e o ponto que ela amostra pra
escolher o tom também. Recolhida, a nav some por trás da faixa. Pra
remover de vez: apagar o componente, a flag, a classe no `layout.tsx` e o
bloco `--announcement-h` do `globals.css` (a nav continua funcionando com
a variável em 0).

### Assets de logo (`/public/logo/`)

Todos os arquivos recebidos chegaram com cores aproximadas, fora do hex
exato da paleta (ex: `#3a4936` em vez de `#405139`) — foram todos
corrigidos por substituição direta de cor pra bater exato com `## Conteúdo (`src/content/site.ts`)

Todo texto e toda foto do site mora num arquivo só, `src/content/site.ts`,
separado por seção (`HERO`, `O_QUE_E`, `GALERIA`, `MANIFESTO`, `CONTATO`,
`SOCIAL`, `MARQUEE`, `FOOTER`, `NAV`, `LINKS`). Pra trocar texto, edita a
string ali. Pra trocar foto: salva o arquivo em `public/images/`, preenche
o `src` (ex.: `"/images/galeria-01.jpg"`) e escreve o `alt`. Com `src:
null`, o site mostra o placeholder verde com o nome da foto.

As fotos passam pelo `PhotoSlot` (`components/ui/PhotoSlot.tsx`):
`next/image` com `fill` + `object-cover` e `sizes` por lugar de uso, ou o
placeholder. A lata do "O que é" é a exceção: `object-contain`, porque a
arte tem fundo transparente. Os metadados de SEO (título, descrição,
domínio) continuam em `src/lib/site.ts`.

## Cores`

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

#### O que o site serve de verdade: WebP, não os SVGs

Os três SVGs usados em tela são ilustrações com milhares de paths — o
wordmark sozinho tinha **2.3MB** e era o elemento de LCP da Hero. Passaram
por `svgo` e, principalmente, viraram **rasters WebP em 2x do tamanho real
de exibição**, que é o que os componentes carregam:

| Servido em tela             | Vem de                     | Peso              | Exibido a         |
| --------------------------- | -------------------------- | ----------------- | ----------------- |
| `fernandito-logo-text.webp` | `fernandito-logo-text.svg` | 2.3MB → **192KB** | até 1667px (Hero) |
| `fernandito-moeda.webp`     | `fernandito-moeda.svg`     | 1.7MB → **23KB**  | 40–120px          |
| `fernandito-horse.webp`     | `fernandito-horse.svg`     | 472KB → **8KB**   | 44px (nav)        |

Os `.svg` continuam no repo como **arquivo-fonte da marca** (é deles que os
rasters saem). Pra regerar — depois de trocar um SVG, ou se algum lugar
passar a exibir maior do que a tabela acima —, use o `sharp` (já é
dependência do projeto): `sharp(svgPath, { density: 300 }).resize({ width })
.webp({ quality: 90-92 }).toFile(webpPath)`, com `width` no dobro da maior
largura CSS de exibição. `fernandito-logo-text.webp` foi regerado assim em
3400×639 (era 1400×263) quando o logo da Hero passou a chegar a 1667px CSS
— o raster antigo ficava borrado acima de ~700px. Regra: **o raster tem que
ter no mínimo 2x a maior largura CSS em que aparece**, senão fica borrado
em tela retina; lembrar de atualizar `INTRINSIC_WIDTH`/`INTRINSIC_HEIGHT`
em `Logo.tsx` junto (usados pelo `next/image` pra reservar a caixa certa e
evitar CLS).

O `<Logo />` usa `next/image` com `priority` (é o LCP: ganha `<link
rel=preload>` e sai do lazy-loading). Os ícones pequenos seguem em `<img>`
normal com `width`/`height` explícitos — passar 40px por um otimizador não
paga o custo, e as dimensões é que evitam CLS.

O GIF da intro (`cavalinho-intro.gif`) tinha 1325×757 sendo exibido a
320px: foi reduzido pra 640px e 32 cores (**1MB → 283KB**), sem diferença
visível.

`fernandito-horse-full.png` (11.8MB), `fernandito-horse-full.svg`,
`fernandito-horse-illustration.png`, `cavalinho.gif` e
`cavalinho-intro.mp4` continuam no `/public` mas **nenhum componente usa** —
não pesam no carregamento do usuário, só no tamanho do deploy. Dá pra
apagar quando quiser (o git guarda).

## Estrutura de seções (`/src/components/sections`)

`ManifestoSection` e `ProdutoSection` (versões antigas) não estão montadas
em `src/app/page.tsx` — os componentes seguem no repositório. O "Manifesto"
de hoje é a `CartaSection` (`#manifesto`).

**Navegação.** Sem numeração de seção nem contadores (pareciam slide —
removidos a pedido). `FloatingNav` (`LINKS`) e `FooterSection`
(`NAV_LINKS`) apontam pras âncoras `#o-que-e`, `#galeria`, `#manifesto` e
`#contato` (este só no rodapé e no menu mobile — no desktop o botão de
WhatsApp da pill já é esse atalho). A pill de links só aparece a partir de
`md` (768px) com `whitespace-nowrap`; abaixo disso vira cavalo (topo) +
pill "Menu"/"Fechar" que abre o overlay.

**Escrita à máquina (`components/ui/TypewriterText.tsx`).** Motivo
recorrente do site: títulos que se escrevem letra a letra presos ao
scroll (scrub, "desescrevem" se rolar pra cima), com um cursor que
acompanha a última letra digitada e pisca (`@keyframes caret-blink` em
`globals.css`). SplitText `words,chars` (quebra só entre palavras); texto
completo no HTML do servidor e em `aria-label`. Usado no Manifesto,
Contato e "O que anda rolando"; o O que é tem a mesma técnica inline.
**Vários textos em sequência** (Contato, rodapé) usam o mesmo gatilho
(`triggerSelector`, ex. `"#contato"`) com faixas encadeadas (título
`top 90%→30%`, parágrafo `top 30%→5%`, botão logo depois) — com o
próprio texto como gatilho, um parágrafo curto embaixo "passava na
frente" do título. Regra de faixa: o texto tem que terminar de se escrever **enquanto a
seção ainda está inteira na tela** (padrão `top 85%` → `top 55%`; no O
que é, `top 90%` → `bottom 85%` da coluna) — nunca só quando ela já está
saindo por cima.

**Parallax geral (`components/ui/Parallax.tsx`).** Wrapper que translada
em `y` de +speed a −speed enquanto atravessa a tela (scrub). Positivo =
camada da frente (sobe mais rápido), negativo = de trás. **Celular e
computador são tratados separado** (`IS_TOUCH`, `pointer: coarse`):

- Imagens, nos dois: O que é (lata −50), Manifesto (cartão −25), Social
  (pilha de 3 fotos, só no celular); a imagem do Contato tem parallax
  próprio.
- Textos, **só no computador** (prop `touch={false}`): O que é (coluna
  +30), Manifesto (título +40), Contato (coluna +40), Social (título +40,
  leque −20, link +10), rodapé (texto +24, links −16). No celular esses
  ficam parados: texto andando fora do ritmo do dedo parecia "seguir o
  scroll", e o fim da página tinha movimento demais ao mesmo tempo.

No toque, o que sobra cai pra 30% da amplitude; abaixo de 768px (sem
toque), pela metade. A galeria tem saída própria (abaixo); a faixa só tem
o loop constante. Sempre num nó próprio — nunca no mesmo elemento que já anima
`transform`.

Ordem fixa da landing page (ver `src/app/page.tsx`):

1. `HeroSection` — cartão **verde-escuro** (logo + tagline) que **fecha na
   moldura** ao rolar, revelando o fundo bege da section em volta.
   **Celular (toque)**: a section é `h-[160vh]` (`140vh` abaixo de md), o
   cartão é `sticky top-0 h-screen` e encolhe (scale 0.9, raio 40px) até
   70% do trecho preso e segura — aprovado assim. **Computador (mouse)**:
   **primeiro fecha, depois desce** — a section é `pointer-fine:h-[150vh]`
   (meia tela presa) e o cartão, `sticky`, fecha (scale 0.86, raio 40px)
   ao longo de todo o trecho preso, terminando exatamente quando solta; aí
   sobe com a página. Um de cada vez, sem pausa entre os dois. Descartados
   no computador: preso 60vh com o fechamento continuando depois de soltar
   ("travava no meio") e sem trecho preso, fechando enquanto subia (os
   dois ao mesmo tempo). **O logo e a frase
   fazem parte do cartão**: encolhem com ele e saem com ele (sem scrub, o
   cartão responde direto à rolagem), com um único movimento próprio, um
   parallax **bem sutil**: sobem `CONTENT_DRIFT` (36px; 22 no toque) ao
   longo do fechamento — descontado o encolhimento, ~15px na tela.
Tentativas
   descartadas: sumir cedo (sobrava cartão vazio), andar mais devagar que o
   cartão na saída (parecia descer junto), subir no ritmo da rolagem
   (disparava pra cima no primeiro gesto). O indicador "scroll" desvanece nos primeiros 15%
   num wrapper próprio. A moldura é bege porque a seção seguinte (O que é)
   é bege — se ela mudar de cor, trocar aqui também.

   No centro do cartão ficam só o logo (`Logo.tsx`, `max-w-[360px]
sm:max-w-[520px] lg:max-w-[700px]`) e, logo abaixo (`mt-3`, bem colado
   no logo), duas linhas de tagline. O banner "Fernet y Cola"
   (`public/images/fernet-y-cola-banner.png`) saiu da Hero — o arquivo segue
   em `/public/images` pra outros usos.

   **Linha 1** (estática): "Fernet y cola em lata." — `text-body-lg`,
   off-white, `font-rampart-sans` regular.

   **Linha 2** (`RotatingWord.tsx`, menor — `text-body` — e mais apagada —
   `text-fernandito-off-white/70`): a frase inteira "Feito com ___." rola
   como um bloco só, não só a palavra dentro de um "Feito com" fixo. Um
   roller vertical (GSAP, `y` em `em` por cima de uma pilha de `<span>`,
   `overflow-hidden`) troca entre 10 frases completas — "Feito com Brio.",
   "Feito com Liberdade.", "Feito com Intenção." etc. (as de liberdade
   — Liberdade, Independência, Inquietação — intercaladas logo no começo;
   Teimosia no fim), com "Feito com" em `font-rampart-sans` e a
   palavra em `font-rampart-stamp font-bold` (bold sintético — a Stamp só
   tem peso 400). Duas coisas que não são óbvias:
   - cada linha do roller usa `h-[1.4em]` + `leading-none` (não `1.2em` — a
     Rampart Stamp tem métricas de ascendente/descendente maiores que o
     normal; com menos folga a linha vizinha vazava visualmente por
     cima/baixo do recorte);
   - **cada linha é a FRASE INTEIRA, não só a palavra** — como cada frase
     ocupa a largura toda do bloco e se centraliza sozinha (`items-center`
     no flex), não precisa medir nem animar largura nenhuma. A versão
     anterior animava só a palavra dentro de um prefixo fixo, e pra manter
     a frase centralizada em cada tamanho de palavra também animava a
     LARGURA da caixa junto com a posição — duas tweens em propriedades de
     natureza diferente (largura mexe no layout, na thread principal;
     posição vertical é só `transform`, no compositor), que às vezes
     dessincronizavam e a palavra parecia entrar "em diagonal". Rolar a
     frase inteira elimina o problema na raiz.

   `prefers-reduced-motion` trava a primeira frase, sem animação.

2. `OQueESection` (`#o-que-e`, 01) — fundo off-white, "o que é" o produto
   em linguagem direta: placeholder da lata à esquerda e, na coluna da
   direita, dois parágrafos + frase de fechamento (`font-rampart`,
   `text-display-sm`). Tudo revelado letra a letra (máquina de escrever)
   preso ao scroll (`scrub`, volta se rolar pra cima). SplitText usa
   `type: "words,chars"` — só `"chars"` deixava o navegador quebrar linha
   no meio da palavra ("qu / anto"). Grid de duas colunas só a partir de
   `md`.
3. `GaleriaSection` (`#galeria`) — **a foto inteira que vira galeria**.
   Palco `h-lvh` pinado (ScrollTrigger `pin`, `SCRUB.soft`), cards
   posicionados em absoluto (x/y via GSAP). **Ritmo da parte presa**:
   pausa com a foto inteira → a foto reduz até card e as outras entram
   pela direita → as fotos passam → pausa com a última foto inteira →
   solta. **Valores separados por aparelho**: no toque, pausas de 0,2 tela,
   redução em 0,7 e trilha a 0,9 px por px rolado (1,125 abaixo de 768px) —
   a 1,5 ficava tudo rápido demais no celular; no computador, pausas de
   0,12, redução em 0,8 e trilha a 1,1 (`SPEED_DESKTOP`) — a 0,9 a galeria
   ficava presa ~4 telas com a roda do mouse. (Testado e descartado: reduzir a foto
   enquanto a galeria ainda entrava na tela — a pessoa não chegava a ver a
   foto inteira.)
   **Fase 2**: parallax de profundidade — cada foto tem `speed` própria
   (fotos grandes na frente, 1.15–1.2; pequenas atrás, 0.8–0.85; a
   primeira e a última na base, 1) e deslocamento vertical `off`; a foto
   i cruza o centro da tela no instante t = i/(n−1), então os vizinhos
   nunca se cruzam dentro da tela, só se sobrepõem de leve (z-index pela
   profundidade). Deriva vertical leve, **só pra cima** e só nas da frente
   (`max(0, speed − 1)`): o palco recorta o que passa da borda de baixo, e
   a sombra das fotos de trás que desciam era cortada reta ali (virava uma
   linha entre a galeria e o Manifesto). Pelo mesmo motivo a Foto 05 fica
   em `off` 0.15 — card + sombra sempre acima da borda do palco; miolo
   de cada card desliza em `xPercent` (±7). **O fundo do palco vai de
   verde-escuro pra bege (off-white)** ao longo da fase 2, na mesma cor do
   Manifesto logo abaixo — emenda sem corte. No caminho passa pelo
   verde-medio (32%) e pelo verde-claro (62%) (`BG_STOPS`, keyframes com
   `easeEach: "none"` dentro de uma tween `power1.inOut`): direto, o meio
   da mistura era um cinza-barro fora da paleta. A fase 2 **termina assim que
   a última foto aparece inteira** com uma folga na direita (`tEnd`,
   margem de 6% da largura) — não leva a foto até o centro, a página já
   segue descendo. **Saída**: cada foto vive numa camada de palco inteiro
   (`layerRefs`, onde também fica o z-index); depois que o pin solta, as
   camadas, depois da pausa final, deslizam de leve pra esquerda (−5% W ×
   speed) e sobem **relativo à velocidade base** (−60% H × max(0, speed − 1)): a última foto (speed 1)
   sai junto com a página, as da frente sobem um pouco mais e as de trás
   acompanham a página (nunca descem, pra sombra não ser cortada). Versão anterior (−30% H × speed²) fazia a última foto
   subir mais rápido que a página e abria um vão enorme antes do
   Manifesto. **Palco em `h-lvh`** (não `svh`): no Safari do iPhone a
   barra recolhe durante a rolagem e a tela fica mais alta que um palco em
   `svh` — sobrava uma faixa embaixo; a `<section>` também anima a cor de
   fundo junto com o palco, então qualquer faixa que apareça é da mesma
   cor. Sem título, contador ou barra (pedido explícito: só a
   foto). Timeline reconstruído só quando a LARGURA útil muda
   (`clientWidth` via ResizeObserver no `<html>` — pega a barra de rolagem
   aparecendo depois do intro; medir com `innerWidth` deixava a trilha
   larga demais e criava rolagem horizontal no PC; e, como rede de segurança, `html, body` têm `overflow-x: clip` em
   `globals.css` — `clip`, não `hidden`, pra não quebrar os `sticky`). Depois de reconstruir,
   **`ScrollTrigger.sort()` antes do `refresh()`**: o pin recriado ia pro
   fim da lista e os gatilhos de baixo (digitação do Contato, rodapé)
   calculavam a posição sem o espaço do pin e disparavam cedo. A saída da galeria
   (gatilhos sem elemento, que começam no fim do pin) tem
   `refreshPriority: -1`: com o `sort()` ela podia ser recalculada antes do
   pin, lia o fim dele ainda velho e já começava "passada" — as fotos
   ficavam ~40px pra esquerda e sobrava uma faixa verde na direita da foto
   de abertura. Rede extra: depois de cada `refresh`, se a largura do palco
   não bate com a da montagem, remonta. Fotos em
   `src/content/site.ts` (`GALERIA.photos`), via `PhotoSlot`. **Hover
   "respira"** (só com mouse): a foto dá zoom de 6% por dentro
   (`group-hover:scale-[1.06]`, `duration-slow`) e a moldura fica parada;
   o card volta a receber `pointer-events` (a camada não recebe). Testada
   e descartada: inclinação dos cards pela velocidade da rolagem (±3°)
   — deformava as fotos e brigava com o parallax de profundidade.
   Placeholders usam cores sólidas (tons translúcidos ficavam cinza sobre
   o bege). `prefers-reduced-motion`: grid estático.
4. `CartaSection` (`#manifesto`) — o **Manifesto**. Emenda com a galeria
   sem sobreposição nem gradiente (as duas versões anteriores deixavam uma
   linha fina na junção): fundo off-white sólido, mesma cor do fim do
   palco, com espaçamento normal (`pt-16` no celular, `sm:py-24`). Título "Nosso
   manifesto" pequeno (`TypewriterText`, `clamp(1.625rem,3.4vw,2.625rem)` —
   o protagonista é o cartão, não o título; título → cartão `sm:mt-12`) + cartão-postal (até 782px de
   largura; wrapper `max-w-[878px]` com `px-6 sm:px-12`: o selo fica
   pendurado ~20px pra fora do cartão e, com só 24px de margem, era cortado
   pela borda da tela entre 640 e 830px. Folga medida do selo até a borda:
   10px no celular, 21px no tablet). Entrada presa ao scroll num wrapper: o cartão sobe inclinado
   (y 160, −6°, escala 0.9) e assenta; no fim o selo é "carimbado" (escala
   2.2 → 1 com `back.out`, pego por `data-seal` porque existe em dobro no
   DOM). Cartão com verso via
   `FlipCard` (`components/ui/FlipCard.tsx`, reutilizável). Clique/Enter/
   Espaço vira o cartão em 3D (`perspective` no `ElevatedCard` externo,
   `rotateY` num elemento interno `preserve-3d`, `back.inOut(1.2)`,
   elevação extra de -10px no meio do giro). Frente: texto, assinaturas
   (`font-accent`), selo. Verso: foto dos fundadores (placeholder com
   `sepia+saturate` preparando o tom retrô), legenda e carimbo sutil.
   Dica "Girar" / "Girar de volta" **embaixo do cartão** (fora dele — dentro
   brigava com assinaturas e legenda), com ícone de respiração contínua,
   clicável também; sempre visível no toque. **Safari**: `backface-visibility`
   não esconde filhos com camada própria (selo com `will-change`, ícone
   animado) — eles apareciam espelhados por cima do verso. A face de costas
   fica `visibility: hidden` de verdade e troca quando o giro passa de 90°
   (`onUpdate` lendo `rotationY`). Cada face tem `backface-visibility:hidden` +
   `pointer-events-none` quando de costas; um "sizer" invisível em fluxo
   normal define a altura. `prefers-reduced-motion`: crossfade de opacity.
5. `ContatoSection` (`#contato`) — CTA de contato em **tela dividida**
   (`md:grid-cols-2`, `md:min-h-[110vh]` — um pouco mais que uma tela): à esquerda, fundo verde-medio,
   título "Quer Fernandito no teu rolê?" + texto de apoio (os dois se
   escrevendo à máquina) + `WhatsAppButton background="verde-escuro"`,
   tudo alinhado à esquerda; à direita, imagem de ponta a ponta (hoje
   placeholder verde-escuro com grain) com parallax próprio. O título se
   escreve devagar (faixa `top 95%` → `top 30%`, ~2× a original) (miolo 120% de
   altura, `yPercent` −8 → 8 e leve zoom desfazendo). **Entrada suave**:
   só um fade longo da moldura (`top 95%` → `top 45%`), somado ao parallax
   de dentro. Já foi uma cortina de clip-path abrindo de baixo pra cima —
   agressiva demais. No
   celular a imagem vai pra baixo do texto (`aspect-[4/5]`, pouco mais de
   meia tela). Foto em `src/content/site.ts` (`CONTATO.photo`). O botão é o
   mesmo `cta-destaque` do menu e do rodapé.
6. `SocialGallerySection` (`#social`, "O que anda rolando") — título
   pequeno numa linha, escrito à máquina (`whitespace-nowrap`; abaixo de sm
   a fonte é `min(6.8vw, 1.75rem)`, porque o título mede ~12,3em e em 390px
   ele quebrava, deixando um "R" solto durante a digitação; cabe numa linha
   de 320px pra cima); embaixo "Segue a gente no
   Instagram" + link @toma.fernandito; seção compacta (~1 tela). **No
   celular (< md)**: só 3 fotos empilhadas (alternando de lado e
   inclinação, levemente sobrepostas), cada uma numa camada de `Parallax`
   com velocidade própria — nada de arrastar pro lado no meio da página.
   Tablet mantém a fileira com snap; desktop, o leque. Fundo off-white, cards 4:5 com cantos arredondados (`rounded-2xl`) e sombra
   suave, sem a borda grossa de polaroid. Leque de 7 cards só a partir de
   `lg` (1024px — abaixo disso cortava as pontas), que começa como uma
   pilha de fotos no centro e se abre em leque conforme rola (scrub);
   mobile/tablet usam fileira com scroll-snap. Ver detalhes na entrada própria abaixo.
7. `FichaTecnicaSection` — só o marquee (`font-accent`, "Toma Fernandito ·
   Fernet y Cola" em loop — 350ml/8% saíram), faixa baixa (`py-3
sm:py-4`, texto `clamp(1.25rem,2.4vw,1.875rem)`, `translate-y-[0.15em]` pra
   centralizar as maiúsculas — a Special Elite reserva ~30% da linha pras
   descendentes), agora em faixa
   **verde-claro** com texto off-white — antes era verde-escuro e se
   fundia com o rodapé logo abaixo. **Movimento contínuo e constante**:
   loop de 90px/s pra esquerda, sem reagir à rolagem, sem fade de entrada
   e sem deslizar junto com a página (já acelerou/inverteu com a rolagem e
   já deslizou com ela; as duas coisas saíram por pedido). Frases em
   `src/content/site.ts` (`MARQUEE.phrases`).
8. `FooterSection` — fundo verde-escuro, compacto, **largura total** (só o
   padding da página). Testado e descartado: rodapé "revelado" (preso no
   fundo, por baixo do conteúdo) — ele aparece de baixo pra cima, então a
   frase de fechamento surgia por último e já digitada, e no celular ele é
   mais alto que a tela (o topo nunca apareceria). Coluna de texto até 34rem (frase em
   `clamp(1.75rem,3vw,2.75rem)`); só a frase principal se escreve à
   máquina, **sozinha, não presa à rolagem** (`TypewriterText
mode="play"`: quando o rodapé chega a 75% da tela, 13 letras por
   segundo, a segunda linha depois da primeira), a legenda e o resto já
   estão lá, e nada tem parallax — o fim da página
   estava com animação demais ao mesmo tempo. Coluna estreita pra não
   espremer as colunas de links. Frase de fechamento em
   `font-rampart` ("Liberdade não se pede, / se toma." — o
   contraste da segunda linha é a cor verde-claro, já que a Rampart não tem
   itálico), legenda "Toma Fernandito." em `font-accent`, CTA
   `WhatsAppButton`; colunas "Navegar" (O que é, Galeria, Manifesto,
   Contato) e "Social" (Instagram). Base: moeda + copyright e botão
   "Voltar ao topo" — pílula com rótulo escrito + seta (só a seta num
   círculo fino não parecia clicável); no hover acende em off-white e a
   seta dá um passinho pra cima. **Voltar ao topo** (esse botão e o cavalo do
   menu) e **todo link de âncora** (menu, menu do celular, "Navegar" do
   rodapé — o `Link` faz isso sozinho pra `href="#..."`) são um
   teletransporte (`teleportTo`/`teleportToTop`, `src/lib/lenis.ts`): a
   página rola 18% de tela rumo ao destino enquanto uma cortina verde-medio
   sobe e cobre a tela (0,35s); por trás dela pula pra 18% antes do destino
   (as animações presas à rolagem chegam no lugar na hora); a cortina segue
   subindo (0,55s) enquanto a página rola os últimos 18% até o destino.
   Sente a viagem sem mostrar tudo passando; ~1s no total. Rolar suave até o
   topo passava por todas as seções no caminho. Sob reduced motion, pulo
   seco.

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

Inspirada no "What's up on socials" do site do Lando Norris. Cards 4:5
com `rounded-2xl`, sombra suave (`0 18px 40px`), grain e 2 selos tipo
carimbo em posições fixas — a borda grossa de polaroid e a sombra dura
saíram (pesavam demais e deixavam os cards pequenos).

- **Leque desktop**: 7 cards em `flex` com margin-left negativo pro
  overlap; cada card tem seu próprio `rotate`/`translateY`/`scale` via
  `gsap.set`/`gsap.to` (nunca via className — precisa mudar no hover).
  Rotação por índice `[-12, -8, -4, 0, 4, 8, 12]`, distância do centro em
  "camadas" de `translateY` (16px por camada) e z-index (maior no centro).
  Entrada presa ao scroll (scrub, `invalidateOnRefresh`): todos partem
  empilhados na posição do card central (x medido por `offsetLeft`),
  levemente girados, e se abrem até os valores finais do leque — fecha de
  volta se rolar pra cima.
  Hover (só com mouse): a foto sob o cursor **sobe 28px, endireita e
  cresce 8%**, com sombra mais funda (`0 40px 70px`), inclinação 3D leve
  seguindo o mouse (±7°, `quickTo` em `rotationX/Y`, perspectiva 900px) e
  zoom da foto por dentro (`group-hover:scale-[1.08]`, a moldura fica
  parada); as vizinhas abrem espaço com queda por distância (44/20/8px) e
  abrem 2° o ângulo. Tudo isso anima o **wrapper** de cada foto, não o
  card — o card é animado pela abertura do leque na rolagem e os dois
  brigavam pelas mesmas propriedades; por isso o z-index também mora no
  wrapper. Tudo reverte no `mouseleave` (z-index só volta depois que o
  wrapper termina de voltar, pra não "furar" atrás do vizinho).
  Espaço no desktop (lg+): título maior (`clamp(2.75rem,3.6vw,3.75rem)`),
  `lg:py-32`, título → leque `lg:mt-24`, leque → "Segue a gente"
  `lg:mt-28` — antes o link encostava nas pontas caídas do leque.
- **Mobile e tablet (< `lg`)**: os dois DOMs (leque e fileira) coexistem,
  alternados via `hidden lg:flex`/`lg:hidden` — o leque só a partir de
  1024px, porque em 640–1023px ele cortava as pontas. Escolhida a **Opção B** (carrossel com
  `overflow-x-auto` + `snap-x snap-mandatory`) em vez de reduzir pra 3-4
  cards do leque: em tela estreita, cada card do carrossel continua no
  tamanho legível de sempre (o leque forçaria cards minúsculos ou vazaria
  a viewport), é um padrão de swipe que todo mundo já conhece, e não
  disputa o gesto de scroll vertical do Lenis (scroll horizontal num
  container é um eixo totalmente independente). Cada card tem só uma
  inclinação leve alternada (±1.5°), sem overlap — "fileira", não
  "leque" —, textura e selo intactos, barra de rolagem escondida; sem hover (não existe em touch) e
  sem cascata por card, só um fade simples na fileira inteira.
- **Placeholders de foto**: 7 divs com `bg-fernandito-verde-medio`/
  `verde-claro` em variações de opacidade, texto "FOTO 0X" — não há
  arquivos ainda. Quando as fotos reais chegarem, trocar o miolo colorido
  de cada `PhotoCard` (`SocialGallerySection.tsx`) por
  `<img src="/images/social-0X.jpg" />`, mantendo o arredondado/sombra/grain
  do card por fora.

## Infra de animação (`/src/lib`)

- **`gsap.ts`** — registra `ScrollTrigger` e `SplitText` uma única vez
  (client-side) e exporta `gsap` + helpers e os tokens de motion
  (`EASE`, `EASE_BEZIER`, `DURATION`, `SCRUB`).
- **`background.ts`** — `backgroundAt(x, y)`: a cor de fundo que está de
  fato na tela num ponto (sobe a árvore até o primeiro fundo não
  transparente) e se ela é clara. Usado pelo menu, pelo cursor e pelo
  `ThemeColorSync`.
- **`lenis.ts`** — inicializa o Lenis (smooth scroll) e sincroniza com o
  ticker do GSAP, para que `ScrollTrigger` e o scroll suave fiquem no mesmo
  relógio.

Qualquer nova seção com animação deve:

- Importar `gsap`/`ScrollTrigger` de `src/lib/gsap.ts` (nunca importar
  `gsap` "cru" diretamente nos componentes).
- Respeitar `prefers-reduced-motion` (helper `prefersReducedMotion()` em
  `src/lib/gsap.ts`).
- Limpar `ScrollTrigger`/timelines no cleanup do `useEffect`.
- Entrada de elemento **focável** (botão, link, cartão com `role=button`)
  anima `opacity`, nunca `autoAlpha`: `visibility: hidden` tira o elemento
  da ordem do Tab, e quem navega pelo teclado não chegava no cartão do
  Manifesto nem no botão do Contato antes de rolar até eles.

## Comportamento de refresh

Decisão explícita: dar refresh na página **sempre volta pro topo**, nunca
mantém a posição de scroll da sessão anterior — landing de página única,
"acordar" no meio do scroll é uma experiência ruim, e a IntroLoader já roda
do zero a cada carregamento mesmo. Implementado em `layout.tsx` via um
`<Script strategy="beforeInteractive">` que desliga `history.scrollRestoration`
e força `scrollTo(0, 0)` antes da hidratação (evita o flash de "restaura no
meio e depois pula pro topo").

## SEO técnico

Tudo via Metadata API nativa do Next — nenhuma tag `<head>` na mão.

- **`src/lib/site.ts`** — `SITE_URL`, `SITE_TITLE`, `SITE_DESCRIPTION`. Mora
  fora do `layout.tsx` de propósito: `robots.ts`/`sitemap.ts` importando do
  layout fariam o módulo dele ser avaliado fora do grafo de componentes,
  onde o transform do `next/font` não roda — e o build quebra em
  `localFont(...).variable`. `NEXT_PUBLIC_SITE_URL` sobrescreve a URL em
  preview, pra deploy de teste não emitir canonical do domínio final.
- **`layout.tsx`** — title/description, keywords, canonical, Open Graph
  (com `/og-image.jpg` 1200×630), Twitter `summary_large_image`, robots, e
  os metadados de geo (`geo.region` BR-RS, `geo.placename`, `geo.position`,
  `ICBM`) via `other`, que a Metadata API não tem campo próprio pra isso.
  `viewport` exporta `themeColor`.
- **JSON-LD** (`@graph` com `Organization` + `Product` + `WebSite`) inline no
  `<body>`. Só com dado que já é verdade no site (350ml, 8% v/v, registro
  MAPA, Instagram). **Sem `offers`, `price` ou `aggregateRating`** — não há
  e-commerce nem avaliações, e marcar campo inexistente derruba o rich
  result inteiro na validação. Quando houver loja, adicionar `offers` aqui.
- **`robots.ts` / `sitemap.ts` / `manifest.ts`** — rotas nativas. Pra somar
  página nova ao sitemap basta uma entrada no array `ROUTES`.
- **Ícones** — `src/app/icon.png`, `apple-icon.png` e `favicon.ico` são
  convenções de arquivo do Next (ele gera as tags sozinho); `public/icon-192.png`
  e `icon-512.png` servem o manifest. Todos gerados a partir da moeda.
  `og-image.jpg` é **placeholder** com o logo real sobre verde-escuro.

## Performance — o que já foi feito e onde está o teto

Baseline Lighthouse (mobile) era **Performance 59 / LCP 8.9s / 3210KB**.
Depois de otimizar assets e fontes: **Performance ~74 / LCP 6.4s / CLS 0 /
TBT ~190ms / 1000KB**, com **SEO 100, Acessibilidade 100, Best Practices 100**.

O LCP restante **não é peso de asset** — todas as imagens carregam em menos
de 100ms. É a cortina de abertura: medido com throttling mobile, LCP com a
intro dá **5.0s** e sem ela (via `prefers-reduced-motion`) dá **0.9s** — ou
seja, **a intro responde por ~4.1s**. A conta é o próprio desenho dela:
`VISIBLE_DURATION` 2s + reveal 1.1s + o fade-in da Hero (que começa em
`opacity: 0`, então o logo nem conta como LCP antes disso). Encurtar a
intro é a única alavanca real de LCP — e é decisão de marca, não técnica.

Regras que o site já segue e que vale manter:

- `scrub` sempre com valor numérico (0.6), nunca `true` puro.
- `[will-change:transform]` em todo elemento que o GSAP anima.
- `CustomCursor` e `ScrollProgress` **não montam** sob `prefers-reduced-motion`
  (retornam `null`) — não é só ficar invisível, é não rodar cálculo nenhum.
- `ScrollProgress` recalcula **por evento de scroll/resize** com rAF só de
  throttle. Antes era um `requestAnimationFrame` em loop infinito, queimando
  CPU ~60x por segundo com a página parada.
- Texto animado (`SplitText`) nasce **no HTML do servidor** — a animação só
  mexe em `opacity`/`transform` de spans que já existem. Nenhuma informação
  depende de JS pra existir no DOM.
- `SplitText` sempre com `aria: "none"`. O padrão (`"auto"`) injeta
  `aria-label` no elemento splitado, o que a spec do ARIA proíbe em `<p>`/
  `<span>` sem role — era o que segurava a nota de acessibilidade em 92.
- Labels pequenos (`text-label`) não descem de `opacity-80`: a 50% o
  contraste caía pra 2.77, abaixo do mínimo de 4.5.

### Conferência final dos blocos de refinamento (0 a 9)

- Lighthouse (celular, build de produção, 2 rodadas): Performance 70–73,
  Acessibilidade 100, Boas práticas 100, SEO 100; LCP 4.8–6.0s; CLS 0–0.01.
- Tempo de bloqueio no carregamento, medido direto (Playwright, CPU 4×
  mais lenta, 3 rodadas): mediana 850ms agora contra 869ms antes do Bloco
  1 — os refinamentos não pesaram. O TBT maior de uma rodada de
  Lighthouse pra outra é variação da simulação. A maior tarefa (~500ms,
  hidratação + montagem de todos os ScrollTriggers) já existia antes e é
  o próximo teto a atacar, se for preciso.
- Rolagem da página inteira no desktop (Chromium sem GPU): mediana de
  16,7ms por quadro (60fps), 5% dos quadros acima de 33ms.
- Teclado: todo item focável mostra contorno; o menu recolhido volta no
  primeiro Tab; o cartão do Manifesto e o botão do Contato entram na
  ordem do Tab (antes ficavam de fora, ver regra do `autoAlpha` acima).
- `prefers-reduced-motion`: sem erros, todo texto visível (galeria vira
  grid estático, sem pin, digitação ou parallax).

## Celular — adaptações do desktop

Regras aplicadas na revisão mobile (390px e 360px, com emulação de toque):

- **Nada pode passar da largura da tela**, nem durante animação: um
  elemento que estoura faz o navegador do celular reduzir o zoom da
  página inteira. O selo do Manifesto começa 2.2× maior na animação de
  carimbo — a seção tem `overflow-x-clip` (recorta sem criar container de
  scroll, não quebra sticky/pin).
- **Hover não existe no toque**: o que só aparecia no hover e comunica
  função (label "VIRAR"/"VOLTAR" do cartão) fica sempre visível em
  `[@media(hover:none)]`.
- **Proporções**: texto do cartão do Manifesto `text-body` (não
  `body-lg`), assinaturas em grade 2×2 (4 numa linha passavam por baixo do
  selo), placeholder da lata `w-24`, parallax com metade da amplitude.
- **Rolagem**: a trilha da galeria anda 1.35× mais por px rolado no
  celular (o pin ficava longo demais pra tela estreita).
- **Barras do Safari (iPhone)**: o Safari pinta a área das barras (a de
  cima e a flutuante de baixo, com o endereço) com a cor "tema" da página.
  Ela era fixa em verde-escuro e sobrava uma faixa escura embaixo das
  seções bege. `components/providers/ThemeColorSync.tsx` amostra a cor de
  fundo nas bordas da tela a cada rolagem (e quando a cortina de abertura
  sai): `theme-color` = cor na borda de cima, fundo do `<html>` = cor na
  borda de baixo.
- O leque do Instagram e a trilha com hover são do desktop; no celular
  viram fileira com snap e trilha pinada sem hover.
