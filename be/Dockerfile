# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p uploads/temp uploads/chunks uploads/processed

EXPOSE 3000

CMD ["node", "server.js"]