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
| Sede | Compras → + Aguardando assinatura, Cadastros (via aba), Usuários ADM Global Compras | Global / ADM Global Compras / Suprimentos / Infraestrutura / Manutenção |

**Origem:** `Sidebar.jsx` (`COMPRAS_CHILDREN_PROJETO`, `montarComprasChildrenSede`), `rbacUtils.js` (`PERFIS_ADM_COMPRAS_SEDE`, `usuarioPodeVerCompras`).

Tipos de novo pedido (`BOTOES_NOVO_PEDIDO` em `utils/comprasPedidoTipos.js`):

| Rota | Título do botão | Descrição no card |
| --- | --- | --- |
| `/compras/novo/consumo` | Itens de consumo | Pedido da janela mensal. A Sede Suprimentos pede os orçamentos. |
| `/compras/novo/hortifruti` | Hortifruti | Frutas, legumes e verduras a qualquer momento. A Sede Suprimentos cota; só o projeto aprova. |
| `/compras/novo/imobilizado` | Bem / imobilizado | Compra de bem. O projeto cota; a Sede Infraestrutura acompanha. |
| `/compras/novo/manutencao` | Itens de manutenção | Reparos e manutenção. A Sede Suprimentos conduz a cotação. |
| `/compras/novo/servico` | Prestação de serviço | Serviços. O projeto cota; a Sede Infraestrutura acompanha. |

### Fluxo consumo (como o JSX conduz)

1. Projeto cria rascunho (`/compras/novo/consumo`) e envia (`Enviar pedido`) — cotação é da Sede (`TIPOS_COTACAO_SEDE`).
2. Suprimentos (Sede) pede cotação por e-mail e **registra orçamentos** (valor + PDF) na ficha.
3. Eventos na timeline com `aguardando_confirmacao` exigem botão **Ok** (confirmação explícita da outra parte).
4. Projeto **escolhe** orçamento (`Escolher`). Essa escolha já deixa o pedido `aprovado`. Se a Sede escolhe, o status continua `aguardando_aprovacao_unidade` até o projeto **Aprovar orçamento**. Pedido em que o projeto já escolheu e o status ficou em aguardando unidade passa a `aprovado` ao abrir a lista ou a ficha.
5. Suprimentos **Enviar pedido de compra por e-mail**.
6. Projeto anexa NF (+ documentos extras) e **Encerrar processo (com NF anexada)**.

Hortifruti: seção **Cotações, Orçamentos ou Arquivos** com **Anexar arquivos**; Suprimentos pode **Aprovar e enviar ao fornecedor**.

---

## 1.2 Lista / hub — `/compras`

**Arquivo:** `carecore-front/src/Compras.jsx`  
**Query:** `?visao=concluidos` · `?aba=itens|categorias|fornecedores|janela|cadastros|patrimonio|economia`

### Função

Hub do módulo: ativação, abas (pedidos, janela, cadastros, patrimônio, economia), lista de pedidos em andamento ou concluídos, atalhos para novo pedido.

### Cabeçalho

| Elemento | Texto |
| --- | --- |
| Eyebrow | Organização |
| Title | Compras **ou** Pedidos concluídos |
| Subtitle (andamento) | Solicitação, cotação, dupla aprovação, pedido ao fornecedor e conferência na unidade. |
| Subtitle (concluídos) | Pedidos encerrados, cancelados ou reprovados — histórico separado dos pedidos em andamento. |

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
| Economia | (sede) Economia das cotações |

### Colunas da lista de pedidos

Unidade · Tipo · Grupo · Objeto / categoria · Envio previsto · Status · Orçamentos · Atualizado · (ação Abrir)

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

### Campos

