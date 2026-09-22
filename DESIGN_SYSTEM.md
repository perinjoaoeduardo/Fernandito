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

## Componentes base (`/src/components/ui`)

- **`Button`** (`Button.tsx`) — variantes:
  - `primary` — fundo `verde-escuro`, texto `off-white`
  - `ghost` — borda `verde-medio`, texto `verde-escuro`
  - `whatsapp` — fundo `verde-medio`, ícone WhatsApp + texto `off-white`
- **`FloatingNav`** (`FloatingNav.tsx`) — menu flutuante centralizado no topo,
  ver comportamento detalhado no componente.
- **`Container`** (`Container.tsx`) — max-width com padding responsivo,
  usado para limitar a largura de conteúdo dentro das seções full-bleed.
- **`WhatsAppButton`** (`WhatsAppButton.tsx`) — wrapper do `Button`
  variante `whatsapp` que lê `NEXT_PUBLIC_WHATSAPP_NUMBER`: sem a variável
  preenchida, renderiza desabilitado (mesma aparência, `opacity-60`,
  `cursor-not-allowed`, tooltip "Em breve"); com ela preenchida, vira link
  para `wa.me/{numero}` com mensagem pré-preenchida. Usar este componente
  em vez de `Button` direto sempre que o CTA for "falar no WhatsApp". Aceita
  `background="verde-medio"` (padrão) ou `"verde-escuro"` (usado no
  `FloatingNav`, que já tem fundo claro).
- **`SvgPlaceholder`** (`SvgPlaceholder.tsx`) — placeholder genérico (borda
  tracejada + label) pros SVGs de marca que ainda não chegaram. Dimensionado
  via `className` por quem usa.
- **`Logo`** (`Logo.tsx`) — lockup completo da marca. Hoje é um
  `SvgPlaceholder` (~4:1, "LOGO SVG AQUI — aguardando arquivo") esperando
  `/public/logo/fernandito-logo-full.svg`. Ver seção "Assets de logo"
  abaixo pros demais arquivos esperados.
- **`CustomCursor`** (`CustomCursor.tsx`) — bolinha de 12px que segue o
  mouse (via `gsap.quickTo`), cresce (2.75x) e vira `mix-blend-mode:
difference` sobre qualquer `a`/`button`/etc. Global (montado 1x no
  `layout.tsx`, não por seção). Só ativa em desktop com hover
  (`supportsHover()`) e fora de `prefers-reduced-motion`; fora disso
  retorna `null` e o cursor nativo continua normal.

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

## Estrutura de seções (`/src/components/sections`)

Ordem fixa da landing page (ver `src/app/page.tsx`):

1. `HeroSection` — fundo **verde-medio**
2. `ManifestoSection` — fundo off-white
3. `ProdutoSection` — fundo verde-medio
4. `FichaTecnicaSection` — fundo verde-claro
5. `VideoSection` — fundo verde-escuro
6. `CTASection` — fundo verde-medio
7. `FooterSection` — fundo verde-escuro, 5 camadas (labels de canto,
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
