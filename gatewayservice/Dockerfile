FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --silent

COPY gateway-service.js ./
EXPOSE 8080
CMD ["npm", "start"]
