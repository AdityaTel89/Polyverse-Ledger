import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BlockchainService } from '../services/blockchain.js';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
const prisma = new PrismaClient();

// Input validation schemas
const registerBlockchainSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid characters in name")
    .trim()
});

const verifyApiKeySchema = z.object({
  apiKey: z.string().min(1, "API key is required")
});

// Response types
interface BlockchainListResponse {
  id: string;
  name: string;
  ubid: string;
  bnsName?: string | null;
  networkType: string;
  chainProtocol: string;
  createdAt: string;
  updatedAt: string;
}

interface RegisterBlockchainResponse {
  id: string;
  name: string;
  ubid: string;
  bnsName?: string | null;
  networkType: string;
  chainProtocol: string;
  createdAt: string;
  ipfsHash?: string;
}

export async function blockchainRoutes(fastify: FastifyInstance) {
  // Register a new blockchain
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { 
            type: 'string',
            minLength: 1,
            maxLength: 100,
            pattern: '^0x[a-fA-F0-9]{40}$'
          }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            ubid: { type: 'string' },
            bnsName: { type: ['string', 'null'] },
            networkType: { type: 'string' },
            chainProtocol: { type: 'string' },
            createdAt: { type: 'string' },
            ipfsHash: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'string' }
          }
        },
        409: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            field: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validationResult = registerBlockchainSchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: validationResult.error.errors.map(e => e.message).join(', ')
        });
      }

      const { name } = validationResult.data;

      const blockchain = await BlockchainService.register({
        name,
        networkType: 'mainnet',
        chainProtocol: 'ethereum'
      });

      const response: RegisterBlockchainResponse = {
        id: blockchain.id,
        name: blockchain.name,
        ubid: blockchain.ubid,
        bnsName: blockchain.bnsName,
        networkType: blockchain.networkType,
        chainProtocol: blockchain.chainProtocol,
        createdAt: blockchain.createdAt.toISOString(),
        ...(blockchain.ipfsHash && { ipfsHash: blockchain.ipfsHash })
      };

      return reply.code(201).send(response);

    } catch (error: any) {
      fastify.log.error('Blockchain register error:', error);

      // Handle Prisma unique constraint violations
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = (error.meta?.target as string[] | undefined);
          const field = target?.[0] || 'field';
          return reply.code(409).send({
            error: `${field} already exists`,
            field
          });
        }
      }

      if (error.message && error.message !== 'Failed to register blockchain') {
        return reply.code(400).send({
          error: error.message
        });
      }

      return reply.code(500).send({
        error: 'Failed to register blockchain'
      });
    }
  });

  // Get list of blockchains
  fastify.get('/list', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              ubid: { type: 'string' },
              bnsName: { type: ['string', 'null'] },
              networkType: { type: 'string' },
              chainProtocol: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const blockchains = await prisma.blockchain.findMany({
        select: {
          id: true,
          name: true,
          ubid: true,
          bnsName: true,
          networkType: true,
          chainProtocol: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const response: BlockchainListResponse[] = blockchains.map((blockchain: any) => ({
        id: blockchain.id,
        name: blockchain.name,
        ubid: blockchain.ubid,
        bnsName: blockchain.bnsName,
        networkType: blockchain.networkType,
        chainProtocol: blockchain.chainProtocol,
        createdAt: blockchain.createdAt.toISOString(),
        updatedAt: blockchain.updatedAt.toISOString()
      }));

      return reply.send(response);

    } catch (error: any) {
      fastify.log.error('Failed to fetch blockchains:', error);
      return reply.code(500).send({
        error: 'Failed to fetch blockchains'
      });
    }
  });

  // Verify API key (for internal use)
  fastify.get('/verify', {
    schema: {
      querystring: {
        type: 'object',
        required: ['apiKey'],
        properties: {
          apiKey: { type: 'string', minLength: 1 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            blockchainId: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validationResult = verifyApiKeySchema.safeParse(request.query);
      if (!validationResult.success) {
        return reply.code(400).send({
          error: 'Invalid API key format'
        });
      }

      const { apiKey } = validationResult.data;
      const verificationResult = await BlockchainService.verifyApiKey(apiKey);

      return reply.send(verificationResult);

    } catch (error: any) {
      fastify.log.error('API key verification error:', error);
      return reply.code(500).send({
        error: 'Failed to verify API key'
      });
    }
  });

  // Get blockchain by UBID
  fastify.get('/ubid/:ubid', {
    schema: {
      params: {
        type: 'object',
        required: ['ubid'],
        properties: {
          ubid: { type: 'string', minLength: 1 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            ubid: { type: 'string' },
            bnsName: { type: ['string', 'null'] },
            networkType: { type: 'string' },
            chainProtocol: { type: 'string' },
            createdAt: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { ubid } = request.params as { ubid: string };
      const blockchain = await BlockchainService.resolveUBID(ubid);
      
      return reply.send({
        id: blockchain.id,
        name: blockchain.name,
        ubid: blockchain.ubid,
        bnsName: blockchain.bnsName,
        networkType: blockchain.networkType,
        chainProtocol: blockchain.chainProtocol,
        createdAt: blockchain.createdAt.toISOString()
      });

    } catch (error: any) {
      if (error.message === 'Blockchain not found') {
        return reply.code(404).send({ error: 'Blockchain not found' });
      }
      
      fastify.log.error('UBID resolution error:', error);
      return reply.code(500).send({ error: 'Failed to resolve UBID' });
    }
  });

  // Get blockchain by BNS name
  fastify.get('/bns/:bnsName', {
    schema: {
      params: {
        type: 'object',
        required: ['bnsName'],
        properties: {
          bnsName: { type: 'string', minLength: 1 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            ubid: { type: 'string' },
            bnsName: { type: ['string', 'null'] },
            networkType: { type: 'string' },
            chainProtocol: { type: 'string' },
            createdAt: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { bnsName } = request.params as { bnsName: string };
      const blockchain = await BlockchainService.resolveBNS(bnsName);
      
      return reply.send({
        id: blockchain.id,
        name: blockchain.name,
        ubid: blockchain.ubid,
        bnsName: blockchain.bnsName,
        networkType: blockchain.networkType,
        chainProtocol: blockchain.chainProtocol,
        createdAt: blockchain.createdAt.toISOString()
      });

    } catch (error: any) {
      if (error.message === 'BNS name not found') {
        return reply.code(404).send({ error: 'BNS name not found' });
      }
      
      fastify.log.error('BNS resolution error:', error);
      return reply.code(500).send({ error: 'Failed to resolve BNS name' });
    }
  });
}
