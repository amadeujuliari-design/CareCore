# Inventário — Compras, NFP, Financeiro e Cobranças

**Escopo:** `carecore-front/src`  
**Método:** rótulos lidos do JSX/TSX (não inventados).  
**Rotas:** `carecore-front/src/routes/AppRouter.jsx`  
**Menus:** `carecore-front/src/Sidebar.jsx`  
**Perfis (constantes):** `carecore-front/src/utils/rbacUtils.js`

---

## Convenções deste inventário

- **Obrigatório (*)** = atributo `required` no JSX ou validação explícita antes do submit no mesmo arquivo.
- **Ligação** = estado/campo do formulário ou payload enviado à API (nome técnico quando aparece no código).
- Senha **gov.br** não aparece em nenhuma tela de Compras. Em NFP, o login no site oficial ocorre fora do CareCore (Chrome do agente / portal); o CareCore **não** tem campo de senha gov.br.

---

# 1. Compras

## 1.1 Acesso e menu

| Escopo | Menu (Sidebar) | Quem vê |
| --- | --- | --- |
| Projeto | Compras → Pedidos e cotações, Pedidos concluídos, Catálogo de itens, Categorias, Fornecedores | Usuário com `compras_modulo_ativo` (ou ADM Pedidos / ADM Compras / Manutenção via `usuarioPodeVerCompras`) |
| Sede | Compras → Pedidos, concluídos, catálogo, categorias, fornecedores, aguardando assinatura, documentos assinados e Usuários ADM Global Compras | ADM Global Compras / Suprimentos / Infraestrutura / Manutenção. Global consulta a mesma sede, sem criar nem editar. O global autorizado a assinar (Noemi) vê a fila e Documentos assinados. |

**Origem:** `Sidebar.jsx` (`COMPRAS_CHILDREN_PROJETO`, `montarComprasChildrenSede`), `rbacUtils.js` (`PERFIS_ADM_COMPRAS_SEDE`, `usuarioPodeVerCompras`, `usuarioEhGlobalPuro`).

O perfil Global vê as abas Pedidos, Janela mensal, Cadastros, Patrimônio e Economia, só para consulta. Não cria pedido nem altera item, fornecedor ou bem. A fila Aguardando assinatura e o botão de posicionar assinatura ficam só para o global autorizado a assinar orçamento de bem/imobilizado e prestação de serviço. Consumo, hortifruti e manutenção continuam com Suprimentos.

Tipos de novo pedido (`BOTOES_NOVO_PEDIDO` em `utils/comprasPedidoTipos.js`):

| Rota | Título do botão | Descrição no card |
| --- | --- | --- |
| `/compras/novo/consumo` | Itens de consumo | Pedido da janela mensal. A Sede Suprimentos pede os orçamentos. |
| `/compras/novo/hortifruti` | Hortifruti | Frutas, legumes e verduras a qualquer momento. A Sede Suprimentos cota; só o projeto aprova. |
| `/compras/novo/imobilizado` | Bem / imobilizado | Compra de bem. O projeto cota; a Sede Infraestrutura acompanha. |
| `/compras/novo/manutencao` | Itens de manutenção | Reparos. Quem conduz: Suprimentos (cotação da Sede) ou Infraestrutura (mesmo caminho de bem e serviço). |
| `/compras/novo/servico` | Prestação de serviço | Serviços. O projeto cota; a Sede Infraestrutura acompanha. |

### Fluxo consumo (como o JSX conduz)

1. Projeto cria rascunho (`/compras/novo/consumo`) e envia (`Enviar pedido`) — cotação é da Sede (`TIPOS_COTACAO_SEDE`).
2. Suprimentos (Sede) pede cotação por e-mail e **registra orçamentos** (valor + PDF) na ficha.
3. Eventos na timeline com `aguardando_confirmacao` exigem botão **Ok** (confirmação explícita da outra parte).
4. Projeto **escolhe** orçamento (`Escolher`). Essa escolha já deixa o pedido `aprovado`. Se a Sede escolhe, o status continua `aguardando_aprovacao_unidade` até o projeto **Aprovar orçamento**. Pedido em que o projeto já escolheu e o status ficou em aguardando unidade passa a `aprovado` ao abrir a lista ou a ficha.
5. Enquanto o pedido está `aprovado` e o e-mail de compra ainda não foi enviado, a Sede pode **Reabrir orçamento aprovado** (motivo obrigatório). A escolha vencedora e a aprovação são desfeitas e o pedido volta para `aguardando_escolha_orcamento`.
6. Suprimentos **Enviar pedido de compra por e-mail**.
7. Projeto anexa NF (+ documentos extras) e **Encerrar processo (com NF anexada)**.

Hortifruti: seção **Cotações, Orçamentos ou Arquivos** com **Anexar arquivos**; Suprimentos pode **Aprovar e enviar ao fornecedor**.

### Fluxo bem, serviço e manutenção+Infraestrutura

1. Projeto cria rascunho com **Informações do pedido** (descrição, nome e dados do fornecedor, sem catálogo de item).
2. Anexa orçamentos (quantos forem) e envia à Infraestrutura.
3. Infraestrutura escolhe, posiciona e assina **ou** envia à fila do representante legal (Noemi).
4. Depois da assinatura do orçamento: passo **Contrato** — anexar contrato ou **Não há contrato, seguir para a compra**. Contrato vai à Infraestrutura e, após o ok, à Noemi (gov.br).
5. Compra: **Enviar pedido de compra por e-mail** ou **Compra direta sem envio de e-mail**.
6. **Documentos do processo**: nota fiscal, boleto (ambos com Assinatura Digital AEB) ou arquivo relacionado. Várias NFs na mesma anexação viram um PDF; se já houver nota, exclui antes de outra.
7. Encerrar processo com NF assinada.

Ao entrar no sistema, projeto e Infraestrutura veem o modal de Compras se um contrato acabou de ser assinado (**Abrir pedido** / **Mais tarde**). Não entra no menu de Comunicação.

---

## 1.2 Lista / hub — `/compras`

**Arquivo:** `carecore-front/src/Compras.jsx`  
**Query:** `?visao=concluidos` · `?aba=itens|categorias|fornecedores|janela|cadastros|patrimonio|economia`

### Função

