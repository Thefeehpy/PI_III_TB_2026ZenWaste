# Finalização de fretes — integração, arquitetura e validação

Referência: 08/11/2026, America/Sao_Paulo. Branch: `backend-pg`.

## 1. Resultado e alcance

A rota `/dashboard/freight-audit` utiliza a API Django real. Foram conectadas
consultas, criação de remessas vinculadas e avulsas, classificação, cotações,
aprovação, CT-e e correções, aceite de divergências, retirada, recebimento com
assinatura, cancelamento, tratativas e demandas internas. A apresentação mantém
os componentes, cores e linguagem visual existentes.

Os resultados atuais são **149 testes backend, 75 testes Vitest, 31 testes de
regressão de navegador e 7 cenários E2E reais aprovados**. TypeScript passou nas
duas configurações; ESLint terminou sem erros; o build de produção foi gerado.
Os 148 testes informados na etapa anterior são evidência histórica, distinta
da execução atual de 149 testes.

Integração HTTP real não significa emissão fiscal, contratação de transporte ou
pagamento bancário real. Os limites externos estão na seção 11.

## 2. Inspeção e preservação do trabalho anterior

- Raiz identificada: `zenwaste_codigo`; branch inicial e final: `backend-pg`.
- Base inicial: `8f17981`; anteriores `57ef080` e `bda3e67`.
- `origin`: `https://github.com/Thefeehpy/PI_III_TB_2026ZenWaste.git`.
- O fetch inicial encontrou a branch local sincronizada com `origin/backend-pg`.
- Havia alterações locais de modelagem/API de fretes e documentação, além de
  `BackEnd/pedidos/README.md`. O trabalho relacionado a fretes foi preservado e
  incluído no escopo; o README de pedidos permaneceu fora dos commits.
- Nenhum ambiente virtual, `.env`, resultado temporário ou credencial foi
  selecionado para versionamento. Não foram usados reset destrutivo, clean ou
  force push. Não houve alteração de remote ou criação de branch alternativa.
- `showmigrations fretes` encontrou **0001 e 0002 já aplicadas** no PostgreSQL
  principal. Esta tarefa não aplicou migrations nesse banco. A anotação anterior
  de 0002 pendente pertence à etapa anterior do desenvolvimento.

## 3. Diagnóstico e melhorias arquiteturais

O diagnóstico anterior à implementação identificou os seguintes problemas
diretamente ligados à entrega de fretes. A revisão preservou os serviços de
pedidos, estoque, comercialização, empresas e autenticação que já atendiam aos
contratos; esses módulos foram abrangidos pela regressão backend.

| Problema anterior e arquivos | Solução aplicada | Princípio/padrão e benefício | Risco e verificação |
| --- | --- | --- | --- |
| `FreightAudit.tsx` montava `AuditoriaFretes`, com fonte demonstrativa. | Montagem de `AuditoriaIntegrada` usando o serviço HTTP existente. | Composição e Adapter; apresentação conectada à fonte persistente. | Diferenças de contrato/estado: cobertas pelos sete E2E reais e TypeScript. |
| O componente de indicadores dependia do tipo de retorno do hook demonstrativo. | Contrato local restrito aos quatro indicadores; rótulo de concluídos configurável. | ISP; componente compartilhável sem conhecer formulários ou serviço demonstrativo. | Indicador global não significa entregues no mês: rótulo atual é “Auditorias concluídas”. |
| Diretórios de empresas carregados junto à consulta principal dificultavam busca e paginação independentes. | `SeletorEmpresaFrete` com busca, página, cancelamento de consulta e tentativa explícita. | SRP/ISP; cada consulta tem seu ciclo e contrato. | Respostas antigas/indisponibilidade: AbortSignal, erro visível e E2E com empresas reais. |
| DTOs preparados não descreviam todas as versões e análises devolvidas pelo backend. | Tipos de documentos, divergências, permissões e recebimento ampliados; medidas ausentes admitem null. | DTO/Mapper; contrato compatível e exibição sem inventar medidas zero. | TypeScript e navegação de documentos/divergências no E2E. |
| Trocas de empresa e respostas atrasadas podiam disputar dados/execução. | Serviço capturado por sessão, guarda antes e depois do hash, sequências de consulta e trava de comandos por sessão. | SRP e isolamento de dependências; resposta antiga não ocupa o estado da empresa seguinte. | Testes específicos de resposta tardia, seleção e comandos durante troca de empresa. |
| Uma falha de recarga após sucesso podia ser confundida com falha da gravação. | Resultado confirmado preservado; erro de consulta independente do erro de comando. | Separação de responsabilidades e contrato de comando explícito. | Teste com gravação bem-sucedida seguida de leitura indisponível. |
| Diálogos demonstrativos não correspondiam a campos e permissões persistentes. | Diálogos integrados e controles reutilizáveis separados da consulta e do transporte HTTP. | SRP/composição; formulários coesos sem introduzir framework novo. | Validação HTML, mensagens da API, trava de envio e E2E. |
| CORS não autorizava `Idempotency-Key`; o navegador bloqueava POST. | Inclusão apenas desse cabeçalho nos defaults de `django-cors-headers`. | Adapter HTTP coerente com o contrato existente. | OPTIONS automatizado e todos os comandos E2E reais. |

