FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --silent //NOSONAR

COPY . .
EXPOSE 3000
CMD ["node", "users-service.js"]
