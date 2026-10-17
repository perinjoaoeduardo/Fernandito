/**
 * Moldura das páginas legais (Termos e Privacidade). O texto jurídico
 * continua em `content/legal/*.md` (é o que vale). Aqui fica só o que
 * facilita a leitura: uma frase de abertura, o "Em resumo" e como as seções
 * (pelo número do "## N.") se agrupam por assunto. Resumos também precisam
 * passar pelo advogado. Seção que não estiver em nenhum grupo cai num
 * último grupo "Outros".
 */

export type LegalIcon =
  "age" | "pix" | "truck" | "back" | "receipt" | "shield" | "user" | "share" | "chat";

export type LegalFrame = {
  /** Rótulo curto (troca entre os documentos). */
  short: string;
  intro: string;
  summary: { icon: LegalIcon; text: string }[];
  groups: { title: string; text: string; sections: number[] }[];
};

export const LEGAL: Record<"termos" | "privacidade" | "trocas", LegalFrame> = {
  termos: {
    short: "Termos",
    intro: "As regras de quem compra no site: o que a gente garante e o que pede de ti.",
    summary: [
      { icon: "age", text: "Só pra maiores de 18. A entrega exige documento com foto." },
      { icon: "pix", text: "Pagamento por Pix. O pedido só vale depois do pagamento confirmado." },
      {
        icon: "truck",
        text: "Entrega própria em Porto Alegre; no resto do Brasil, por transportadora.",
      },
      { icon: "back", text: "Desistiu? Tu tem 7 dias depois de receber, com reembolso integral." },
      { icon: "receipt", text: "Chegou com defeito? Até 30 dias pra trocar ou receber de volta." },
      { icon: "chat", text: "Resposta em até 1 dia útil, no e-mail ou no WhatsApp." },
    ],
    groups: [
      {
        title: "Antes de tudo",
        text: "Quem somos, como estes termos valem e a regra dos 18 anos.",
        sections: [1, 2, 3, 4],
      },
      {
        title: "A compra",
        text: "Produto, preço, Pix, estoque, entrega e nota fiscal.",
        sections: [5, 6, 7, 8, 9],
      },
      {
        title: "Trocas e cancelamentos",
        text: "Desistência em 7 dias, defeito em 30 e quando a gente cancela.",
        sections: [10, 11, 12],
      },
      {
        title: "O resto das regras",
        text: "Uso do site, marca, responsabilidade, atendimento e a lei que vale.",
        sections: [13, 14, 15, 16, 17, 18],
      },
    ],
  },
  trocas: {
    short: "Trocas",
    intro:
      "Desistiu, chegou com problema ou quer o dinheiro de volta: como resolve, sem enrolação.",
    summary: [
      {
        icon: "back",
        text: "Desistiu? 7 dias depois de receber, sem explicar. A volta é por nossa conta.",
      },
      {
        icon: "receipt",
        text: "Chegou com defeito ou avariado? 30 dias pra trocar ou receber de volta.",
      },
      { icon: "truck", text: "Caixa danificada na entrega: recusa ou tira fotos e avisa a gente." },
      { icon: "pix", text: "Reembolso integral por Pix, em até 5 dias úteis." },
      {
        icon: "chat",
        text: "Pede no WhatsApp ou e-mail com o nº do pedido. Resposta em 1 dia útil.",
      },
      { icon: "shield", text: "Nada aqui limita teus direitos do Código de Defesa do Consumidor." },
    ],
    groups: [
      { title: "Quando dá pra devolver", text: "Desistência e defeito.", sections: [1, 2] },
      {
        title: "Como pedir e receber",
        text: "O passo a passo e o reembolso.",
        sections: [3, 4, 5],
      },
    ],
  },
  privacidade: {
    short: "Privacidade",
    intro: "O que a gente faz com os teus dados, com quem divide e como tu controla isso.",
    summary: [
      { icon: "user", text: "Só o necessário pra entregar: nome, CPF, contato e endereço." },
      { icon: "pix", text: "O Pix é do Mercado Pago. A gente não vê os dados da tua conta." },
      { icon: "share", text: "Dividimos só com quem faz a compra acontecer. Não vendemos dados." },
      { icon: "shield", text: "Conexão criptografada e acesso restrito aos teus dados." },
      {
        icon: "back",
        text: "Tu pode ver, corrigir ou apagar teus dados — resposta em até 15 dias.",
      },
      { icon: "age", text: "Site e produtos não são pra menores de 18." },
    ],
    groups: [
      {
        title: "Quem cuida e o que coletamos",
        text: "Quem é responsável e quais dados entram.",
        sections: [1, 2],
      },
      {
        title: "Pra que usamos e com quem",
        text: "Cada uso com a sua base na lei, e os parceiros que recebem.",
        sections: [3, 4, 5],
      },
      {
        title: "Quanto tempo e teus direitos",
        text: "Prazos de guarda e o que tu pode pedir.",
        sections: [6, 7],
      },
      {
        title: "Cookies, segurança e contato",
        text: "Cookies, menores, proteção, mudanças e como falar com a gente.",
        sections: [8, 9, 10, 11, 12],
      },
    ],
  },
};
