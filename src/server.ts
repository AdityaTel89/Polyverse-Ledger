import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import dotenv from 'dotenv';
import formbody from '@fastify/formbody';

dotenv.config();

import { paypalRoutes } from './routes/paypal.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { blockchainRoutes } from './routes/blockchain.js';
import { userRoutes } from './routes/user.js';
import { invoiceRoutes } from './routes/invoice.js';
import { creditScoreRoutes } from './routes/creditScore.js';
import { crossChainIdentityRoutes } from './routes/crossChainIdentity.js';
import { crossChainTransactionRoutes } from './routes/crossChainTransaction.js';
import { planRoutes } from './routes/plan.js';
import { queryRoutes } from './routes/query.js';
import { transactionRoutes } from './routes/transaction.js';
import { organizationRoutes } from './routes/organization.js';

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

// Fixed JWT registration with proper validation
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

// Register routes with proper prefixes
await fastify.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
await fastify.register(blockchainRoutes, { prefix: '/api/v1/blockchain' });
await fastify.register(userRoutes, { prefix: '/api/v1/user' });
await fastify.register(organizationRoutes, { prefix: '/api/v1/organization' });
await fastify.register(invoiceRoutes, { prefix: '/api/v1/invoices' });
await fastify.register(creditScoreRoutes, { prefix: '/api/v1/credit-score' });
await fastify.register(crossChainIdentityRoutes, { prefix: '/api/v1/crosschain' });
await fastify.register(crossChainTransactionRoutes, { prefix: '/api/v1/transaction/cross-chain' });
await fastify.register(queryRoutes, { prefix: '/api/v1/query' });
await fastify.register(transactionRoutes, { prefix: '/api/v1/transaction' });
await fastify.register(planRoutes, { prefix: '/api/v1/plan' });
await fastify.register(paypalRoutes);

// Health check
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

// Production-ready error handler
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

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`✅ Server running at http://localhost:${port}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📚 Swagger docs: http://localhost:${port}/documentation`);
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