Hub do módulo: ativação, abas (pedidos, janela, cadastros, patrimônio, economia), lista de pedidos em andamento ou concluídos, atalhos para novo pedido. Na aba Pedidos a tela continua uma só: primeiro o bloco **Suprimentos** (agrupado por projeto, com expandir), depois o bloco **Infraestrutura** no mesmo padrão.

### Cabeçalho

| Elemento | Texto |
| --- | --- |
| Eyebrow | Organização |
| Title | Compras **ou** Pedidos concluídos |
| Subtitle (andamento) | Solicitação, cotação, dupla aprovação, pedido ao fornecedor e conferência na unidade. |
| Subtitle (concluídos) | Pedidos encerrados, cancelados ou reprovados — histórico separado dos pedidos em andamento. Para Suprimentos, a lista é caixa de correio: não lidas no topo, selo Lida / Não lida, e contagem no subtítulo. |

### Campos / filtros

| Rótulo / UI | Obrig. | O que informar | Ligação |
| --- | --- | --- | --- |
| (input `type="month"` no FilterPanel «Filtros») | — | Competência AAAA-MM; vazio = todos os períodos. Em andamento abre sem mês | `competencia` → `comprasPedidos` |
| Todos os períodos | — | Limpa o mês e volta a listar todas as competências | — |
| Subtitle filtro andamento | — | Por padrão, todos os pedidos em andamento, agrupados por unidade | — |
| Subtitle filtro concluídos | — | Competência operacional (AAAA-MM) — só pedidos encerrados/cancelados/reprovados | — |

### Abas (não concluídos)

| Botão aba | Conteúdo |
| --- | --- |
| Pedidos | Lista + Novo pedido |
| Janela mensal | `ComprasJanelaCalendario` |
| Fornecedores / Catálogo de itens / Categorias | (projeto, se `podeCadastrarMestre`) |
| Cadastros | (sede) subabas Fornecedores, Catálogo de itens, Categorias e fontes |
| Patrimônio | `ComprasPatrimonioCadastro` |
| Economia | Economia das cotações (projeto vê a própria unidade; ADM Global Compras vê todos e a Sede) |

### Colunas da lista de pedidos

Unidade · Tipo · Objeto / categoria · Status · Orçamentos · Atualizado · Caixa (só Suprimentos em concluídos: Lida / Não lida) · (ação Abrir)

### Botões / links

| Botão | Quando |
| --- | --- |
| Ativar módulo Compras | Módulo inativo e `pode_ativar` ou sede |
| Cards Novo pedido (5 tipos) | Aba Pedidos, não concluídos |
| Agrupar por unidade / Desagrupar | Lista com pedidos. Em andamento já abre agrupado |
| Ordenar por \<coluna\> | Cabeçalhos da tabela |
| Expandir / Recolher | Agrupamento por unidade |
| Abrir | Linha do pedido → `/compras/pedidos/:id` |

---

## 1.3 Novo pedido — `/compras/novo/:tipo`

**Arquivo:** `carecore-front/src/ComprasPedidoNovo.jsx`

### Função

Criar rascunho do pedido conforme o tipo; redireciona para a ficha.

No topo, **Copiar um pedido concluído** abre rascunho do mês seguinte. **Inteiro** junta de novo o que foi separado (carne, peixe, alimentação) para dividir no próximo envio. **Dividido** copia só o pedido escolhido.

### Campos

| Rótulo | Obrig. | O que informar | Ligação | Visível quando |
| --- | --- | --- | --- | --- |
| Convênio ou custo indireto * | * | Selecionar fonte | `fonte_recurso_id` | sempre |
| Destino | — | Unidade / projeto · Sede (matriz) | `destino` | usuário sede |
| Unidade * | * (se destino projeto) | Projeto | `instituicao_id` | sede + destino projeto |
| Quem conduz | * | Suprimentos · Infraestrutura | `destino_compras` | manutenção, no topo |
| Título / objeto * | * | Ex.: Troca de compressor da geladeira | `titulo` | bem, serviço ou manutenção+Infraestrutura |
| Justificativa * | * | Por que esta compra/serviço é necessária | `justificativa` | mesmo recorte |
| Urgência | — | Normal · Urgente | `urgencia` | mesmo recorte |
| Data desejada * | * | data | `data_desejada` | mesmo recorte |
| Valor estimado (R$) | — | Opcional | `valor_estimado_reais` | mesmo recorte |
| Local (se diferente do projeto) | — | Endereço ou local de execução | `local_texto` | mesmo recorte |
| Tipo (manutenção) | — | Corretiva · Preventiva | `tipo_manutencao` | manutenção |
| Defeito / sintoma * | * | O que está acontecendo com o equipamento | `defeito` | manutenção + Suprimentos |
| Descrição detalhada / O que será comprado * | * | Texto livre do bem, serviço ou reparo | `info_pedido` | bem, serviço ou manutenção+Infraestrutura |
| Nome do fornecedor * | * | Sem cadastro no catálogo | `fornecedor_pedido_nome` | mesmo recorte |
| Informações adicionais do fornecedor | — | Contato, endereço | `fornecedor_pedido_info` | mesmo recorte |
| Observação | — | Preferências / restrições | `observacao` | consumo / hortifruti / manutenção+Suprimentos |
| Item N (typeahead) | * itens catálogo | Digite/buscar no catálogo do segmento | `catalogo_item_id`, `descricao` | consumo, hortifruti e manutenção+Suprimentos |
| Qtd | — | quantidade | `quantidade` | linhas |
| Unidade | — | un etc. | `unidade_medida` | linhas |

Placeholders typeahead por tipo: «Digite o item de consumo» · «Buscar peça/material de manutenção» · «Buscar serviço no catálogo» · «Buscar item de hortifruti» · «Buscar bem no catálogo».

### Botões

| Botão |
| --- |
| Voltar à lista |
| Remover (linha) |
| Adicionar item |
| Criar rascunho / Criando… |
| Cancelar |

Modal embutido: `ModalFormItemConsumo` (cadastro rápido de item).

---

## 1.4 Ficha do pedido — `/compras/pedidos/:pedidoId`

**Arquivo:** `carecore-front/src/ComprasPedido.jsx`  
**Modais:** `ModalRevisarEmailCompras.jsx`, `ModalPosicionarAssinaturaOrcamento`, `ModalPosicionarTextoNf`, `ModalFormItemConsumo`, `ModalVisualizarAnexoCompras`

### Função

