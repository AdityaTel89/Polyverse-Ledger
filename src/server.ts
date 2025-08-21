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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';

const fastify = Fastify({
  logger: isProd
    ? {
        level: 'warn',
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            hostname: req.hostname,
            remoteAddress: req.ip,
          }),
        },
      }
    : true,
  bodyLimit: 1_048_576, // 1MB
  trustProxy: true,
  ignoreTrailingSlash: true,
});

// ==================
// CORS
// ==================
await fastify.register(cors, {
  origin: isProd
    ? [process.env.FRONTEND_URL || 'https://mythosnet.com']
    : ['http://localhost:8080', 'http://localhost:5173'],
  credentials: true,
});

await fastify.register(formbody);

// ==================
// JWT
// ==================
const jwtSecret = process.env.JWT_SECRET;
if (isProd && !jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required in production');
}
await fastify.register(jwt, { secret: jwtSecret || 'supersecret' });

// ==================
// Serve React Frontend
// ==================
await fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../dist-frontend'),
  prefix: '/', // Serve frontend at root
  decorateReply: true, // ✅ REQUIRED to use reply.sendFile()
});

// ==================
// Swagger (dev only)
// ==================
if (!isProd) {
  await fastify.register(swagger, {
    swagger: {
      info: {
        title: 'MythosNet Universal Registry Protocol API',
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
// Load Routes Dynamically
// ==================
const loadRoutes = async () => {
  const routes = [
    { name: 'paypal', path: './routes/paypal.js' },
    { name: 'dashboard', path: './routes/dashboard.js', prefix: '/api/v1/dashboard' },
    { name: 'blockchain', path: './routes/blockchain.js', prefix: '/api/v1/blockchain' },
    { name: 'user', path: './routes/user.js', prefix: '/api/v1/user' },
    { name: 'organization', path: './routes/organization.js', prefix: '/api/v1/organization' },
    { name: 'invoice', path: './routes/invoice.js', prefix: '/api/v1/invoices' },
    { name: 'creditScore', path: './routes/creditScore.js', prefix: '/api/v1/credit-score' },
    { name: 'crossChainIdentity', path: './routes/crossChainIdentity.js', prefix: '/api/v1/crosschain' },
    { name: 'crossChainTransaction', path: './routes/crossChainTransaction.js', prefix: '/api/v1/transaction/cross-chain' },
    { name: 'query', path: './routes/query.js', prefix: '/api/v1/query' },
    { name: 'transaction', path: './routes/transaction.js', prefix: '/api/v1/transaction' },
    { name: 'plan', path: './routes/plan.js', prefix: '/api/v1/plan' },
  ];

  for (const route of routes) {
    try {
      const routeModule = await import(route.path);
      const handler =
        routeModule.default ||
        routeModule[`${route.name}Routes`] ||
        routeModule[route.name];

      if (!handler) {
        console.warn(`⚠️ No route handler found for ${route.name} (${route.path})`);
        continue;
      }

      if (route.prefix) {
        await fastify.register(handler, { prefix: route.prefix });
      } else {
        await fastify.register(handler);
      }
      console.log(`✅ Loaded route: ${route.name}`);
    } catch (err) {
      console.warn(`⚠️ Failed to load route ${route.name} from ${route.path}:`, err);
    }
  }
};

await loadRoutes();

// ==================
// API Config Endpoint
// ==================
fastify.get('/api/v1/config', async () => {
  return {
    paypalClientId: process.env.PAYPAL_CLIENT_ID || null,
    apiBaseUrl: process.env.API_BASE_URL || '',
    environment: process.env.NODE_ENV || 'development',
  };
});

// ==================
// Health Checks
// ==================
fastify.get('/health', async () => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  version: process.env.npm_package_version || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
}));

fastify.get('/ready', async () => ({
  status: 'ready',
  timestamp: new Date().toISOString(),
}));

// ==================
// Error Handler
// ==================
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  const statusCode =
    (error as any).statusCode && typeof (error as any).statusCode === 'number'
      ? (error as any).statusCode
      : 500;

  if (isProd) {
    reply.status(statusCode).send({
      error: 'Internal Server Error',
      timestamp: new Date().toISOString(),
    });
  } else {
    reply.status(statusCode).send({
      error: 'Internal Server Error',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }
});

// ==================
// SPA Fallback for React Router
// ==================
fastify.setNotFoundHandler((request, reply) => {
  if (
    request.url.startsWith('/api') ||
    request.url.startsWith('/health') ||
    request.url.startsWith('/ready') ||
    request.url.startsWith('/paypal')
  ) {
    reply.status(404).send({
      error: 'Route not found',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // ✅ Always serve React's index.html for non-API routes
  return reply.sendFile('index.html');
});

// ==================
// Start Server
// ==================
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '8080', 10);
    await fastify.listen({ port, host: '0.0.0.0' });

    console.log(`✅ Server running on port ${port}`);
    console.log(`🌐 Frontend: https://www.mythosnet.com/`);
    console.log(`🔗 API: https://www.mythosnet.com/api`);
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

start();
