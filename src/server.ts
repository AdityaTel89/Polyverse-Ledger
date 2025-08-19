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

const fastify = Fastify({
  logger: process.env.NODE_ENV === 'production' 
    ? {
        level: 'warn',
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            hostname: req.hostname,
            remoteAddress: req.ip,
          }),
        }
      }
    : true,
  bodyLimit: 1048576, // 1MB
  trustProxy: true,
  ignoreTrailingSlash: true,
});

// Register plugins
await fastify.register(cors, {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || 'https://polyverse-ledger-35727157380.europe-west1.run.app']
    : ['http://localhost:8080', 'http://localhost:5173', process.env.FRONTEND_URL || 'https://polyverse-ledger-35727157380.europe-west1.run.app'],
  credentials: true,
});

await fastify.register(formbody);

// JWT registration with proper validation
const jwtSecret = process.env.JWT_SECRET;

if (process.env.NODE_ENV === 'production' && !jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required in production');
}

await fastify.register(jwt, {
  secret: jwtSecret || 'supersecret',
});

// Register static file serving for React frontend
await fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../dist-frontend'),
  prefix: '/', // Serve directly from root
  decorateReply: false,
});

// Only register Swagger in development
if (process.env.NODE_ENV !== 'production') {
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

// Graceful route loading function
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
    { name: 'plan', path: './routes/plan.js', prefix: '/api/v1/plan' }
  ];

  for (const route of routes) {
    try {
      const routeModule = await import(route.path);
      const routeHandler = routeModule.default || 
                          routeModule[`${route.name}Routes`] || 
                          routeModule[route.name];
      
      if (!routeHandler) {
        console.warn(`⚠️ No route handler found for ${route.name}`);
        continue;
      }

      if (route.prefix) {
        await fastify.register(routeHandler, { prefix: route.prefix });
      } else {
        await fastify.register(routeHandler);
      }
      console.log(`✅ Loaded route: ${route.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ Failed to load route ${route.name}:`, message);
      
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Error details:', error);
      }
    }
  }
};

// Load routes with error handling
await loadRoutes();

// API Root route - Shows available endpoints
fastify.get('/api', async () => {
  return {
    message: 'MythosNet Universal Registry Protocol API',
    version: '1.0.0',
    endpoints: {
      dashboard: '/api/v1/dashboard',
      blockchain: '/api/v1/blockchain',
      user: '/api/v1/user',
      organization: '/api/v1/organization',
      invoices: '/api/v1/invoices',
      creditScore: '/api/v1/credit-score',
      crosschain: '/api/v1/crosschain',
      transaction: '/api/v1/transaction',
      plan: '/api/v1/plan',
      query: '/api/v1/query',
      paypal: '/paypal'
    }
  };
});


// Health check endpoint
fastify.get('/health', async () => {
  return { 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };
});

// Readiness probe
fastify.get('/ready', async () => {
  return { 
    status: 'ready', 
    timestamp: new Date().toISOString() 
  };
});

fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  // Type narrow the error to handle unknown type
  const err = error instanceof Error ? error : new Error(String(error));
  const statusCode = 'statusCode' in error && typeof error.statusCode === 'number' 
    ? error.statusCode 
    : 500;
  
  if (process.env.NODE_ENV === 'production') {
    reply.status(statusCode).send({
      error: 'Internal Server Error',
      timestamp: new Date().toISOString(),
    });
  } else {
    reply.status(statusCode).send({
      error: 'Internal Server Error',
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
  }
});



// 404 handler for API routes
fastify.setNotFoundHandler((request, reply) => {
  // If it's an API route that doesn't exist, return 404
  if (request.url.startsWith('/api') || 
      request.url.startsWith('/health') || 
      request.url.startsWith('/ready') || 
      request.url.startsWith('/paypal')) {
    reply.status(404).send({
      error: 'Route not found',
      path: request.url,
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  // For all other routes, serve React app
  import('fs').then(fs => {
    const indexPath = path.join(__dirname, '../dist-frontend/index.html');
    
    try {
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf8');
        reply.type('text/html').send(html);
      } else {
        reply.status(404).send({
          error: 'Frontend not found',
          message: 'Please run "npm run build:frontend" to build the React app first',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      // Type narrow the error properly
      const err = error instanceof Error ? error : new Error(String(error));
      reply.status(500).send({
        error: 'Error serving frontend',
        message: err.message,
        timestamp: new Date().toISOString()
      });
    }
  }).catch(error => {
    const err = error instanceof Error ? error : new Error(String(error));
    reply.status(500).send({
      error: 'Error loading filesystem module',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  });
});


// Enhanced startup function
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '8080');
    
    console.log(`Starting server on port ${port} with NODE_ENV=${process.env.NODE_ENV}`);
    console.log('Environment check:', {
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasSupabaseUrl: !!(process.env.SUPABASE_URL),
      hasSupabaseKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
    });
    
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`✅ Server successfully started on port ${port}`);
    console.log(`🌐 Serving both API and Frontend from same service`);
    console.log(`📱 Frontend: https://polyverse-ledger-35727157380.europe-west1.run.app/`);
    console.log(`🔗 API: https://polyverse-ledger-35727157380.europe-west1.run.app/api`);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📚 Swagger docs: http://localhost:${port}/documentation`);
    }
    
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('❌ Failed to start server:', {
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : 'Hidden in production',
      port: process.env.PORT,
      nodeEnv: process.env.NODE_ENV
    });
    
    process.exit(1);
  }
};

start();