### SOLID e padrões mantidos

- **S:** views recebem HTTP, serializers validam/produzem contratos, serviços
  coordenam transações e modelos/políticas expressam regras locais. No React,
  consulta, formulários, controles e apresentação possuem responsabilidades
  identificadas. Isso não exige decompor cada função simples em uma classe.
- **O:** o registro explícito `COMANDOS` associa contratos e operações, preservando
  uma fronteira única de autenticação/transação. A fábrica do serviço HTTP e os
  adaptadores existentes permitem substituição sem refazer a apresentação.
- **L:** nenhuma hierarquia nova foi criada. A herança de views/testes preserva os
  contratos do framework; os fluxos de frete usam composição e políticas simples.
- **I:** indicadores e seletor de empresas recebem contratos específicos. O
  serviço de fretes continua delimitado ao domínio; não foi criado um protocolo
  abrangendo pagamentos, estoque ou notificações sem uso real.
- **D:** a consulta aceita o serviço fornecido, permitindo testes controlados; o
  painel reutiliza o cliente HTTP compartilhado. Não foi introduzido container.

Foram mantidos **Service Layer**, políticas de domínio, **DTO/Mapper**, fábrica
do serviço HTTP e **Adapter** para o transporte. A unidade transacional é
`transaction.atomic()`. As estratégias de estoque e os adaptadores de pagamento
e IA existentes não precisaram ser alterados.

Não houve justificativa para duplicar o ORM com Repository, criar Unit of Work
próprio, substituir enumerações por uma hierarquia State ou usar signals como
gatilho de efeitos comerciais de frete. Não foram acrescentadas dependências de
execução, integrações externas ou migrations para traduções de nomenclatura.

## 4. Arquitetura consolidada

```text
FreightAudit -> AuditoriaIntegrada
  -> usePainelAuditoriaIntegrada: formulários e ações
  -> useConsultaAuditoriaApi: sessão, páginas, seleção, erros e trava
  -> criarServicoHttpAuditoriaFretes -> cliente HTTP compartilhado
  -> Bearer + Idempotency-Key + CORS
  -> views/serializers -> serviços transacionais -> PostgreSQL
  -> DTOs com permissões e visibilidade por participante
```

O código demonstrativo anterior permanece para seus testes isolados. A página
integrada não o utiliza como fonte nem como alternativa silenciosa à API.

### Modelos, serviços, views e serializers

- **Frete:** vínculo opcional ao Pedido, partes comerciais, transportadora,
  quantidade e unidade, medidas, modalidade e estado. Cancelamento exige
  justificativa/instante coerentes; políticas distinguem retirada, recebimento
  e conclusão da auditoria.
- **CotacaoFrete:** propostas persistentes; no máximo uma aprovada por frete.
- **DocumentoCTe:** versões imutáveis; correção cria documento posterior.
- **DivergenciaFrete:** snapshot de referência, cobrança e diferença; resolução
  por aceite ou CT-e corrigido, com autoria, instante e vínculo da correção.
