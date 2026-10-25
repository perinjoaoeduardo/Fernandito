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
  /** WhatsApp comercial (+55 51 99338-3764), só dígitos: país + DDD +
   * número. A variável NEXT_PUBLIC_WHATSAPP_NUMBER, se existir, tem
   * prioridade (ver README). */
  whatsappNumber: "5551993383764",
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
  /** Esgotado (teto do site ou estoque do Bling zerado). */
  soldOut: "Esgotado",
  soldOutText: "O primeiro lote acabou. Deixa teu contato que a gente avisa do próximo.",
  /** Esgotado: botões que abrem o "me avisa do próximo lote". */
  notifyCta: "Me avisa do próximo lote",
  notifyNavCta: "Esgotado",
  /** Barra de compra fixa no celular. */
  stickyCta: "Adicionar",
  addToCart: "Adicionar ao carrinho",
  /** CTA dos outros lugares do site (menu, Hero, bloco final). */
  cta: "Comprar o kit",
  navCta: "Comprar",
  /** Contato secundário embaixo do botão de compra. */
  helpPrefix: "Dúvidas?",
  helpLink: "Fala com a gente no WhatsApp",
  /**
   * Plano B se o Mercado Pago cair na hora de gerar o Pix: a pessoa paga
   * direto na chave Pix da conta da empresa e manda o comprovante; a
   * Fernandito confere e confirma no painel (/api/loja/confirmar). VAZIO =
   * desligado (mostra só o erro e o WhatsApp). PREENCHER com a chave real
   * aqui ou na variável NEXT_PUBLIC_PIX_MANUAL_KEY da Vercel (+ redeploy).
   */
  manualPix: {
    // Chave aleatória da conta da empresa (é pública: vai na tela do Pix
    // manual). A variável na Vercel, se existir, tem prioridade.
    key: process.env.NEXT_PUBLIC_PIX_MANUAL_KEY?.trim() || "114c4c96-ccc8-46c1-b50f-df6003da3546",
    keyLabel: "Chave Pix (aleatória)",
    holder: "FERNANDITO BEBIDAS LTDA",
  },
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
  soldOutText: "Primeiro lote esgotado · valeu, gurizada",
};

/**
 * Seções do site completo (com `PRELAUNCH.enabled: false`), NA ORDEM em que
 * aparecem na home. Pra tirar uma seção do lançamento: `on: false` — some da
 * página, do menu e do rodapé. A Hero e o rodapé estão sempre lá. O kit
 * ainda depende de `STORE.enabled`.
 */
export const SECTIONS = [
  { key: "oQueE", on: true, id: "o-que-e", label: "O que é" },
  { key: "galeria", on: true, id: "galeria", label: "Fotos" },
  // Manifesto fora do ar por enquanto (texto em `MANIFESTO` e cartão em
  // CartaSection ficam guardados; ainda em construção). Pra voltar: on: true.
  { key: "manifesto", on: false, id: "manifesto", label: "Manifesto" },
  { key: "contato", on: true, id: "contato", label: "Contato" },
  { key: "episodios", on: true, id: "episodios", label: "Episódios" },
  { key: "fichaTecnica", on: true, id: "ficha-tecnica", label: "Ficha técnica" },
  // Fora do lançamento (código guardado): chamada grande do kit e a
  // galeria do Instagram (deu lugar aos episódios).
  { key: "kit", on: false, id: "kit", label: "Kit" },
  { key: "social", on: false, id: "social", label: "Instagram" },
] as const;

/** Onde mora a compra do kit: página própria no site completo; seção da
 * home no pré-lançamento. Usado por todo "Comprar" / "Ver o kit". */
export const SHOP_HREF = PRELAUNCH.enabled ? "/#comprar" : "/comprar";

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
  // No site completo o kit da home é a chamada (#kit).
  const first = SECTIONS.find((s) => sectionOn(s.key));
  return first ? `#${first.id}` : "#contato";
}

/**
 * Formulários curtíssimos da página Contato (motivos Evento e Revenda): viram
 * lead (guardado no site) e abrem o WhatsApp com a mensagem já escrita. Em
 * `message`, `{campo}` vira a resposta do campo de mesmo nome.
 */
