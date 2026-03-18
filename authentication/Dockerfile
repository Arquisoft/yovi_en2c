FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --silent --omit=dev --ignore-scripts

COPY . .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 5000
CMD ["node", "auth-service.js"]