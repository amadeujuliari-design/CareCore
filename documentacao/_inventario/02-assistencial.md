# Inventário assistencial — CareCore+ (frontend)

Inventário minucioso das telas assistenciais a partir do JSX em `carecore-front/src`. Rótulos copiados do código (não inventados). Campos marcados com `*` no UI ou com `required` / `obrigatorio: true` constam como **obrigatório**.

**Rotas:** `carecore-front/src/routes/AppRouter.jsx`  
**Menu lateral:** `carecore-front/src/Sidebar.jsx`

---

## Destaque — projeto sem pernoite (Casa Porto)

Regra de detecção: nome do projeto contém `"casa porto"` (normalizado, sem acento).

Origens:

- `projetoOcultaAcomodacoes` / `aplicarPresetCasaPorto` — `carecore-front/src/config/configOperacionalDefaults.js`
- Ocultação de menu — `carecore-front/src/Sidebar.jsx`
- Carteirinha sem acomodação — `carecore-front/src/utils/carteirinhaDados.js` (`carteirinhaOcultaAcomodacao`)
- Campos de leito no prontuário — `carecore-front/src/components/conviventes/ProntuarioPessoais.jsx`

### O que muda na Casa Porto

| Item | Comportamento atual |
| --- | --- |
| Menu **Acomodações** (`/quartos`) | Oculto |
| Menu **Pertences Recolhidos** (`/rotina/pertences-recolhidos`) | Oculto |
| Menu **Lavanderia** (`/rotina/lavanderia` — controle de peças) | Oculto (`lavanderia_pecas: false`) |
| Lavanderia na **Rotina Diária** | Continua como interação simples rótulo **Lavanderia** (uso/bip, não tela de peças) |
| Prontuário — **Alocação de Quarto / Cama** | Não renderizado |
| Carteirinha — bloco **Acomodação Atual** | Não exibido |
| Refeições preset | **Café da manhã**, **Almoço**, **Lanche da tarde** (sem jantar/lanche noturno do padrão SIAT) |
| Interações preset | **Banho**, **Lavanderia**, **Documentos guardados**, **Documentos retirados** |

### Aviso de saída às 16h (NÃO é tela de configuração)

Não existe tela para configurar horário de saída automática. O código atual da Casa Porto avisa às **16h**:

- Banner na Rotina Diária: *“convivente(s) ainda constam dentro da Casa Porto Seguro depois das 16h.”* — `RotinaDiaria.jsx`
- Alerta global: *“ainda dentro da Casa Porto Seguro depois das 16h. Registre a saída.”* — `components/AlertaPresencaOperacional.jsx`

### Retrato diário 22:40 — Dashboard Operacional

Na rota `/rotina/dashboard`, bloco **Histórico — retrato 22:40 (São Paulo)**: um retrato por projeto/dia, com totais de dentro/fora e interações. Subtítulo da página: *“Estado ao vivo e retratos diários às 22:40 (São Paulo)…”* — `DashboardOperacional.jsx`.

---

## 1. Conviventes — lista e prontuário

### 1.1 Lista de conviventes

| | |
| --- | --- |
| **Rota** | `/conviventes` |
| **Menu** | Conviventes → Cadastro |
| **Arquivos** | `Conviventes.jsx`, `components/conviventes/ConviventesLista.jsx` |
| **Função** | Listar população acolhida; abrir novo acolhimento ou editar prontuário |

**Cabeçalho:** título **Módulo de Prontuários** · subtítulo **Cadastro, acompanhamento técnico, documentos e histórico da população acolhida.**

**Filtros / campos (ordem visual):**

| Rótulo | Obrig. | O que informar | Ligação |
| --- | --- | --- | --- |
| Pesquisar acolhido | não | texto (placeholder: *Pesquise por prontuário, nome, CPF ou família (F001)...*) | convivente |
| Status | não | Todos / Apenas Ativos / Em acolhimento / Ausência justificada / Inativos / saídas / Saída qualificada / Inativado / Bloqueado | convivente.status |
| Acomodação | não | Todos / Com Cama (Fixo/Trans.) / Sem Cama (Centro Dia) | leito |

**Botões:** **+ Novo Acolhimento** · **Abrir** / edição na linha · paginação Anterior/Próxima.

---

### 1.2 Prontuário — cabeçalho e abas

| | |
| --- | --- |
| **Rota** | `/conviventes` (formulário no mesmo módulo; sem rota por aba) |
| **Arquivo** | `components/conviventes/ProntuarioCabecalho.jsx` |

**Títulos:** **Prontuário institucional** · **Ficha de admissão institucional**

**Abas (rótulos exatos, ordem UI):**

1. **Pessoais e status**
2. **Histórico**
3. **Assistência social**
4. **PIA** (se perfil pode gerenciar PIA ou somente leitura)
5. **Fluxo Diário**
6. **Saúde** (oculto para Orientador)
7. **Dados sensíveis** (oculto para Orientador)
8. **Anexos, GED e Cofre**

**Botões do cabeçalho:** **Imprimir ID de acesso** · **Imprimir ficha completa** · **Excluir sem vínculos** (condicional) · **Fechar**

