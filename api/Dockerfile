FROM node:22-alpine

WORKDIR /app

COPY package*.json package-lock.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

EXPOSE 4001

CMD ["npm", "start"]