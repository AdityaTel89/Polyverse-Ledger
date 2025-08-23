// src/server.ts - CLEAN PRODUCTION-READY VERSION FOR MYTHOSNET
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import dotenv from 'dotenv';
import formbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';

const fastify = Fastify({
  logger: isProd ? { level: 'info' } : { level: 'warn' },
  bodyLimit: 1_048_576,
  trustProxy: true,
  ignoreTrailingSlash: true,
});

// ==================
// CORS Configuration - FIXED FOR X-HEADERS
// ==================
const corsOrigins = isProd
  ? [
      'https://mythosnet.com',
      'https://www.mythosnet.com',
      process.env.FRONTEND_URL
    ].filter((origin): origin is string => typeof origin === 'string' && origin.length > 0)
  : ['http://localhost:8080', 'http://localhost:5173'];

await fastify.register(cors, {
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Chain-Id',
    'X-Blockchain-Id',
    'X-Wallet-Address',
    'Accept',
    'Origin'
  ]
});

await fastify.register(formbody);

// ==================
// JWT Configuration
// ==================
const jwtSecret = process.env.JWT_SECRET;
if (isProd && !jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required in production');
}
await fastify.register(jwt, { secret: jwtSecret || 'supersecret' });

// ==================
// Static File Serving
// ==================
const frontendPath = path.join(__dirname, '../dist-frontend');
if (fs.existsSync(frontendPath)) {
  await fastify.register(fastifyStatic, {
    root: frontendPath,
    prefix: '/',
    decorateReply: true,
  });
}

// ==================
// Swagger (dev only)
// ==================
if (!isProd) {
  await fastify.register(swagger, {
    swagger: {
      info: {
        title: 'MythosNet API',
        description: 'API documentation',
        version: '1.0.0',
      },
      schemes: ['https', 'http'],
      consumes: ['application/json'],
      produces: ['application/json'],
    },
  });
}

// ==================
// Route Loading
// ==================
const loadRoutes = async () => {
  const routesDir = path.join(__dirname, 'routes');
  
  if (!fs.existsSync(routesDir)) {
    console.error(`Routes directory does not exist: ${routesDir}`);
    return { loadedCount: 0, failedRoutes: [] };
  }

  const routeConfigs = [
    { name: 'user', file: 'user.ts', prefix: '/api/v1/user' },
    { name: 'blockchain', file: 'blockchain.ts', prefix: '/api/v1/blockchain' },
    { name: 'invoice', file: 'invoice.ts', prefix: '/api/v1/invoices' },
    { name: 'transaction', file: 'transaction.ts', prefix: '/api/v1/transaction' },
    { name: 'creditScore', file: 'creditScore.ts', prefix: '/api/v1/credit-score' },
    { name: 'crossChainIdentity', file: 'crossChainIdentity.ts', prefix: '/api/v1/crosschain' },
    { name: 'crossChainTransaction', file: 'crossChainTransaction.ts', prefix: '/api/v1/cross-chain-transaction' },
    { name: 'query', file: 'query.ts', prefix: '/api/v1/query' },
    { name: 'plan', file: 'plan.ts', prefix: '/api/v1/plan' },
    { name: 'organization', file: 'organization.ts', prefix: '/api/v1/organization' },
    { name: 'dashboard', file: 'dashboard.ts', prefix: '/api/v1/dashboard' },
    { name: 'paypal', file: 'paypal.ts', prefix: '/api/v1/paypal' },
  ];

  let loadedCount = 0;
  const failedRoutes: Array<{name: string, reason: string}> = [];

  for (const route of routeConfigs) {
    try {
      const routePath = path.join(routesDir, route.file);
      
      if (!fs.existsSync(routePath)) {
        failedRoutes.push({ name: route.name, reason: 'File not found' });
        continue;
      }

      const routeURL = pathToFileURL(routePath).href;
      const routeModule = await import(routeURL);
      
      const handler = routeModule.default || 
                     routeModule[route.name] || 
                     routeModule[`${route.name}Routes`] ||
                     routeModule.userRoutes ||
                     routeModule.routes ||
                     routeModule.router;

      if (!handler || typeof handler !== 'function') {
        failedRoutes.push({ name: route.name, reason: 'No valid handler function found' });
        continue;
      }

      await fastify.register(handler, { prefix: route.prefix });
      loadedCount++;
      
      if (!isProd) {
        console.log(`✅ Registered ${route.name} at ${route.prefix}`);
      }
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      failedRoutes.push({ name: route.name, reason: error.message });
      if (!isProd) {
        console.error(`Failed to load ${route.name}:`, error.message);
      }
    }
  }

  if (!isProd) {
    console.log(`Routes loaded: ${loadedCount}, Failed: ${failedRoutes.length}`);
  }

  return { loadedCount, failedRoutes };
};

const routeResult = await loadRoutes();

// ==================
// Essential API Endpoints
// ==================
fastify.get('/api/v1/config', async () => ({
  paypalClientId: process.env.PAYPAL_CLIENT_ID || null,
  apiBaseUrl: process.env.API_BASE_URL || '',
  environment: process.env.NODE_ENV || 'development',
  routesLoaded: routeResult.loadedCount,
  timestamp: new Date().toISOString(),
}));

fastify.get('/health', async () => ({
  status: 'healthy',
  environment: process.env.NODE_ENV || 'development',
  routesLoaded: routeResult.loadedCount,
  timestamp: new Date().toISOString(),
}));

// Debug endpoint for development only
if (!isProd) {
  fastify.get('/api/debug', async () => ({
    routes: fastify.printRoutes(),
    environment: process.env.NODE_ENV,
    routeResult,
    timestamp: new Date().toISOString(),
  }));
}

// ==================
// Error Handlers
// ==================
fastify.setErrorHandler((error, request, reply) => {
  const statusCode = (error as any).statusCode || 500;
  
  if (!isProd) {
    console.error(`Error on ${request.method} ${request.url}:`, error.message);
  }
  
  reply.status(statusCode).send({
    error: isProd ? 'Internal Server Error' : error.message,
    path: request.url,
    method: request.method,
    timestamp: new Date().toISOString(),
  });
});

fastify.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith('/api')) {
    reply.status(404).send({
      error: 'API endpoint not found',
      path: request.url,
      method: request.method,
      routesLoaded: routeResult.loadedCount,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Serve React app for non-API routes
  if (fs.existsSync(frontendPath)) {
    return reply.sendFile('index.html');
  } else {
    reply.status(404).send({ error: 'Frontend not found' });
  }
});

// ==================
// Server Startup
// ==================
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '8080', 10);
    await fastify.listen({ port, host: '0.0.0.0' });

    console.log(`🎉 MythosNet Server Running on port ${port}`);
    console.log(`📊 API Routes: ${routeResult.loadedCount} loaded`);
    
    if (!isProd) {
      console.log(`🌐 Local: http://localhost:${port}`);
      console.log(`🔍 Debug: http://localhost:${port}/api/debug`);
    }

    if (routeResult.loadedCount === 0) {
      console.warn(`⚠️  WARNING: No routes were loaded!`);
    }

  } catch (err) {
    console.error('Server startup failed:', err);
    process.exit(1);
  }
};

start();