| Rótulo | Obrig. | O que informar | Ligação | Visível quando |
| --- | --- | --- | --- | --- |
| Convênio ou custo indireto * | * | Selecionar fonte | `fonte_recurso_id` | sempre |
| Destino | — | Unidade / projeto · Sede (matriz) | `destino` | usuário sede |
| Unidade * | * (se destino projeto) | Projeto | `instituicao_id` | sede + destino projeto |
| Título / objeto * | * | Ex.: Troca de compressor da geladeira | `titulo` | cotação projeto (bem/serviço) |
| Justificativa * | * | Por que esta compra/serviço é necessária | `justificativa` | cotação projeto |
| Urgência | — | Normal · Urgente | `urgencia` | cotação projeto |
| Data desejada * | * | data | `data_desejada` | cotação projeto |
| Valor estimado (R$) | — | Opcional | `valor_estimado_reais` | cotação projeto |
| Local (se diferente do projeto) | — | Endereço ou local de execução | `local_texto` | cotação projeto |
| Tipo (manutenção) | — | Corretiva · Preventiva | `tipo_manutencao` | manutenção |
| Defeito / sintoma * | * | O que está acontecendo com o equipamento | `defeito` | manutenção |
| Descrição do escopo * | * | O que o prestador deve entregar | `escopo_servico` | serviço |
| Observação | — | Preferências / restrições | `observacao` | sempre |
| Item N (typeahead) | * itens catálogo | Digite/buscar no catálogo do segmento | `catalogo_item_id`, `descricao` | sempre (serviço: itens opcional agora) |
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

#### Comunicação (parecer, negativa, observação)

| Campo | Opções / placeholder | Ligação |
| --- | --- | --- |
| select tipo | Observação · Parecer · Negativa | `comunicacao.tipo` |
| Texto da comunicação * | — | `comunicacao.texto` |
| Anexar resposta do fornecedor | file | tipo `resposta_fornecedor` |

Botão: Registrar

#### Timeline do processo

Botão **Ok** quando evento aguarda confirmação de outro usuário.

#### Envio na janela (consumo + rascunho)

| Campo | Ligação |
| --- | --- |
| Envio automático (checkbox) | `envio_automatico` |

#### Espelho da compra (hortifruti + sede + enviado_fornecedor)

File → tipo `espelho_compra`

#### Nota fiscal e encerramento

| Campo | Obrig. | Ligação |
| --- | --- | --- |
| Tipo NF | — | Produto · Serviço · Outro → `nfForm.tipo_nf` |
| Número NF | — | `nfForm.numero` |
| R$ 0,00 | — | `nfForm.valor_reais` |
| Insira as informações complementares de pagamento para a impressão da NF | * antes de PDF | `nfForm.observacao` |
| Arquivo NF | * | `arqNf` (.pdf/.xml/imagem) |
| Documentos junto da nota fiscal / Arquivos da aquisição do bem | — | tipo `aquisicao_bem` |

Botões: Anexar NF · Encerrar processo (com NF anexada) · Visualizar · Baixar NF · Excluir arquivo · Excluir (documento extra)

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
| Excluir rascunho | `pedido.pode_excluir` |
| Reprovar / Cancelar | não terminal (motivo via prompt) |
| Voltar | sempre |
| Liberar escolha (banner) | quando aplicável → `comprasLiberarEscolha` |

#### Modal e-mail

Títulos: Revisar pedido de cotação · Revisar pedido de compra · Revisar reenvio ao fornecedor  
(`ModalRevisarEmailCompras.jsx`) — corpo editável; Cancelar / confirmar envio.

---

## 1.5 Fila assinatura sede — `/compras/aguardando-assinatura`

**Arquivo:** `carecore-front/src/ComprasAguardandoAssinatura.jsx`  
**Rota protegida:** `PERFIS_ADM_COMPRAS_SEDE` + Manutenção

### Função

Fila de pedidos de cotação do projeto em `aguardando_aprovacao_sede`: escolher vencedor, cadastrar PDF de assinatura, posicionar e assinar.

### Campos / uploads

| Rótulo | Obrig. | Ligação |
| --- | --- | --- |
| Cadastrar PDF da assinatura / Substituir PDF | * para assinar | `comprasUploadAssinaturaDigital` |

### Botões

Atualizar · Escolher · Revogar · Abrir pedido · Posicionar e assinar / Assinando… · links Orçamento:/Assinado: · Ver itens e timeline

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

Botões: Fechar · Cancelar · Incluir bem / Salvar alterações

---

## 1.11 Economia das cotações (sede)

**Arquivo:** `Compras.jsx` (aba economia)  
Colunas: Unidade / Sede · Competência · Tipo · Valor escolhida

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

Bipar QR (câmera/leitor USB) ou informar chave; validação SEFAZ; só cupom sem CPF do consumidor.

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