Ciclo completo: itens, cotação/orçamentos, comunicação, timeline, pedido de compra, NF e encerramento, ações de fluxo.

Abaixo do título, faixa fixa **Fonte da verba**: **Custo direto** (convênio) ou **Custo indireto**. A mesma faixa aparece como selo na lista de pedidos. Convênio cadastrado como fonte conta como custo direto.

### Stepper (cotação projeto)

Montar · Pedir orçamento · Registrar · Sede · Assinado · Ao fornecedor · NF  
(`STEPS_COTACAO_PROJETO`)

### Seções e campos (rótulos do JSX)

#### Cabeçalho (somente leitura — cotação projeto)

Justificativa · Urgência · Data desejada · Local · Tipo manutenção · Defeito · Escopo

#### Observação do pedido

| Campo | Ligação |
| --- | --- |
| textarea (placeholder preferência/marca) | `obsPedido` → `comprasAtualizarRascunho` |

Botão: gravar observação (texto do botão no JSX via PremiumButton no bloco observação).

#### Itens

| Rótulo | Obrig. | Ligação |
| --- | --- | --- |
| Novo item | * catálogo | typeahead `item.descricao` / `catalogo_item_id` |
| Qtd | — | `quantidade` |
| Unidade | — | `unidade_medida` |
| Embalagem / Marca (colunas tabela) | — | edição inline |

Botões: Incluir item · Só neste pedido · Sim, atualizar cadastro · Usar un · Retirar · Desfazer · (salvar itens quando há alteração)

#### Cotações e orçamentos / Cotações, Orçamentos ou Arquivos

| UI | Ligação |
| --- | --- |
| Busca fornecedor (placeholder: Digite o nome ou e-mail — resultados desde a 1ª letra) | `buscaFornecedorCotacao` |
| Checkboxes fornecedores | `fornecedoresCotacaoIds` |
| Buscar na lista de fornecedores… | `buscaFornecedorLancamento` |
| Fornecedor cadastrado… / Ou nome avulso | `cotacao.fornecedor_id` / `fornecedor_nome` |
| R$ 0,00 | `cotacao.valor_reais` * |
| file PDF/imagem | `arqsCotacao` |
| + Anexar PDFs / Anexar arquivos (hortifruti) | `comprasAnexarArquivo` tipo `orcamento` |

Botões: Enviar pedido de cotação · Escolher · Revogar escolha · Remover · Visualizar · Baixar · × · Registrar orçamento recebido · Retirar (seleção e-mail)

O orçamento **Escolhida** fica no topo da lista, em negrito e com fundo verde, para a Sede e para o projeto.

#### Comunicação (parecer, negativa, observação)

| Campo | Opções / placeholder | Ligação |
| --- | --- | --- |
| select tipo | Observação · Parecer · Negativa | `comunicacao.tipo` |
| Texto da comunicação * | — | `comunicacao.texto` |
| Anexar resposta do fornecedor | file | tipo `resposta_fornecedor` |

Botão: Registrar

#### Timeline do processo

Registro de **Suprimentos** em azul e do **projeto** em branco. Em observação, parecer e negativa, **Corrigir** altera o texto e guarda o anterior em **Histórico da correção** (quem e quando). Botão **Ok** quando o evento aguarda confirmação de outro usuário. **Voltar** retorna à tela anterior, com mês, projeto e calendário como estavam.

#### Envio na janela (consumo + rascunho)

| Campo | Ligação |
| --- | --- |
| Envio automático (checkbox) | `envio_automatico` |

#### Espelho da compra (hortifruti + sede + enviado_fornecedor)

File → tipo `espelho_compra`

#### Documentos do processo (depois da compra)

| Campo | Obrig. | Ligação |
| --- | --- | --- |
| Tipo de documento | * | Nota fiscal · Boleto · Arquivo relacionado → `classeDoc` |
| Número NF | — | `nfForm.numero` (só nota fiscal) |
| R$ 0,00 | — | `nfForm.valor_reais` (só nota fiscal) |
| Insira as informações complementares de pagamento para a impressão da NF | * antes de PDF da nota | `nfForm.observacao` |
| Insira a senha do gestor para a assinatura eletrônica digital | * em nota e boleto | senha do gestor; Gestor, Técnico, Administrativo e ADM Pedidos do projeto; o carimbo leva nome do gestor, projeto e cargo Gestor |
| Arquivo | * | um ou vários PDFs de nota (o sistema junta); boleto e relacionado um a um |

Na Infraestrutura, depois da compra: **Pagamento** à vista (1) ou em N parcelas. Cada parcela recebe NF e/ou comprovante (sem assinatura). **Todos os valores já foram pagos** pede confirmação (e avisa se ainda falta parcela sem documento) e libera o encerramento mesmo com parcela sem anexo. Se o cliente pagar em menos parcelas, **Cliente pagou em N parcelas** reduz o plano até a última com documento. Encerrar só com NF assinada e pagamento completo.

**Documentos anexados** (botão em destaque, acima do formulário): NF, boleto, comprovante e arquivo relacionado no mesmo bloco. No parcelado, os arquivos da mesma parcela ficam juntos; relacionado sem parcela aparece em Arquivos do processo. Expandir mostra Visualizar, Baixar e Excluir.

Botões: Anexar NF assinada · Anexar boleto assinado · Anexar comprovante · Anexar arquivo relacionado · Cliente pagou em N parcelas · Todos os valores já foram pagos · Encerrar processo · Visualizar · Baixar · Excluir

Contrato fica no passo anterior, antes da compra. Boleto e nota exigem Assinatura Digital AEB. Relacionado não.

Para Suprimentos, ao abrir um pedido com status recebido, o aviso fixo abaixo do título diz se a NF **ainda não foi impressa** ou **já foi impressa** (com data). O botão **Imprimir NF** abre o PDF ou a imagem e, na primeira vez, grava a impressão. Abrir o pedido concluído marca a linha como lida na caixa.

#### Fluxo (ações condicionais ao status)

