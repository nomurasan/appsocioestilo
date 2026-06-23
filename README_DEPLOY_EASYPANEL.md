# 🚀 Manual de Deploy - Potenciar Socioestilo no Easypanel (Hostinger VPS)

Este guia prático foi elaborado por um **Arquiteto de Software Sênior - Especialista em Segurança e Cloud Native** para orientar o processo completo de provimento, implantação, configuração segura e validação da plataforma **Potenciar Socioestilo** no painel administrativo **Easypanel (Hostinger)**.

---

## 📋 1. Visão Geral da Arquitetura de Produção

A aplicação foi estruturada seguindo rigorosos padrões de segurança:
*   **Frontend (Vite + React):** Empacotado no build estático da aplicação. Lê as variáveis iniciadas com o prefixo `VITE_`.
*   **Backend (Node.js + Express):** Orquestrador seguro que roda as APIs de inteligência, segurança, saneamento e conexão direta com as APIs do Supabase, Firebase e n8n, assegurando de forma intransponível que **nenhuma chave de privilégio administrativo administrativo ou privada** se infiltre no navegador.

---

## 🔑 2. Lista de Variáveis de Ambiente no Easypanel

Ao cadastrar a aplicação no **Easypanel**, insira as variáveis abaixo no painel de configurações na aba **Environment (Ambiente)**.

### 🛑 VARIÁVEIS PRIVADAS (EXCLUSIVAS DO BACKEND - MEMÓRIA DA VPS)
*Essas chaves nunca devem conter o prefixo `VITE_`. Elas residem estritamente no servidor Express.*

| Nome da Variável | Finalidade | Exemplo de Produção | Obrigatório? |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Define o modo de execução otimizado e oculta stack traces de stack e logs sensíveis ao usuário. | `production` | **Sim** |
| `PORT` | Porta de tráfego interno da aplicação VPS. | `3000` | **Sim** (Hardcoded) |
| `HOST` | Interface de tráfego interno. | `0.0.0.0` | **Sim** |
| `APP_URL` | Subdomínio próprio de destino da aplicação na internet. | `https://socioestilo.suaempresa.com.br` | **Sim** |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de superusuário com poderes de bypass de RLS para persistir dados, relatórios e buscas de conhecimento do usuário com privilégios administrativos. | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | **Sim** |
| `GEMINI_API_KEY` | Chave para acionamento do Google Gemini para orquestrações locais do chatbot ou laudo offline. | `AIzaSyBuxX...` | **Sim** |
| `OPENAI_API_KEY` | Chave para geração de vetores de alta fidelidade (1536 dimensões) no chatbot e banco vetorial. | `sk-proj-...` | Não (Optional) |
| `N8N_WEBHOOK_URL` | Endereço do webhook ativado em seu fluxo privado do n8n na VPS para receber os relatórios do socioestilo. | `https://n8n.suaempresa.com.br/webhook/...` | Não (Usa padrão) |

### 🌐 VARIÁVEIS PÚBLICAS (INJETADAS NO FE VIA VITE / NAVEGADOR)
*Devem obrigatoriamente possuir o prefixo `VITE_` para que o empacotador as exponha com segurança ao código rodando no browser.*

| Nome da Variável | Finalidade | Exemplo de Produção | Obrigatório? |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Endpoint público de conexão com o banco do Supabase da empresa. | `https://czxxuznpclbuiqgpegzj.supabase.co` | **Sim** |
| `VITE_SUPABASE_ANON_KEY` | Chave pública anônima para interações básicas do usuário no Supabase. | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | **Sim** |
| `VITE_FIREBASE_API_KEY` | Chave para gerenciar o login via Firebase Auth do Socioestilo. | `AIzaSyBoQvK-EALDG...` | **Sim** |
| `VITE_FIREBASE_AUTH_DOMAIN` | Domínio de delegação de autenticação do Firebase. | `gen-lang-client-0279925838.firebaseapp.com` | **Sim** |
| `VITE_FIREBASE_PROJECT_ID` | Identificador do projeto Firebase associado. | `gen-lang-client-0279925838` | **Sim** |
| `VITE_FIREBASE_STORAGE_BUCKET` | Espaço de armazenamento público no Firebase. | `gen-lang-client-0279925838.firebasestorage.app` | **Sim**|
| `VITE_FIREBASE_MESSAGING_SENDER_ID`| Sender ID para monitoramento e telemetria. | `814709675367` | **Sim** |
| `VITE_FIREBASE_APP_ID` | Identificador da aplicação Frontend Web. | `1:814709675367:web:d9...` | **Sim** |

---

## 🌐 3. Configuração de Subdomínio no Easypanel + Hostinger

Para rotear seu subdomínio próprio (ex: `socioestilo.suaempresa.com.br`) até o **Easypanel**:

