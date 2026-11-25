# Imagem OCI compatível com Podman e Docker para rodar o AprovaFoco localmente ou em produção
FROM docker.io/library/node:22-bookworm-slim

WORKDIR /app

# Instala dependências antes de copiar o código para aproveitar cache de camadas
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# Permite sobrescrever VITE_DATA_DRIVER / VITE_API_BASE_URL durante o build da SPA
ARG VITE_DATA_DRIVER=postgres
ARG VITE_API_BASE_URL=
ENV VITE_DATA_DRIVER=${VITE_DATA_DRIVER}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV NODE_ENV=production

RUN npm run build

# Executa com usuário não-privilegiado incluído na imagem oficial Node
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npm", "start"]