- **ConfirmacaoEntrega:** registro único, assinatura PNG validada, recebedor
  declarado, empresa confirmadora e ressalva quando aplicável.
- **HistoricoFrete:** eventos e idempotência gravados junto à operação; contém
  tratativas. A imagem da assinatura não é devolvida no histórico/detalhe.
- **DemandaTransporte:** necessidade interna vinculada ao frete.
- **servicos.py:** criação e despacho dos dez comandos; validação de entrada,
  permissão, estado e persistência sob transação.
- **views.py:** autenticação explícita de empresa, consultas autorizadas,
  paginação, filtros, indicadores e adaptação de comandos/respostas.
- **serializers.py:** contratos de entrada restritos; saída de listas/detalhes,
  documentos e análises, permissões e ocultação financeira por participante.

## 5. Endpoints integrados

Base: `/api/fretes/`. A contagem de 17 considera método e caminho; GET e POST
da raiz são contratos distintos. A conferência ocorre no registro/correção do
CT-e; não foi inventada uma rota separada de conferência.

| Método | Caminho relativo | Uso na tela |
| --- | --- | --- |
| GET | `/` | Fretes, paginação, filtros e indicadores globais autorizados. |
| POST | `/` | Remessa de Pedido ou avulso. |
| GET | `/{id}/` | Resumo, documentos, análises, cotações, histórico e entrega. |
| POST | `/{id}/classificar/` | Cotar, contratado ou retirada pelo cliente. |
| POST | `/{id}/cotacoes/` | Registrar proposta para transportadora cadastrada. |
| POST | `/{id}/aprovar-cotacao/` | Definir proposta aprovada e referência. |
| POST | `/{id}/registrar-cte/` | Documento inicial ou correção, com conferência automática. |
| POST | `/{id}/resolver-divergencia/` | Aceite com justificativa. |
| POST | `/{id}/cancelar/` | Cancelar antes da retirada/recebimento. |
| POST | `/{id}/tratativas/` | Registrar observação interna. |
| POST | `/{id}/retirada/` | Registrar retirada e nome do arquivo de foto. |
| POST | `/{id}/confirmar-entrega/` | Recebimento pela compradora e assinatura. |
| POST | `/{id}/publicar-demanda/` | Registrar demanda interna. |
| GET | `/pedidos-disponiveis/` | Selecionar Pedido e saldo restante para remessas parciais. |
| GET | `/compradoras/` | Buscar e paginar destinatárias elegíveis. |
| GET | `/transportadoras/` | Buscar e paginar empresas transportadoras. |
| GET | `/demandas/` | Consultar demandas internas dos fretes permitidos. |

Filtros de fretes: busca, situação, transportadora e intervalo de `data_pedido`.
Tamanho padrão 10, máximo 100 no backend; a tela permite 5, 10 ou 20. Diretórios,
pedidos e demandas têm paginação própria. Indicadores abrangem os fretes
autorizados independentemente dos filtros e da página.

## 6. Regras de negócio e permissões

1. Uma remessa representa no máximo um Pedido; um Pedido admite várias remessas.
   A soma não cancelada não pode exceder a quantidade negociada. A unidade deve
   corresponder à negociada. Frete avulso não cria Pedido/Produto fictício.
2. Vendedora e compradora são empresas cadastradas distintas. A vendedora gerencia
   o frete; apenas a compradora confirma recebimento. Papéis globais não concedem
   acesso a fretes de terceiros.
3. Compradora e vendedora participantes podem consultar todas as cotações. A
   transportadora participante vê somente suas propostas. Para participante não
   selecionada, informações financeiras/documentais também são restringidas.
4. Cotação aprovada define referência. Contratado exige transportadora e valor
   informados, sem gerar uma cotação fictícia. Retirada pelo cliente dispensa
   cotação e CT-e no fluxo padrão confirmado pelo usuário.
5. Tolerância monetária absoluta: R$ 5,00, incluindo os limites. A diferença é
   `valor_cobrado - valor_referencia`, preservando sinal e valores originais.
