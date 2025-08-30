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
    .regex(/^[a-zA-Z0-9\s\-_]+$/, "Invalid characters in name")
    .trim(),
  walletAddress: z.string().min(1, "Wallet address is required"),
  blockchainId: z.string().min(1, "Blockchain ID is required")
});

const userRegisteredSchema = z.object({
  walletAddress: z.string().min(1, "Wallet address is required"),
  blockchainId: z.string().min(1, "Blockchain ID is required")
});

const verifyApiKeySchema = z.object({
  apiKey: z.string().min(1, "API key is required")
});

export async function blockchainRoutes(fastify: FastifyInstance) {
  
  // ✅ FIXED: User blockchain registration - ALWAYS creates a new blockchain per user
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'walletAddress', 'blockchainId'],
        properties: {
          name: { 
            type: 'string',
            minLength: 1,
            maxLength: 100,
            pattern: '^[a-zA-Z0-9\\s\\-_]+$'
          },
          walletAddress: { type: 'string', minLength: 1 },
          blockchainId: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validationResult = registerBlockchainSchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.code(400).send({
          success: false,
          error: 'Validation failed',
          details: validationResult.error.errors.map(e => e.message).join(', ')
        });
      }

      const { name, walletAddress, blockchainId } = validationResult.data;

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: {
          blockchainId_walletAddress: {
            blockchainId: blockchainId,
            walletAddress: walletAddress
          }
        }
      });

      if (!user) {
        return reply.code(404).send({
          success: false,
          error: 'User not found. Please register your wallet first.'
        });
      }

      // ✅ ALWAYS CREATE NEW BLOCKCHAIN - No duplicate checking
      // Each user gets their own blockchain instance with unique UBID
      try {
        const newBlockchainData = await BlockchainService.register({
          name,
          networkType: 'mainnet',
          chainProtocol: 'ethereum'
        });

        // Null check for the service response
        if (!newBlockchainData) {
          console.error('[DEBUG] BlockchainService.register returned null/undefined');
          return reply.code(500).send({
            success: false,
            error: 'Failed to create blockchain - service returned null'
          });
        }

        // Fetch the complete blockchain record from database
        const blockchain = await prisma.blockchain.findUnique({
          where: { id: newBlockchainData.id }
        });

        if (!blockchain) {
          console.error('[DEBUG] Failed to fetch created blockchain from database');
          return reply.code(500).send({
            success: false,
            error: 'Failed to fetch created blockchain'
          });
        }

        const response = {
          success: true,
          id: blockchain.id,
          name: blockchain.name,
          ubid: blockchain.ubid,
          bnsName: blockchain.bnsName,
          networkType: blockchain.networkType,
          chainProtocol: blockchain.chainProtocol,
          createdAt: blockchain.createdAt.toISOString(),
          registeredAt: new Date().toISOString(),
          message: 'New blockchain created successfully'
        };

        return reply.code(201).send(response);

      } catch (serviceError: any) {
        console.error('[DEBUG] BlockchainService.register error:', serviceError);
        return reply.code(500).send({
          success: false,
          error: 'Failed to register blockchain via service',
          details: serviceError.message
        });
      }

    } catch (error: any) {
      console.error('[DEBUG] Registration error:', error);
      fastify.log.error('Blockchain register error:', error);

      return reply.code(500).send({
        success: false,
        error: 'Failed to register blockchain',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get user-registered blockchains
  fastify.get('/user-registered', {
    schema: {
      querystring: {
        type: 'object',
        required: ['walletAddress', 'blockchainId'],
        properties: {
          walletAddress: { type: 'string', minLength: 1 },
          blockchainId: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validationResult = userRegisteredSchema.safeParse(request.query);
      if (!validationResult.success) {
        return reply.code(400).send({
          success: false,
          error: 'Missing required parameters: walletAddress and blockchainId',
          details: validationResult.error.errors.map(e => e.message).join(', ')
        });
      }

      const { walletAddress, blockchainId } = validationResult.data;

      const user = await prisma.user.findUnique({
        where: {
          blockchainId_walletAddress: {
            blockchainId: blockchainId,
            walletAddress: walletAddress
          }
        },
        include: {
          blockchain: true
        }
      });

      if (!user) {
        return reply.send({ 
          success: true,
          data: [],
          message: 'No user found. Please register your wallet first.'
        });
      }

      const userBlockchains: any[] = [];

      // Add user's primary blockchain
      if (user.blockchain) {
        userBlockchains.push({
          id: user.blockchain.id,
          name: user.blockchain.name,
          ubid: user.blockchain.ubid,
          bnsName: user.blockchain.bnsName,
          networkType: user.blockchain.networkType,
          chainProtocol: user.blockchain.chainProtocol,
          registeredAt: user.createdAt.toISOString(),
          createdAt: user.blockchain.createdAt.toISOString(),
          updatedAt: user.blockchain.updatedAt.toISOString(),
          isPrimary: true
        });
      }

      // Get cross-chain identities for this user
      const crossChainIdentities = await prisma.crossChainIdentity.findMany({
        where: {
          userId: user.id
        },
        include: {
          blockchain: true
        }
      });

      // Add cross-chain identities blockchains
      crossChainIdentities.forEach((identity: any) => {
        if (identity.blockchain && !userBlockchains.find(ub => ub.id === identity.blockchain.id)) {
          userBlockchains.push({
            id: identity.blockchain.id,
            name: identity.blockchain.name,
            ubid: identity.blockchain.ubid,
            bnsName: identity.blockchain.bnsName,
            networkType: identity.blockchain.networkType,
            chainProtocol: identity.blockchain.chainProtocol,
            registeredAt: identity.createdAt.toISOString(),
            createdAt: identity.blockchain.createdAt.toISOString(),
            updatedAt: identity.blockchain.updatedAt.toISOString(),
            isPrimary: false,
            crossChainWalletAddress: identity.walletAddress
          });
        }
      });

      return reply.send({
        success: true,
        data: userBlockchains,
        count: userBlockchains.length
      });

    } catch (error: any) {
      console.error('[DEBUG] Error fetching user registered blockchains:', error);
      fastify.log.error('Failed to fetch user registered blockchains:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch registered blockchains',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Verify API key endpoint
  fastify.post('/verify', {
    schema: {
      body: {
        type: 'object',
        required: ['apiKey'],
        properties: {
          apiKey: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validationResult = verifyApiKeySchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.code(400).send({
          success: false,
          error: 'Validation failed',
          details: validationResult.error.errors.map(e => e.message).join(', ')
        });
      }

      const { apiKey } = validationResult.data;

      const blockchain = await prisma.blockchain.findFirst({
        where: { apiKey: apiKey }
      });

      if (!blockchain) {
        return reply.code(404).send({
          success: false,
          error: 'Invalid API key'
        });
      }

      return reply.send({
        success: true,
        blockchain: {
          id: blockchain.id,
          name: blockchain.name,
          ubid: blockchain.ubid,
          bnsName: blockchain.bnsName,
          networkType: blockchain.networkType,
          chainProtocol: blockchain.chainProtocol
        }
      });

    } catch (error: any) {
      console.error('[DEBUG] API key verification error:', error);
      fastify.log.error('API key verification error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to verify API key',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
}
