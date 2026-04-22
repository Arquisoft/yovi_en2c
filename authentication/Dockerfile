FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --silent

# copy service code
COPY authentication/ .

# copy shared monitoring module
COPY monitoring /app/monitoring

COPY . .

EXPOSE 5000

CMD ["node", "auth-service.js"]