**Rodapé do form:** **Salvar prontuário** / **Atualizar prontuário** / **Salvando...** — `Conviventes.jsx`

---

### 1.3 Aba Pessoais e status

**Arquivo:** `components/conviventes/ProntuarioPessoais.jsx` (+ `ProntuarioFamilia.jsx`)

**Campos (ordem visual):**

| Rótulo | Obrig. | O que informar | Ligação |
| --- | --- | --- | --- |
| (foto) | — | preview; botões **Remover** / **+** (vai para anexos) | documentos |
| Carteirinhas impressas (oficial) | — | somente leitura (contagem) | carteirinha |
| Nome Civil Completo * | sim | texto | convivente |
| Nome Social | não | texto | convivente |
| Técnico de Referência | não | select (*Não Definido (Atendimento Geral)* + técnicos) | usuário |
| Vínculo familiar | não | só no Reencontro Pari. *Sem vínculo*, *Nova família (Fxxx)* ou busca por código/nome. O código é do sistema. Salvar grava o vínculo; no acolhimento seguinte, o mesmo código liga os outros integrantes | família do convivente |
| Trabalho / ocupação | não | só no Reencontro Pari. Ofício, escala (segunda a sexta, 6x1, 12x36 e demais), dias da semana e hora de início e fim da jornada | convivente |
| Parcerias | não | só no Reencontro Pari. Texto livre | convivente |
| Informações escolares | não | só no Reencontro Pari. Etapa (creche ao ensino médio, EJA, curso, concluído), turno e hora de início e fim. Curso abre texto do nome | convivente |
| Avisos/Alertas | não | só no Reencontro Pari. Texto livre para aviso da lista (não está na lista, advertência, SISA). Edita quem já tem e inclui em acolhimento novo. Apague e salve para remover. O ícone da lista mostra junto com trabalho, parcerias e escola | convivente |
| Observação operacional | não | nos outros projetos, textarea do aviso da lista | convivente |
| Situação no Abrigo * | sim | Ativo (Presente) / Em acolhimento / Ausência justificada / Inativado (Evadiu/Alta) / Saída qualificada / Bloqueado (Suspensão) | convivente.status |
| Data de cadastro no sistema * | sim | date (somente leitura após criar) | convivente |
| Origem / Encaminhado por | não | select origens + **Outros** | cadastro origens / PIA |
| Informe origem / encaminhamento | cond. | se Outros | — |
| Motivo Principal * | cond. | se status mudou (exceto Bloqueado) | — |
| Relato Detalhado * | cond. | textarea | — |
| **Histórico institucional** | | | |
| Data da primeira vinculação no projeto | não | date | presença/ausência |
| Data de inativação | não | date | status |
| Data de nova vinculação | não | date | reativação |
| Inativações no histórico | — | chips somente leitura | — |
| Prontuário da saúde | não | texto | saúde externa |
| Referência CAPS | não | texto | CAPS |
| Convivente preferencial (destaque dourado na carteirinha) | não | checkbox | carteirinha |
| CPF | não | máscara | convivente |
| RG | não | texto | convivente |
| Nascimento | não | date (+ idade calculada) | convivente |
| Estado Civil | não | Solteiro(a)… União Estável | convivente |
| Telefone / Celular | não | telefone | convivente |
| **Remanejamento TB (acomodação)** | | | (só se acomodações ativas) |
| Situação TB | não | Sem remanejamento TB / TB Suspeita / TB Confirmado | leito / modalidade quarto |
| Reservar leito fixo anterior | cond. | checkbox | leito |
| Alocação de Quarto / Cama (ou Alocação no quarto TB) | não | select leitos; opção *Apenas Convivência Diurna (Sem Pernoite)* | leito / quarto |
| **Exceção de horário na portaria** | | | |
| Motivo | não | select motivos | portaria |
| Saída até | cond. | time | portaria |
| Entrada até | cond. | time | portaria |
| **Endereço** | | | |
| CEP, Rua / Logradouro, Número, Complemento, Bairro, Cidade, UF | não | endereço | convivente |
| Nome da Mãe | não | texto | convivente |
| Nome do Pai | não | texto | convivente |

**Bloco Relação familiar e referências** (`ProntuarioFamilia.jsx`):

| Rótulo | Obrig. | O que informar |
| --- | --- | --- |
| Raça/cor | não | IBGE |
| Natural de: | não | UF + Cidade |
| Orientação sexual | não | select |
| Identidade de gênero | não | select |
| Possui religião? | não | Sim/Não |
| Qual religião? | cond. | texto |
| Situação familiar afetivo-social (PIA) | não | radios (rótulos PIA) |
| Familiares: Parentesco, Nome, Idade, telefone, endereço | não | lista (+ **+ Adicionar** / **Remover**) |

---

### 1.4 Aba Histórico

**Arquivos:** `ProntuarioHistorico.jsx`, `ProntuarioAcompanhamentos.jsx`

#### 1.4.1 Acompanhamentos técnicos (leitura no prontuário)