6. CT-e corrigido preserva versões anteriores. Se ainda houver divergência, a
   análise anterior fica substituída e outra abre com a referência original.
   Aceite exige justificativa e não apaga a diferença factual.
7. Divergência aberta permite retirada e recebimento; impede a conclusão da
   auditoria. Após o recebimento, resolver a última pendência conclui a auditoria.
8. Cancelamento exige justificativa e só ocorre antes da retirada e do
   recebimento/conclusão. Não cancela a compra, não estorna pagamento e não
   movimenta estoque. A alocação da remessa cancelada deixa de consumir o limite.
9. Recebimento exige assinatura e, quando houver ressalva, seu texto. A assinatura
   é declaração registrada pela empresa autenticada, sem certificação individual.
10. Tratativas e demandas são registros internos; não enviam mensagens externas.

Não surgiu decisão de negócio adicional necessária para finalizar esses fluxos.

## 7. Persistência, idempotência e integridade

Os comandos usam `transaction.atomic()`, com ordem de bloqueio Empresa autora
(`NO KEY UPDATE`), Pedido quando houver e Frete. O serviço revalida permissões e
estado após o bloqueio. As restrições do PostgreSQL reforçam unicidade, vínculos
e coerência dos registros; `full_clean()` valida regras locais.

A chave idempotente tem escopo empresa autora + ação + chave. O resumo inclui
conteúdo normalizado e identificador do frete. Repetir o comando não repete
histórico, documento ou recebimento; conteúdo incompatível retorna 409. Uma falha
na persistência do histórico desfaz toda a operação, inclusive novos documentos,
análises e confirmações. Concorrência foi testada com conexões PostgreSQL reais.

O frontend agrupa comandos iguais em andamento e trava o envio simultâneo. A
mesma chave é reutilizada após falha de transporte/5xx; sucesso ou rejeição
definitiva permite uma nova tentativa com nova chave. Respostas de sessões e
seleções anteriores não substituem o estado atual. Campos sensíveis de assinatura
são limpos ao abrir outro frete e após a confirmação.

A baixa comercial existente continua no pagamento/finalização manual. Auditoria
não introduz outra baixa. No E2E foram comparados quantidade do Produto,
quantidade do Anúncio, situação do Pedido e situação da Reserva antes/depois,
além de se exigir ausência de nova MovimentacaoEstoque.

## 8. Arquivos criados e modificados

A relação inclui o trabalho relacionado de backend que já estava local no
início desta finalização e foi preservado para versionamento.

| Grupo | Criados | Modificados |
| --- | --- | --- |
| Backend de fretes | `BackEnd/fretes/dominio.py`, `servicos.py`, `views.py`, `urls.py`, `migrations/0002_resolucao_divergencia_cancelamento.py` | `BackEnd/fretes/models.py`, `permissoes.py`, `serializers.py` |
| Testes backend | `BackEnd/fretes/configuracao_testes.py`, `executar_testes_postgresql.py`, `test_modelagem.py`, `test_integracao.py` | O teste CORS foi acrescentado a `test_integracao.py` na etapa full-stack. |
| Roteamento/configuração | — | `BackEnd/app/urls.py`, `BackEnd/app/settings.py` (CORS). |
| Apresentação integrada | `src/features/auditoria-fretes/AuditoriaIntegrada.tsx`, `apresentacao-api.ts`, `components/ControlesAuditoriaIntegrada.tsx`, `components/DialogosAuditoriaIntegrada.tsx` | `src/pages/FreightAudit.tsx`, `components/IndicadoresFretes.tsx` dentro da feature. |
| Contratos e hooks | — | `src/features/auditoria-fretes/tipos-api.ts`, `servico-http-auditoria-fretes.ts`, `use-consulta-auditoria-api.ts`, `use-painel-auditoria-integrada.ts`. |
| Testes frontend | `src/test/fixtures/fretes.ts`, `src/features/auditoria-fretes/servico-http-auditoria-fretes.test.ts`, `use-consulta-auditoria-api.test.tsx` | `tests/frontend/integracoes.spec.ts` (substituição do cenário obsoleto demonstrativo). |
| E2E real | `BackEnd/fretes/executar_e2e.py`, `servidor_e2e.py`, `playwright.fretes.config.ts`, `tests/fretes/fluxos-reais.spec.ts` | `playwright.config.ts` separa a suíte real da regressão simulada. |
| Documentação | `BackEnd/fretes/README.md`, `HISTORICO_DESENVOLVIMENTO.md`, este relatório | `README.md`; os documentos locais novos foram atualizados ao longo das etapas. |

