# BlackFit Backend

API do sistema BlackFit, desenvolvida para o PEX.

## Tecnologias

- Node.js
- Express
- Prisma
- PostgreSQL
- JWT
- Bcrypt

## Como Rodar Localmente

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variaveis de ambiente

Crie um arquivo `.env` baseado no `.env.example`:

```env
DATABASE_URL="postgresql://usuario:senha@host:5432/blackfit?schema=public"
JWT_SECRET="sua_chave_secreta"
PORT=3000
FRONTEND_URL="http://localhost:5173"
SEED_RECEPTIONIST_NAME="Recepcao BlackFit"
SEED_RECEPTIONIST_EMAIL="recepcao@blackfit.com"
SEED_RECEPTIONIST_PASSWORD="blackfit123"
```

### 3. Rodar migrations

```bash
npx prisma migrate dev
```

### 4. Criar usuario inicial

```bash
npm run seed
```

### 5. Iniciar servidor

```bash
npm run dev
```

## Deploy no Render

### 1. Criar banco PostgreSQL

Crie um PostgreSQL no Render, Neon, Supabase ou outro provedor e copie a connection string.

### 2. Configurar variaveis no Render

```env
DATABASE_URL=postgresql://usuario:senha@host:5432/database?schema=public
JWT_SECRET=uma_chave_grande_e_diferente
FRONTEND_URL=https://seu-front.vercel.app
SEED_RECEPTIONIST_NAME=Recepcao BlackFit
SEED_RECEPTIONIST_EMAIL=recepcao@blackfit.com
SEED_RECEPTIONIST_PASSWORD=troque_essa_senha
```

### 3. Build Command

```bash
npm install && npx prisma generate && npx prisma migrate deploy
```

### 4. Start Command

```bash
npm start
```

### 5. Seed no primeiro deploy

Depois que o primeiro deploy estiver no ar, rode no Shell do Render:

```bash
npm run seed
```

Isso cria o primeiro usuario recepcionista para acessar o sistema.

## Scripts

- `npm run dev`: inicia o servidor com nodemon.
- `npm start`: inicia o servidor em modo producao.
- `npm run prisma:generate`: gera o Prisma Client.
- `npm run prisma:deploy`: aplica migrations em producao.
- `npm run seed`: cria o usuario inicial.
- `npm run deploy:build`: comando auxiliar com install, generate e migrate deploy.

## Estrutura do Projeto

- `src/routes`: rotas da aplicacao.
- `src/middlewares`: middlewares, como autenticacao.
- `src/lib`: integracao com Prisma.
- `prisma`: schema, migrations e seed.

## Observacoes Sobre SQLite

O projeto foi preparado para PostgreSQL no deploy. O arquivo `prisma/dev.db` era usado apenas no desenvolvimento com SQLite e nao deve ser usado em producao.

Para este PEX, a migracao para PostgreSQL foi pensada para banco novo. Caso precise preservar dados antigos do SQLite, sera necessario criar um script de exportacao/importacao.

## Objetivo do Projeto

Sistema academico para gestao de academia, com foco em alunos, instrutores, recepcao, check-in, ranking, avaliacoes e gerenciamento de treinos.

## Proximas Etapas

- [x] Estrutura inicial do backend
- [x] Configuracao do Prisma
- [x] Criar autenticacao com JWT
- [x] Criar rota de register
- [x] Criar rota de login
- [x] Criar middleware de autenticacao
- [x] Melhorar validacao
- [x] Melhorar schema do Prisma
- [x] Criar fluxo de recepcionista cadastrar aluno e instrutor
- [x] Criar rota de criacao de treinos
- [x] Criar atribuicao de treinos
- [x] Criar check-in e ranking
- [x] Criar dashboard/stats
- [x] Criar fluxo de rating
- [x] Integrar frontend com backend
- [x] Preparar backend para deploy
- [x] Fazer deploy do backend
