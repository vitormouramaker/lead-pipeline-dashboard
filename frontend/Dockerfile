# Etapa 1: build do React
FROM node:22-alpine AS build

WORKDIR /app

# Dependências primeiro, para aproveitar o cache de camadas.
COPY package.json package-lock.json ./
RUN npm ci

# Código fonte.
COPY . .

# A URL da API entra no bundle na hora do build (variável REACT_APP_*).
ARG REACT_APP_API_URL=http://localhost:5000/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV GENERATE_SOURCEMAP=false
RUN npm run build

# Etapa 2: só os arquivos estáticos, servidos pelo nginx.
FROM nginx:1.27-alpine

# Fallback de SPA: qualquer rota desconhecida devolve o index.html.
RUN printf 'server {\n  listen 3000;\n  root /usr/share/nginx/html;\n  location / {\n    try_files $uri /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf

COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 3000
