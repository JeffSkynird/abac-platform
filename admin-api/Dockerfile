# --- build deps ---
FROM node:20-alpine AS deps
WORKDIR /app

# deps
COPY package*.json ./
RUN npm ci

# Build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy node_modules and dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/dist ./dist

EXPOSE 3001
CMD ["node","dist/main.js"]
