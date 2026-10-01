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

/** Faixa fixa no topo do pré-lançamento ("Estamos chegando"). Pra tirar do
 * site: `enabled: false` — some a faixa e o menu volta pro lugar sozinho. */
export const ANNOUNCEMENT = {
  enabled: true,
  text: "Estamos chegando",
};

export const NAV = {
  /** Links da pílula do topo (desktop) e do menu do celular. */
  links: [
    { label: "O que é", href: "#o-que-e" },
    { label: "Galeria", href: "#galeria" },
    { label: "Manifesto", href: "#manifesto" },
  ],
  /** Só no menu do celular e no rodapé (no desktop o botão do WhatsApp faz esse papel). */
  contactLink: { label: "Contato", href: "#contato" },
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
      "Coxilhas douradas a perder de vista sob céu azul",
      "/images/placeholder/coxilhas-nuvens.webp",
    ),
    photo(
      "Hero 02",
      "Araucárias no alto de uma coxilha, no fim de tarde",
      "/images/placeholder/araucarias.webp",
    ),
    photo("Hero 03", "Campo de coxilhas com a serra ao fundo", "/images/placeholder/coxilhas.webp"),
    photo(
      "Hero 04",
      "Rio raso entre pedras e araucárias, contra o sol",
      "/images/placeholder/rio.webp",
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
      "/images/placeholder/gado.webp",
    ),
    photo(
      "Foto 02",
      "Touro vermelho de pelo crespo olhando pra câmera, no campo com neblina",
      "/images/placeholder/touro.webp",
    ),
    photo(
      "Foto 03",
      "Cavalo malhado no meio do capim alto, sob céu nublado",
      "/images/placeholder/cavalo-capim.webp",
    ),
    photo(
      "Foto 04",
      "Cavalo deitado num banhado, com mata de araucárias ao fundo",
      "/images/placeholder/cavalo-banhado.webp",
    ),
    photo(
      "Foto 05",
      "Morros pontudos cobertos de mata, sob céu fechado",
      "/images/placeholder/morros.webp",
    ),
    photo(
      "Foto 06",
      "Rio raso entre pedras e araucárias, contra o sol",
      "/images/placeholder/rio.webp",
    ),
    photo(
      "Foto 07",
      "Vaca de cara branca vindo pelo campo dourado",
      "/images/placeholder/vaca-campo.webp",
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
      "/images/fundadores.webp",
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
    "Caminhonetes cheias de barro em fila, embaixo de um morro de pedra",
    "/images/placeholder/caminhonetes.webp",
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
      "/images/placeholder/troller.webp",
    ),
    photo("Foto 02", "Campo de coxilhas com a serra ao fundo", "/images/placeholder/coxilhas.webp"),
    photo(
      "Foto 03",
      "Morros pontudos cobertos de mata, sob céu fechado",
      "/images/placeholder/morros.webp",
    ),
    photo(
      "Foto 04",
      "Vaca de cara branca vindo pelo campo dourado",
      "/images/placeholder/vaca-campo.webp",
    ),
    photo(
      "Foto 05",
      "Araucárias no alto de uma coxilha, no fim de tarde",
      "/images/placeholder/araucarias.webp",
    ),
    photo(
      "Foto 06",
      "Cavalo deitado num banhado, com mata de araucárias ao fundo",
      "/images/placeholder/cavalo-banhado.webp",
    ),
    photo(
      "Foto 07",
      "Touro vermelho de pelo crespo olhando pra câmera, no campo com neblina",
      "/images/placeholder/touro.webp",
    ),
  ],
};

export const MARQUEE = {
  /** Frases que passam na faixa, separadas por "·". */
  phrases: ["Toma Fernandito", "Fernet y cola"],
};

export const FOOTER = {
  line1: "Pra quem não deixa passar,",
  line2: "vira história.",
  tagline: "Isso toma fernandito.",
  navTitle: "Navegar",
  socialTitle: "Social",
  backToTop: "Voltar ao topo",
  copyright: "© 2026 Fernandito. Todos os direitos reservados.",
  madeIn: "Feito com brio. Porto Alegre, RS.",
};
