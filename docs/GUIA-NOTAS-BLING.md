# Guia do sócio: notas fiscais e Bling da Fernandito

> **Para quem é:** o sócio que vai cuidar do Bling e emitir as notas, usando o
> Claude, sem precisar pedir pra ninguém.
>
> **Para o Claude que ler isto:** este arquivo é o seu contexto. Siga as
> regras daqui. Na dúvida, **pergunte antes de emitir**: nota autorizada não
> se desfaz fácil.

---

## Parte 0: o jeito fácil, a aba "Emitir nota" do painel

**Para a maioria das notas, use o painel:** `fernandito.com.br/painel` →
menu **Vendas → Emitir nota**. O Claude só é necessário para os casos que o
painel trava.

### Passo a passo

1. **Cole o texto** (WhatsApp, cartão CNPJ etc.) e clique em **Preencher com
   IA**. Se a IA ficar em dúvida, ela lista o que faltou (ex.: "Falta a IE").
2. **Confira os campos.** Para cada coisa diferente, faça **uma nota por
   vez**: venda e brinde pro mesmo cliente são duas notas.
   - Preço = **preço final combinado POR UNIDADE**. Six pack = preço da
     caixa (13,86 × 6 = 83,16), já com o ST dentro.
   - Brinde: o preço é fixo (valor de tabela); ninguém paga.
   - Envio: escolha **"cada caixa com sua etiqueta"** ou **"tudo junto
     num volume só, empilhado"** (e quantas pilhas). O painel calcula a
     caixa (ex.: 6 six packs em 2 pilhas = 24 × 27,6 × 49,2 cm, 15 kg).
3. **Conferir.** O painel olha tudo sem criar nada: regras fiscais, CNPJ/CPF,
   IE, CEP, preço, estoque do Bling, cadastro que já existe no Bling, nota
   repetida, frete e saldo do Melhor Envio. Se for envio, **abre a janela do
   Melhor Envio** com as opções (transportadora, preço e prazo) e o saldo:
   escolha uma e clique em **Usar este frete**.
4. **Preparar nota (rascunho).** Cria cliente, pedido e nota em RASCUNHO no
   Bling e confere o rascunho (total e CFOP). Nada vai pra Sefaz. Dá pra ver
   a prévia e **Descartar**.
5. **Emitir na Sefaz.** Pede confirmação. Emite, manda pro e-mail do cliente
   (se tiver), **baixa o estoque** e, se for envio, **compra a etiqueta** com
   o saldo do Melhor Envio. A etiqueta aparece também em Vendas → Imprimir
   e postar.

### Quando o painel libera (o resto TRAVA)

| | RS | RJ | SC | Outros estados |
|---|---|---|---|---|
| **Venda pra empresa** (com IE) | ✅ ST 5401 (preço com ST incluso) | ✅ 6101 sem ST + observação da Lei RJ | ⛔ | ⛔ |
| **Venda pra pessoa física** | ✅ 5101 | ✅ 6107 | ✅ 6107 | ✅ 6107 |
| **Brinde** (empresa ou pessoa) | ✅ 5910 | ⛔ | ✅ 6910 | ⛔ |

Liberar um estado novo = a contadora cadastrar a natureza no Bling e o João
acrescentar no sistema. **Até lá, trava e chama o João.**

### O que trava e o que fazer

**Regra de ouro: travou ou deu erro, NÃO tente de outro jeito. Chama o João.**
É melhor esperar do que sair nota ou etiqueta errada.

