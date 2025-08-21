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

const fastify = Fastify({
  logger: isProd
    ? {
        level: 'info',
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
// CORS - Fixed TypeScript Error
// ==================
const corsOrigins = isProd
  ? ['https://mythosnet.com', 'https://www.mythosnet.com', process.env.FRONTEND_URL]
    .filter((origin): origin is string => typeof origin === 'string' && origin.length > 0)
  : ['http://localhost:8080', 'http://localhost:5173'];

await fastify.register(cors, {
  origin: corsOrigins,
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
// Route Loading Helper
// ==================
const checkFileExists = (filePath: string): boolean => {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
};

// ==================
// Load Routes Dynamically
// ==================
const loadRoutes = async () => {
  const routeConfigs = [
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

  let loadedCount = 0;
  const failedRoutes: Array<{name: string, reason: string, path: string}> = [];

  console.log(`\n🔄 Starting route loading process...`);
  console.log(`📁 Base directory: ${__dirname}`);

  for (const route of routeConfigs) {
    try {
      // Check multiple possible paths
      const possiblePaths = [
        path.resolve(__dirname, route.path),
        path.resolve(__dirname, route.path.replace('.js', '.ts')),
        path.resolve(__dirname, '..', route.path),
      ];

      let routePath = '';
      let foundFile = false;

      for (const testPath of possiblePaths) {
        if (checkFileExists(testPath)) {
          routePath = testPath;
          foundFile = true;
          break;
        }
      }

      if (!foundFile) {
        console.error(`❌ Route file not found: ${route.name}`);
        console.error(`   Searched paths:`);
        possiblePaths.forEach(p => console.error(`   - ${p}`));
        failedRoutes.push({ 
          name: route.name, 
          reason: 'File not found', 
          path: route.path 
        });
        continue;
      }

      console.log(`🔄 Loading route: ${route.name} from ${routePath}`);
      
      // Use file URL for proper ESM importing
      const routeURL = pathToFileURL(routePath).href;
      const routeModule = await import(routeURL);
      
      // Try multiple export patterns
      const handler =
        routeModule.default ||
        routeModule[`${route.name}Routes`] ||
        routeModule[route.name] ||
        routeModule.routes ||
        routeModule.router;

      if (!handler || typeof handler !== 'function') {
        console.error(`❌ No valid route handler found for ${route.name}`);
        console.error(`   Available exports:`, Object.keys(routeModule));
        failedRoutes.push({ 
          name: route.name, 
          reason: 'No valid handler found', 
          path: route.path 
        });
        continue;
      }

      // Register the route
      if (route.prefix) {
        await fastify.register(handler, { prefix: route.prefix });
        console.log(`✅ Loaded route: ${route.name} at ${route.prefix}`);
      } else {
        await fastify.register(handler);
        console.log(`✅ Loaded route: ${route.name} at /`);
      }
      
      loadedCount++;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`❌ Failed to load route ${route.name}:`, error.message);
      if (error.stack && !isProd) {
        console.error(`   Stack:`, error.stack);
      }
      failedRoutes.push({ 
        name: route.name, 
        reason: error.message, 
        path: route.path 
      });
      
      // In production, fail fast for critical routes
      if (isProd && ['dashboard', 'user', 'blockchain'].includes(route.name)) {
        throw new Error(`Critical route ${route.name} failed to load: ${error.message}`);
      }
    }
  }

  console.log(`\n📊 Route Loading Summary:`);
  console.log(`✅ Successfully loaded: ${loadedCount} routes`);
  console.log(`❌ Failed to load: ${failedRoutes.length} routes`);
  
  if (failedRoutes.length > 0) {
    console.log(`\n❌ Failed routes:`);
    failedRoutes.forEach(route => {
      console.log(`  - ${route.name}: ${route.reason}`);
    });
  }

  if (loadedCount === 0) {
    throw new Error('❌ No routes were loaded successfully! Server cannot start without routes.');
  }

  return { loadedCount, failedRoutes };
};

const routeLoadResult = await loadRoutes();

// ==================
// API Config Endpoint
// ==================
fastify.get('/api/v1/config', async () => {
  return {
    paypalClientId: process.env.PAYPAL_CLIENT_ID || null,
    apiBaseUrl: process.env.API_BASE_URL || '',
    environment: process.env.NODE_ENV || 'development',
    routesLoaded: routeLoadResult.loadedCount,
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
  routesLoaded: routeLoadResult.loadedCount,
}));

fastify.get('/ready', async () => ({
  status: 'ready',
  timestamp: new Date().toISOString(),
  routesLoaded: routeLoadResult.loadedCount,
}));

// ==================
// Debug Endpoints (dev only)
// ==================
if (!isProd) {
  fastify.get('/api/debug/routes', async () => {
    return {
      routes: fastify.printRoutes(),
      routeCount: fastify.printRoutes().split('\n').length - 1,
      loadResult: routeLoadResult
    };
  });

  fastify.get('/api/debug/files', async () => {
    const routesDir = path.join(__dirname, 'routes');
    let files: string[] = [];
    try {
      files = fs.readdirSync(routesDir);
    } catch {
      files = ['Directory not found'];
    }
    
    return {
      routesDirectory: routesDir,
      files: files,
      __dirname: __dirname,
    };
  });
}

// ==================
// Error Handler
// ==================
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error({
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
  });
  
  const statusCode =
    (error as any).statusCode && typeof (error as any).statusCode === 'number'
      ? (error as any).statusCode
      : 500;

  if (isProd) {
    reply.status(statusCode).send({
      error: 'Internal Server Error',
      timestamp: new Date().toISOString(),
      requestId: request.id,
    });
  } else {
    reply.status(statusCode).send({
      error: 'Internal Server Error',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      requestId: request.id,
    });
  }
});

// ==================
// SPA Fallback for React Router
// ==================
fastify.setNotFoundHandler((request, reply) => {
  // Log 404s for API routes to help debugging
  if (request.url.startsWith('/api')) {
    fastify.log.warn({
      message: 'API route not found',
      url: request.url,
      method: request.method,
      userAgent: request.headers['user-agent']
    });
    
    reply.status(404).send({
      error: 'API Route not found',
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      hint: 'Check if the route module loaded successfully. Visit /api/debug/routes in development.',
      availableRoutes: isProd ? undefined : fastify.printRoutes()
    });
    return;
  }

  // Serve React app for all non-API routes
  return reply.sendFile('index.html');
});

// ==================
// Start Server
// ==================
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '8080', 10);
    await fastify.listen({ port, host: '0.0.0.0' });

    console.log(`\n🎉 Server Successfully Started!`);
    console.log(`📍 Port: ${port}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Routes loaded: ${routeLoadResult.loadedCount}`);
    
    if (isProd) {
      console.log(`🌐 Frontend: https://www.mythosnet.com/`);
      console.log(`🔗 API: https://www.mythosnet.com/api`);
    } else {
      console.log(`🌐 Frontend: http://localhost:${port}/`);
      console.log(`🔗 API: http://localhost:${port}/api`);
      console.log(`🐛 Debug Routes: http://localhost:${port}/api/debug/routes`);
      console.log(`📁 Debug Files: http://localhost:${port}/api/debug/files`);
    }
    
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('❌ Failed to start server:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

start();
