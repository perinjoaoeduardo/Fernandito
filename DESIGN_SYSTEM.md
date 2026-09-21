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

Fontes atuais carregadas via `next/font/google` como placeholder funcional
(serão substituídas por fontes customizadas em prompt futuro — a troca é só
trocar o `next/font` import em `layout.tsx`, os tokens de escala abaixo não
mudam):

- `font-serif` → Instrument Serif, Georgia, serif — **voz rústica/manifesto**
- `font-sans` → Inter, system-ui, sans-serif — UI, labels, ficha técnica

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

## Estrutura de seções (`/src/components/sections`)

Ordem fixa da landing page (ver `src/app/page.tsx`):

1. `HeroSection` — fundo verde-escuro
2. `ManifestoSection` — fundo off-white
3. `ProdutoSection` — fundo verde-medio
4. `FichaTecnicaSection` — fundo verde-claro
5. `VideoSection` — fundo verde-escuro
6. `CTASection` — fundo verde-medio

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
