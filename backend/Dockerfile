# Imagem de origem
FROM node:22-alpine

# Diretório de trabalho (onde a aplicação fica dentro do container).
WORKDIR /app

# Dependências primeiro, para aproveitar o cache de camadas.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Código da aplicação.
COPY . .

# Roda sem root.
USER node

EXPOSE 5000

# Inicializa a aplicação (as tabelas são criadas na subida).
CMD ["node", "server.js"]