1.  **Configuração na Zone de DNS do Provedor de Domínio (ex: Hostinger):**
    *   Crie um registro do tipo **CNAME** ou **A** apontando para o IP público da sua VPS onde o Easypanel está rodando.
    *   *Exemplo A:* `socioestilo` -> `IP_DA_SUA_VPS`
2.  **Configuração no Painel do Easypanel:**
    *   Entre no seu projeto no Easypanel, selecione a aplicação **Potenciar Socioestilo**.
    *   No menu **Domains (Domínios)**, clique em **Add Domain**.
    *   Adicione o subdomínio completo: `socioestilo.suaempresa.com.br`.
    *   Garanta que a porta externa mapeie internamente para a porta `3000`.
    *   O Easypanel cuidará automaticamente do registro e do provisionamento do certificado **SSL (Let's Encrypt)** com HTTPS.

---

## 🛠️ 4. Como Validar o Build do Projeto

Execute localmente ou verifique os logs do console do Easypanel para asseverar a integridade estrutural do build TypeScript. Os scripts de produção unificados geram o bundle estático do frontend na pasta `/dist` e compilam o backend seguro em `/dist/server.cjs` usando `esbuild` para bypass de incompatibilidades de ESM.

> Importante: o Vite injeta variáveis `VITE_` no bundle estático no momento do build. Se o Easypanel estiver configurado para fornecer essas variáveis apenas em tempo de execução, a imagem Docker deve reconstruir o frontend na inicialização do container ou receber os valores como argumentos de build.

```bash
# Compilar frontend e backend localmente
npm run build
```

No Dockerfile, há suporte para ambos os cenários:
* Se `VITE_*` for fornecido como argumento de build, o frontend será compilado durante a etapa de build da imagem.
* Caso contrário, o container executará `npm run build` na inicialização se `/dist` estiver ausente ou vazio.

---

## 👁️ 5. Como Validar o Standby do Servidor Backend

Após o deploy no Easypanel, observe a inicialização na aba **Logs** do container. O console imprimirá um diagnóstico corporativo sanitizado mostrando se as conexões importantes estão presentes sem vazar caracteres que comprometam a infraestrutura:

```text
=================================================================
       VALIDADOR ARCHITECT - POTENCIAR SECURITIZADO
=================================================================
Ambiente de Deploy: PRODUCTION
Porta Ingress     : 3000
Link do Portal    : https://socioestilo.suaempresa.com.br
Supabase Target   : https://czxxuznpclbuiqgpegzj.supabase.co
Chave Supabase    : eyJh...6YzQ
Chave Gemini      : AIza...r7MA
Chave OpenAI      : sk-p...zK1A
Webhook n8n       : http...Anal
=================================================================

[SERVER-INIT] Servidor de produção servindo dist/ estático.
[SERVER-BOOT] Aplicação executada com segurança de nível prod em http://0.0.0.0:3000
```

---

## 🧪 6. Roteiro de Teste dos Endpoints Principais (API)

Utilize softwares como o *Postman*, *Insomnia* ou o simples comando `curl` no terminal para certificar-se de que os barramentos estão com o rate limiting e payload sanitizers ativos.

### A. Testando a Rota de Busca Vetorial (Proteção contra injeção e abuso)
```bash
curl -X POST https://socioestilo.suaempresa.com.br/api/knowledge-search \
  -H "Content-Type: application/json" \
  -d '{"query": "Estilo Expressivo"}'
```
*   **Resposta Esperada se ativo:** Retorno JSON com resultados de correspondência em frações de segundos.
*   **Resposta Esperada com spam continuado (Rate limit):** HTTP status `429` com a mensagem: *"Muitas requisições sequenciais. Por favor, aguarde alguns segundos..."* junto ao seu ID exclusivo de requisição (`requestId`).

### B. Testando Tratamento de Erros e Omissão de Stacks em Erros Críticos
```bash
curl -X POST https://socioestilo.suaempresa.com.br/api/knowledge-search \
  -H "Content-Type: application/json" \
  -d '{"query": ""}'
```
*   **Resposta Esperada:** HTTP status `400` contendo erro descritivo amigável, livre de vazar diretórios internos ou trechos de código do servidor.

---

## ✅ 7. Checklist Completo Antes de Publicar (Go-Live)

Use esta lista para garantir zero surpresas indesejadas no dia da publicação:

*   [ ] O arquivo `.env` local do ambiente de desenvolvimento está listado corretamente em `.gitignore`?
*   [ ] As chaves `SUPABASE_SERVICE_ROLE_KEY` e `GEMINI_API_KEY` foram devidamente adicionadas nas variáveis **Privadas** do Easypanel?
*   [ ] Certificou-se que **nenhum** token com o termo `VITE_SUPABASE_SERVICE_ROLE_KEY` foi configurado pública?
*   [ ] O subdomínio da Hostinger foi devidamente delegado com HTTPS de Let's Encrypt ativo?
*   [ ] A aplicação compila por completo executando `npm run build` sem erros de tipagem no TypeScript?
*   [ ] O portal n8n foi parametrizado com suporte à recepção de JSONs no formato especificado (`metadata` e `questionnaire`)?
*   [ ] O botão de exportação em PDF no menu principal do laudo individual foi retirado (Conforme demanda do usuário)?

---

## 🛡️ 8. Relatório de Auditoria de Segurança Enterprise

Esta seção formaliza os mecanismos de proteção, mitigação de riscos e regras de auditoria que fundamentam a integridade do Socioestilo no ambiente produtivo corporativo.

### A. Auditoria de Autenticação Firebase
O Socioestilo delega a autenticação de usuários ao **Firebase Auth** (Client-Side). Esta decisão arquitetural remove do servidor local o risco de armazenamento inadequado de senhas (mitigando vulnerabilidades de vazamento de hashes, SQL Injection em logins e Brute Force direto):
1.  **Segregação de Credenciais:** Nenhuma senha trafega ou reside na memória da VPS. Os tokens (JWT) são autenticados e rotacionados de forma transparente pelo barramento do Google Firebase.
2.  **Mitigação de Ataques:** O Firebase Auth possui mecanismos embutidos e automatizados contra ataques automatizados, controle de IPs suspeitos e autenticação multifator (MFA) caso configurado.
3.  **Auditoria Recomendada:**
    *   Habilitar os **Logs de Auditoria do Firebase/GCP Cloud Logging** para monitorar ações como `createUserWithEmailAndPassword`, delegações de provedores federados (Google Login) e rotatividade de senhas corporativas.

### B. Auditoria de Permissões do Supabase & Políticas RLS (Row Level Security)
No barramento de dados do Supabase, o banco de dados deve estar sob governança de políticas estritas para impedir que usuários anônimos adulterem dados do negócio.

#### 1. Tabela `documents` (Base de Conhecimento Vetorial)
Esta tabela armazena o conteúdo do Livro de Socioestilo para fins de RAG (Busca Vetorial). Ela deve permitir apenas leitura, com bloqueio total de mutações no frontend.
*   **Políticas Recomendadas:**
    ```sql
    -- 1. Habilitar RLS de forma intransponível
    ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

    -- 2. Permitir SELECT público apenas para leitura (se desejado no frontend) ou restrito aos autenticados
    CREATE POLICY "Permitir leitura de documentos por usuários" 
    ON documents FOR SELECT 
    USING (true);

    -- 3. Bloquear inserções e alterações por usuários comuns do frontend (Chave Anon)
    CREATE POLICY "Bloquear mutações de documentos no Frontend" 
    ON documents FOR INSERT 
    WITH CHECK (false);

    CREATE POLICY "Bloquear edições de documentos no Frontend" 
    ON documents FOR UPDATE 
    USING (false);
    ```

#### 2. Tabela `candidates_reports` (Relatórios e Laudos de Socioestilo)
Esta tabela registra os dados de candidatos e relatórios gerados. Como o backend Express utiliza a `SUPABASE_SERVICE_ROLE_KEY` (chave de privilégio de sistema) em ambiente de servidor VPS seguro para realizar transações de escrita e leitura de laudos, o frontend público nunca interage diretamente com o banco de dados para salvar resultados.
*   **Políticas Recomendadas:**
    ```sql
    -- 1. Habilitar RLS na tabela de relatórios
    ALTER TABLE candidates_reports ENABLE ROW LEVEL SECURITY;

    -- 2. Negar qualquer acesso de escrita ou leitura indiscriminada via Anon Key no browser
    CREATE POLICY "Bloquear gravação direta de candidatos no frontend" 
    ON candidates_reports FOR INSERT 
    WITH CHECK (false);

    CREATE POLICY "Bloquear leitura pública de laudos de outros candidatos" 
    ON candidates_reports FOR SELECT 
    USING (false);
    ```
*   *Vantagem dessa Abordagem:* O backend atua como um **Security Gateway (BFF)**. Ao blindar os inserts e queries por trás da API do Express protegida por CORS, Rate Limiters e validações do Zod, impede-se qualquer ataque de manipulação de parâmetros ou injeção de ID de terceiros no browser (IDOR - Insecure Direct Object References).

---

Com este guia, você possui o domínio definitivo de arquitetura segura em VPS e Easypanel para o portal Potenciar Socioestilo! Em caso de alterações futuras de infraestrutura, revise sempre as travas de seguranças no início do bootstrap do `server.ts`.
