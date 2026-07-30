# Adequação do sistema ao contrato SocioEstilo V30

## Escopo implementado

- `src/lib/report-v30.ts` concentra o contrato canônico e o adaptador `normalizeV30Report`.
- O adaptador aceita somente payloads identificados como V30 e não promove estruturas legadas silenciosamente.
- A validação exige os sete campos governados, com `status` explícito (`generated`, `insufficient_evidence` ou `error`).
- A persistência só é considerada válida quando `persisted=true` e há `resultado_id` ou `relatorio_uuid`.
- Os scores internos usam somente `assertivo`, `participativo`, `integrador` e `analitico`.

## Adequações obrigatórias no fluxo de conclusão

1. Enviar ao backend apenas `metadata` mínima e `questionnaire.answers` com `questionId`, `question`, `answerOrder` e `answer`.
2. Nunca calcular perfil ou texto final no navegador.
3. Consumir `response.report_output`, com `response.report_data.report_output` apenas como envelope de compatibilidade.
4. Se o retorno não for V30, não estiver validado ou não confirmar persistência, mostrar erro neutro, oferecer nova tentativa e não salvar resultado final.
5. Quando `persisted=true`, não chamar `criarResultado` no navegador.
6. Não guardar `raw_response`, prompt, payload de entrada ou auditoria privada no `localStorage` do participante.

## Adequações de autorização

- A role deve vir do token verificado no backend; e-mail e `localStorage` não são fonte de autorização.
- `/api/resultados` deve aplicar escopo por usuário/empresa/role.
- O participante deve receber DTO sanitizado; auditoria integral deve ficar em endpoint administrativo.
- O navegador nunca deve chamar o webhook de reindexação diretamente.

## Persistência e governança

- `report_element_config` é a única fonte de configuração de visibilidade.
- A visibilidade efetiva é `permitido_pela_seguranca AND ativo_na_configuracao AND campo_disponivel_no_relatorio`.
- UCs devem ser integrais, versionadas, com `content_hash`, `embedding_text_hash` e histórico imutável.
- A indexação deve ser assíncrona, idempotente e executada por job com geração ativa e rollback.

## Critérios de aceite mínimos

- Um output V30 válido gera exatamente um resultado persistido.
- Pontuação inválida ou zero não assume Assertivo nem outro perfil.
- Os sete campos são renderizados a partir de `campos_relatorio`.
- Insuficiência de evidência não recebe texto genérico.
- Participante não recebe auditoria privada na resposta de rede.
- Repetição do mesmo job de indexação não duplica documentos.
