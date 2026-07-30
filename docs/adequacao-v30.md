# Adequação V30 — implementação por etapas

## Parte 2 concluída

- `src/lib/report-v30.ts` valida o envelope `report_output` V30, os sete elementos obrigatórios, identificadores, UUID, status, conteúdo, habilitação, ordem, evidências, UCs, fallback, auditoria e scores.
- O adaptador produz conteúdo canônico tipado e separa `publicReport` do `privateAudit`. O DTO público não contém auditoria, evidências ou UCs.
- O estado estrutural (`invalid`) é separado do estado do relatório (`complete`, `partial` ou `failed`). Elementos desabilitados não participam do cálculo do estado geral.
- `DashboardScreen` renderiza somente elementos V30 habilitados, na ordem recebida, usando os títulos e conteúdos validados.
- Um registro com `report_output` ou indicação V30 passa obrigatoriamente pelo adaptador. V30 inválido exibe erro controlado e não usa o legado como fallback silencioso.
- Registros sem `report_output` e sem indicação V30 continuam no fluxo legado, sem migração ou regravação.

## Integração funcional mínima — etapa posterior

- A resposta do n8n é incorporada ao payload já usado pela aplicação, preservando `report_output`, `contract_version`, `resultado_id`, `relatorio_uuid` e `persisted` quando recebidos.
- Quando o n8n informa `persisted=true` e fornece identificador, o frontend não executa uma segunda gravação. Quando não informa persistência, a gravação existente em `criarResultado` continua sendo usada uma única vez.
- O `report_output` também é incluído em `relatorio_pronto_para_app` quando a coluna existir; o mecanismo de retry existente remove a coluna caso o schema instalado ainda não a possua.
- Scores V30 válidos são lidos do adaptador e reaproveitados; não são recalculados nem substituídos por zero.
- Uma resposta `persisted=true` sem `resultado_id` e sem `relatorio_uuid` interrompe a gravação local e mostra erro controlado, evitando duplicidade.

## O que continua legado

O fluxo histórico continua usando a normalização e apresentação legadas existentes no Dashboard. Aliases e textos históricos permanecem restritos a esse fluxo e não são usados para reparar contratos V30.

## Pendências para etapas futuras

- A segregação efetiva da auditoria no backend continua pendente: nesta etapa o payload completo ainda pode chegar ao navegador, embora não seja renderizado no relatório do participante.
- Continuam fora desta etapa autorização, persistência única, gestão e versionamento de UCs, indexação vetorial, parametrização administrativa, banco/políticas Supabase e workflow n8n.
- Não foi criada interface administrativa de habilitação; o Dashboard respeita apenas `enabled`/`habilitado` resolvido no contrato V30.
- A segregação efetiva da auditoria no backend continua pendente; esta etapa apenas conecta o payload ao fluxo existente e não remove os dados privados já armazenados.

## Arquivos da Parte 2

- Modificados: `src/lib/report-v30.ts`, `src/components/DashboardScreen.tsx`, este documento.
- Criado: `src/lib/report-v30.test.ts`.
- Criado: `src/lib/report-integration.ts`.

## Critério V30 versus histórico

Há sinal V30 quando o registro contém `report_output` diretamente ou em `report_data`, ou declara `contractVersion`/`contract_version`/`schema_version` como `V30` ou `socioestilo-report/v30`. Com esse sinal, qualquer falha de validação permanece como erro V30. Sem esse sinal, o registro é tratado como histórico pelo fluxo legado.

Nenhum commit foi realizado nesta etapa.