| Botão | Condição típica |
| --- | --- |
| Enviar pedido | rascunho / cotação sede |
| Enviar à Sede | cotação projeto em cotação |
| Aprovar orçamento | consumo + aguardando_aprovacao_unidade |
| Aprovar na unidade | outros tipos + aguardando_aprovacao_unidade |
| Aprovar e enviar ao fornecedor | hortifruti + sede |
| Aprovar na Sede | sede + aguardando_aprovacao_sede (não projeto) |
| Posicionar assinatura e aprovar (Sede) | cotação projeto na sede |
| Enviar pedido de compra por e-mail | aprovado / pode enviar |
| Reabrir processo | quando `podeReabrir` |
| Reabrir orçamento aprovado | Sede + `aprovado` + pedido de compra ainda não enviado (motivo obrigatório) |
| Excluir rascunho | `pedido.pode_excluir` |
| Reprovar / Cancelar | não terminal (motivo via prompt) |
| Voltar | sempre |
| Liberar escolha (banner) | quando aplicável → `comprasLiberarEscolha` |

#### Modal e-mail

Títulos: Revisar pedido de cotação · Revisar pedido de compra · Revisar reenvio ao fornecedor  
(`ModalRevisarEmailCompras.jsx`) — corpo editável; Cancelar / confirmar envio. Em hortifruti sem orçamento escolhido, o envio e o reenvio pedem o fornecedor na lista; o e-mail usa o endereço cadastrado no momento.

---

## 1.5 Fila assinatura sede — `/compras/aguardando-assinatura`

**Arquivo:** `carecore-front/src/ComprasAguardandoAssinatura.jsx`  
**Rota protegida:** `PERFIS_ADM_COMPRAS_SEDE` + Manutenção

### Função

Duas filas: Infraestrutura (orçamentos e contratos aguardando ok) e representante legal (o que a Infraestrutura enviou + contratos após o ok). Cada fila **agrupa por unidade**, no mesmo padrão da lista de Pedidos: a linha do projeto mostra quantidade, tipo e **data/hora da última atualização**; **Expandir** / **Recolher** abre os itens. Em cada pedido e orçamento aparecem enviado em, atualizado em e a data/hora do arquivo. **Visualizar** abre o PDF/imagem no modal (sem baixar); o nome do arquivo continua servindo para baixar. A Infraestrutura pode **Posicionar e assinar** ou **Enviar para a fila do representante legal**. A Noemi vê Visualizar, assinar com gov.br e anexar o PDF assinado. Ao entrar no sistema, quem assina vê o aviso da fila; Suprimentos não recebe esse aviso.

## 1.5b Documentos assinados — `/compras/documentos-assinados`

**Arquivo:** `carecore-front/src/ComprasDocumentosAssinados.jsx`

Lista contratos já assinados (saem da fila). Visualizar / Baixar / Abrir / Substituir o PDF, se o processo ainda não estiver encerrado.

### Campos / uploads

| Rótulo | Obrig. | Ligação |
| --- | --- | --- |
| Cadastrar PDF da assinatura / Substituir PDF | * para assinar | `comprasUploadAssinaturaDigital` |

### Botões

Atualizar · Expandir / Recolher (por unidade) · Escolher · Revogar · Visualizar · Abrir pedido · Posicionar e assinar / Assinando… · Assinar com gov.br (baixa o PDF, abre assinador.iti.br, arquiva o PDF assinado e aprova o pedido) · links Orçamento:/Assinado:/Contrato: (download) · Ver itens e timeline

Mensagem se sem perfil: «Somente ADM Compras (Sede) acessa esta fila.»

---

## 1.6 Janela mensal — aba em `/compras`

**Arquivo:** `carecore-front/src/components/ComprasJanelaCalendario.jsx`

### Função

Calendário de compras (competência, semana, publicar ano, liberar projeto fora da janela).

### Campos

| Rótulo | Ligação / uso |
| --- | --- |
| Semana do mês (padrão) | publicação |
| Início / Fim | datas da janela |
| Motivo | liberação / exceção |
| Projeto | liberar unidade |

### Botões

Mês anterior · Próximo mês · Salvar alteração · Publicar janela · (criar rascunho / abrir pedido via callbacks do hub)

---

## 1.7 Catálogo de itens — `/compras?aba=itens` (e Cadastros sede)

**Arquivo:** `carecore-front/src/components/ComprasItensConsumoCadastro.jsx`  
**Modal form:** `ModalFormItemConsumo.jsx`  
**Modal ficha:** `ModalFichaItemConsumo.jsx`

### Filtros lista

| Rótulo | Opções |
| --- | --- |
| Busca | placeholder: Comece a digitar a descrição, marca ou categoria |
| Uso no pedido | Todos + segmentos |
| Competência | Todas / … |
| Categoria | — |
| Status | Ativos · Inativos |

Colunas: Item · Uso · Competência · Categoria · Unidade · Embalagem · Marca · Status

Ações: Ver ficha · Editar · Excluir · Novo item (padrão do componente)

### Modal Novo/Editar item (`ModalFormItemConsumo.jsx`)

| Rótulo | Obrig. | Ligação |
| --- | --- | --- |
| Descrição | * | `descricao` |
| Categoria | — | `categoria_id` (label inclui segmento) |
| Competência de orçamento | — | Sede (orçado pela Sede) · Projeto (orçado pelo projeto) |
| Unidade de medida | — | `unidade_medida` |
| Embalagem | — | Ex.: fardo com 12 · PCT 2 kg |
| Marca preferencial | — | — |
| Quantidade na embalagem | — | Ex.: 12 |
| Sinônimos / nomes equivalentes | — | vírgulas |
| Item equivalente (opcional) | — | Nenhum / lista |
| Perecível | checkbox | `perecivel` |
| Observação | — | — |
| Ativo | checkbox | `ativo` |

Botões: Fechar · Cancelar · Salvar / Salvando…

---

## 1.8 Categorias (e fontes na sede) — `/compras?aba=categorias`

**Arquivo:** `carecore-front/src/components/ComprasCategoriasFontes.jsx`

### Categorias do catálogo

Ajuda (texto JSX): uso Consumo (janela), Itens de manutenção, Bem/imobilizado ou Serviço; Carne/Peixe categorias próprias.

| Campo cadastro | Rótulo |
| --- | --- |
| Nome | Nova categoria / Digite para ver se já existe |
| Uso no pedido | select segmento (`ROTULO_SEGMENTO_CATALOGO`) |
| Tipo | (quando aplicável no form de lista) |
| Vigência inicial (opcional) / Vigência final (opcional) | fontes/categorias conforme lista |

Colunas: Nome · Uso no pedido · Tipo · Vigência · Status · Ações

### Fontes de recurso (sede / `mostrarFontes`)