Seções: **Transferências e saídas** · **Discussões hospitalares** · **Tuberculose (TB)** · **POT** · **Suspensão provisória**  
Botão: **Atualizar** · **Carregar mais** por seção. Cadastro/edição fica nas rotas `/conviventes/acompanhamentos/...`.

#### 1.4.2 Histórico técnico do convivente

| Rótulo | Obrig. | O que informar |
| --- | --- | --- |
| Origem da informação * | sim | texto |
| Data de origem * | sim | date |
| Título | não | texto |
| Informação histórica * | sim | textarea |

**Filtros** (`ProntuarioFiltrosLista.jsx`): **Data inicial**, **Data final**, **Busca** · botões **Período padrão**, **Aplicar filtros**.

#### 1.4.3 Ocorrências e pareceres

Filtros iguais (Data inicial/final, Busca) + lista de ocorrências do convivente.

---

### 1.5 Aba Assistência social

**Arquivo:** `ProntuarioSocial.jsx`

| Seção / rótulo | Obrig. | Notas / ligação |
| --- | --- | --- |
| **Cadastro social (NIS / SISA / CadÚnico)** | | |
| Número NIS | não | |
| Número SISA | não | SISA |
| Status CadÚnico | não | Atualizado / Desatualizado / Não Possui |
| **Situação escolar (PIA seção 3)** | | |
| Alfabetizado? / Interesse em EJA? / Estuda atualmente? | não | Sim/Não |
| Curso atual | não | |
| Ensino Fundamental/Médio/Superior | não | Concluído / Incompleto + série/período |
| **Trabalho e benefícios (PIA seção 4)** | | |
| Profissão | não | |
| Situações de trabalho (checkboxes) | não | lista PIA |
| Já participou de curso? / Tem certificados? / Pretende fazer curso? | não | + textareas condicionais |
| Benefícios: Bolsa Família, Aposentadoria, BPC (+ valor R$), Bilhete Único Especial, TOP Especial, Passe Livre, Outro(s) | não | |
| Possui Renda Fixa/Mensal? / Valor da Renda (R$) | não | |
| **Documentação civil (PIA seção 5)** | | Tipo / Número / Orientações · **+ Adicionar documento** |
| **Vida na rua / trajetória (PIA seção 7)** | | |
| Em situação de via pública desde | não | |
| Relato (como veio parar na rua) | não | |
| Centros / projetos anteriores | não | select equipamentos + Outros |

---

### 1.6 Aba Saúde

**Arquivo:** `ProntuarioSaude.jsx`

| Rótulo | Obrig. |
| --- | --- |
| Contato de Emergência (Nome) | não |
| Telefone de Emergência | não |
| Histórico de doença na família? / Qual? | não |
| Problema de saúde atual? / Qual? | não |
| Possui laudo médico? / CID | não |
| Trata em outro equipamento? / Onde? | não |
| Observações médicas gerais | não |
| Medicamentos: Medicamento, Há quanto tempo, Como utiliza | não · **+ Adicionar** |
| Internações: Onde, Período, Quem encaminhou | não · **+ Adicionar** |
| Substâncias: Substância, Desde quando, Quantidade | não · **+ Adicionar substância** |

---

### 1.7 Aba Dados sensíveis

**Arquivo:** `ProntuarioSensiveis.jsx`

| Rótulo / controle | Obrig. | Botões |
| --- | --- | --- |
| É Egresso Prisional? (+ Artigo / motivo, Ano) | não | |
| Usa Tornozeleira Eletrônica? | não | |
| Tem mandado de prisão? | não | **Consultar BNMP** |
| Pendência no Judiciário? / Qual? | não | |
| Pendência no Eleitoral? / Qual? | não | |
| Referência CAPS | não | |
| Acompanhamento CAPS | não | |
| Medidas Protetivas | não | |
| Uso de Substâncias Psicoativas | não | |
| Transtornos Mentais | não | |
| Comprovante da consulta BNMP (PDF) | não | **Baixar PDF** · **Remover PDF** · upload PDF |

---

### 1.8 Aba Anexos, GED e Cofre

**Arquivo:** `ProntuarioDocumentos.jsx`

**Cofre de senhas:** E-mail Pessoal · Senha E-mail (**Mostrar**/**Ocultar**) · Senha GOV.BR (**Mostrar**/**Ocultar**)

**Novo Documento ou Foto:**

| Controle | Obrig. |
| --- | --- |
| Selecione o tipo do documento | implícito no upload | opções: Foto de Perfil, RG / CPF, CadÚnico, Consulta BNMP, Termo do bagageiro, Saúde sensível, Jurídico / sigiloso, Outros |
| Documento sensível/restrito | não | checkbox |
| Arquivo / câmera | sim para upload | **Abrir câmera** / **Tirar foto (webcam)** · **Fazer upload** |

**Lista:** Arquivos do Acolhido · **Baixar** · **Excluir** · **Carregar mais documentos**

---

### 1.9 Aba PIA

**Arquivo:** `ProntuarioPia.jsx`

