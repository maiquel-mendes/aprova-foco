# Desenvolvimento Local Offline no Debian com Podman + PostgreSQL

O **AprovaFoco** possui uma camada abstrata de **Repositórios de Dados** (`src/repositories/`) e **Provedores de Autenticação** (`IAuthProvider`). Isso permite alternar sem alterar os componentes React entre:

1. **Modo Google / Firebase (`DATA_DRIVER="firebase"`)** — Ideal para o ambiente de desenvolvimento no AI Studio (Firebase Auth + Firestore + Google Calendar/Drive).
2. **Modo PostgreSQL Offline / Backend Próprio (`DATA_DRIVER="postgres"`)** — Roda 100% local no seu Debian com container Podman + PostgreSQL + API REST `/api/v1/*` + autenticação por e-mail/senha.

---

## 1. Pré-requisitos no Debian

Instale o Podman e o suporte a `podman compose` (ou `podman-compose`):

```bash
sudo apt update
sudo apt install -y podman podman-compose nodejs npm
```

---

## 2. Subir o PostgreSQL em Container (Podman)

Na raiz do projeto, suba apenas o banco de dados:

```bash
podman compose up -d db
```

Verifique se o container está saudável (`healthy`):

```bash
podman ps
podman logs aprovafoco-postgres
```

> **Dica Debian / Rootless Podman**: O volume `aprovafoco_pgdata` em `compose.yaml` usa `:Z` para compatibilidade com SELinux/AppArmor e persiste os dados entre reinicializações do container.

---

## 3. Configurar o `.env` para Modo Local Offline

Crie ou edite o arquivo `.env` na raiz do projeto:

```env
DATA_DRIVER="postgres"
VITE_DATA_DRIVER="postgres"
DATABASE_URL="postgres://aprovafoco:aprovafoco_dev_local@localhost:5432/aprovafoco"
AUTH_SECRET="gere_um_segredo_aleatorio_com_openssl_rand_hex_32"
BOOTSTRAP_ADMIN_EMAIL="seu-email@dominio.com"

# Opcional: necessário apenas se quiser usar extração de PDF / diagnóstico com Gemini
GEMINI_API_KEY=""
```

Para gerar um `AUTH_SECRET` forte no terminal Debian:

```bash
openssl rand -hex 32
```

---

## 4. Criar as Tabelas no PostgreSQL (Drizzle Kit)

Com o container `aprovafoco-postgres` rodando:

```bash
npm install
npx drizzle-kit push
```

Na primeira execução da aplicação, o backend (`ensurePostgresSeeded()`) popula automaticamente as questões iniciais comentadas caso o banco esteja vazio.

---

## 5. Rodar a Aplicação em Desenvolvimento Offline

```bash
npm run dev
```

Acesse `http://localhost:3000`.
- Na tela de entrada, o sistema exibirá **Entrar** e **Criar conta** com e-mail e senha (sem depender de internet ou login Google).
- O primeiro usuário cadastrado (ou o e-mail definido em `BOOTSTRAP_ADMIN_EMAIL`) recebe automaticamente o papel `admin`.

### Rodar tudo containerizado (App + PostgreSQL)

Se preferir rodar tanto o servidor Node quanto o Postgres dentro do Podman:

```bash
podman compose --profile full up --build -d
```

---

## 6. Como Migrar para um Backend Próprio Externo (Go, NestJS, FastAPI, Spring etc.)

Toda a interface React consome exclusivamente os contratos em `src/repositories/contracts.ts`:
- `IAuthProvider` (login, registro, token em memória, signOut)
- `IUserRepository`, `IQuestionRepository`, `IPdfImportRepository`, `IScraperRepository`, `IMockExamRepository`, `IDashboardRepository`, `ICommunityRepository`

Para apontar o frontend para uma API própria hospedada em outro servidor:

1. Implemente os endpoints esperados em `src/repositories/api/HttpApiRepositories.ts` (prefixo `/api/v1/*`) ou crie um novo adaptador implementando `IAppRepositories` em `src/repositories/`.
2. Defina no `.env` do frontend:
   ```env
   VITE_DATA_DRIVER="postgres"
   VITE_API_BASE_URL="https://api.seudominio.com"
   ```
3. Se servir o backend Node incluído em domínio separado, configure também `CORS_ORIGIN="https://app.seudominio.com"`.
