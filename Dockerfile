# Stage 1: Build Stage
FROM node:20 AS build

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all source code
COPY . .

# Build frontend and backend
RUN npm run build:frontend
RUN npm run build:backend
    
# Stage 2: Production Stage
FROM node:20-slim

WORKDIR /app

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend and backend from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-frontend ./dist-frontend
COPY --from=build /app/prisma ./prisma

# Expose port
EXPOSE 8080

# Start the app
CMD ["node", "dist/server.js"]