Não foram alteradas migrations históricas para traduzir nomes, regras de
pagamento ou estratégias de estoque nesta finalização full-stack.

## 9. Testes atuais e reprodução

| Verificação | Resultado atual |
| --- | --- |
| Backend/PostgreSQL descartável | **149/149**, zero falhas, erros ou ignorados; 60,168 s de suíte. |
| Composição backend | 36 de modelagem + 40 de fretes/API/CORS + 73 dos módulos relacionados. |
| CORS após padronizar nome da classe de teste | 1/1 adicional; sem preparar/conectar banco. Não somado novamente aos 149. |
| Vitest | **75/75**, 18 arquivos; inclui dez novos casos de serviço HTTP e consulta. |
| TypeScript | `tsconfig.app.json` e `tsconfig.node.json`: aprovados. |
| ESLint | **0 erros**, 10 avisos Fast Refresh em arquivos preexistentes fora da feature integrada. |
| Build Vite | Aprovado; aviso de chunk principal acima de 500 kB e base Browserslist antiga. |
| Playwright geral, Edge, respostas simuladas | **31/31**, um worker, aproximadamente 1,5 min. Não comprova persistência real. |
| Playwright fretes, Edge + Vite + Django + PostgreSQL reais | **7/7**, um worker, aproximadamente 1,3 min. Sem interceptar a API. |
| Django system check | Nenhum problema identificado. |

Backend: rollback após falhas injetadas, limites concorrentes de alocação,
aprovação simultânea, CT-e/correções concorrentes, recebimento idempotente e
conflitos de cancelamento/retirada; isolamento e ocultação financeira; aplicação/reversão de
migrations em banco descartável; regressão de pedidos, produtos, comercialização,
empresas, acesso e mercado. Falhas são injetadas para testar rollback, sem
substituir gravação/transações por persistência simulada.

E2E real:

| Cenário | Resultado verificado |
| --- | --- |
| A — normal | Pedido, remessa parcial, cotação/aprovação, CT-e, retirada, assinatura e auditoria concluída. |
| B — divergência | Recebimento físico mantém análise aberta; aceite justificado posterior conclui auditoria. |
| C — correções | Valores 650 → 620 → 500, referência 500; três versões e duas análises substituídas preservadas. |
| D — retirada pelo cliente | Retirada/recebimento/conclusão sem cotação e sem CT-e. |
| E — segurança | Cotação concorrente oculta, comandos indevidos 403 e acesso de terceira empresa 404. |
| F — integridade | Assinatura ausente/inválida, criação duplicada idempotente, alocação excedente, cancelamento após retirada e viewport móvel. |
| G — operações complementares | Tratativa e demanda persistidas após recarga, paginação real, busca/filtro e cancelamento permitido. |

A conferência PostgreSQL final contou **13 fretes, 5 documentos, 3 análises,
3 confirmações, 1 demanda e 39 eventos históricos**. Seis fretes estavam
aguardando classificação (incluindo cinco criados para exercitar paginação),
dois aguardando entrega, um cancelado, três concluídos e um em cotação.
`estado_comercial_preservado` foi verdadeiro. O banco exclusivo foi removido.

Evidências locais ignoradas pelo Git:
`test-results/test_zenwaste_fretes_e2e_3b95e077f4f9/playwright.json`,
`persistencia.json`, screenshots dos fluxos A/B/C e log do servidor.

Na raiz:

```powershell
npm test
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.node.json
npm run lint
npm run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npx playwright test --workers=1
```

