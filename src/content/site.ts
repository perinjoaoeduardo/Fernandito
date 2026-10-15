/**
 * TODO O CONTEÚDO DO SITE MORA AQUI.
 *
 * Pra trocar um texto, edite a string. Pra colocar uma foto no lugar de um
 * placeholder:
 *   1. salve o arquivo em `public/images/` (ex.: `public/images/galeria-01.jpg`);
 *   2. preencha o `src` correspondente com o caminho a partir de `public`
 *      (ex.: `src: "/images/galeria-01.jpg"`);
 *   3. escreva um `alt` descrevendo o que aparece na foto.
 * Enquanto `src` estiver vazio (`null`), o site mostra o placeholder verde
 * com o nome da foto. Nenhum componente precisa ser aberto.
 *
 * Os títulos com efeito de máquina de escrever quebram linha sozinhos; não
 * precisa colocar `\n`.
 */

export type ContentImage = {
  /** Caminho a partir de `public` (ex.: "/images/foto.jpg"), ou `null` pro placeholder. */
  src: string | null;
  /** Descrição da foto pra leitores de tela e buscadores. */
  alt: string;
  /** Nome que aparece no placeholder enquanto não há foto. */
  placeholder: string;
};

function photo(placeholder: string, alt: string, src: string | null = null): ContentImage {
  return { src, alt, placeholder };
}

export const LINKS = {
  instagramUrl: "https://www.instagram.com/toma.fernandito/",
  instagramHandle: "@toma.fernandito",
  /** WhatsApp comercial (+55 51 9338-3764), só dígitos: país + DDD +
   * número. A variável NEXT_PUBLIC_WHATSAPP_NUMBER, se existir, tem
   * prioridade (ver README). */
  whatsappNumber: "555193383764",
  /** Mensagem que já vem escrita quando a pessoa abre o WhatsApp. Sem
   * emoji: o 🐎 chegava como "�" na página do wa.me (redirecionamento do
   * WhatsApp quebra alguns emojis). */
  whatsappMessage: "Oi! Quero conhecer mais sobre o Fernandito.",
};

/** Textos da loja (seção/página Comprar, carrinho e checkout). Produtos e
 * preços moram em `src/lib/catalog.ts`; frete em `src/lib/shipping.ts`. */
export const STORE = {
  /** Liga a loja (venda do kit pré-lançamento). `false` esconde tudo dela:
   * seção Comprar, botões de compra (menu, Hero, bloco final), carrinho e as
   * páginas /comprar e /checkout (viram 404) — o site volta ao que era antes
   * da loja. O código continua aqui; pra religar é só `true`. */
  enabled: true,
  eyebrow: "Comprar",
  /** Linha curta acima do nome do kit (o que é). */
  badge: "Pré-lançamento · edição limitada",
  contentsTitle: "O que vem no kit",
  /** Selo de estoque real (Bling). `{n}` vira o número. */
  stockLeft: "Restam {n} unidades",
  stockLast: "Última unidade",
  /** Barra de compra fixa no celular. */
  stickyCta: "Adicionar",
  addToCart: "Adicionar ao carrinho",
  /** CTA dos outros lugares do site (menu, Hero, bloco final). */
  cta: "Comprar o kit",
  navCta: "Comprar",
  /** Contato secundário embaixo do botão de compra. */
  helpPrefix: "Dúvidas?",
  helpLink: "Fala com a gente no WhatsApp",
};

/** Modo pré-lançamento: o site mostra só a Hero, um bloco "estamos chegando"
 * com o WhatsApp e o rodapé — sem as seções que ainda não têm conteúdo.
 * Pra lançar o site completo: `enabled: false` (nada mais muda). */
export const PRELAUNCH = {
  enabled: false,
  title: "O Fernandito está chegando.",
  text: "Nós estamos arrumando tudo por aqui, mas tu já pode falar com a gente.",
  cta: "Chamar no WhatsApp",
  instagram: "Ver Instagram",
};

/** Faixa fixa no topo do pré-lançamento ("Estamos chegando"). Pra tirar do
 * site: `enabled: false` — some a faixa e o menu volta pro lugar sozinho. */
export const ANNOUNCEMENT = {
  enabled: true,
  text: "Lançamento · primeiro lote em pré-venda",
};

