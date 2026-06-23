# Especificação de Segurança - Potenciar Socioestilo

Este documento descreve políticas de controle de acesso (ABAC) e validações no Firestore, prevenindo ataques de personificação (Identity Spoofing), escalonamento de privilégios e injeção de dados inválidos.

## Invariantes de Dados (Data Invariants)

1. **Associação de Usuário**: Um documento em `usuarios` pertencente a `userId` só pode ser criado/modificado se `userId == request.auth.uid`.
2. **Resultados Pessoais**: Os dados enviados da pesquisa sob `/resultados/{resultadoId}` devem ter o campo `id_usuario` igual a `request.auth.uid`.
3. **Imutabilidade**: Campos como `uid` e `email` em `usuarios`, e `id_usuario` em `resultados` não podem ser modificados pós-criação.
4. **Alinhamento de Equipe**: Um usuário só pode ler resultados de terceiros se o `empresa_nome` do resultado corresponder exatamente ao seu próprio `empresa_nome` (validado buscando o perfil do usuário atual via `get`).
5. **Prevenção de Injeção**: Nomes de empresas e IDs devem obedecer a tamanhos limite para prevenir "Denial of Wallet".

## Os 12 Payloads Maliciosos ("Dirty Dozen")

Abaixo estão 12 cenários de tentativa de invasão que devem ser impedidos (PERMISSION_DENIED):

1. **Spoofing de Usuário**: Criar um perfil de usuário `/usuarios/vitima_uid` com dados de login de `atacker_uid`.
2. **Modificação Retroativa de ID**: Atualizar o `uid` de `/usuarios/meu_uid` para trocar de identidade.
3. **Empresa Fantasma**: Enviar um nome de empresa vazio ou gigante (> 150 chars) em `empresas` para estourar o banco de dados.
4. **Apropriação de Resultado**: Gravar resultados em `/resultados/res_123` com `id_usuario` definido como o UID de outro usuário.
5. **Leitura Espionada**: Tentar consultar os resultados de outra empresa sem estar autenticado ou pertencendo a uma empresa diferente.
6. **Burlar Pontuação**: Enviar scores contendo valores não numéricos (ex: strings ou arrays vazios em vez de números inteiros para os perfis).
7. **Modificar Resultado Alheio**: Alterar a pontuação de outro funcionário já gravada no sistema.
8. **Modificação Retroativa de Resultado**: Tentar atualizar o campo `id_usuario` em `/resultados/res_123` após já ter sido gravado.
9. **Timestamp Falsificado**: Enviar `data_conclusao` do cliente adulterado em vez de usar o `request.time` (Server Timestamp) no cadastro ou conclusão.
10. **Acesso Sem Autenticação**: Tentar inserir uma nova empresa em `/empresas/emp_abc` sem possuir um token de login ativo.
11. **Estourar as Chaves de Atualização**: Adicionar um campo "isAdmin: true" oculto usando um "Ghost Field" em uma atualização de perfil.
12. **Injeção de Caracteres no ID (ID Poisoning)**: Tentar criar uma empresa com ID contendo caracteres especiais de controle ou strings absurdamente grandes (>128 chars).

---

## Verificação das Regras (Rule Tests Summary)

As regras de segurança que vamos criar no arquivo `/firestore.rules` usarão verificações rigorosas com funções auxiliares como:
- `isValidId(id)`
- `isValidUsuario(data)`
- `isValidResultado(data)`
- `isValidEmpresa(data)`
- `isOwner(userId)`
- `perteceAMesmaEmpresa(resourceEmpresa)`

Toda e qualquer tentativa de violar as regras acima será interceptada nativamente pelo Firestore Engine, retornando erro de autorização.