Título: Fontes de recurso  
Ajuda: A fonte da verba do pedido só pode ser Convênio ou Custo indireto.  
Campo novo: Nova fonte  
Tipos label: Convênio · Custo indireto

---

## 1.9 Fornecedores — `/compras?aba=fornecedores`

**Arquivos:** `ComprasFornecedoresCadastro.jsx`, `ModalFormFornecedor.jsx`, `ModalFichaFornecedor.jsx`

### Lista

| Filtro | Opções |
| --- | --- |
| Busca | Buscar por nome, CNPJ, segmento, contato ou projeto |
| Status | Ativos · Inativos · Bloqueados · Todos |

Colunas: Fornecedor · Segmento · Representante · Telefone · Projetos · Status  
Ações: Ver ficha · Editar · Novo fornecedor

### Modal form fornecedor

| Rótulo | Obrig. | Placeholder / notas | Ligação tipica |
| --- | --- | --- | --- |
| Nome / razão social | * (padrão form) | — | nome |
| CNPJ | — | 00.000.000/0000-00 | cnpj |
| Categoria principal | — | — | categoria_id |
| Outras categorias (opcional) | — | — | categoria_ids |
| Prazo de entrega (dias) | — | Ex.: 7 | prazo |
| Segmento / tipo de serviço | — | Ex.: Alimentação seca, Material elétrico | segmento |
| Representante | — | Nome da pessoa de contato | representante |
| Telefone | — | (11) 99999-9999 | telefone |
| E-mail do representante | — | — | email |
| E-mail da empresa | — | — | email_empresa |
| Projetos atendidos | — | GERAL / unidades | projetos |
| Observações | — | Opcional | observacoes |
| Status | — | Ativo · Inativo · Bloqueado | status |

Botões: Fechar · Cancelar · Incluir fornecedor / Salvar alterações / Salvando…

Ficha (somente leitura adicional): CEP · Logradouro · Número · Complemento · Bairro · Cidade · UF · Endereço completo · Categoria (cotação)

---

## 1.10 Patrimônio — aba Patrimônio

**Arquivos:** `ComprasPatrimonioCadastro.jsx`, `ModalFormPatrimonio.jsx`

Filtros: Busca · Unidade · Situação · Propriedade  
Colunas: Bem · Unidade · Local · Valor · Situação  
Ações: Ver ficha · Editar · Novo bem

### Modal bem

Destino (Sede / Unidade / projeto) · Projeto · Descrição · Nº da etiqueta · Localização · Departamento · Categoria (Bem / imobilizado) · Propriedade · Origem · Conservação · Data da aquisição · Documento (NF / recibo) · Valor da aquisição (R$) · Forma da aquisição · Data da baixa · Motivo da baixa · Depreciação anual / Valor atual (exibição)

**Arquivos do bem:** orçamentos, termo de doação e notas que vieram da compra, mais anexos feitos direto no bem (tipo Orçamento, Termo de doação, Nota, Aquisição ou Outro).

Botões: Fechar · Cancelar · Incluir bem / Salvar alterações

---

## 1.11 Economia das cotações

**Arquivo:** `Compras.jsx` (aba economia) e `ComprasEconomiaPainel.jsx`

Filtros: período (de/até, pelo dia da aprovação) e projeto. ADM Global Compras, Global e Manutenção veem todos os projetos e a Sede e podem filtrar uma unidade. Usuário de projeto, inclusive ADM Pedidos, vê só a própria unidade.

Cada projeto mostra valor cheio (cotação mais alta), valor da cotação escolhida, economia em relação à maior e em relação à média. A linha expande os pedidos, com as mesmas contas e a lista de cotações.

Botões: Exportar XLSX · Imprimir. Os dois saem com o filtro aplicado, o total de cada projeto e o detalhe de cada pedido.

---

## 1.12 Usuários ADM Global Compras

Menu aponta para **`/usuarios`** (tela `Usuarios.jsx`, fora deste módulo). Label no menu sede: «Usuários ADM Global Compras».

---

# 2. NFP – Créditos

## 2.1 Acesso (resumo)

| Constante / regra | Perfis |
| --- | --- |
| `PERFIS_NFP_GESTAO` | Global, ADM Global NFP, Manutenção |
| `PERFIS_NFP_LEITURA_CUPONS` | Global, ADM Global NFP, ADM Produção NFP, Gestor, Técnico, Administrativo, Manutenção |
| `PERFIS_NFP_ENVIO_SEFAZ` (ver tela) | Global, ADM Global NFP, Manutenção |
| `PERFIS_NFP_OPERAR_ENVIO_SEFAZ` | ADM Global NFP, Manutenção |
| Flag `nfp_modulo_ativo` | Libera menu **NFP – Créditos** no escopo projeto (`usuarioPodeAcessarNfp`) → rota leitura; **não** substitui perfis da fila Envio SEFAZ |

**Origem:** `rbacUtils.js`, `Sidebar.jsx` (`escopoNfp: 'projeto'`), `AppRouter.jsx`.

**Senha gov.br:** digitada somente no site oficial `nfp.fazenda.sp.gov.br` (Chrome do agente / «Abrir site Fazenda»). Não há campo de senha NFP no CareCore; nada é armazenado como senha gov.br nas telas inventariadas.

**Leitura:** subtitle JSX — «Validamos na SEFAZ e só entram cupons sem CPF do consumidor.» Rejeição: status «Rejeitado CPF».

---

## 2.2 Dashboard — `/nfp`

**Arquivo:** `carecore-front/src/NfpCreditos.jsx`

### Função

Dashboard NFP + abas Importações, Rateio, Lançamentos de Doadores Diretos; atalhos para cadastros/relatórios.

### Abas

Dashboard · Importações · Rateio · Lançamentos de Doadores Diretos

### Campos

| Rótulo | Ligação |
| --- | --- |
| Agente de captação | filtro agente |
| Competência (mês/ano) | `competencia` |
| Planilha (importar doadores) | arquivo |
| Planilha CNPJ + LOJA | arquivo |
| Planilha Pedidos | arquivo |
| Arquivos ConsultaNFP (vários) | arquivos SEFAZ |

### Botões

Atualizar · Calcular rateio · Importar (×4 blocos) · OK (resumo) · links para Agentes / Doadores / CNPJs / Relatórios

Cards de atalho: Agentes captadores · Doadores · CNPJs / CPFs Captados por Agentes · Relatórios

---

