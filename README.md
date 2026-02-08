# MyFinance API

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-3C873A)](https://nodejs.org)
[![Express](https://img.shields.io/badge/express-5.x-000000)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/mongodb-Atlas-47A248)](https://www.mongodb.com)
[![License](https://img.shields.io/badge/license-ISC-blue)](LICENSE)

API oficial do MyFinance para gerenciamento financeiro familiar. Esta API
centraliza autenticacao, usuarios, transacoes, categorias, caixinhas,
dashboard e gestao de familia/convites.

## Stack

- Node.js + Express
- MongoDB + Mongoose
- JWT para autenticacao
- Nodemailer para email
- Multer + Vercel Blob para upload de avatar

## Requisitos

- Node.js 18+
- MongoDB

## Configuracao

Crie um arquivo `.env` na raiz com as variaveis abaixo (exemplo):

```env
PORT=3000
MONGO_URI=mongodb+srv://USER:PASS@HOST/?appName=myfinance
MONGO_URI_DIRECT=mongodb://HOST1,HOST2,HOST3/?replicaSet=atlas-xxxxx-shard-0&ssl=true&authSource=admin
DNS_SERVERS=1.1.1.1,8.8.8.8
DB_NAME=general
JWT_SECRET=change_me
MAIL_USER=myfinance.app.noreply@gmail.com
MAIL_PASS=app_password
FRONT_URL=http://localhost:5000
BLOB_READ_WRITE_TOKEN=vercel_blob_token
```

Notas:
- `MONGO_URI_DIRECT` e opcional e so usado como fallback quando o DNS SRV falhar.
- `DNS_SERVERS` e opcional e pode ajudar em ambientes com bloqueio de consulta SRV.

## Como rodar

```bash
npm install
npm run dev
```

API disponivel em `http://localhost:3000`.

## Autenticacao

As rotas protegidas exigem o token JWT retornado no login:

```
Authorization: Bearer <token>
```

## Padrao de erros

Respostas de erro seguem o formato:

```json
{ "error": "mensagem" }
```

## Endpoints

Base URL: `/`

### Health check

- `GET /`  
  Retorna status basico do servico.

Exemplo de resposta:

```json
{ "status": "ok", "service": "MyFinance API" }
```

### Auth

- `POST /auth/register`  
  Cria usuario e familia (se nao houver `inviteCode`) e envia email de
  verificacao.

Corpo:

```json
{
  "name": "Ana",
  "email": "ana@email.com",
  "password": "123456",
  "inviteCode": "ABCD1234"
}
```

Resposta:

```json
{
  "message": "Cadastro realizado. Verifique seu email.",
  "familyId": "..."
}
```

- `POST /auth/login`  
  Autentica e retorna token + dados do usuario.

Corpo:

```json
{ "email": "ana@email.com", "password": "123456" }
```

Resposta:

```json
{
  "token": "jwt...",
  "user": {
    "id": "...",
    "name": "Ana",
    "email": "ana@email.com",
    "familyId": "...",
    "emailVerified": false,
    "avatarUrl": null
  }
}
```

- `GET /auth/verify-email?token=...`  
  Valida o token de verificacao de email.

- `POST /auth/resend-verification`  
  Reenvia email de verificacao.

Corpo:

```json
{ "email": "ana@email.com" }
```

- `POST /auth/forgot-password`  
  Dispara email de recuperacao.

Corpo:

```json
{ "email": "ana@email.com" }
```

- `POST /auth/reset-password`  
  Redefine senha com token valido.

Corpo:

```json
{ "token": "reset_token", "password": "nova_senha" }
```

### Usuario (auth)

- `PATCH /users/me`  
  Atualiza o nome do usuario logado.

Corpo:

```json
{ "name": "Ana Maria" }
```

- `PATCH /users/me/avatar`  
  Upload do avatar do usuario logado.

Requisitos:

- `multipart/form-data`
- Campo `avatar` (imagem)
- Limite 2MB, apenas `image/*`

Resposta:

```json
{ "avatarUrl": "https://...vercel-storage.com/avatars/...", "user": { "...": "..." } }
```

### Transacoes (auth)

Campos comuns:

- `type`: `income` | `expense`
- `value`: number
- `category`: string
- `group`: `fixed` | `variable` | `planned` | `unexpected`
- `date`: ISO string

- `POST /transactions`  
  Cria uma transacao.

Corpo:

```json
{
  "type": "income",
  "value": 1500,
  "category": "Salario",
  "group": "fixed",
  "date": "2026-01-17T12:00:00.000Z"
}
```

- `GET /transactions`  
  Lista todas as transacoes da familia (ordenadas por data desc).

- `GET /transactions/month?year=YYYY&month=MM`  
  Filtra por mes.

- `GET /transactions/year?year=YYYY`  
  Filtra por ano.

- `GET /transactions/range?start=YYYY-MM-DD&end=YYYY-MM-DD`  
  Filtra por intervalo.

- `GET /transactions/:id`  
  Busca uma transacao especifica.

- `PUT /transactions/:id`  
  Atualiza uma transacao existente.

- `DELETE /transactions/:id`  
  Remove uma transacao.

### Contas (auth)

Campos comuns:

- `name`: string
- `installmentValue`: number
- `downPayment`: number (opcional)
- `installments`: number inteiro >= 1
- `paidInstallments`: number inteiro >= 0
- `firstDueDate`: ISO string
- `category`: string (opcional, pode ser definida no primeiro pagamento)

- `POST /accounts`  
  Cria uma conta.

Corpo:

```json
{
  "name": "Notebook",
  "installmentValue": 350,
  "downPayment": 500,
  "installments": 10,
  "firstDueDate": "2026-02-15",
  "category": ""
}
```

- `GET /accounts`  
  Lista contas da familia.

- `GET /accounts/:id`  
  Busca uma conta por id.

- `PUT /accounts/:id`  
  Atualiza uma conta (todos os campos editaveis).

- `DELETE /accounts/:id`  
  Exclui uma conta.

- `POST /accounts/:id/pay`  
  Registra o pagamento da proxima parcela, cria uma transacao de despesa
  (`group: fixed`) e incrementa `paidInstallments`.

Corpo (quando a conta ainda nao tem categoria):

```json
{
  "category": "Eletronicos",
  "date": "2026-02-08T12:00:00.000Z"
}
```

### Categorias (auth)

- `GET /categories`  
  Lista categorias fixas e da familia.

- `POST /categories`  
  Cria categoria customizada.

Corpo:

```json
{ "name": "Mercado", "type": "expense" }
```

- `PUT /categories/:id`  
  Atualiza o nome da categoria.

- `DELETE /categories/:id`  
  Remove categoria (nao pode estar em uso).

### Caixinhas (auth)

- `GET /boxes`  
  Lista caixinhas da familia.

- `POST /boxes`  
  Cria caixinha.

Corpo:

```json
{ "name": "Reserva", "isEmergency": true }
```

- `POST /boxes/:id/move`  
  Movimenta valor dentro/fora da caixinha.

Corpo:

```json
{ "type": "in", "value": 200 }
```

- `PUT /boxes/:id`  
  Atualiza dados da caixinha.

- `DELETE /boxes/:id`  
  Remove caixinha e seu historico.

### Dashboard (auth)

- `GET /dashboard/summary?year=YYYY&month=MM`  
  Retorna totais de receitas/despesas, saldo e caixinhas.

Resposta:

```json
{ "income": 0, "expense": 0, "balance": 0, "boxes": [] }
```

### Familia (auth)

- `POST /family/join`  
  Entra em uma familia via codigo.

Corpo:

```json
{ "code": "ABCD1234" }
```

- `GET /family`  
  Retorna dados da familia e membros.

- `GET /family/invite-code`  
  Retorna o codigo de convite (somente owner).

- `POST /family/invite-code`  
  Regenera o codigo (somente owner).

- `PATCH /family/invite-code`  
  Regenera o codigo (somente owner).

## Uploads (Avatar)

O upload de avatar usa `@vercel/blob` com armazenamento publico. O endpoint
retorna o `avatarUrl` com a URL publica do blob.

Requer a variavel `BLOB_READ_WRITE_TOKEN` configurada no ambiente.

## [Licença](LICENSE) 