| Rótulo / campo | Obrig. | Botões |
| --- | --- | --- |
| Data de início do PIA | não | |
| Está em São Paulo desde | não | |
| | | **Imprimir formulário (manual)** · **Imprimir formulário (completo)** |
| Título do PIA principal / Subtítulo/tema da evolução | subtítulo obrig. na evolução (modal) | |
| Descrição / Objetivos/metas / Encaminhamentos | não | placeholders |
| Projeto de vida: Expectativas… · Destinos (SIAT III / Hotel Social / República, Moradia Autônoma, Retorno Familiar) · Explicação · Dificuldades | não | |
| Status do registro | não | Em acompanhamento / Pendente / Concluído / Revisar |

**Botões:** **Evoluir PIA atual** · **Abrir novo PIA principal** · **Criar PIA principal** / **Salvar evolução** / **Salvar alterações** · **Cancelar edição** · **Imprimir evolução do PIA** · **Atualizar** · **Editar** · **Evoluir este PIA** · **Excluir** (evolução)

Modal: **Subtítulo obrigatório** · **OK, vou preencher**

---

### 1.10 Aba Fluxo Diário

**Arquivo:** `ProntuarioFluxo.jsx`

Filtros: **Data inicial**, **Data final**, **Tipo de registro**, **Busca** · **Período padrão** · **Aplicar filtros** · **Carregar mais**. Lista de movimentos da rotina do convivente.

---

### 1.11 Modal carteirinha (ID de acesso)

| | |
| --- | --- |
| **Arquivos** | `ModalCarteirinha.jsx`, `CarteirinhaCard.jsx` |
| **Função** | Preview e impressão do crachá/ID |

**Dados exibidos (rótulos no card):** PRONT · SISA · CPF · ENTRADA · TÉCNICO · **Acomodação Atual** / Tipo (oculto na Casa Porto) · badges Provisória / Preferencial  
**Botões:** **Cancelar** · **Imprimir RG**

---

## 2. Acompanhamentos (módulo dedicado)

Rotas sob `/conviventes/acompanhamentos/:slug` — `AcompanhamentoModulo.jsx` + `config/acompanhamentosConfig.js`.  
Perfis: Gestor, Técnico, Global.

Filtros comuns da lista: **Data início**, **Data fim**, busca convivente, filtros extras do módulo, **Incluir evoluções** (relatório).  
Botões típicos: novo registro · **Evoluções** · **Editar** · **Excluir** · imprimir/exportar.

### 2.1 Encaminhamentos, saídas e ações — `/conviventes/acompanhamentos/transferencias`

| Campo | Obrig. | Ligação |
| --- | --- | --- |
| (seleção de convivente) | sim | convivente |
| Tipo de ação | sim | destinos transferência |
| Especificar ação | se Outros | |
| Data da discussão | não | |
| Data da visita/saída (portão) | não | |
| Data da transferência/efetivação | não | |
| Observações | não | |

Filtro extra: **Tipo de ação**.

### 2.2 Discussões hospitalares — `/conviventes/acompanhamentos/discussoes-hospitalares`

| Campo | Obrig. |
| --- | --- |
| Hospital (SUS São Paulo) | sim |
| Nome do hospital | se Outros |
| Data da discussão | não |
| Previsão de entrada | não |
| Observações | não |

Modal evoluções: status Internado / Alta / Encerrado (+ data e observações) — `DiscussaoEvolucoesModal.jsx`.

### 2.3 Tuberculose (TB) — `/conviventes/acompanhamentos/tuberculose`

| Campo | Obrig. |
| --- | --- |
| Situação | não (Suspeita, Confirmado, Em tratamento, Alta) |
| Data de início / Data de alta/fim | não |
| Observações | não |

### 2.4 POT — `/conviventes/acompanhamentos/pot`

| Campo | Obrig. |
| --- | --- |
| Data de inserção | não |
| Atividade | não |
| Local | não (POT I, POT II, POT Glicério, Reviravolta, Trabalho Formal/Informal) |
| Indicação | não |
| Data de desligamento | não |
| Congelamento ativo / Início / Fim | não |
| Observações | não |

Filtros: Status do convivente, Local, Técnico de referência, Situação do POT.  
Modal **Evoluções do POT**: status Em participação / Congelamento / Desligado / Encerrado.

### 2.5 Suspensão provisória — `/conviventes/acompanhamentos/suspensoes`

| Campo | Obrig. | Ligação |
| --- | --- | --- |
| Mês de referência | sim | |
| Data do registro | sim | |
| Motivo (obrigatório) | sim | atualiza status do convivente |
| Observações | não | |

### 2.6 Resumo mensal — `/conviventes/acompanhamentos/resumo-mensal`

**Arquivo:** `AcompanhamentoResumoMensal.jsx`  
Título **Resumo mensal**. Campos: **Mês de referência**, **Data inicial**, **Data final** (opcional). Totais para relatório técnico.

---

## 3. Acomodações / quartos

| | |
| --- | --- |
| **Rota** | `/quartos` |
| **Menu** | Acomodações |
| **Arquivo** | `Quartos.jsx` |
| **Função** | Configurar quartos/leitos e mapa de ocupação |
| **Casa Porto** | Menu oculto |

**Campos do formulário de quarto:**

