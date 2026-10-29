# Production image: builds the React app, then runs the Express API that serves it.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 TRUST_PROXY=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY src/domain ./src/domain
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "server/index.js"]
