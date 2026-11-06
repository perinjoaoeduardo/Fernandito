import { z } from "zod";

/**
 * Produção (aba do painel): fornecedores/insumos e a receita, editados no
 * próprio painel e salvos no banco do site (Redis, `producao:dados`), um
 * cadastro só pra equipe toda. Não passa pelo Bling.
 */

export const CATEGORIAS = ["Líquido", "Embalagem", "Serviço", "Outro"] as const;

/**
 * Quanto do insumo vai em cada lata:
 * - `fernet` / `cola`: vem da receita (ml por lata → litros);
 * - `lata`: quantidade fixa por lata (`qtd`);
 * - `pack`: quantidade por six pack (`qtd` a cada 6 latas).
 */
export const USOS = ["fernet", "cola", "lata", "pack"] as const;

const faixa = z.object({
  /** A partir de quantas unidades de compra vale este preço. */
  de: z.number().min(0).max(1e9),
  precoCents: z.number().int().min(0).max(1e10),
});

export const insumoSchema = z.object({
  id: z.string().min(1).max(40),
  insumo: z.string().trim().min(1).max(80),
  fornecedor: z.string().trim().max(80),
  contato: z.string().trim().max(120),
  categoria: z.enum(CATEGORIAS),
  unidade: z.string().trim().min(1).max(30),
  uso: z.enum(USOS),
  qtd: z.number().min(0).max(1e6),
  faixas: z.array(faixa).min(1).max(10),
  minimo: z.number().min(0).max(1e9),
  prazoDias: z.number().int().min(0).max(3650),
  /** Envase/serviço: só começa quando os outros insumos chegam. */
  depois: z.boolean(),
  /** Linha de exemplo que ainda não foi editada. */
  exemplo: z.boolean().optional(),
});

export const producaoSchema = z.object({
  insumos: z.array(insumoSchema).max(100),
  receita: z.object({
    fernetMl: z.number().min(0).max(350).nullable(),
    colaMl: z.number().min(0).max(350).nullable(),
  }),
  atualizadoEm: z.string().optional(),
});

export type Insumo = z.infer<typeof insumoSchema>;
export type ProducaoData = z.infer<typeof producaoSchema>;

/** Ponto de partida: exemplos pra editar ou apagar (receita em branco). */
export const EXEMPLO: ProducaoData = {
  receita: { fernetMl: null, colaMl: null },
  insumos: [
    {
      id: "fernet",
      insumo: "Fernet",
      fornecedor: "Fornecedor A",
      contato: "",
      categoria: "Líquido",
      unidade: "litro",
      uso: "fernet",
      qtd: 0,
      faixas: [
        { de: 0, precoCents: 6000 },
        { de: 200, precoCents: 5600 },
      ],
      minimo: 50,
      prazoDias: 10,
      depois: false,
      exemplo: true,
    },
    {
      id: "cola",
      insumo: "Base de cola",
      fornecedor: "Fornecedor B",
      contato: "",
      categoria: "Líquido",
      unidade: "litro",
      uso: "cola",
      qtd: 0,
      faixas: [{ de: 0, precoCents: 450 }],
      minimo: 200,
      prazoDias: 7,
      depois: false,
      exemplo: true,
    },
    {
      id: "lata",
      insumo: "Lata 350ml + tampa",
      fornecedor: "Fornecedor C",
      contato: "",
      categoria: "Embalagem",
      unidade: "unidade",
      uso: "lata",
      qtd: 1,
      faixas: [
        { de: 0, precoCents: 95 },
        { de: 10000, precoCents: 85 },
      ],
      minimo: 5000,
      prazoDias: 21,
      depois: false,
      exemplo: true,
    },
    {
      id: "caixa",
      insumo: "Caixa six pack",
      fornecedor: "Fornecedor D",
      contato: "",
      categoria: "Embalagem",
      unidade: "caixa",
      uso: "pack",
      qtd: 1,
      faixas: [{ de: 0, precoCents: 350 }],
      minimo: 500,
      prazoDias: 12,
      depois: false,
      exemplo: true,
    },
    {
      id: "envase",
      insumo: "Envase",
      fornecedor: "Fornecedor E",
      contato: "",
      categoria: "Serviço",
      unidade: "lata envasada",
      uso: "lata",
      qtd: 1,
      faixas: [{ de: 0, precoCents: 60 }],
      minimo: 3000,
      prazoDias: 5,
      depois: true,
      exemplo: true,
    },
  ],
};

export const PRODUCAO_KEY = "producao:dados";
