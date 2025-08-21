// src/server.ts
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

console.log(`🚀 Starting server in ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
console.log(`📁 Server directory: ${__dirname}`);

const fastify = Fastify({
  logger: isProd ? { level: 'info' } : true,
  bodyLimit: 1_048_576,
  trustProxy: true,
  ignoreTrailingSlash: true,
});

// ==================
// CORS Configuration
// ==================
const corsOrigins = isProd
  ? [
      'https://mythosnet.com',
      'https://www.mythosnet.com',
      process.env.FRONTEND_URL
    ].filter((origin): origin is string => typeof origin === 'string' && origin.length > 0)
  : ['http://localhost:8080', 'http://localhost:5173'];

console.log(`🔒 CORS origins:`, corsOrigins);

await fastify.register(cors, {
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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
console.log(`📂 Frontend path: ${frontendPath}`);
console.log(`📂 Frontend exists: ${fs.existsSync(frontendPath)}`);

await fastify.register(fastifyStatic, {
  root: frontendPath,
  prefix: '/',
  decorateReply: true,
});

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
// Route Loading with Enhanced Error Handling
// ==================
const loadRoutes = async () => {
  // Check what's actually in the routes directory
  const routesDir = path.join(__dirname, 'routes');
  console.log(`📁 Routes directory: ${routesDir}`);
  console.log(`📁 Routes directory exists: ${fs.existsSync(routesDir)}`);
  
  if (fs.existsSync(routesDir)) {
    const files = fs.readdirSync(routesDir);
    console.log(`📄 Available route files:`, files);
  }

  const routeConfigs = [
    { name: 'paypal', file: 'paypal.js' },
    { name: 'dashboard', file: 'dashboard.js', prefix: '/api/v1/dashboard' },
    { name: 'blockchain', file: 'blockchain.js', prefix: '/api/v1/blockchain' },
    { name: 'user', file: 'user.js', prefix: '/api/v1/user' },
    { name: 'organization', file: 'organization.js', prefix: '/api/v1/organization' },
    { name: 'invoice', file: 'invoice.js', prefix: '/api/v1/invoices' },
    { name: 'creditScore', file: 'creditScore.js', prefix: '/api/v1/credit-score' },
    { name: 'crossChainIdentity', file: 'crossChainIdentity.js', prefix: '/api/v1/crosschain' },
    { name: 'crossChainTransaction', file: 'crossChainTransaction.js', prefix: '/api/v1/transaction/cross-chain' },
    { name: 'query', file: 'query.js', prefix: '/api/v1/query' },
    { name: 'transaction', file: 'transaction.js', prefix: '/api/v1/transaction' },
    { name: 'plan', file: 'plan.js', prefix: '/api/v1/plan' },
  ];

  let loadedCount = 0;
  const failedRoutes: Array<{name: string, reason: string}> = [];

  for (const route of routeConfigs) {
    try {
      const routePath = path.join(routesDir, route.file);
      
      if (!fs.existsSync(routePath)) {
        console.error(`❌ Route file not found: ${routePath}`);
        failedRoutes.push({ name: route.name, reason: 'File not found' });
        continue;
      }

      console.log(`🔄 Loading route: ${route.name} from ${routePath}`);
      
      const routeURL = pathToFileURL(routePath).href;
      const routeModule = await import(routeURL);
      
      const handler = routeModule.default || 
                     routeModule[route.name] || 
                     routeModule[`${route.name}Routes`] ||
                     routeModule.routes ||
                     routeModule.router;

      if (!handler) {
        console.error(`❌ No handler found in ${route.name}. Available exports:`, Object.keys(routeModule));
        failedRoutes.push({ name: route.name, reason: 'No handler found' });
        continue;
      }

      if (route.prefix) {
        await fastify.register(handler, { prefix: route.prefix });
        console.log(`✅ Registered ${route.name} at ${route.prefix}`);
      } else {
        await fastify.register(handler);
        console.log(`✅ Registered ${route.name} at /`);
      }
      
      loadedCount++;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`❌ Failed to load ${route.name}:`, error.message);
      failedRoutes.push({ name: route.name, reason: error.message });
    }
  }

  console.log(`\n📊 Route Loading Results:`);
  console.log(`✅ Loaded: ${loadedCount} routes`);
  console.log(`❌ Failed: ${failedRoutes.length} routes`);
  
  if (failedRoutes.length > 0) {
    console.log(`Failed routes:`, failedRoutes);
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

// Debug endpoint for development
if (!isProd) {
  fastify.get('/api/debug', async () => ({
    routes: fastify.printRoutes(),
    environment: process.env.NODE_ENV,
    __dirname,
    routeResult,
  }));
}

// ==================
// Enhanced Error Handler
// ==================
fastify.setErrorHandler((error, request, reply) => {
  console.error(`💥 Error on ${request.method} ${request.url}:`, error.message);
  
  const statusCode = (error as any).statusCode || 500;
  
  const errorResponse = {
    error: isProd ? 'Internal Server Error' : error.message,
    path: request.url,
    method: request.method,
    timestamp: new Date().toISOString(),
    ...(isProd ? {} : { stack: error.stack }),
  };

  reply.status(statusCode).send(errorResponse);
});

// ==================
// Enhanced 404 Handler
// ==================
fastify.setNotFoundHandler((request, reply) => {
  console.warn(`🔍 404: ${request.method} ${request.url}`);
  
  if (request.url.startsWith('/api')) {
    reply.status(404).send({
      error: 'API endpoint not found',
      path: request.url,
      method: request.method,
      availableEndpoints: isProd ? undefined : fastify.printRoutes(),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Serve React app for non-API routes
  return reply.sendFile('index.html');
});

// ==================
// Server Startup
// ==================
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '8080', 10);
    await fastify.listen({ port, host: '0.0.0.0' });

    console.log(`\n🎉 MythosNet Server Running!`);
    console.log(`📍 Port: ${port}`);
    console.log(`🌍 Environment: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`📊 API Routes: ${routeResult.loadedCount} loaded`);
    
    if (isProd) {
      console.log(`🌐 URL: https://www.mythosnet.com`);
    } else {
      console.log(`🌐 Local: http://localhost:${port}`);
      console.log(`🔍 Debug: http://localhost:${port}/api/debug`);
    }

  } catch (err) {
    console.error('💥 Server startup failed:', err);
    process.exit(1);
  }
};

start();
