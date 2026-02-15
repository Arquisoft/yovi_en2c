FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --silent --ignore-scripts

COPY gateway-service.js ./
EXPOSE 8080
CMD ["npm", "start"]