Em `BackEnd`:

```powershell
.\.venv-local\Scripts\python.exe -B -m fretes.executar_testes_postgresql
.\.venv-local\Scripts\python.exe -B -m fretes.executar_e2e
.\.venv-local\Scripts\python.exe -B manage.py showmigrations fretes
```

Os executores dependem das variáveis PostgreSQL locais e permissão para criar e
remover o banco descartável, sem imprimir as credenciais. O E2E gera segredo de
autenticação e senha aleatórios exclusivos, bloqueia conexão ao principal e
encerra o servidor próprio. Nenhum teste exige SQLite ou alteração do `.env`.

### Problemas encontrados e resolvidos

1. O primeiro E2E parou em um seletor de teste que usava o texto completo de um
   label contendo as opções. A seleção passou a usar papel `combobox` e nome;
   a tentativa foi interrompida e o banco removido pelo executor.
2. A tentativa seguinte revelou o bloqueio CORS real de `Idempotency-Key`.
   O cabeçalho foi autorizado no Django e recebeu teste de pré-requisição;
   os seis cenários passaram e depois a suíte foi ampliada para sete, todos aprovados.
3. A regressão geral iniciada com seis workers em paralelo às demais verificações
   teve três timeouts em 30 s, com 28 casos aprovados. Repetida integralmente com
   um worker, aprovou os 31. Não foi relaxada regra de negócio para aprovar testes.
4. A revisão identificou trava de comando compartilhada entre sessões. Ela passou
   a ser associada à sessão, com teste de troca de empresa e comandos pendentes.
5. Um uso inicial de `replaceAll` não atendia ao alvo TypeScript; foi substituído
   por expressão regular compatível. TypeScript atual passou nos dois projetos.

## 10. Git e publicação

O primeiro commit é `ce1f424` — `feat(fretes): persistir auditoria e expor api
transacional`. O segundo reúne a integração React, E2E e documentação e contém
este relatório. Os arquivos foram selecionados por caminhos explícitos, com
revisão do diff e busca de credenciais antes dos commits.

O registro definitivo dos hashes e do retorno do push acompanha a mensagem final
de entrega deste relatório. O commit que contém este próprio documento não pode
incluir seu próprio hash. A publicação deve ser conferida por:

```powershell
git branch --show-current
git fetch origin
git rev-list --left-right --count origin/backend-pg...backend-pg
git push -u origin backend-pg
git rev-parse HEAD
git rev-parse origin/backend-pg
```

A branch de destino é exclusivamente `backend-pg`; não há autorização para
force push ou descarte de alterações anteriores não relacionadas.

## 11. Implementado, demonstração e pendências

| Estado | Escopo |
| --- | --- |
| **Implementado e validado** | API e página de auditoria, persistência PostgreSQL, CT-e versionado, análises, permissões, assinatura armazenada, histórico, idempotência e os fluxos descritos. |
| **Código demonstrativo legado preservado** | Componentes/serviço antigos de auditoria e suas fixtures; não são fallback da página atual. Pagamentos de demonstração e estimativa local de frete de outros fluxos continuam conforme seus contratos anteriores. |
| **Representado por metadados** | Nome de arquivo CT-e/NF-e/foto. Não equivale a upload, leitura de XML, armazenamento do documento fiscal ou foto. |
| **Pendente/fora desta integração** | Emissão/consulta/validação de CT-e na SEFAZ, XML fiscal, SIGOR/MTR, ERP, rastreamento, contratação externa, envio de mensagens e provedor financeiro real. |
| **Validação posterior** | Homologação externa, testes de carga e falhas de infraestrutura, assinatura certificada e revisão de eventual contenção do lock por empresa com medição. |
| **Melhoria técnica conhecida** | Divisão do bundle principal e avisos Fast Refresh/Browserslist, sem falha dos checks atuais. |

Os próximos passos são homologar o fluxo com empresas e dados de negócio
controlados e definir os contratos externos antes de implementá-los. Alterar o
momento da baixa de estoque exige evolução coordenada de pedidos/pagamentos;
esta integração preserva o comportamento comercial existente.
