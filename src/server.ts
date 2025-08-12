import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import dotenv from 'dotenv';
import formbody from '@fastify/formbody';

dotenv.config();

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
    ? [process.env.FRONTEND_URL || 'https://www.mythosnet.com']
    : ['http://localhost:3000', 'http://localhost:5173', process.env.FRONTEND_URL || 'https://www.mythosnet.com'],
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

// Graceful route loading function that prevents crashes
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
      
      // Show more details in development
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Error details:', error);
      }
    }
  }
};

// Load routes with error handling
await loadRoutes();

// Function to get route information (fixed TypeScript error)
const getRouteInfo = () => {
  try {
    return fastify.printRoutes();
  } catch (error) {
    return 'Route information unavailable';
  }
};

// Health check endpoint
fastify.get('/health', async () => {
  return { 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    routeInfo: getRouteInfo()
  };
});

// Readiness probe
fastify.get('/ready', async () => {
  return { 
    status: 'ready', 
    timestamp: new Date().toISOString() 
  };
});

// Enhanced error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  if (process.env.NODE_ENV === 'production') {
    reply.status(error.statusCode || 500).send({
      error: 'Internal Server Error',
      timestamp: new Date().toISOString(),
    });
  } else {
    reply.status(error.statusCode || 500).send({
      error: 'Internal Server Error',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }
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