| Rótulo | Obrig. | Opções / ligação |
| --- | --- | --- |
| Nome ou Número de Identificação * | sim | |
| Público Alvo | não | Masculino / Feminino / Misto / Famílias |
| Modalidade de Vaga | não | Fixo (Pernoite Regular) / Transitório / TB Suspeita / TB Confirmado |
| Quarto rotativo (carteirinha provisória por 7 dias ao alocar leito) | não | checkbox → carteirinha |
| Camas deste Quarto (identificação) | — | **+ Adicionar Cama** |

**Botões:** **+ Novo Quarto** · **Editar** · **Excluir** · **Salvar estrutura** · clique no leito para alocar/desalocar convivente.

---

## 4. Ocorrências

| | |
| --- | --- |
| **Rota** | `/ocorrencias` |
| **Menu** | Comunicação → Ocorrências / Minhas Ocorrências |
| **Arquivo** | `CentralOcorrencias.jsx` |

**Filtros:** Data inicial, Data final, Buscar, Técnico responsável · **Período padrão (7 dias)** · **Buscar** · **Incluir texto original** (relatório).

**Novo chamado (campos na ordem UI):**

| Rótulo | Obrig. | Ligação |
| --- | --- | --- |
| 1. Selecione o Acolhido * | sim | convivente (+ ler carteirinha) |
| 2. Funcionário(s) envolvido(s) | não | usuário |
| Funcionário citado * | cond. | usuário |
| Assinatura digital do convivente * | cond. (termo) | convivente |
| Método de validação | — | |
| Tipo de Evento | não | |
| Título Resumido * | sim | |
| Relato Completo * | sim | |
| Prioridade * | sim | |
| Requer Atenção do Técnico? | não | técnico |
| Copiar equipe (@Menções) | não | usuário |
| Encerrar Chamado (Dar Parecer Técnico) | não | |

**Botões / ações:** abrir chamado · interações · baixa em lote · relatório · **Ler carteirinha** · **Usar este código**.

---

## 5. Avisos

| | |
| --- | --- |
| **Rota** | `/avisos` |
| **Arquivo** | `Avisos.jsx` |
| **Função** | Comunicação interna |

**Novo aviso:** Título · Mensagem · Classificação · Prioridade · Destino (**Enviar para todos** / **Usuários específicos**) · Destinatários · Válido até.

**Filtros ativos:** Início, Fim, Classificação, Prioridade, Buscar, Somente não lidos · **Aplicar filtros** · **Período padrão (7 dias)** · **Limpar**.

**Histórico:** Status, Classificação, Buscar, Início, Fim.

---

## 6. Rotina diária — Registro

| | |
| --- | --- |
| **Rota** | `/rotina` |
| **Menu** | Rotina Diária → Registro da Rotina |
| **Arquivo** | `RotinaDiaria.jsx` |
| **Título** | Controle de Fluxo Diário |

**Modos de bip automático:** **Entrada/Saída** · **Interação**  
**Ações por convivente:** **Entrada** · **Saída** · botões de refeição/interação configuráveis · lista **Últimas Leituras**.

**Campos / modais:**

| Rótulo | Obrig. | Uso |
| --- | --- | --- |
| Leitor de pistola ou digitação manual | — | prontuário/CPF/QR |
| Tipo de interação | sim (modo interação) | banho, lavanderia, bagageiro, docs… |
| Relato / observação | cond. | documentos, horário fora do padrão, movimento rápido |
| Confirmar refeição extra | — | modal |

**Casa Porto:** banner após 16h se houver conviventes dentro (texto fixo 16h — ver destaque no topo).

**Reencontro Pari:** sem botões de Entrada/Saída, sem status Dentro/Saiu e sem totais de presentes na unidade. Fica alimentação e as interações do projeto. O mesmo modelo de menu e rotina vale para **REENCONTRO ANHANGABAÚ**, **REENCONTRO CRUZEIRO DO SUL** e **REENCONTRO JABAQUARA**. Lavanderia OMO e kit do Cruzeiro do Sul têm regra própria (seções 7 e 7.1). O cadastro de cada projeto continua separado.

---

## 7. Lavanderia (peças)

| | |
| --- | --- |
| **Rota** | `/rotina/lavanderia` |
| **Arquivo** | `Lavanderia.jsx` |
| **Título** | Lavanderia |
| **Subtítulo** | Controle de peças deixadas para lavagem/secagem, prazo de 48h e retirada conferida. |
| **Casa Porto** | Menu oculto (módulo `lavanderia_pecas` false). Uso de lavanderia fica só na Rotina Diária. |
| **Reencontro Pari, Anhangabaú e Jabaquara** | A mesma rota abre a grade OMO: semana de horários de 1h30 para lavar e secar juntas, livre ou ocupado. Marcar pede OK. Mudar o horário é arrastando o nome para outro livre, com nova confirmação. Em horário ainda agendado, **Cancelar** na grade ou na lista de confirmados libera a vaga. Abaixo da grade: listas de confirmados e de realizados, com período, por página, botões para mostrar só uma delas, ordenação ao clicar na coluna, **Exportar** e **Imprimir**. Não usa controle de peças. |
| **Reencontro Cruzeiro do Sul** | Duas grades de 45 minutos, lavagem e secagem, das 7h às 12h e das 14h às 18h. O último início da manhã é 10h45 (termina 11h30) e o da tarde é 17h (termina 17h45). A pessoa marca a lavagem; a secagem entra no primeiro horário livre que começa quando essa lavagem acaba. Lavagem que termina 11h30 seca às 14h. Lavagem que termina 17h45 seca no dia seguinte às 7h. Arrastar a lavagem recalcula a secagem. Cancelar lavagem ou secagem cancela o par. |

