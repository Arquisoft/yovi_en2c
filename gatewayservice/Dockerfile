FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --silent --ignore-scripts

COPY . .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000
CMD ["node", "users-service.js"]