## 2.3 Agentes captadores — `/nfp/cadastro/agentes`

**Arquivo:** `NfpAgentes.jsx`

### Função

Cadastro de agentes, percentual de rateio e endereço.

### Campos form

| Rótulo | Placeholder / notas |
| --- | --- |
| Código | Ex.: SEDE AEB |
| Tipo | — |
| Nome | Nome completo ou razão social |
| Nome fantasia | — |
| CPF / CNPJ | conforme tipo |
| E-mail · Telefone | — |
| Percentual do agente (%) | 0 |
| (+ campos endereço via `NfpEnderecoFields` se presentes no form) | — |

Filtro busca: Buscar por código, nome ou documento · Status Todos/Ativos/Inativos

Botões: Carregar agentes padrão · Novo agente · Voltar · Atualizar · Salvar agente · Cancelar

Colunas: Nº · Código · Nome · Tipo · Percentual · Contato · Status

---

## 2.4 Doadores — `/nfp/cadastro/doadores`

**Arquivo:** `NfpDoadores.jsx`

### Campos

Nome · CPF · Data de nascimento · E-mail · Telefone · Unidade / projeto (Metas NFP) (Selecione o projeto…)

Busca: Buscar por nº, nome ou CPF

Botões: Novo doador · Voltar · Atualizar · Salvar doador · Cancelar

Colunas: Nº · Nome · CPF · Unidade · Origem · Contato · Status

Nota JSX: vínculo alimenta coluna «Doadas» em Metas / Rateio mensal.

---

## 2.5 CNPJs / CPFs — `/nfp/cadastro/cnpjs`

**Arquivo:** `NfpCnpjs.jsx`

### Função

Estabelecimentos (CNPJ) e pessoas físicas (CPF) vinculadas a agentes.

### Campos CPF

CPF · Nome · Agente captador · E-mail · Telefone · Status

### Campos CNPJ

CNPJ · Loja / nome fantasia · Razão social · Captador · Inscrição estadual · E-mail · Telefone · Status

Botões: Voltar · Atualizar · + Novo CPF · + Novo CNPJ · Salvar CPF · Salvar CNPJ · Cancelar  
Filtro: Todos os captadores

---

## 2.6 Leitura de Cupons — `/nfp/leitura-cupons`

**Arquivo:** `NfpLeituraCupons.jsx`  
**Perfis rota:** `PERFIS_NFP_LEITURA_CUPONS`

### Função

Menu Leitura de QR Code (câmera, leitor USB ou chave) ou Inserção de dados (CNPJ, tipo Cupom Fiscal, data, COO e valor, com CNPJ travável, mês da compra dentro do prazo SEFAZ (cadeado opcional), valor em reais e +/− no COO). QR passa pela validação SEFAZ e só entra sem CPF do consumidor. Dados entram direto na mesma fila; o robô lança no bloco sem chave de acesso.

### Campos

| Rótulo | Ligação |
| --- | --- |
| Captador / unidade | select. Abre na unidade do projeto logado; Sede só se o login for da Sede ou não houver unidade correspondente. Continua editável. Fica fixo quando o usuário tem vínculo NFP |
| Chave 44 dígitos ou URL | leitura manual |
| Filtros lista: status / captador / usuário | checando, pendente, reservado, enviado, erro, rejeitado CPF, rejeitado prazo… |

Botões: Atualizar · (câmera on/off implícita) · paginação

Mensagens: «Leitura realizada com sucesso» · «Vínculo do usuário» · «As leituras deste login vão sempre para este projeto/Sede.»

---

## 2.7 Envio SEFAZ — `/nfp/envio-sefaz`

**Arquivo:** `NfpEnvioSefaz.jsx`  
**Ver:** Global / ADM Global NFP / Manutenção  
**Operar (abrir site / fila):** ADM Global NFP / Manutenção (`usuarioPodeOperarEnvioSefaz`)

### Função

Instalar agente local, abrir `nfp.fazenda.sp.gov.br`, rodar fila de cupons pendentes. Login/CAPTCHA no site da Fazenda (não no CareCore). No painel local, CPF e senha GOV em Enviar fila: se a Fazenda voltar ao login, o agente entra com gov.br e continua a fila.

### Cards status

Robô nesta API · Chrome / CDP · Pendentes · Reservados (em máquina) · Executados (enviados) · Com erro · Total no CareCore

### Campos

| Rótulo | Opções / placeholder |
| --- | --- |
| Fonte | Pendentes do CareCore · Planilha (Downloads) |
| Limite da sessão (opcional) | vazio = continuo · ex.: 200, 500, 1000 |

### Botões

Atualizar status · Baixar agente NFP (.exe) · Baixar ZIP · Abrir site Fazenda · 100/200/300/500/1000 · Continuo · Rodar rotina / enviar fila · Parar rotina

Texto do pacote: no painel, CPF e senha GOV em Enviar fila; abrir a Fazenda até Bem-vindo; se voltar ao login, o robô entra com o GOV salvo e continua.

---

## 2.8 Conferência pré-prazo — `/nfp/conferencia-sefaz`

**Arquivo:** `NfpConferenciaSefaz.jsx`  
**Perfis:** `PERFIS_NFP_GESTAO` (texto UI: «Acesso restrito a ADM Global NFP e Manutenção.» — Global pode ver rota mas mensagem restringe operação)

### Função

Batimento Pedidos × cupons antes do dia 20 (CNPJ + nº SAT + valor).

### Passos UI

1. Contexto e prioridades  
2. Importar Pedidos SEFAZ (CADASTRO)  
3. Resultado do batimento  
4. Próximo passo — robô  

### Campos

Enviados a partir de · Enviados antes de · seleção na tabela (Sel. · Situação · CNPJ · Nº SAT · Valor · Chave (fim))

Botões: Próximo: importar Pedidos · Executar batimento · Voltar · Novo batimento

---

## 2.9 Metas / Rateio mensal — `/nfp/metas`

**Arquivo:** `NfpMetas.jsx`

### Função

Competência = mês de pagamento; Ref. crédito = mês SEFAZ (~4 meses antes). Campos digitáveis salvam/recalculam ao sair.

### Abas

Mensal · Consolidado / ranking

### Campos / labels (entradas e rateio)