**Registrar entrega:** Convivente · Peças · Observação  
**Retirada / cancelamento:** quantidade, observação, motivo  
**Filtros:** busca · status · **Filtrar** · **Padrão** · exportar/imprimir relatório.

---

## 7.1 Kit mensal de higiene (Reencontro Pari)

| | |
| --- | --- |
| **Rota** | `/rotina/kit-higiene` |
| **Arquivo** | `PariKitHigiene.jsx` |
| **Menu** | Kit de higiene, no Reencontro Pari e nos projetos do mesmo modelo (Anhangabaú, Cruzeiro do Sul e Jabaquara) |

**Retirada do kit:** primeiro bloco da tela. Busca por família ou pessoa, leitura de carteirinha ou prontuário. Cada pessoa da família tem nascimento, sexo e **Salvar idade**. **Registrar retirada** grava o kit do mês. A lista **Retiradas deste projeto** mostra as últimas famílias. A segunda retirada da mesma família no mês é recusada.

**Itens:** nome do que pode entrar no kit. A quantidade fica no perfil.  
**Perfis:** Bebê (0 a 1 ano, qualquer sexo), Criança (2 a 10 anos, qualquer sexo), Adolescente masculino e feminino (11 a 16 anos), Homem e Mulher (17 anos ou mais). Cada cartão lista os itens e a quantidade do mês. A faixa etária do tipo é salva em **Salvar idade**. Uma idade não pode caber em dois perfis de base.

**Cruzeiro do Sul:** o perfil de base continua um só por pessoa. Os complementos somam no kit e podem cruzar a mesma idade. A equipe cria outros complementos e define itens e quantidades. Os complementos iniciais são Fralda (até completar 3 anos), Sabonete infantil (até completar 2 anos) e Leite (dos 6 meses até completar 6 anos). Menstruação não usa idade: a flag **Já menstrua** no acolhido, com sexo feminino, inclui o absorvente. Salvar a idade do acolhido também grava essa flag.

Quem está sem data, sem sexo na faixa que separa masculino e feminino, ou sem perfil aparece em **Fora do kit** e bloqueia **Registrar retirada**.

---

## 8. Pertences recolhidos

| | |
| --- | --- |
| **Rota** | `/rotina/pertences-recolhidos` |
| **Arquivo** | `PertencesRecolhidos.jsx` |
| **Casa Porto** | Menu oculto |
| **Reencontro Pari** | Menu oculto. A rota volta para a Rotina Diária. |

**Campos:** Quarto · Itens recolhidos · Observação · (retirada) convivente + quantidade · baixa administrativa (destino/motivo).  
**Botões:** **Filtrar** · **Padrão** · **Confirmar retirada** · **Confirmar baixa** · **Baixa administrativa em lote** · seleção em lote.

---

## 9. Dashboard operacional

| | |
| --- | --- |
| **Rota** | `/rotina/dashboard` |
| **Arquivo** | `DashboardOperacional.jsx` |
| **Título** | Dashboard Operacional |

**Função:** estado ao vivo + histórico de **retratos 22:40 (São Paulo)**.

**Cards / listas:** Dentro do projeto · Fora do projeto · Entradas · Saídas · interações do dia · Sem interação 24h · Ausentes · abas de lista **Dentro do projeto** / **Fora do projeto** / **Sem interação 24h** / **Ausentes**.

**Reencontro Pari:** sem portaria. Os cards e o gráfico mostram **Ativos** e **Inativos** do cadastro (status Ativo e Inativado). Some Dentro/Fora, Entradas/Saídas e Ausentes. A lista fica em **Sem interação 24h**.

**Histórico retrato 22:40:** seleção de período · métricas no gráfico · clicar dia · **Imprimir retratos** · exportar · **Fechar retrato**.  
Retrato aberto mostra: Dentro/Fora · Entradas/Saídas · Ativos · Interações · Sem interação 24h · Ausentes · refeições · interações por tipo · aviso se há ajuste manual.

**Botão:** **Atualizar**.

---

## 10. Histórico da rotina

| | |
| --- | --- |
| **Rota** | `/rotina/historico` |
| **Arquivo** | `RotinaHistorico.jsx` |
| **Título** | Histórico Geral da Rotina |
| **Subtítulo** | Entradas, saídas, refeições, enxoval, bagagem, documentos e eventos de auditoria. |

**Reencontro Pari:** cards **Ativos** e **Inativos** no lugar de Entradas/Saídas. O filtro Tipo de registro lista só as interações do PARI. **Casa Porto:** o mesmo filtro usa as interações da Casa Porto (mantém Entrada e Saída). O SIAT continua com a lista completa.