| Mensagem (resumo) | O que fazer |
|---|---|
| "A IA está desligada / não respondeu / ocupada" | Preencha os campos à mão (funciona igual). |
| "CNPJ/CPF inválido" | Confira os números no cartão CNPJ. |
| "Empresa sem inscrição estadual" | Pegue a IE no Sintegra RS. Se for isenta: João. |
| "Falta a razão social" | Use o nome do cartão CNPJ (não o fantasia). |
| "CEP não é do estado" / "Nenhuma transportadora atende esse CEP" | Confira o CEP. Se estiver certo: João. |
| "Preço fora do normal" | Quase sempre é preço por lata no six pack (multiplique por 6). Se estiver certo: João. |
| "Natureza desse estado não está cadastrada" / "ainda não emitimos bonificação pra esse estado" | João (e contadora). |
| "Estoque do Bling tem X latas" | João (estoque precisa ser acertado). |
| "Esse cliente já está no Bling com IE/UF diferente" | João (o cadastro do Bling precisa ser corrigido antes; senão a Sefaz rejeita). |
| "Já tem nota hoje pra esse cliente" | Se for outra venda mesmo, marque **É outra nota mesmo**. Se não, pare. |
| "Saldo do Melhor Envio não paga a etiqueta" | Coloque saldo no Melhor Envio e confira de novo. |
| "Empilhado fica grande demais" / "mais de 20 caixas" | Mais pilhas ou caixas separadas. Se não der: João. |
| "Travei: o total da nota não bate / o CFOP saiu…" | João. O rascunho é apagado sozinho (se não der, a mensagem diz o que apagar no Bling). |
| "Nota REJEITADA / DENEGADA pela Sefaz" | **Não prepare outra.** João (o motivo está no Bling → Notas fiscais). |
| "A Sefaz ainda não respondeu" | Espere 1 minuto e clique em **Conferir de novo**. Não emita outra. |
| "A nota saiu, mas a etiqueta não" | Clique em **Comprar etiqueta** (não paga em dobro). Falhou de novo: João. |
| "A nota saiu, mas o estoque NÃO baixou" | Avise o João (ele baixa à mão). |
| "A conexão caiu no meio" | Recarregue e olhe **Últimas notas do painel** antes de repetir qualquer coisa. |

### Ligar a IA (uma vez só, o João faz)

1. Entrar em **console.anthropic.com** (criar conta com o e-mail da
   Fernandito) → **Settings → Billing**: colocar um cartão e um crédito
   pequeno (ex.: US$ 5 dura muito; cada nota custa uma fração de centavo).
2. **API Keys → Create Key** → nome "painel-fernandito" → copiar a chave
   (começa com `sk-ant-`). Ela só aparece uma vez.
3. **Vercel** → projeto Fernandito → **Settings → Environment Variables** →
   **Add**: nome `ANTHROPIC_API_KEY`, valor = a chave, ambiente
   **Production** (e Preview, se quiser testar). Salvar.
4. **Deployments** → no último → **⋯ → Redeploy**.
5. Testar: painel → Emitir nota → colar um texto → **Preencher com IA**.
6. **Nunca cole a chave em chat, WhatsApp ou e-mail.** Vazou? Apague em
   console.anthropic.com → API Keys e crie outra.

---

## Parte 1: deixar tudo pronto (uma vez só)

Seu trabalho é só com o Bling. **Você não precisa mexer no código do site.**
Por isso o caminho mais simples (A) nem usa GitHub.

### Caminho A (recomendado): Claude no navegador ou no celular

1. **Conta no Claude.** Entre em <https://claude.ai> com o seu e-mail. Para
   conectar o Bling, o plano precisa ser pago (Pro ou superior).
2. **Conectar o Bling:**
   - No Claude, abra **Configurações → Conectores** (*Settings → Connectors*).
   - Procure **Bling** e clique em **Conectar**.
   - Vai abrir a tela do Bling: entre com o usuário da Fernandito e clique em
     **Autorizar**.
   - Pronto: o Claude passa a ler e criar pedidos, notas, contatos e estoque
     no Bling.
3. **Criar um Projeto com este guia:**
   - No menu da esquerda, **Projetos → Novo projeto**, com o nome
     "Fernandito – Notas".
   - Em **Conhecimento do projeto** (*Project knowledge*), anexe **este
     arquivo** (`GUIA-NOTAS-BLING.md`).
   - Daqui pra frente, **sempre abra conversas dentro desse projeto**: o
     Claude já começa sabendo tudo daqui.
4. **Teste:** dentro do projeto, escreva *"Quanto estoque de latas tem no
   Bling?"*. Se ele responder com um número, está tudo funcionando.

### Caminho B (opcional): GitHub e Claude Code

Só se um dia você quiser ver ou mexer no código do site junto com o João.

1. **Criar conta no GitHub:** <https://github.com/signup>. Informe e-mail,
   senha e um nome de usuário, e confirme o código que chega no e-mail.
2. **Mande seu nome de usuário do GitHub pro João.** Ele entra no
   repositório → **Settings → Collaborators → Add people** e te convida.