export type ContatoField = {
  name: string;
  label: string;
  placeholder?: string;
  /** Com opções vira uma fileira de botões (só tocar). */
  options?: string[];
  /** Pode ficar em branco (some da mensagem). */
  optional?: boolean;
};
export type ContatoReason = {
  key: "geral" | "evento" | "negocio";
  /** Botão do motivo. */
  chip: string;
  /** Frase embaixo do seletor, muda junto com o motivo. */
  lead: string;
  /** Cor da tela inteira com esse motivo. */
  theme: "verde-medio" | "verde-escuro" | "verde-claro" | "off-white";
  photo: ContentImage;
  fields: ContatoField[];
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
      a: "No Brasil todo, por transportadora (Jadlog, J&T, Loggi ou LATAM Cargo). Em Porto Alegre e Caxias do Sul a entrega é nossa. O valor e o prazo aparecem no checkout, com o teu CEP.",
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

/** Cabeçalhos e textos das páginas internas. */
export const PAGES = {
  /** Chamada do kit na home (leva pra /comprar). */
  kitTeaser: {
    eyebrow: "Pré-lançamento · edição limitada",
    cta: "Ver o kit",
  },
  /** Adesivo "pré-venda no ar" colado na lata do "O que é" (→ /comprar). */
  preVenda: {
    tag: "Pré-venda no ar",
    cta: "Comprar",
    /** Mesmo adesivo quando esgota. */
    soldOutTag: "Primeiro lote",
    soldOutCta: "Esgotado",
  },
  /** Página Contato: título, 3 motivos e o botão do WhatsApp. "Falar com a
   * gente" não pede nada; evento e revenda pedem o mínimo pra mensagem já
   * chegar com contexto. Cada motivo tem um verde (médio, claro, escuro) e
   * a sua foto; o bege fica pros botões e destaques. Todo envio
   * vira lead (`/api/leads`). Na `message`, `{campo}` vira a resposta. */
  contato: {
    title: "Contato",
    submit: "Chamar no WhatsApp",
    /** Embaixo do botão quando o motivo pede dados (LGPD: dizer pra quê). */
    privacy: "Usamos esses dados só pra te responder.",
    sent: "Abrimos o WhatsApp. É só enviar.",
    fallback: "Não abriu?",
    copy: "Copiar mensagem",
    copied: "Copiada!",
    reasons: [
      {
        key: "geral",
        chip: "Conversar",
        lead: "Curtiu o Fernandito? Chama a gente.",
        theme: "verde-medio",
        photo: photo("Foto: contato", "Campo de coxilhas", "/images/placeholder/coxilhas.jpg"),
        fields: [],
        message: "Oi, Fernandito! Vim pelo site.\n— enviado pelo site · Contato",
      },
      {
        key: "evento",
        chip: "Evento",
        lead: "Vai rolar um evento? Conta pra gente que o Fernandito vai junto.",
        theme: "verde-claro",
        photo: photo(
          "Foto: evento",
          "Jipe com barraca no teto, no campo ao pôr do sol",
          "/images/placeholder/troller.jpg",
        ),
        fields: [
          { name: "nome", label: "Qual teu nome?", placeholder: "Ana Souza" },
          { name: "cidade", label: "Em que cidade?", placeholder: "Porto Alegre" },
          {
            name: "pessoas",
            label: "Quantas pessoas?",
            options: ["Até 50", "50 a 150", "150+"],
          },
        ],
        message:
          "Oi, Fernandito! Aqui é {nome}.\nTenho um evento em {cidade}, {pessoas} pessoas.\n— enviado pelo site · Evento",
      },
      {
        key: "negocio",
        chip: "Revenda",
        lead: "Quer ter Fernandito no teu bar ou na tua loja? Fala com a gente.",
        theme: "verde-escuro",
        photo: photo("Foto: revenda", "Araucárias no campo", "/images/placeholder/araucarias.jpg"),
        fields: [
          { name: "nome", label: "Qual teu nome?", placeholder: "Ana Souza" },
          { name: "lugar", label: "Qual o lugar e a cidade?", placeholder: "Bar do Zé, Pelotas" },
        ],
        message:
          "Oi, Fernandito! Aqui é {nome}, do {lugar}.\nQuero revender o Fernandito.\n— enviado pelo site · Revenda",
      },
    ] as ContatoReason[],
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
  /** Menu (máx. 4 itens — regra da navegação): a home é uma página só (tudo
   * sobre a marca); Comprar (botão da barra) e Contato são páginas. Ficam no
   * menu de cima, no menu do celular e no rodapé. Somem no pré-lançamento. */
  links: [
    { label: "Início", href: "/" },
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
    "Fernandito é fernet com cola, amargo e refrescante, já misturado e pronto pra tomar. Ele nasceu da vontade de espalhar uma cultura de liberdade, e decidimos que a melhor forma de fazer isso seria através da bebida que a gente ama.",
    "Cada lata carrega o espírito de quem tem um jeito próprio de fazer as coisas, de quem deixa marca, movimenta ideias e não precisa seguir o caminho de todo mundo. Isso é muito Fernandito.",
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
    "Tem os que se entregam na fraqueza.\nOutros que se entregam na intenção. Domam.",
    "É sobre esse chão que nos criamos. Não pra representar um lugar, nem pra reinventar a bebida. Mas pra dar forma a um espírito, colocar em lata um modo de viver.",
    "Somos a primeira lata quando a lenha pega. O brinde de quem chegou atrasado e ficou até o fim. A mesa que ninguém quer levantar. O rumo que se descobre indo junto.",
    "Escolhemos o amargo, o detalhe, o tempo que não tem pressa.",
    "Pra quem tem sede. Pra quem acha a vida pouca e sabe que podia ser mais. Afinal, ninguém conta história que viu de longe.",
    "Não é pra todos. Aceitamos assim.\nMas pra esses, queremos ser. Queremos fazer parte.",
  ],
  /** A última frase, em destaque. */
  finale: "Liberdade não se pede. Se toma.",
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
  title: "Se interessou pelo Fernandito?",
  text: "Quer o Fernandito na tua festa, no teu bar ou no teu evento? Chama a gente.",
  cta: "Chama a gente",
  photo: photo(
    "Foto contato",
    "Rascunho do cavalo do Fernandito em papel, com canetas e rótulos na mesa",
    "/images/contato-rascunhos.jpg",
  ),
};

/**
 * Episódios do Fernandito (Instagram). Na ordem em que saíram; pra somar um
 * novo é só acrescentar no fim. `cover`: capa (foto em `public/images/`).
 * `preview`: trecho curto em vídeo, sem som (mp4 de 5–10 s em
 * `public/videos/`) que toca no hover — sem ele, o cartão mostra a capa com
 * o ícone de play. `href`: o post/reel no Instagram.
 */
export const EPISODIOS = {
  title: "O que anda rolando",
  follow: "Segue a gente no Instagram",
  items: [
    {
      number: 1,
      title: "Como chegamos aqui?",
      href: "https://www.instagram.com/p/DeQEuoLRP92/",
      cover: photo(
        "Capa ep. 1",
        "Capa do episódio 1: Como chegamos aqui?",
        "/images/episodios/ep-1.jpg",
      ),
      preview: "/videos/ep-1.mp4" as string | null,
    },
    {
      number: 2,
      title: "A marca é + ou -⁠ assim",
      href: "https://www.instagram.com/p/Dec1LA3xqMY/",
      cover: photo(
        "Capa ep. 2",
        "Capa do episódio 2: A marca é + ou - assim",
        "/images/episodios/ep-2.jpg",
      ),
      preview: "/videos/ep-2.mp4" as string | null,
    },
    {
      number: 3,
      title: "Isso é muito Fernandito",
      href: "https://www.instagram.com/p/DesR8QqxaRL/",
      cover: photo(
        "Capa ep. 3",
        "Capa do episódio 3: Isso é muito Fernandito",
        "/images/episodios/ep-3.jpg",
      ),
      preview: "/videos/ep-3.mp4" as string | null,
    },
  ],
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
    { label: "Trocas e devoluções", href: "/trocas" },
  ],
  backToTop: "Voltar ao topo",
  copyright: "© 2026 Fernandito · Todos os direitos reservados.",
  /** Aviso obrigatório de bebida alcoólica (sempre visível no rodapé). */
  alcoholNotice: "Beba com moderação. Venda proibida para menores de 18 anos.",
  /** Dados da empresa: a lei do e-commerce (Decreto 7.962/2013) pede razão
   * social, CNPJ e endereço visíveis no site. */
  company:
    "FERNANDITO BEBIDAS LTDA · CNPJ 69.252.946/0001-41 · Rua Castro Alves, 433, Rio Branco, Porto Alegre/RS, CEP 90430-131",
  /** As mesmas informações, quebradas pra caber organizado no rodapé
   * (no celular cada trecho entre " · " vira uma linha). */
  companyName: "FERNANDITO BEBIDAS LTDA · CNPJ 69.252.946/0001-41",
  companyAddress: "Rua Castro Alves, 433, Rio Branco · Porto Alegre/RS, CEP 90430-131",
  madeIn: "Feito com brio. Porto Alegre, RS.",
};

/** Modal "me avisa do próximo lote" (quando o kit esgota). Os contatos vão
 * pro painel (`/painel`, seção "Avisar do próximo lote"). */
export const NOTIFY = {
  kicker: "Primeiro lote esgotado",
  title: "A gente te avisa do próximo",
  text: "Deixa teu nome e WhatsApp (ou e-mail). Quando sair o próximo lote, tu fica sabendo antes.",
  name: "Teu nome",
  contact: "WhatsApp ou e-mail",
  submit: "Me avisa",
  skip: "Agora não",
  doneTitle: "Fechado!",
  doneText: "Quando o próximo lote sair, a gente te chama. Valeu!",
  close: "Fechar",
};
