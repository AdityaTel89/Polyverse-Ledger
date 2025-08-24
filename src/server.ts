// src/server.ts
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
// CORS configuration (typed)
// ---------------------------
const prodOrigins = [
  'https://mythosnet.com',
  'https://www.mythosnet.com',
  process.env.FRONTEND_URL
].filter((o): o is string => typeof o === 'string' && o.length > 0);

const corsOrigins = isProd ? prodOrigins : ['http://localhost:8080', 'http://localhost:5173'];

await fastify.register(cors, {
  origin: corsOrigins.length > 0 ? corsOrigins : false,
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
// JWT
// ---------------------------
const jwtSecret = process.env.JWT_SECRET;
if (isProd && !jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required in production');
}
await fastify.register(jwt, { secret: jwtSecret || 'supersecret' });

// ---------------------------
// Frontend static serving
// ---------------------------
function resolveFrontendRoot(): string | null {
  // Prefer project-root/dist-frontend because server.js runs from dist/
  const candidates = [
    path.join(process.cwd(), 'dist-frontend'),
    path.join(__dirname, '../dist-frontend'),
    path.join(__dirname, '../../dist-frontend'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) return p;
  }
  return null;
}

const frontendRoot = resolveFrontendRoot();
if (frontendRoot) {
  await fastify.register(fastifyStatic, {
    root: frontendRoot,
    prefix: '/', // Serve from root
    decorateReply: true,
  });
  if (!isProd) {
    console.log(`🗂️ Serving frontend from: ${frontendRoot}`);
  }
} else {
  console.warn('⚠️ dist-frontend not found. Frontend assets will 404.');
}

// ---------------------------
// Swagger (dev only)
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
// Route autoloading
// ---------------------------
type LoadRoutesResult = { loadedCount: number; failedRoutes: Array<{ name: string; reason: string }> };

function resolveRoutesDir(): string | null {
  // In prod: dist/server.js => dist/routes
  // In dev:  src/server.ts  => src/routes
  const candidates = [
    path.join(__dirname, 'routes'),          // dist/routes or src/routes (depending on build)
    path.join(process.cwd(), 'dist/routes'), // explicit dist path
    path.join(process.cwd(), 'src/routes'),  // explicit src path
    path.join(__dirname, '../routes'),       // fallback
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const loadRoutes = async (): Promise<LoadRoutesResult> => {
  const routesDir = resolveRoutesDir();
  if (!routesDir) {
    console.warn('⚠️ Routes directory not found.');
    return { loadedCount: 0, failedRoutes: [] };
  }

  if (!isProd) {
    console.log(`🔍 Loading routes from: ${routesDir}`);
    try {
      console.log('📁 Files:', fs.readdirSync(routesDir));
    } catch {}
  }

  const fileExt = isProd ? '.js' : '.ts';
  const routeConfigs = [
    { name: 'user', file: 'user' + fileExt, prefix: '/api/v1/user' },
    { name: 'blockchain', file: 'blockchain' + fileExt, prefix: '/api/v1/blockchain' },
    { name: 'invoice', file: 'invoice' + fileExt, prefix: '/api/v1/invoices' },
    { name: 'transaction', file: 'transaction' + fileExt, prefix: '/api/v1/transaction' },
    { name: 'creditScore', file: 'creditScore' + fileExt, prefix: '/api/v1/credit-score' },
    { name: 'crossChainIdentity', file: 'crossChainIdentity' + fileExt, prefix: '/api/v1/crosschain' },
    { name: 'crossChainTransaction', file: 'crossChainTransaction' + fileExt, prefix: '/api/v1/cross-chain-transaction' },
    { name: 'query', file: 'query' + fileExt, prefix: '/api/v1/query' },
    { name: 'plan', file: 'plan' + fileExt, prefix: '/api/v1/plan' },
    { name: 'organization', file: 'organization' + fileExt, prefix: '/api/v1/organization' },
    { name: 'dashboard', file: 'dashboard' + fileExt, prefix: '/api/v1/dashboard' },
    { name: 'paypal', file: 'paypal' + fileExt, prefix: '/api/v1/paypal' },
  ];

  let loadedCount = 0;
  const failedRoutes: Array<{ name: string; reason: string }> = [];

  for (const route of routeConfigs) {
    try {
      const routePath = path.join(routesDir, route.file);
      if (!fs.existsSync(routePath)) {
        failedRoutes.push({ name: route.name, reason: 'File not found' });
        continue;
      }
      const routeURL = pathToFileURL(routePath).href;
      const mod = await import(routeURL);
      const handler =
        mod.default ||
        mod[route.name] ||
        mod[`${route.name}Routes`] ||
        mod.userRoutes ||
        mod.routes ||
        mod.router;

      if (typeof handler !== 'function') {
        failedRoutes.push({ name: route.name, reason: 'No valid handler function export' });
        continue;
      }

      await fastify.register(handler, { prefix: route.prefix });
      loadedCount++;
      if (!isProd) console.log(`✅ Registered ${route.name} at ${route.prefix}`);
    } catch (e) {
      failedRoutes.push({ name: route.name, reason: e instanceof Error ? e.message : String(e) });
      if (!isProd) console.error(`❌ Failed to load ${route.name}:`, e);
    }
  }

  if (!isProd) {
    console.log(`📊 Routes loaded: ${loadedCount}, Failed: ${failedRoutes.length}`);
    if (failedRoutes.length) console.log('❌ Failures:', failedRoutes);
  }

  return { loadedCount, failedRoutes };
};

const routeResult = await loadRoutes();

// ---------------------------
// Essential API Endpoints
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
// Error + NotFound Handlers
// ---------------------------
fastify.setErrorHandler((error, request, reply) => {
  const statusCode = (error as any).statusCode || 500;
  if (!isProd) console.error(`Error on ${request.method} ${request.url}:`, error.message);
  reply.status(statusCode).send({
    error: isProd ? 'Internal Server Error' : error.message,
    path: request.url,
    method: request.method,
    timestamp: new Date().toISOString(),
  });
});

// SPA-safe: only serve index.html for route-like URLs (no dot), not for missing assets
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
  if (frontendRoot && !request.url.includes('/api') && !request.url.includes('.')) {
    return reply.sendFile('index.html'); // from frontendRoot
  }
  reply.status(404).send({ error: 'Not found' });
});

// ---------------------------
/* Server Startup */
// ---------------------------
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '8080', 10);
    await fastify.listen({ port, host: '0.0.0.0' });

    console.log(`🎉 MythosNet Server Running on port ${port}`);
    console.log(`📊 API Routes: ${routeResult.loadedCount} loaded`);
    if (frontendRoot) console.log(`🗂️ Frontend root: ${frontendRoot}`);

    if (!isProd) {
      console.log(`🌐 Local: http://localhost:${port}`);
      console.log(`🔍 Debug: http://localhost:${port}/api/debug`);
    }

    if (routeResult.loadedCount === 0) {
      console.warn('⚠️ No routes were loaded. Ensure dist/routes exists in production or src/routes in dev.');
    }
    if (!frontendRoot) {
      console.warn('⚠️ dist-frontend not found. Ensure Vite build runs and is deployed.');
    }
  } catch (err) {
    console.error('Server startup failed:', err);
    process.exit(1);
  }
};

start();