3. **Aceite o convite.** Chega por e-mail, ou aparece em
   <https://github.com/notifications>.
4. **Ligar o GitHub ao Claude:** entre em <https://claude.ai/code>, clique em
   **Conectar GitHub** e autorize. Depois escolha o repositório da
   Fernandito.
5. **Coloque o mesmo Bling** (Configurações → Conectores) se ainda não fez.

> ⚠️ **O repositório é PÚBLICO.** Qualquer pessoa na internet lê o que estiver
> lá. **Nunca** coloque no código, em arquivo ou em commit:
> - senhas, chaves ou códigos de cupom;
> - CPF, telefone ou endereço de cliente.

---

## Parte 2: o que é a Fernandito (contexto)

- **Produto:** fernet com cola em lata de 350 ml, vendido em lata avulsa e em
  **six pack** (caixa com 6 latas).
- **Empresa:** FERNANDITO BEBIDAS LTDA, CNPJ 69.252.946/0001-41.
  - **Simples Nacional:** CSOSN 102, IPI sem destaque.
  - NCM 2208.90.00, CEST 02.001.00.
  - Base em Porto Alegre/RS.
- **Site:** <https://fernandito.com.br>.
  - O cliente paga por Pix (Mercado Pago).
  - O site cria o pedido no Bling, a nota sai e o envio é pelo Melhor Envio.
  - **Vendas do site são automáticas: não mexa nelas.**
- **O Bling é a fonte da verdade** de estoque, notas, clientes,
  fornecedores e compras. O site e o painel só leem dele.
- **Painel interno:** `fernandito.com.br/painel`, com senha própria.
  - Mostra pedidos e notas, inclusive as feitas à mão no Bling: elas aparecem
    sozinhas.
  - Lá tem o botão **"Marcar entregue"** para entregas em mãos ou por fora.
  - Tem também a aba **Caixas da equipe** (ver Parte 6).
- **Equipe:** Lorenzo, Matheus, João, Fernando e o ponto **Al Capone**.

---

## Parte 3: códigos do Bling (para o Claude)

| O quê | ID / código |
|---|---|
| Lata 350 ml (`FERN-350`) | produto **16718234916** |
| Six pack (`FERN-350-6`) | produto **16718234925**: *composição* de 6 latas, o estoque fica nas latas |
| Kit | produto 16718236657 |
| Press kit | produto 16720690766 |
| Litro do barril (`FERN-BARRIL-L`) | produto 16740716066, unidade L |
| Depósito (único) | **14889218318** |
| Forma de pagamento padrão | 11331737 |
| Categoria do pedido de venda | 14747067217 |
| Loja / unidade de negócio | 206326864 / 3064823 |

### Naturezas de operação (definidas pela contadora)

| Natureza | ID | CFOP | Quando usar |
|---|---|---|---|
| Venda de produção a não contribuinte – Consumidor final | **15111699956** | 5101 (RS) / 6107 (fora) | Pessoa física e vendas do site |
| Venda de produção Fora do Estado (RJ) | **15112000710** | 6101 | Empresa no RJ (caso Grão de Mostarda) |
| Saída em bonificação – Brinde | **15111699949** | 5910 (RS) / 6910 (fora) | Brinde, amostra, bonificação |
| Venda de produção com ST (RS) | **15111699959** | 5401 | Empresa do RS com IE (revenda). O **ST já está dentro** do preço combinado: o preço da nota é ajustado pra o total bater |

> ❗ Venda pra empresa de **outro estado** (fora RS e RJ): cada estado tem
> regra de ST. **Antes, a contadora.**

---

## Parte 4: passo a passo de uma nota

Peça ao Claude em português normal, por exemplo:
*"Nota de venda: 30 latas a R$ 13,86 para o CNPJ tal, entrega em mãos"*.
O Claude faz o resto, seguindo estes passos:

1. **Juntar os dados do cliente**
   - **Empresa:** razão social, **CNPJ só números**, **Inscrição Estadual**
     (sem ela a SEFAZ **rejeita**), endereço completo com CEP.
   - **Pessoa física:** nome, CPF, endereço.
   - Quantidade, preço unitário, frete (quem paga, valor), número de volumes.
2. **Procurar o cliente no Bling** pelo CPF ou CNPJ. Se não existir,
   **cadastrar**, já com a IE.
   - ⚠️ O Claude **não consegue editar nem apagar** contato. Se um dado sair
     errado, corrija **à mão no Bling** (Contatos → editar).
