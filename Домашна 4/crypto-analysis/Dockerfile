FROM node:20-alpine AS build
WORKDIR /app

# Build frontend
COPY src/package*.json ./src/
WORKDIR /app/src
RUN npm ci
COPY src/ .
RUN npm run build

# Prepare server
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/ .
COPY --from=build /app/src/dist/prototype-das ./dist/prototype-das

EXPOSE 4000
CMD ["node", "index.js"]
