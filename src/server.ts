// src/server.ts - CLEAN PRODUCTION-READY VERSION FOR MYTHOSNET
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import dotenv from 'dotenv';
import formbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
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

// ---------------------------
// CORS configuration - FIXED TYPE ISSUE
// ---------------------------
const corsOrigins = isProd
  ? [
      'https://mythosnet.com',
      'https://www.mythosnet.com',
      process.env.FRONTEND_URL
    ].filter((origin): origin is string => 
      typeof origin === 'string' && origin.length > 0
    )
  : ['http://localhost:8080', 'http://localhost:5173'];

await fastify.register(cors, {
  origin: corsOrigins.length > 0 ? corsOrigins : false, // ✅ Fixed: Ensure valid origin array
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

// ---------------------------
// JWT configuration
// ---------------------------
const jwtSecret = process.env.JWT_SECRET;
if (isProd && !jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required in production');
}
await fastify.register(jwt, { secret: jwtSecret || 'supersecret' });

// ---------------------------
// Static file serving
// ---------------------------
const frontendPath = path.join(__dirname, '../dist-frontend');
if (fs.existsSync(frontendPath)) {
  await fastify.register(fastifyStatic, {
    root: frontendPath,
    prefix: '/',
    decorateReply: true,
  });
}

// ---------------------------
// Swagger docs (dev only)
// ---------------------------
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

// ---------------------------
// Route auto-loading - FIXED RETURN TYPE
// ---------------------------
const loadRoutes = async (): Promise<{ loadedCount: number; failedRoutes: Array<{ name: string; reason: string }> }> => {
  const routesDir = isProd
    ? path.join(__dirname, 'routes') // dist/routes
    : path.join(__dirname, 'routes'); // src/routes

  console.log(`🔍 Loading routes from: ${routesDir}`);
  console.log(`📂 Directory exists: ${fs.existsSync(routesDir)}`);
  console.log(`🏗️ Environment: ${isProd ? 'production' : 'development'}`);
  console.log(`📁 Current __dirname: ${__dirname}`);

  // If not found, print alternatives for debugging
  if (!fs.existsSync(routesDir)) {
    console.log(`❌ Routes directory does not exist: ${routesDir}`);
    const altPaths = [
      path.join(__dirname, '../routes'),
      path.join(process.cwd(), 'dist/routes'),
      path.join(process.cwd(), 'src/routes'),
      path.join(__dirname, '../../src/routes')
    ];
    
    for (const alt of altPaths) {
      if (fs.existsSync(alt)) {
        console.log(`✅ Found routes at alternative path: ${alt}`);
        break;
      } else {
        console.log(`❌ Not found at: ${alt}`);
      }
    }
    
    // ✅ Fixed: Always return the correct object structure
    return { loadedCount: 0, failedRoutes: [] };
  }

  const files = fs.readdirSync(routesDir);
  console.log(`📁 Files found in routes directory:`, files);

  const routeConfigs = [
    { name: 'user', file: isProd ? 'user.js' : 'user.ts', prefix: '/api/v1/user' },
    { name: 'blockchain', file: isProd ? 'blockchain.js' : 'blockchain.ts', prefix: '/api/v1/blockchain' },
    { name: 'invoice', file: isProd ? 'invoice.js' : 'invoice.ts', prefix: '/api/v1/invoices' },
    { name: 'transaction', file: isProd ? 'transaction.js' : 'transaction.ts', prefix: '/api/v1/transaction' },
    { name: 'creditScore', file: isProd ? 'creditScore.js' : 'creditScore.ts', prefix: '/api/v1/credit-score' },
    { name: 'crossChainIdentity', file: isProd ? 'crossChainIdentity.js' : 'crossChainIdentity.ts', prefix: '/api/v1/crosschain' },
    { name: 'crossChainTransaction', file: isProd ? 'crossChainTransaction.js' : 'crossChainTransaction.ts', prefix: '/api/v1/cross-chain-transaction' },
    { name: 'query', file: isProd ? 'query.js' : 'query.ts', prefix: '/api/v1/query' },
    { name: 'plan', file: isProd ? 'plan.js' : 'plan.ts', prefix: '/api/v1/plan' },
    { name: 'organization', file: isProd ? 'organization.js' : 'organization.ts', prefix: '/api/v1/organization' },
    { name: 'dashboard', file: isProd ? 'dashboard.js' : 'dashboard.ts', prefix: '/api/v1/dashboard' },
    { name: 'paypal', file: isProd ? 'paypal.js' : 'paypal.ts', prefix: '/api/v1/paypal' },
  ];

  let loadedCount = 0;
  const failedRoutes: Array<{ name: string; reason: string }> = [];

  for (const route of routeConfigs) {
    try {
      const routePath = path.join(routesDir, route.file);
      
      console.log(`🔍 Looking for route: ${routePath}`);
      
      if (!fs.existsSync(routePath)) {
        console.log(`❌ Route file not found: ${routePath}`);
        failedRoutes.push({ name: route.name, reason: 'File not found' });
        continue;
      }

      const routeURL = pathToFileURL(routePath).href;
      console.log(`🔗 Importing route from: ${routeURL}`);
      
      const routeModule = await import(routeURL);
      
      const handler = routeModule.default || 
                     routeModule[route.name] || 
                     routeModule[`${route.name}Routes`] ||
                     routeModule.userRoutes ||
                     routeModule.routes ||
                     routeModule.router;

      if (!handler || typeof handler !== 'function') {
        console.log(`❌ No valid handler found in ${route.name}`);
        console.log(`Available exports:`, Object.keys(routeModule));
        failedRoutes.push({ name: route.name, reason: 'No valid handler function found' });
        continue;
      }

      await fastify.register(handler, { prefix: route.prefix });
      loadedCount++;
      
      console.log(`✅ Registered ${route.name} at ${route.prefix}`);
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`❌ Failed to load ${route.name}:`, error.message);
      failedRoutes.push({ name: route.name, reason: error.message });
    }
  }

  console.log(`📊 Final Results: ${loadedCount} routes loaded, ${failedRoutes.length} failed`);
  
  if (failedRoutes.length > 0) {
    console.log(`❌ Failed routes:`, failedRoutes);
  }

  return { loadedCount, failedRoutes };
};

const routeResult = await loadRoutes();

// ---------------------------
// API Endpoints
// ---------------------------
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

if (!isProd) {
  fastify.get('/api/debug', async () => ({
    routes: fastify.printRoutes(),
    environment: process.env.NODE_ENV,
    routeResult,
    __dirname,
    cwd: process.cwd(),
    timestamp: new Date().toISOString(),
  }));
}

// ---------------------------
// Error Handlers
// ---------------------------
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

// ✅ Fixed: SPA-safe NotFoundHandler - Only serve index.html for routes, not assets
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

  // Serve React app for routes (URLs without file extensions)
  if (fs.existsSync(frontendPath) && !request.url.includes('.')) {
    return reply.sendFile('index.html');
  }
  
  // Otherwise, return 404 for missing assets
  reply.status(404).send({ error: 'Not found' });
});

// ---------------------------
// Server Startup
// ---------------------------
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
      console.warn(`⚠️ WARNING: No routes were loaded!`);
      console.warn(`🔍 Expected route files in: ${isProd ? 'dist/routes/' : 'src/routes/'}`);
    }

  } catch (err) {
    console.error('Server startup failed:', err);
    process.exit(1);
  }
};

start();
