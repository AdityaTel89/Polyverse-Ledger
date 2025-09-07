import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BlockchainService } from '../services/blockchain.js';
import { z } from 'zod';
import { supabase } from '../lib/supabaseClient.js';
import { generateUUID, generateAPIKey } from '../utils/ubid.js';

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
  
  // ✅ FIXED: User blockchain registration using Supabase client
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

      // Check if user exists using Supabase - CASE INSENSITIVE SEARCH
      const { data: user, error: userError } = await supabase
        .from('User')
        .select('id, walletAddress, blockchainId')
        .ilike('walletAddress', walletAddress) // Case insensitive
        .eq('blockchainId', blockchainId)
        .single();

      if (userError || !user) {
        return reply.code(404).send({
          success: false,
          error: 'User not found. Please register your wallet first.'
        });
      }

      // ✅ Create new blockchain using Supabase
      try {
        const newBlockchainId = generateUUID();
        const apiKey = generateAPIKey();
        const ubid = generateUUID();
        const now = new Date().toISOString();

        const { data: newBlockchain, error: blockchainError } = await supabase
          .from('Blockchain')
          .insert({
            id: newBlockchainId,
            name: name.trim(),
            ubid: ubid,
            apiKey: apiKey,
            bnsName: name.trim().toLowerCase().replace(/\s+/g, '-'),
            networkType: 'mainnet',
            chainProtocol: 'ethereum',
            createdAt: now,
            updatedAt: now
          })
          .select()
          .single();

        if (blockchainError || !newBlockchain) {
          console.error('[DEBUG] Blockchain creation error:', blockchainError);
          return reply.code(500).send({
            success: false,
            error: 'Failed to create blockchain',
            details: blockchainError?.message || 'Unknown error'
          });
        }

        const response = {
          success: true,
          id: newBlockchain.id,
          name: newBlockchain.name,
          ubid: newBlockchain.ubid,
          bnsName: newBlockchain.bnsName,
          networkType: newBlockchain.networkType,
          chainProtocol: newBlockchain.chainProtocol,
          apiKey: newBlockchain.apiKey, // Include API key in response
          createdAt: newBlockchain.createdAt,
          registeredAt: now,
          message: 'New blockchain created successfully'
        };

        return reply.code(201).send(response);

      } catch (serviceError: any) {
        console.error('[DEBUG] Blockchain creation service error:', serviceError);
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

  // ✅ FIXED: Get user-registered blockchains using Supabase
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

      // Find user with blockchain info - CASE INSENSITIVE SEARCH
      const { data: user, error: userError } = await supabase
        .from('User')
        .select(`
          id,
          walletAddress,
          blockchainId,
          createdAt,
          Blockchain!blockchainId (
            id,
            name,
            ubid,
            bnsName,
            networkType,
            chainProtocol,
            createdAt,
            updatedAt
          )
        `)
        .ilike('walletAddress', walletAddress) // Case insensitive
        .eq('blockchainId', blockchainId)
        .single();

      if (userError || !user) {
        return reply.send({ 
          success: true,
          data: [],
          message: 'No user found. Please register your wallet first.'
        });
      }

      const userBlockchains: any[] = [];

      // Add user's primary blockchain
      if (user.Blockchain) {
        const blockchain = Array.isArray(user.Blockchain) ? user.Blockchain[0] : user.Blockchain;
        userBlockchains.push({
          id: blockchain.id,
          name: blockchain.name,
          ubid: blockchain.ubid,
          bnsName: blockchain.bnsName,
          networkType: blockchain.networkType,
          chainProtocol: blockchain.chainProtocol,
          registeredAt: user.createdAt,
          createdAt: blockchain.createdAt,
          updatedAt: blockchain.updatedAt,
          isPrimary: true
        });
      }

      // Get cross-chain identities for this user
      const { data: crossChainIdentities, error: crossChainError } = await supabase
        .from('CrossChainIdentity')
        .select(`
          id,
          walletAddress,
          createdAt,
          Blockchain!blockchainId (
            id,
            name,
            ubid,
            bnsName,
            networkType,
            chainProtocol,
            createdAt,
            updatedAt
          )
        `)
        .eq('userId', user.id);

      if (!crossChainError && crossChainIdentities) {
        // Add cross-chain identities blockchains
        crossChainIdentities.forEach((identity: any) => {
          if (identity.Blockchain && !userBlockchains.find(ub => ub.id === identity.Blockchain.id)) {
            const blockchain = Array.isArray(identity.Blockchain) ? identity.Blockchain[0] : identity.Blockchain;
            userBlockchains.push({
              id: blockchain.id,
              name: blockchain.name,
              ubid: blockchain.ubid,
              bnsName: blockchain.bnsName,
              networkType: blockchain.networkType,
              chainProtocol: blockchain.chainProtocol,
              registeredAt: identity.createdAt,
              createdAt: blockchain.createdAt,
              updatedAt: blockchain.updatedAt,
              isPrimary: false,
              crossChainWalletAddress: identity.walletAddress
            });
          }
        });
      }

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

  // ✅ FIXED: Verify API key endpoint using Supabase
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

      // Find blockchain by API key using Supabase
      const { data: blockchain, error: blockchainError } = await supabase
        .from('Blockchain')
        .select('id, name, ubid, bnsName, networkType, chainProtocol')
        .eq('apiKey', apiKey)
        .single();

      if (blockchainError || !blockchain) {
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

  // ✅ NEW: Health check for blockchain service
  fastify.get('/health', async (request, reply) => {
    try {
      // Test Supabase connection
      const { data, error } = await supabase.from('Blockchain').select('id').limit(1);
      if (error) throw error;
      
      return reply.send({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
        blockchainCount: data?.length || 0
      });
    } catch (error) {
      return reply.status(500).send({
        status: 'error',
        database: 'disconnected',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  });
}