**Filtros:** Busca · Data Inicial · Data Final · Tipo de registro · Por técnico · Status · Auditoria · **Limpar** · paginação.

**Modal editar:** Novo Tipo · Motivo da Edição · **Salvar**  
**Modal cancelar:** Motivo do Cancelamento · **Confirmar Cancelamento**

---

## 11. Ajustes de totais

| | |
| --- | --- |
| **Rota** | `/rotina/ajustes-totais` |
| **Arquivo** | `RotinaAjustesTotais.jsx` |
| **Perfis** | Gestor (menu); rota também Manutenção |
| **Função** | Complementar totais diários da rotina (ajuste manual no retrato/relatórios) |

**Campos:** **Dia a ajustar** · complementos por tipo de registro · **Justificativa do ajuste (mín. caracteres)** (mín. 30).  
Salva ajustes que entram na leitura do retrato 22:40.

**Reencontro Pari:** a tabela não lista Entrada/Saída nem interações de outro projeto. **Casa Porto:** lista Entrada/Saída e as interações da Casa Porto.

---

## 12. Atividades

### 12.1 Cadastro — `/atividades`

**Arquivo:** `AtividadesCadastro.jsx`  
Título **Atividades do projeto**.

**Lista:** filtro **Mês para gerar sessões** · **Nova atividade** · **Editar** · **Gerar sessões do mês** · **Excluir**.

**Modal Nova/Editar atividade:**

| Rótulo | Obrig. | Ligação |
| --- | --- | --- |
| Nome | sim (envio) | atividade |
| Máx. sessões/mês | não | |
| Vigência início / Vigência fim | não | |
| Categoria | não | |
| Frequência | não | |
| Responsável | não | usuário (*Sem responsável definido*) |
| Dias da semana (botões) | cond. | |
| Somente dias úteis (segunda a sexta) | não | |
| Atividade ativa | não | |
| Esta atividade pontua para brindes | não | pontos |

### 12.2 Chamada de presença — `/atividades/chamada`

**Arquivo:** `AtividadesChamada.jsx`

Seletores: atividade · mês · sessão.  
Busca: *Buscar convivente elegível...*  
Botões: **Ler carteirinha** · **Marcar presente** · **Desfazer** · **Encerrar sessão** / **Reabrir sessão**.

### 12.3 Grade mensal — `/atividades/grade`

**Arquivo:** `AtividadesGrade.jsx`  
Seletores atividade + mês · células presença · exportação. Subtítulo: só conviventes com ≥1 presença no mês.

### 12.4 Conteúdo das sessões — `/atividades/conteudo`

**Arquivo:** `AtividadesConteudo.jsx`  
Campo **Ações realizadas** (textarea). Salvar por sessão.

### 12.5 Relatórios — `/atividades/relatorios`

**Arquivo:** `AtividadesRelatorios.jsx`  
Filtros: **Início**, **Fim**, **Agrupamento**, **Atividade**, **Responsável**.

### 12.6 Conferência SISA — `/atividades/conferencia-sisa`

**Arquivo:** `AtividadesConferenciaSisa.jsx`  
Importar planilha SISA · comparar presenças CareCore+ · **Mostrar só sem vínculo** · vincular **Atividade CareCore+** · salvar/reprocessar conferência.

### 12.7 Pontos e brindes — `/atividades/pontos-brindes`

**Arquivo:** `AtividadesPontosBrindes.jsx`  
**Resgate de brinde:** Pontos a utilizar · Descrição do brinde (opcional) · confirmação com carteirinha (*Código da carteirinha*). Ranking e últimos resgates.

---

## 13. Convênio / SISA

| | |
| --- | --- |
| **Rota** | `/convenio-sisa` |
| **Arquivo** | `ConvenioSisa.jsx` |
| **Título** | Convênio / SISA |
| **Menu** | ocultável se módulo `sisa` desativado na config |

**Abas:** Relatório de presenças · Importações SISA.

**Filtros/campos:** Data inicial · Data final · Tipo / presença · Planilha exportada do SISA · conviventes SISA na prévia.

**Botões:** **Atualizar período** · **Hoje** · **Ontem** · **Este mês** · **Mês anterior** · **Atualizar histórico** · **Fechar mês** · **Reabrir mês** · observações do fechamento.

**Reencontro Pari:** o relatório não mostra Entradas, Saídas nem Ausentes (saída de ontem). Saída qualificada do cadastro continua nos outros módulos.

---

## 14. Relatórios

### 14.1 Central de relatórios — `/relatorios`

**Arquivo:** `Relatorios.jsx` + `utils/relatoriosUtils.js` (`ABAS_RELATORIOS`)

**Abas:** Conviventes · Rotina · Ocorrências · PIA · Acomodações · Documentação · Carteirinhas · Equipe · Auditoria · Evolução · Personalização.

Filtros comuns por aba (período, status, técnico, busca, prioridade de ocorrência etc.).  
Ações: imprimir · exportar · link para **Configuração operacional** (`/relatorios/config-operacional`).  
Aba **Evolução**: cards Atendimentos, Média diária, Pendências técnicas, Novos acolhimentos · opção **Incluir gráficos no relatório?**