Digitadas (R$) — do rateio · Doadas CPF (R$) — do rateio · Soulcial base — manual · Total captador — do rateio · Digitadas Diego — manual · Fundo 30% (digitadas) · P/ projetos (digitadas) · Fundo 30% (doadas) · P/ projetos (doadas) · Soulcial rateio · Valor Diego 50% · Total rateio (projetos) · Digitadas projetos · Digitadas geral · Vinculado a unidade_captador do doador

Botões: Atualizar do rateio · Salvar agora · Impressão (bloco)

Colunas mensal: Projeto · Digitadas · % · Doadas · Vlr digitado · Vlr aplicativo · Vlr total · Soulcial · Campanhas · Diego · Total

---

## 2.10 Central de relatórios — `/nfp/relatorios`

**Arquivo:** `NfpRelatorios.jsx`  
Cards para Cupons lidos / enviados, Rateio consolidado, Rateio detalhado, Metas (links de `relatorioNfpUtils.js`).

---

## 2.11 Relatório Cupons — `/nfp/relatorios/cupons`

**Arquivo:** `RelatorioNfpCupons.jsx`

| Campo | Opções |
| --- | --- |
| Data início / Data fim | — |
| Filtrar por | Data de leitura · Data de envio |
| Captador / unidade | Todos / lista |
| Busca (chave, CNPJ ou mensagem) | Opcional |

Botão: Gerar relatório / Gerando…

---

## 2.12 Rateio consolidado — `/nfp/relatorios/rateio-consolidado`

**Arquivo:** `RelatorioNfpRateioConsolidado.jsx`

Campos: Competência início · Competência fim · Agente  
Colunas: Total · Parte agente · Parte AEB · Doador auto · Direto AEB · Linhas  
Botão: Gerar relatório

---

## 2.13 Rateio detalhado — `/nfp/relatorios/rateio-detalhado`

**Arquivo:** `RelatorioNfpRateioDetalhado.jsx`

| Campo | Notas |
| --- | --- |
| Competência * | obrigatório UI |
| Agente · Origem · Exibição · Busca loja/CNPJ | Exibição: Agrupado por CNPJ · Sem agrupar (cada lançamento) |

Colunas: CNPJ · Loja · Captador · Origem · Fonte · Nº nota · Qtd · Retorno · Retorno loja · Retorno CPF · Agente · AEB

---

## 2.14 Usuários ADM NFP

Menu Gestão Global → «Usuários ADM NFP» → **`/usuarios`** (`Usuarios.jsx`). Flag `nfp_modulo_ativo` no cadastro de usuário libera leitura no projeto; fila Envio SEFAZ continua por perfil Global/ADM Global/Manutenção.

---

# 3. Financeiro (pacote `financeiro_pessoal`)

## 3.1 Quem acessa

| Regra | Origem |
| --- | --- |
| Rotas `/financeiro/*` só se `organizacao_tipo_pacote === 'financeiro_pessoal'` | `ProtectedRoute.jsx` + `orgPacoteUtils.js` (`usuarioOrganizacaoFinanceira`) |
| Usuário de org financeira é redirecionado para `/financeiro/dashboard` se sair do módulo (exceto `/organizacao`) | idem |
| Menu lateral próprio | `FinanceSidebar.jsx` — Visão Geral, Extrato, Notas Fiscais (Leitura de PDFs + Conferência NFS-e), A Pagar / Receber, WhatsApp, Cartões, Investimentos, Contas, Configurações, ONGs/Projetos |

Não há lista de perfis Gestor/Técnico nestas rotas: o gate é o **tipo de pacote da organização**.

**Nota de implementação:** `/financeiro/contas` e `/financeiro/extrato` renderizam o mesmo componente `Accounts` (`FinanceContasPro.jsx` / `FinanceExtratoPro.jsx` → `pro/pages/Accounts.tsx` → `AccountsDesktop.tsx`).

---

## 3.2 Visão Geral — `/financeiro/dashboard`

**Arquivos:** `FinanceDashboardPro.jsx` → `pro/pages/Dashboard.tsx` → `DashboardDesktop.tsx`

### Função

Painel: patrimônio, receitas/despesas do mês, gráficos.

### UI (rótulos)

Visão geral das suas finanças · Patrimônio Total · navegação de mês · filtros de gráfico Despesas/Receitas · categorias

---

## 3.3 Contas / Extrato — `/financeiro/contas` e `/financeiro/extrato`

**Arquivo UI:** `financeiro/pro/pages/AccountsDesktop.tsx`

### Função

Minhas Contas + extrato da conta ativa + importação OFX/CSV.

### Campos modal conta

| Rótulo | Placeholder |
| --- | --- |
| Nome | Ex: C6 Bank... |
| Saldo Inicial | número |
| Rendimento Automático? | checkbox |
| % do CDI | se rendimento |

### Extrato (colunas)

Data · Descrição · Valor · Status (CONCILIADO / ABERTO)

### Botões

Nova Conta · Importar Extrato / Importando... · Excluir (N) · Salvar · Cancelar · (editar data / toggle status / lixeira)

Títulos: Minhas Contas · Saldo Unificado · Extrato · Adicionar Conta / Editar Conta

---

## 3.4 A Pagar / Receber — `/financeiro/pagar-receber`

**Arquivo:** `PayablesDesktop.tsx` (via `FinancePayablesPro.jsx`)

Título: Contas a Pagar / Receber  
Subtitle: Controle seus compromissos futuros  

Abas: Lista (+ formulário de inclusão no mesmo arquivo)  
Cards: Receitas · Despesas · Balanço  
Filtros: Buscar... · TODOS · ABERTO · PAGO  
Colunas: Vencimento · Descrição · Valor · Status  
Botões: Excluir · (marcar pago / remover linha)

---

## 3.5 Notas — Leitura de PDFs — `/financeiro/notas`

**Arquivos:** `FinanceInvoicesPro.jsx` → `ServiceInvoicesDesktop.tsx` / `InvoicePage.tsx`

### Função

Importar PDFs NFS-e; monitoramento fiscal / limite MEI.

### UI

Notas Fiscais · Importar PDFs (NFS-e) · Selecionar Arquivos / Processando...  
Texto: Selecione vários arquivos. O PDF será salvo automaticamente. / O sistema reconhece: Danki, Associação Evangélica e Grants.  
Placeholder fallback: Cole aqui o texto da nota se o PDF falhar...  
Colunas: Data · Descrição · Valor · PDF  
KPIs: Faturamento Anual · Limite MEI · Monitoramento Fiscal

---

