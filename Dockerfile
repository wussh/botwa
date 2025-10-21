FROM node:20-alpine AS builder
WORKDIR /app

# Install git (required by some npm dependencies)
RUN apk add --no-cache git

COPY package*.json ./
RUN npm install --production

FROM node:20-alpine
WORKDIR /app

# Install git in runtime as well (in case it's needed)
RUN apk add --no-cache git

COPY --from=builder /app/node_modules ./node_modules
COPY . .

VOLUME ["/app/auth", "/app/memory"]

ENV TZ=Asia/Jakarta
ENV NODE_ENV=production

CMD ["node", "src/index.js"]