/**
 * Seções do site completo (com `PRELAUNCH.enabled: false`), NA ORDEM em que
 * aparecem na home. Pra tirar uma seção do lançamento: `on: false` — some da
 * página, do menu e do rodapé. A Hero e o rodapé estão sempre lá. O kit
 * ainda depende de `STORE.enabled`.
 */
export const SECTIONS = [
  { key: "kit", on: true, id: "comprar", label: "Comprar" },
  { key: "portas", on: true, id: "portas", label: "O que tu procura" },
  { key: "manifestoCurto", on: true, id: "manifesto-curto", label: "Manifesto" },
  { key: "social", on: true, id: "social", label: "Social" },
  // Moram nas páginas próprias (ver ARQUITETURA no DESIGN_SYSTEM.md):
  // O que é, Galeria, Manifesto e Ficha técnica em /manifesto; Perguntas em
  // /contato. Dá pra trazer qualquer uma de volta pra home com `on: true`.
  { key: "oQueE", on: false, id: "o-que-e", label: "O que é" },
  { key: "galeria", on: false, id: "galeria", label: "Galeria" },
  { key: "manifesto", on: false, id: "manifesto", label: "Manifesto" },
  { key: "perguntas", on: false, id: "perguntas", label: "Perguntas" },
  { key: "contato", on: false, id: "contato", label: "Contato" },
  { key: "fichaTecnica", on: false, id: "ficha-tecnica", label: "Ficha técnica" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

/** A seção aparece? (kit também precisa da loja ligada) */
export function sectionOn(key: SectionKey) {
  const section = SECTIONS.find((s) => s.key === key);
  if (!section?.on) return false;
  return key === "kit" ? STORE.enabled : true;
}

/** Âncora da primeira seção depois da Hero (seta "scroll" da Hero). */
export function firstSectionHref() {
  if (PRELAUNCH.enabled) return STORE.enabled ? "#comprar" : "#contato";
  const first = SECTIONS.find((s) => sectionOn(s.key));
  return first ? `#${first.id}` : "#contato";
}

/**
 * "As três portas": cada visitante acha o seu caminho. Casa = comprar o kit;
 * evento e negócio abrem um formulário curtíssimo que vira lead (guardado no
 * site) e abre o WhatsApp com a mensagem já escrita. Em `message`, `{campo}`
 * vira a resposta do campo de mesmo nome.
 */
export const PORTAS = {
  eyebrow: "Por onde tu chega",
  title: "O que tu procura?",
  casa: {
    title: "Fernandito na tua casa",
    text: "O kit de pré-lançamento, com entrega pro Brasil todo.",
    cta: "Comprar",
  },
  forms: [
    {
      key: "evento",
      href: "/eventos",
      title: "Fernandito no teu evento",
      text: "Festa, formatura, casamento ou evento da empresa. Conta o básico que a gente responde no WhatsApp.",
      cta: "Pedir orçamento",
      formTitle: "Conta da tua festa",
      submit: "Chamar no WhatsApp",
      fields: [
        {
          name: "tipo",
          label: "Que evento?",
          options: ["Aniversário", "Casamento", "Formatura", "Empresa", "Festa ou show", "Outro"],
        },
        { name: "data", label: "Quando?", type: "date" },
        { name: "cidade", label: "Cidade", placeholder: "Porto Alegre" },
        {
          name: "pessoas",
          label: "Quantas pessoas?",
          options: ["Até 50", "50 a 100", "100 a 200", "Mais de 200"],
        },
      ],
      message:
        "Oi! Quero o Fernandito no meu evento.\nEvento: {tipo}\nData: {data}\nCidade: {cidade}\nPessoas: {pessoas}",
    },
    {
      key: "negocio",
      href: "/revenda",
      title: "Fernandito no teu negócio",
      text: "Bar, restaurante, mercado ou empório: se tem geladeira e gente com sede, tem lugar pro Fernandito.",
      cta: "Quero revender",
      formTitle: "Conta do teu lugar",
      submit: "Chamar no WhatsApp",
      fields: [
        { name: "lugar", label: "Nome do lugar", placeholder: "Bar do Seu Zé" },
        {
          name: "tipo",
          label: "Tipo",
          options: ["Bar", "Restaurante", "Mercado ou empório", "Distribuidora", "Outro"],
        },
        { name: "cidade", label: "Cidade", placeholder: "Porto Alegre" },
      ],
      message: "Oi! Quero revender o Fernandito.\nLugar: {lugar} ({tipo})\nCidade: {cidade}",
    },
  ] as LeadForm[],
};

export type LeadField = {
  name: string;
  label: string;
  type?: "text" | "date";
  placeholder?: string;
  /** Com opções vira uma lista de escolha. */
  options?: string[];
};
export type LeadForm = {
  key: "evento" | "negocio";
  /** Página própria da porta. */
  href: string;
  title: string;
  text: string;
  cta: string;
  formTitle: string;
  submit: string;
  fields: LeadField[];
  message: string;
};

/** Perguntas frequentes — onde moram os fatos do produto. */
export const PERGUNTAS = {
  eyebrow: "Perguntas",
  title: "Perguntas que a gente sempre ouve.",
  items: [
    {
      q: "O que é o Fernandito?",
      a: "Fernet com cola na medida, pronto, numa lata de 350 ml. 8% de teor alcoólico. Feito em Porto Alegre.",
    },
    {
      q: "Como é melhor tomar?",
      a: "Bem gelado. Direto da lata ou num copo com bastante gelo.",
    },
    {
      q: "Vocês entregam onde?",
      a: "No Brasil todo, pela Jadlog. Em Porto Alegre a entrega é nossa. O valor e o prazo aparecem no checkout, com o teu CEP.",
    },
    {
      q: "Quais as formas de pagamento?",
      a: "Pix. O pedido é confirmado na hora em que o pagamento cai.",
    },
    {
      q: "Como acompanho a entrega?",
      a: "Quando o pedido sai, o código de rastreio chega no teu e-mail.",
    },
    {
      q: "Menor de idade pode comprar?",
      a: "Não. A venda é proibida para menores de 18 anos, e quem recebe precisa mostrar documento com foto.",
    },
  ],
};

/** Manifesto em 3 frases na home, com link pro inteiro (/manifesto). */
export const MANIFESTO_CURTO = {
  lines: [
    "A gente acredita que encontro não se faz com fernet, gelo e coca.",
    "Se faz com gente. E entre gente.",
    "A bebida é o veículo. O encontro é o propósito.",
  ],
  cta: "Ler o manifesto",
};

/** Cabeçalhos e textos das páginas internas. */
export const PAGES = {
  manifesto: {
    eyebrow: "Manifesto",
    title: "Quem é o Fernandito.",
    intro: "O que tem na lata, de onde vem e no que a gente acredita.",
  },
  eventos: {
    eyebrow: "Eventos",
    title: "Fernandito no teu evento.",
    intro:
      "Casamento, formatura, aniversário ou evento da empresa. Conta o básico que a gente monta uma proposta e responde no WhatsApp.",
    steps: [
      { title: "Conta da tua festa", text: "Que evento, quando, onde e quantas pessoas." },
      {
        title: "Recebe a proposta",
        text: "A gente responde no WhatsApp com valores e o que vai junto.",
      },
      { title: "No dia, tá lá", text: "O Fernandito chega gelado e no ponto." },
    ],
  },
  revenda: {
    eyebrow: "Revenda",
    title: "Fernandito no teu negócio.",
    intro:
      "Bar, restaurante, mercado, empório ou distribuidora. Se tem geladeira e gente com sede, tem lugar pro Fernandito.",
    reasons: [
      {
        title: "Ninguém tem igual",
        text: "Fernet com cola pronto, em lata. Teu cliente pede o que já toma, sem preparo.",
      },
      { title: "Sai rápido", text: "Gelou, vendeu. Não ocupa o balcão nem o barman." },
      {
        title: "A gente faz junto",
        text: "Material pro ponto de venda e divulgação do teu lugar no nosso Instagram.",
      },
    ],
  },
  contato: {
    eyebrow: "Contato",
    title: "Fala com a gente.",
    intro:
      "Escolhe o motivo: o WhatsApp abre com a mensagem pronta e quem atende já sabe do que se trata.",
    /** Cada motivo abre o WhatsApp com a sua mensagem (ou leva pra página). */
    reasons: [
      {
        title: "Dúvida sobre o kit",
        text: "Antes de comprar.",
        message: "Oi! Tenho uma dúvida sobre o kit do Fernandito.",
      },
      {
        title: "Meu pedido",
        text: "Já comprei e quero saber da entrega.",
        message: "Oi! Quero saber do meu pedido. Número do pedido: ",
      },
      { title: "Evento", text: "Festa, formatura, empresa.", href: "/eventos" },
      { title: "Revenda", text: "Bar, mercado, empório.", href: "/revenda" },
      {
        title: "Parceria ou imprensa",
        text: "Influenciadores, marcas, jornalistas.",
        message: "Oi! Quero falar sobre uma parceria com o Fernandito.",
      },
    ] as { title: string; text: string; message?: string; href?: string }[],
  },
  /** Faixa de "próximo passo" no fim das páginas internas. */
  next: {
    title: "Bora?",
    text: "O primeiro lote tá em pré-venda.",
    buy: "Comprar o kit",
    talk: "Falar com a gente",
  },
};

export const NAV = {
  /** Páginas do menu (máx. 4 — regra da navegação). Ficam no menu de cima,
   * no menu do celular e no rodapé. Somem no pré-lançamento. */
  links: [
    { label: "Manifesto", href: "/manifesto" },
    { label: "Eventos", href: "/eventos" },
    { label: "Revenda", href: "/revenda" },
    { label: "Contato", href: "/contato" },
  ],
  whatsappLabel: "Fale no WhatsApp",
};

export const HERO = {
  /** Texto do h1 pra leitores de tela e buscadores (o logo é imagem). */
  srTitle: "Fernandito — fernet com cola, direto da lata",
  tagline: "Fernet y cola em lata.",
  /** "Feito com ___." — a primeira palavra é a que aparece ao carregar. */
  rotatingPrefix: "Feito com",
  rotatingWords: [
    "Brio",
    "Liberdade",
    "Intenção",
    "Independência",
    "Coragem",
    "Inquietação",
    "Amargor",
    "Paciência",
    "Insistência",
    "Teimosia",
  ],
  scrollHint: "scroll",
  /** Fotos de fundo do cartão, trocando sozinhas (a 1ª aparece ao carregar).
   * PLACEHOLDER do pré-lançamento — trocar pelas fotos definitivas. */
  photos: [
    photo(
      "Hero 01",
      "Rascunhos e o rótulo do Fernandito espalhados sobre uma mesa de madeira",
      "/images/hero-rotulo.jpg",
    ),
  ],
};

export const O_QUE_E = {
  paragraphs: [
    "Fernandito é uma bebida mista pronta pra beber: fernet e cola numa lata só, gaseificada, 8% vol.",
    "Sem coqueteleira, sem gelo, sem enrolação — só abrir e virar. O ritual gaúcho do fernet, do jeito que a vida moderna pede.",
  ],
  statement: "Onde tomar fernet vira tão fácil quanto abrir uma lata.",
  lata: photo("Lata (aguardando arte)", "Lata de Fernandito"),
};

export const GALERIA = {
  /** Sempre 7 fotos, na ordem em que passam na tela. O formato de cada uma
   * (vertical, horizontal) é definido pelo layout da galeria; a foto é
   * recortada pra caber. */
  photos: [
    photo(
      "Foto 01",
      "Gado pastando no campo, com nuvens baixas sobre as coxilhas",
      "/images/placeholder/gado.jpg",
    ),
    photo(
      "Foto 02",
      "Touro vermelho de pelo crespo olhando pra câmera, no campo com neblina",
      "/images/placeholder/touro.jpg",
    ),
    photo(
      "Foto 03",
      "Cavalo malhado no meio do capim alto, sob céu nublado",
      "/images/placeholder/cavalo-capim.jpg",
    ),
    photo(
      "Foto 04",
      "Cavalo deitado num banhado, com mata de araucárias ao fundo",
      "/images/placeholder/cavalo-banhado.jpg",
    ),
    photo(
      "Foto 05",
      "Morros pontudos cobertos de mata, sob céu fechado",
      "/images/placeholder/morros.jpg",
    ),
    photo(
      "Foto 06",
      "Rio raso entre pedras e araucárias, contra o sol",
      "/images/placeholder/rio.jpg",
    ),
    photo(
      "Foto 07",
      "Vaca de cara branca vindo pelo campo dourado",
      "/images/placeholder/vaca-campo.jpg",
    ),
  ],
};

export const MANIFESTO = {
  title: "Nosso manifesto",
  paragraphs: [
    "A gente acredita numa vida que não se entrega fácil. Que escolhe o caminho difícil porque é nele que mora o gosto de verdade.",
    "Fernandito nasceu de uma crença simples: existe entrega que é render-se, e existe entrega que é arte. A gente escolheu o segundo caminho — e essa lata é prova disso.",
  ],
  closing: "Com brio, de Porto Alegre,",
  signatures: ["João", "Lorenzo", "Nando", "Matheus"],
  /** Verso do cartão (aparece ao girar). */
  back: {
    photo: photo(
      "Foto fundadores",
      "Os quatro fundadores do Fernandito rindo na frente de uma cerca viva — da esquerda pra direita: Lorenzo, Matheus, Nando e João",
      "/images/fundadores.jpg",
    ),
    /** Na ordem da foto, da esquerda pra direita. */
    caption: "Lorenzo · Matheus · Nando · João — Porto Alegre, 2026",
  },
  flipLabel: "Girar",
  flipBackLabel: "Girar de volta",
};

export const CONTATO = {
  title: "Quer Fernandito no teu rolê?",
  text: "Bar, festa, evento ou só curiosidade? Chama a gente no WhatsApp que a gente responde.",
  cta: "Chamar no WhatsApp",
  photo: photo(
    "Foto contato",
    "Rascunho do cavalo do Fernandito em papel, com canetas e rótulos na mesa",
    "/images/contato-rascunhos.jpg",
  ),
};

export const SOCIAL = {
  title: "O que anda rolando",
  follow: "Segue a gente no Instagram",
  /** Sempre 7 fotos. No celular aparecem só a 1ª, a 2ª e a 4ª. */
  photos: [
    photo(
      "Foto 01",
      "Jipe amarelo com barraca no teto, no campo ao pôr do sol",
      "/images/placeholder/troller.jpg",
    ),
    photo("Foto 02", "Campo de coxilhas com a serra ao fundo", "/images/placeholder/coxilhas.jpg"),
    photo(
      "Foto 03",
      "Morros pontudos cobertos de mata, sob céu fechado",
      "/images/placeholder/morros.jpg",
    ),
    photo(
      "Foto 04",
      "Vaca de cara branca vindo pelo campo dourado",
      "/images/placeholder/vaca-campo.jpg",
    ),
    photo(
      "Foto 05",
      "Araucárias no alto de uma coxilha, no fim de tarde",
      "/images/placeholder/araucarias.jpg",
    ),
    photo(
      "Foto 06",
      "Cavalo deitado num banhado, com mata de araucárias ao fundo",
      "/images/placeholder/cavalo-banhado.jpg",
    ),
    photo(
      "Foto 07",
      "Touro vermelho de pelo crespo olhando pra câmera, no campo com neblina",
      "/images/placeholder/touro.jpg",
    ),
  ],
};

export const MARQUEE = {
  /** Frases que passam na faixa, separadas por "·". */
  phrases: ["Toma Fernandito", "Fernet y cola"],
};

export const FOOTER = {
  line1: "Liberdade não se pede,",
  line2: "se toma.",
  tagline: "Toma Fernandito.",
  navTitle: "Navegar",
  socialTitle: "Social",
  /** Coluna "Legal" (aparece com a loja ligada, `STORE.enabled`). */
  legalTitle: "Legal",
  legalLinks: [
    { label: "Termos de uso", href: "/termos" },
    { label: "Política de privacidade", href: "/privacidade" },
  ],
  backToTop: "Voltar ao topo",
  copyright: "© 2026 Fernandito. Todos os direitos reservados.",
  /** Aviso obrigatório de bebida alcoólica (sempre visível no rodapé). */
  alcoholNotice: "Beba com moderação. Venda proibida para menores de 18 anos.",
  /** Dados da empresa (a lei do e-commerce pede CNPJ e endereço visíveis).
   * Falta a razão social e o endereço completo. */
  company: "CNPJ 69.252.946/0001-41",
  madeIn: "Feito com brio. Porto Alegre, RS.",
};