## 3.6 Conferência NFS-e — `/financeiro/notas/conferencia-nfse`

**Arquivo:** `FinanceNotasConferencia.jsx`

### Função

Comparar NFS-e do portal nacional (`nfse.gov.br`) com PDFs locais; login manual, sem certificado digital.

### Campos

| Rótulo | Notas |
| --- | --- |
| Pastas de origem (PDFs) | placeholder C:\\...\\pasta com PDFs das NFs |
| Pasta de destino (confirmações e prints) | destino |
| Ano de conferência | 2025 · 2026 |
| Mês inicial / Mês final | Janeiro…Dezembro |
| Ritmo de navegação (anti-bloqueio) | Normal — 3–6 s · Lento (recomendado) — 6–12 s · Muito lento — 12–20 s |

### Botões

Escolher no Explorer · Linha manual · Iniciar conferência · (parar / abrir navegador conforme API) · Remover pasta

Cards resultado: Site (lidas) · Canceladas · autorizadas no portal · PDF s/ portal · Relatório Excel

---

## 3.7 WhatsApp — `/financeiro/whatsapp`

**Arquivo:** `WhatsappPageDesktop.tsx`

Título: WhatsApp & Dívidas  
Subtitle: Conciliação de gastos compartilhados  

Campos: Mês de Referência · Data de Corte · upload de arquivo  
Colunas Histórico: Data · Resp. · Categoria · Descrição · Valor · Status  
Botões: Fechar Ciclo (Conciliar) · Limpar Tudo · (importar)

---

## 3.8 Cartões — `/financeiro/cartoes`

**Arquivo:** `CardsDesktop.tsx` (+ `CardImport`)

Título: Gestão de Cartões  
Subtitle: Importe sua fatura CSV e classifique seus gastos

---

## 3.9 Investimentos — `/financeiro/investimentos`

**Arquivo:** `InvestmentsDesktop.tsx`

Título: Carteira de Investimentos  
KPIs: Total Líquido · Total Investido · Rendimento · Variação Diária  
Colunas: Ativo · Investido · Atual (Líq) · Rentabilidade  
Modal: Nome (Ex: Tesouro Selic) · Valor · data · Rende % do CDI? · % do CDI (Ex: 100) / Taxa Fixa % a.m.  
Botões: Cancelar · Salvar · Editar · excluir · bloco Melhores Taxas

---

## 3.10 Configurações — `/financeiro/configuracoes`

**Arquivo:** `SettingsDesktop.tsx`

Título: Configurações · Gerencie regras, dados e backups

### Regras de Categorização

| Campo | Placeholder |
| --- | --- |
| Palavra-chave | Ex: Uber... |
| Categoria | Ex: Transporte... |

### Outros blocos

Aplicar Regras / Reprocessar histórico · Backup e Dados (Exportar JSON / importação) · Formato do Arquivo

---

# 4. Cobranças

## 4.1 Cobranças — `/cobrancas`

**Arquivo:** `Cobrancas.jsx`  
**Perfil:** Manutenção (`AppRouter` + Sidebar)

### Função

Módulo de Cobranças — fechamento, vencimento e pagamento do ciclo; integração Asaas (config/teste).

### Campos (emissão / config conforme blocos da tela)

| Rótulo | Placeholder |
| --- | --- |
| CNPJ do boleto | — |
| Valor (R$) | 0,00 |
| Vencimento | — |
| Descrição (opcional) | Ex.: Mensalidade SIAT julho/2026 |

### Botões

Gerar 2ª via / pagar · (ações de validação Asaas / teste sandbox descritos nos parágrafos da tela)

Colunas ciclos: Projeto / CNPJ · Conviventes · Usuários · Total · Mensalidade · Cobrança · Fechamento · Vencimento · Cadastros · Valor · Status · Ação

---

## 4.2 Operação Financeira — `/admin/cobrancas`

**Arquivo:** `CobrancasAdmin.jsx`  
**Perfil:** Manutenção  
**Menu:** Operação Financeira

### Função

Painel de organizações, faturas, alertas, bloqueios e liberações temporárias.

### KPIs

Organizações · Em dia · Pendentes · Alertas · Bloqueadas · Liberadas

### Filtro

Todos os status · Em dia · Pendente · Perto do vencimento · Em alerta · Bloqueada · Liberada temporariamente

### Colunas

Organização · Status · Projetos · Faturas · Pendente · Ciclo atual · Liberação · Ações

### Botões / ações

Atualizar · liberar temporariamente (prompt motivo + dias) · revogar liberação (prompt motivo)

Bloco: Automação de cobranças (Fechamento automático / Geração Asaas automática / Dia previsto)

---

# 5. Índice de arquivos-fonte

| Área | Arquivos principais |
| --- | --- |
| Rotas | `routes/AppRouter.jsx` |
| Menus | `Sidebar.jsx`, `components/FinanceSidebar.jsx` |
| Compras hub | `Compras.jsx` |
| Novo pedido | `ComprasPedidoNovo.jsx`, `utils/comprasPedidoTipos.js` |
| Ficha | `ComprasPedido.jsx` |
| Assinatura sede | `ComprasAguardandoAssinatura.jsx` |
| Cadastros | `components/ComprasItensConsumoCadastro.jsx`, `ComprasCategoriasFontes.jsx`, `ComprasFornecedoresCadastro.jsx`, `ComprasJanelaCalendario.jsx`, `ComprasPatrimonioCadastro.jsx`, modais `ModalForm*` |
| NFP | `NfpCreditos.jsx`, `NfpAgentes.jsx`, `NfpDoadores.jsx`, `NfpCnpjs.jsx`, `NfpLeituraCupons.jsx`, `NfpEnvioSefaz.jsx`, `NfpConferenciaSefaz.jsx`, `NfpMetas.jsx`, `NfpRelatorios.jsx`, `RelatorioNfp*.jsx` |
| Financeiro | `financeiro/Finance*Pro.jsx`, `financeiro/FinanceNotasConferencia.jsx`, `financeiro/pro/pages/*Desktop.tsx` |
| Cobranças | `Cobrancas.jsx`, `CobrancasAdmin.jsx` |
| RBAC / pacote | `utils/rbacUtils.js`, `utils/orgPacoteUtils.js`, `routes/ProtectedRoute.jsx` |

---

*Fim do inventário 03 — Compras / NFP / Financeiro / Cobranças.*
