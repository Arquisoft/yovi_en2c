FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --silent

# copy users service code
COPY users/ .

# copy shared monitoring module
COPY monitoring /app/monitoring

COPY . .
EXPOSE 3000
CMD ["node", "users-service.js"]
