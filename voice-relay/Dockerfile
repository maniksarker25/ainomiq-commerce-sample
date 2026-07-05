FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev
COPY server.mjs ./
EXPOSE 8080
CMD ["node", "server.mjs"]