**Reencontro Pari:** a aba Rotina e o gráfico de fluxo mostram **Ativos** e **Inativos** do cadastro no lugar de Entradas e Saídas.

### 14.2 Cadastros novos — `/relatorios/cadastros-novos`

**Arquivo:** `RelatorioCadastrosNovos.jsx`  
Critério (novas inclusões / vinculações) · status · **Data inicial** · **Data final** · **Técnico** · **Busca**.

### 14.3 Presença e ausência — `/relatorios/presenca-ausencia`

**Arquivo:** `RelatorioPresencaAusencia.jsx`  
**Data inicial** · **Data final** · **Técnico** · **Busca** (Nome, prontuário ou SISA) · filtro de situação.

### 14.4 Configuração operacional — `/relatorios/config-operacional`

**Arquivo:** `RelatoriosConfigOperacional.jsx`  
**Não** é tela de horário de saída automática Casa Porto.

**Abas:**

1. **Refeições** — toggle refeições · Nome / Início / Fim / Ativo · **Adicionar item**
2. **Portaria e Rotina** — **Saída padrão até** · **Entrada padrão até** · **Entrada após pernoite fora** · **Movimento após pernoite dentro** · mín. caracteres justificativa · interações (Nome exibido, Identificador interno, Comportamento, Ativo, tipos retirada/entrega)
3. **Módulos** (rótulos UI): TB (indicador legado) · Convênio / SISA · POT · Discussões hospitalares · Suspensões provisórias · Encaminhamentos e transferências · Acompanhamento tuberculose · Histórico legado  
   *(acomodações / pertences / lavanderia_pecas existem no preset Casa Porto no código, mas não como toggles nesta lista de rótulos)*
4. **Documentos** — termos (compromisso, LGPD, bagageiro) editáveis

---

## 15. Histórico legado

Feature `historicoLegado` / módulo `historico_legado`.

### 15.1 Ocorrências/Rotina e Rotina Legada — `/historico-legado` e `/historico-legado/rotina`

**Arquivo:** `HistoricoLegado.jsx`  
Título **Histórico Legado SIAT**.

**Validação / registro:** Convivente * · Origem da informação * · Data de origem * · Título · Histórico *  
Filtros de busca e paginação.

### 15.2 Presenças legado — `/historico-legado/rotina/presencas`

**Arquivo:** `components/historico-legado/RelatorioPresencaLegado.jsx`  
Título **Presenças no legado**. Filtros: Data inicial · Data final · Busca (Nome, SISA ou prontuário). Matriz só com dias que têm registro (não calcula ausências).

---

## Mapa rápido rota → arquivo principal

| Rota | Arquivo |
| --- | --- |
| `/conviventes` | `Conviventes.jsx` + `components/conviventes/*` |
| `/conviventes/acompanhamentos/:slug` | `AcompanhamentoModulo.jsx` |
| `/conviventes/acompanhamentos/resumo-mensal` | `AcompanhamentoResumoMensal.jsx` |
| `/quartos` | `Quartos.jsx` |
| `/ocorrencias` | `CentralOcorrencias.jsx` |
| `/avisos` | `Avisos.jsx` |
| `/rotina` | `RotinaDiaria.jsx` |
| `/rotina/lavanderia` | `Lavanderia.jsx` |
| `/rotina/kit-higiene` | `PariKitHigiene.jsx` |
| `/rotina/pertences-recolhidos` | `PertencesRecolhidos.jsx` |
| `/rotina/dashboard` | `DashboardOperacional.jsx` |
| `/rotina/historico` | `RotinaHistorico.jsx` |
| `/rotina/ajustes-totais` | `RotinaAjustesTotais.jsx` |
| `/atividades` | `AtividadesCadastro.jsx` |
| `/atividades/chamada` | `AtividadesChamada.jsx` |
| `/atividades/grade` | `AtividadesGrade.jsx` |
| `/atividades/conteudo` | `AtividadesConteudo.jsx` |
| `/atividades/relatorios` | `AtividadesRelatorios.jsx` |
| `/atividades/conferencia-sisa` | `AtividadesConferenciaSisa.jsx` |
| `/atividades/pontos-brindes` | `AtividadesPontosBrindes.jsx` |
| `/convenio-sisa` | `ConvenioSisa.jsx` |
| `/relatorios` | `Relatorios.jsx` |
| `/relatorios/cadastros-novos` | `RelatorioCadastrosNovos.jsx` |
| `/relatorios/presenca-ausencia` | `RelatorioPresencaAusencia.jsx` |
| `/relatorios/config-operacional` | `RelatoriosConfigOperacional.jsx` |
| `/historico-legado` · `/historico-legado/rotina` | `HistoricoLegado.jsx` |
| `/historico-legado/rotina/presencas` | `components/historico-legado/RelatorioPresencaLegado.jsx` |

---

*Gerado por leitura do JSX em `carecore-front/src`. Não documenta tela inexistente de configuração de saída automática.*