3. **Conferir o estoque** da lata (produto 16718234916).
4. **Criar o pedido de venda** com:
   - a natureza certa;
   - os itens: lata ou six pack, com o preço;
   - as parcelas: o total, na forma de pagamento 11331737;
   - o transporte: frete por conta de quem, valor, volumes, peso
     (≈2,5 kg por six pack) e endereço de entrega;
   - nas observações, o que a contadora pediu, se for o caso.
5. **Gerar a nota a partir do pedido**, conferir o rascunho (CFOP, valores,
   IE) e **só então autorizar** na SEFAZ.
6. **Dar a baixa no estoque à mão** (muito importante, ver abaixo).
7. Mandar ao João ou ao grupo: número da nota e total. O DANFE está no Bling.

### ⚠️ A baixa de estoque é manual nas notas feitas à mão

As naturezas **não mexem no estoque sozinhas**. O site dá a baixa só nas
vendas dele. Toda nota feita à mão (venda ou brinde) precisa de uma saída
lançada à mão:

- Lançamento de estoque, operação **"S" (saída)**, no produto **lata
  16718234916**, depósito 14889218318.
- Quantidade **em latas**: 1 six pack = 6 latas.
- Observação, por exemplo: *"Baixa NF 000209 – brinde Duas Rodas"*.

Esquecer a baixa faz o site vender estoque que não existe.

### Se a nota for rejeitada

- **Leia o motivo.** O mais comum é IE faltando ou errada, ou CEP errado.
- Corrija o **cadastro do contato no Bling**.
- A nota rejeitada **guarda o cadastro antigo**: reenviar não adianta.
  Crie um **pedido novo**, gere uma **nota nova** e apague a rejeitada e o
  pedido velho no Bling.

---

## Parte 5: casos especiais

- **Brinde / bonificação:** natureza 15111699949. O valor vai só para
  constar, ninguém paga. Também tem baixa manual.
- **Venda para outro estado:** confirme a natureza e o ICMS-ST com a
  contadora antes, como foi feito com o RJ.
- **Barril / venda por litro:** produto **"Fernandito - Litro do barril
  (chopp)"**, código `FERN-BARRIL-L`, ID **16740716066**, unidade **L**,
  R$ 24,50 o litro.
  - Barril de 20 L = **20 L** na nota. Desconto vai no pedido/nota.
  - Ex.: 20 L × 24,50 = R$ 490, desconto R$ 80, total R$ 410.
  - Sem baixa de estoque, por enquanto não é controlado.
  - Venda para bar ou empresa no RS: mesma pendência da natureza e do ST
    (Parte 3).
  - Se o barril (vasilhame) volta para a Fernandito, confirme com a
    contadora se precisa de nota de comodato ou remessa.
- **Envio por transportadora fora do site** (ex.: Buslog): a etiqueta é
  feita pelo João no Melhor Envio. Combine com ele.

---

## Parte 6: Caixas da equipe (painel)

Registro simples de quem está com quantas caixas e para onde elas foram:

- **Tipos:** pegou · entregou pra venda · brinde · consumo próprio · passou
  pra outra pessoa · devolveu · ajuste.
- Lance pelo formulário do painel, aba **Caixas da equipe**.
- É só um **diário** de quem está com quantas caixas. **Não tem relação com
  a nota**: toda nota sai do estoque do Bling.

---

## Parte 7: regras de ouro

1. **Confirme antes de autorizar** qualquer nota e antes de mexer no
   estoque. O Claude mostra o resumo e você diz "pode".
2. **Nunca cole senha no chat do Claude.** Fica gravado no histórico.
3. **Dados de cliente são sensíveis** (CPF, endereço, telefone). Não espalhe
   nem coloque no GitHub.
4. **Não mexa nos pedidos que vieram do site.** Eles se resolvem sozinhos.
5. **Em dúvida fiscal: contadora.** Em dúvida sobre o sistema: João.
6. **Erros comuns que já aconteceram:**
   - IE faltando → rejeição.
   - Reenviar nota rejeitada sem refazer o pedido.
   - Esquecer a baixa manual.
   - Limite de requisições do Bling (erro 429): espere 1 minuto e tente de
     novo.
