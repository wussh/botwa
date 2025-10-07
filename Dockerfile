FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --production

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY . .

VOLUME ["/app/auth", "/app/memory"]

ENV TZ=Asia/Jakarta

CMD ["node", "bot.js"]