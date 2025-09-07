// src/routes/user.ts - GASLESS VERSION FOR MYTHOSNET
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabase } from '../lib/supabaseClient.js';
import { generateUUID, generateAPIKey } from '../utils/ubid.js';
import { walletValidationHook } from '../middleware/validateWallet.js';
import { queryLimitHook } from '../middleware/queryLimit.js';
import { isTrialActive } from '../utils/isTrialActive.js';
import { checkUserPlanLimits, canAddWalletToUser } from '../utils/checkUserPlanLimits.js';
import { fetchWalletData, validateWalletAddress } from '../services/userWalletFetcher.js';
// GASLESS IMPORTS
import { verifyWalletSignature } from '../services/gaslessWalletVerifier.js';

// UPDATED SCHEMA: Make blockchainId & chainName optional, add signature/message
const createUserSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
  metadataURI: z.string().min(1).max(500),
  blockchainId: z.string().optional(),
  chainName: z.string().optional(),
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  message: z.string().optional(),
  signature: z.string().optional(),
});

const addWalletSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
  blockchainId: z.string().min(1),
  metadataURI: z.string().min(1).max(500),
  userId: z.string().min(1),
  chainName: z.string().min(1).max(100),
  message: z.string().optional(),
  signature: z.string().optional(),
});

// Type guards and utility functions
function isPlanObject(obj: any): obj is { name: string } {
  return obj != null && typeof obj === 'object' && 'name' in obj && typeof obj.name === 'string';
}

function extractPlanName(planData: unknown): string {
  if (planData == null) return 'Free';
  if (Array.isArray(planData)) {
    if (planData.length === 0) return 'Free';
    const first = planData[0];
    if (isPlanObject(first)) {
      return first.name;
    }
    return 'Free';
  }
  if (isPlanObject(planData)) {
    return planData.name;
  }
  if (typeof planData === 'string') {
    return planData;
  }
  return 'Free';
}

const extractPlanLimits = (planData: any): { queryLimit: number; userLimit: number; txnLimit: number | null } => {
  const defaults = { queryLimit: 100, userLimit: 1, txnLimit: null };
  
  try {
    if (!planData) return defaults;
    
    let plan = planData;
    if (Array.isArray(planData) && planData.length > 0) {
      plan = planData[0];
    }
    
    if (typeof plan === 'object' && plan !== null) {
      return {
        queryLimit: typeof plan.queryLimit === 'number' ? plan.queryLimit : defaults.queryLimit,
        userLimit: typeof plan.userLimit === 'number' ? plan.userLimit : defaults.userLimit,
        txnLimit: typeof plan.txnLimit === 'number' ? plan.txnLimit : defaults.txnLimit,
      };
    }
    
    return defaults;
  } catch (error) {
    console.warn('Error extracting plan limits:', error);
    return defaults;
  }
};

export async function userRoutes(fastify: FastifyInstance) {
  // Health check
  fastify.get('/health', async (request, reply) => {
    try {
      const { data, error } = await supabase.from('User').select('id').limit(1);
      if (error) throw error;
      
      return reply.send({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
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

  // Get all users
  fastify.get('/', async (request, reply) => {
    try {
      const { data: users, error } = await supabase
        .from('User')
        .select(`
          *,
          Plan!planId (name, queryLimit, userLimit, txnLimit)
        `)
        .order('createdAt', { ascending: false });

      if (error) {
        console.error('Database error fetching users:', error);
        throw new Error(`Database query failed: ${error.message}`);
      }

      return reply.send({ success: true, data: users || [] });
    } catch (error) {
      console.error('Error in GET /:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch users',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GASLESS REGISTRATION ENDPOINT
  fastify.post('/register', async (request, reply) => {
    try {
      const parsed = createUserSchema.safeParse(request.body);
      if (!parsed.success) {
        console.error('Validation errors:', parsed.error.issues);
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          issues: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        });
      }
      
      const { walletAddress, metadataURI, blockchainId: providedChainId, chainName: providedChainName, name, email, message, signature } = parsed.data;

      // GASLESS: Require signature from frontend
      if (!message || !signature) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Message and signature are required for gasless registration' 
        });
      }

      // GASLESS: Verify wallet signature - KEEP ORIGINAL CASE FOR WALLET ADDRESS
      const isValid = await verifyWalletSignature(message, signature, walletAddress);
      if (!isValid) {
        return reply.status(401).send({ 
          success: false, 
          error: 'Invalid wallet signature' 
        });
      }

      // Use provided chain or default to SKALE
      const blockchainId = providedChainId || process.env.DEFAULT_CHAIN_ID || '1564830818';
      const chainName = providedChainName || process.env.DEFAULT_CHAIN_NAME || 'skale';

      console.log('✅ Gasless registration - signature verified for:', walletAddress);

      // 1. Check for existing users - USE CASE INSENSITIVE COMPARISON BUT PRESERVE ORIGINAL CASE
      try {
        const [primaryUserResult, crossChainResult] = await Promise.all([
          supabase
            .from('User')
            .select('id, name, email, planId, walletAddress')
            .ilike('walletAddress', walletAddress) // Case insensitive search
            .eq('blockchainId', blockchainId)
            .maybeSingle(),
          supabase
            .from('CrossChainIdentity')
            .select('id, userId, walletAddress')
            .ilike('walletAddress', walletAddress) // Case insensitive search
            .eq('blockchainId', blockchainId)
            .maybeSingle(),
        ]);
        
        if (primaryUserResult.error && primaryUserResult.error.code !== 'PGRST116') {
          throw new Error(`Primary user query failed: ${primaryUserResult.error.message}`);
        }
        
        if (crossChainResult.error && crossChainResult.error.code !== 'PGRST116') {
          throw new Error(`CrossChain query failed: ${crossChainResult.error.message}`);
        }
        
        if (primaryUserResult.data) {
          const existingUser = await supabase
            .from('User')
            .select(`*, Plan!planId (name, queryLimit, userLimit, txnLimit)`)
            .eq('id', primaryUserResult.data.id)
            .single();
          
          return reply.send({
            success: true,
            data: existingUser.data,
            message: 'User already registered',
            isExisting: true
          });
        }
        
        if (crossChainResult.data) {
          return reply.status(409).send({ 
            success: false,
            error: 'This wallet is already registered as a cross-chain identity',
            code: 'WALLET_EXISTS_CROSSCHAIN'
          });
        }
      } catch (queryError) {
        console.error('Error checking existing users:', queryError);
        throw queryError;
      }

      // 2. Handle blockchain entry
      try {
        const { data: existingChain, error: chainQueryError } = await supabase
          .from('Blockchain')
          .select('*')
          .eq('id', blockchainId)
          .maybeSingle();
          
        if (chainQueryError && chainQueryError.code !== 'PGRST116') {
          throw new Error(`Blockchain query failed: ${chainQueryError.message}`);
        }
        
        const now = new Date().toISOString();
        const ubid = existingChain?.ubid || generateUUID();
        const apiKey = existingChain?.apiKey || generateAPIKey();
        const networkType = existingChain?.networkType || 'custom';
        const chainProtocol = existingChain?.chainProtocol || 'custom';

        const { error: blockchainError } = await supabase
          .from('Blockchain')
          .upsert({
            id: blockchainId,
            name: chainName,
            ubid,
            apiKey,
            networkType,
            chainProtocol,
            bnsName: chainName,
            createdAt: existingChain?.createdAt || now,
            updatedAt: now,
          }, { onConflict: 'id' });
          
        if (blockchainError) {
          throw new Error(`Blockchain upsert failed: ${blockchainError.message}`);
        }
      } catch (blockchainError) {
        console.error('Blockchain handling error:', blockchainError);
        throw blockchainError;
      }

      // 3. Get Free Plan
      try {
        const { data: freePlan, error: planError } = await supabase
          .from("Plan")
          .select("id, name, queryLimit, userLimit, txnLimit")
          .eq("name", "Free")
          .single();
          
        if (planError) {
          console.error('Plan query error:', planError);
          throw new Error(`Failed to fetch Free plan: ${planError.message}`);
        }
        
        if (!freePlan) {
          throw new Error('Free plan not found in database');
        }

        // 4. Create user - PRESERVE ORIGINAL WALLET ADDRESS CASE
        const userNow = new Date().toISOString();
        const userId = generateUUID();

        const userData = {
          id: userId,
          walletAddress: walletAddress, // PRESERVE ORIGINAL CASE - NO toLowerCase()
          metadataURI,
          blockchainId,
          planId: freePlan.id,
          name: name.trim(),
          email: email.trim().toLowerCase(), // Only email should be lowercase
          updatedAt: userNow,
          trialStartDate: userNow,
          trialUsed: false,
          createdAt: userNow,
          creditScore: 0,
          queriesUsed: 0,
          queriesLimit: freePlan.queryLimit || 100,
        };

        const { data: user, error: userError } = await supabase
          .from('User')
          .insert(userData)
          .select(`*, Plan!planId (name, queryLimit, userLimit, txnLimit)`)
          .single();
          
        if (userError) {
          console.error('User creation error:', userError);
          throw new Error(`User creation failed: ${userError.message}`);
        }

        console.log('✅ Gasless registration completed for:', walletAddress);

        return reply.send({
          success: true,
          data: user,
          message: 'User registered successfully (gasless)',
        });
        
      } catch (planError) {
        console.error('Plan/User creation error:', planError);
        throw planError;
      }
      
    } catch (error) {
      console.error('Gasless registration failed:', error);
      return reply.status(500).send({
        success: false,
        error: 'Registration failed',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Enhanced wallet endpoint with case-insensitive search but preserving original case
  fastify.get('/wallet/:walletAddress/:blockchainId', {
    preHandler: [walletValidationHook, queryLimitHook],
  }, async (request, reply) => {
    try {
      const { walletAddress, blockchainId } = request.params as any;
      
      // Try to find primary user first - USE CASE INSENSITIVE SEARCH
      try {
        const { data: primaryUser, error: primaryError } = await supabase
          .from('User')
          .select(`
            *,
            Plan!planId (name, queryLimit, userLimit, txnLimit)
          `)
          .ilike('walletAddress', walletAddress) // Case insensitive search
          .eq('blockchainId', blockchainId)
          .maybeSingle();

        if (primaryError && primaryError.code !== 'PGRST116') {
          console.error('Primary user query error:', primaryError);
          throw new Error(`Primary user query failed: ${primaryError.message}`);
        }

        if (primaryUser) {
          const planName = extractPlanName(primaryUser.Plan);
          const planLimits = extractPlanLimits(primaryUser.Plan);

          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();
          
          let queriesUsed = 0;
          let queriesLimit = primaryUser.queriesLimit || planLimits.queryLimit;
          
          // Get current month query usage
          try {
            const { data: queryUsage } = await supabase
              .from('QueryUsage')
              .select('used')
              .eq('userId', primaryUser.id)
              .eq('month', currentMonth)
              .eq('year', currentYear)
              .maybeSingle();
            
            queriesUsed = queryUsage?.used || primaryUser.queriesUsed || primaryUser.queryCount || 0;
          } catch (error) {
            console.warn('Query usage fetch failed, using fallback:', error);
            queriesUsed = primaryUser.queriesUsed || primaryUser.queryCount || 0;
          }

          // Get transaction usage
          let transactionUsage = { 
            used: 0, 
            count: 0,
            limit: planLimits.txnLimit
          };
          
          try {
            const startDate = new Date(currentYear, currentMonth - 1, 1).toISOString();
            const endDate = new Date(currentYear, currentMonth, 1).toISOString();
            
            const { data: transactions } = await supabase
              .from('Transaction')
              .select('amount, status')
              .eq('userId', primaryUser.id)
              .eq('status', 'SUCCESS')
              .gte('createdAt', startDate)
              .lt('createdAt', endDate);

            if (transactions && transactions.length > 0) {
              const totalAmount = transactions.reduce((sum, txn) => sum + (txn.amount || 0), 0);
              transactionUsage = {
                used: totalAmount,
                count: transactions.length,
                limit: planLimits.txnLimit
              };
            }
          } catch (error) {
            console.warn('Transaction usage fetch failed:', error);
          }
          
          return reply.send({
            success: true,
            data: {
              ...primaryUser,
              source: 'primary',
              planName: planName,
              queriesLimit: queriesLimit,
              queriesUsed: queriesUsed,
              queryResetDate: primaryUser.queryResetDate || primaryUser.lastQueryReset,
              transactionUsage: transactionUsage,
              Plan: { 
                name: planName,
                queryLimit: planLimits.queryLimit,
                userLimit: planLimits.userLimit,
                txnLimit: planLimits.txnLimit
              }
            }
          });
        }
      } catch (primaryQueryError) {
        console.error('Primary user query failed:', primaryQueryError);
      }

      // Try to find cross-chain user - USE CASE INSENSITIVE SEARCH
      try {
        const { data: crossChainUser, error: crossChainError } = await supabase
          .from('CrossChainIdentity')
          .select(`
            *,
            User!userId(
              id,
              planId,
              name,
              email,
              queriesUsed,
              queriesLimit, 
              queryResetDate,
              queryCount,
              lastQueryReset,
              Plan!planId(name, queryLimit, userLimit, txnLimit)
            )
          `)
          .ilike('walletAddress', walletAddress) // Case insensitive search
          .eq('blockchainId', blockchainId)
          .maybeSingle();

        if (crossChainError && crossChainError.code !== 'PGRST116') {
          console.error('CrossChain user query error:', crossChainError);
          throw new Error(`CrossChain user query failed: ${crossChainError.message}`);
        }

        if (crossChainUser && crossChainUser.User) {
          const userData = Array.isArray(crossChainUser.User) ? crossChainUser.User[0] : crossChainUser.User;
          const planName = crossChainUser.planName || extractPlanName(userData.Plan);
          const planLimits = extractPlanLimits(userData.Plan);

          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();
          
          let queriesUsed = 0;
          let queriesLimit = userData.queriesLimit || planLimits.queryLimit;
          
          try {
            const { data: queryUsage } = await supabase
              .from('QueryUsage')
              .select('used')
              .eq('userId', userData.id)
              .eq('month', currentMonth)
              .eq('year', currentYear)
              .maybeSingle();
            
            queriesUsed = queryUsage?.used || userData.queriesUsed || userData.queryCount || 0;
          } catch (error) {
            console.warn('Query usage fetch failed, using fallback:', error);
            queriesUsed = userData.queriesUsed || userData.queryCount || 0;
          }

          let transactionUsage = { 
            used: 0, 
            count: 0,
            limit: planLimits.txnLimit
          };
          
          try {
            const startDate = new Date(currentYear, currentMonth - 1, 1).toISOString();
            const endDate = new Date(currentYear, currentMonth, 1).toISOString();
            
            const { data: transactions } = await supabase
              .from('Transaction')
              .select('amount, status')
              .eq('userId', userData.id)
              .eq('status', 'SUCCESS')
              .gte('createdAt', startDate)
              .lt('createdAt', endDate);

            if (transactions && transactions.length > 0) {
              const totalAmount = transactions.reduce((sum, txn) => sum + (txn.amount || 0), 0);
              transactionUsage = {
                used: totalAmount,
                count: transactions.length,
                limit: planLimits.txnLimit
              };
            }
          } catch (error) {
            console.warn('Transaction usage fetch failed:', error);
          }
          
          return reply.send({
            success: true,
            data: {
              ...crossChainUser,
              name: userData.name,
              email: userData.email,
              source: 'crosschain',
              planName: planName,
              queriesLimit: queriesLimit,
              queriesUsed: queriesUsed,
              queryResetDate: userData.queryResetDate || userData.lastQueryReset,
              transactionUsage: transactionUsage,
              mainUserId: userData.id,
              userId: userData.id,
              planId: userData.planId,
              Plan: { 
                name: planName,
                queryLimit: planLimits.queryLimit,
                userLimit: planLimits.userLimit,
                txnLimit: planLimits.txnLimit
              },
              parentUserId: userData.id
            }
          });
        }
      } catch (crossChainQueryError) {
        console.error('CrossChain user query failed:', crossChainQueryError);
      }

      return reply.status(404).send({
        success: false,
        error: 'Wallet not found',
        code: 'WALLET_NOT_FOUND',
        details: `No user found with wallet ${walletAddress} on blockchain ${blockchainId}`
      });

    } catch (error) {
      console.error('Wallet endpoint error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // GASLESS ADD WALLET ENDPOINT
  fastify.post('/add-wallet', async (request, reply) => {
    try {
      const parsed = addWalletSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          issues: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        });
      }

      const { walletAddress, blockchainId, metadataURI, userId, chainName, message, signature } = parsed.data;

      // GASLESS: Verify signature if provided (optional for add-wallet)
      if (message && signature) {
        const isValid = await verifyWalletSignature(message, signature, walletAddress);
        if (!isValid) {
          return reply.status(401).send({ 
            success: false, 
            error: 'Invalid wallet signature for add-wallet' 
          });
        }
        console.log('✅ Add wallet - signature verified for:', walletAddress);
      }

      // Get primary user and their plan
      const { data: primaryUser, error: userError } = await supabase
        .from('User')
        .select(`
          id, 
          walletAddress, 
          blockchainId, 
          Plan!planId (name, queryLimit, userLimit, txnLimit)
        `)
        .eq('id', userId)
        .single();

      if (userError || !primaryUser) {
        console.error('Primary user not found:', userError);
        return reply.status(404).send({ 
          success: false,
          error: 'Primary user not found',
          code: 'USER_NOT_FOUND' 
        });
      }

      const primaryPlan = extractPlanName(primaryUser.Plan);

      // Check wallet limits
      const canAdd = await canAddWalletToUser(userId, walletAddress, blockchainId);
      if (!canAdd.canAdd) {
        return reply.status(403).send({
          success: false,
          error: canAdd.reason,
          code: 'WALLET_LIMIT_EXCEEDED',
          wouldCount: canAdd.wouldCount,
        });
      }

      // Check for existing wallets - USE CASE INSENSITIVE SEARCH
      const [existingInUser, existingInCrossChain] = await Promise.all([
        supabase
          .from('User')
          .select('id, walletAddress')
          .ilike('walletAddress', walletAddress)
          .eq('blockchainId', blockchainId)
          .maybeSingle(),
        supabase
          .from('CrossChainIdentity')
          .select('id, walletAddress, userId')
          .ilike('walletAddress', walletAddress)
          .eq('blockchainId', blockchainId)
          .maybeSingle(),
      ]);

      if (existingInUser.data) {
        if (existingInUser.data.id === userId) {
          return reply.status(409).send({
            success: false,
            error: 'This is your primary wallet. You cannot add it as an additional wallet.',
            code: 'CANNOT_ADD_PRIMARY_WALLET'
          });
        } else {
          return reply.status(409).send({
            success: false,
            error: 'This wallet is already registered as a primary wallet by another user',
            code: 'WALLET_EXISTS_PRIMARY'
          });
        }
      }

      if (existingInCrossChain.data) {
        if (existingInCrossChain.data.userId === userId) {
          return reply.status(409).send({
            success: false,
            error: 'You have already added this wallet to your account',
            code: 'WALLET_EXISTS_SAME_USER'
          });
        } else {
          return reply.status(409).send({
            success: false,
            error: 'This wallet is already registered by another user',
            code: 'WALLET_EXISTS_OTHER_USER'
          });
        }
      }

      // Ensure blockchain exists
      const { data: blockchain } = await supabase
        .from('Blockchain')
        .select('id, name')
        .eq('id', blockchainId)
        .maybeSingle();

      if (!blockchain) {
        const { error: blockchainError } = await supabase
          .from('Blockchain')
          .upsert({
            id: blockchainId,
            name: chainName,
            ubid: generateUUID(),
            apiKey: generateAPIKey(),
            networkType: 'custom',
            chainProtocol: 'custom',
            bnsName: chainName, 
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (blockchainError) {
          throw new Error(`Failed to create blockchain entry: ${blockchainError.message}`);
        }
      }

      // Insert CrossChainIdentity - PRESERVE ORIGINAL WALLET ADDRESS CASE
      const now = new Date().toISOString();
      const { data: crossChainIdentity, error: crossChainError } = await supabase
        .from('CrossChainIdentity')
        .insert({
          id: generateUUID(),
          userId,
          blockchainId,
          walletAddress: walletAddress, // PRESERVE ORIGINAL CASE - NO toLowerCase()
          proofHash: generateUUID(),
          planName: primaryPlan,
          planSource: 'inherited',
          parentUserId: userId,
          metadataURI: metadataURI || '',
          chainName: chainName,
          creditScore: 0,
          createdAt: now,
          updatedAt: now,
        })
        .select(`
          *, 
          blockchain:Blockchain!blockchainId(name, ubid)
        `)
        .single();

      if (crossChainError) {
        console.error('CrossChain creation error:', crossChainError);
        throw new Error(`Failed to create cross-chain identity: ${crossChainError.message}`);
      }

      return reply.send({
        success: true,
        data: {
          ...crossChainIdentity,
          planInfo: {
            name: primaryPlan,
            source: 'inherited',
            inheritedFrom: userId,
            sharedLimits: true
          }
        },
        message: `Wallet added successfully with ${primaryPlan} plan inheritance`,
        countsTowardLimit: canAdd.wouldCount,
        planInheritance: {
          primaryUserPlan: primaryPlan,
          crossChainPlan: primaryPlan,
          planSource: 'inherited'
        }
      });

    } catch (error) {
      console.error('Add wallet error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to add wallet',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Credit score endpoint
  fastify.get('/credit-score/:walletAddress/:blockchainId', {
    preHandler: [async (request: any, reply: any) => {
      if (request.body) {
        request.body.incrementUsage = false;
      } else {
        request.body = { incrementUsage: false };
      }
      return queryLimitHook(request, reply);
    }],
  }, async (request, reply) => {
    try {
      const { walletAddress, blockchainId } = request.params as { 
        walletAddress: string;
        blockchainId: string;
      };

      const queryContext = (request as any).queryContext;
      let user = null;
      let source = null;
      let crossChainIdentityId = null;

      // Try primary user first - USE CASE INSENSITIVE SEARCH
      try {
        const { data: primaryUser, error: primaryError } = await supabase
          .from('User')
          .select(`
            id,
            creditScore,
            trialStartDate,
            trialUsed,
            planId
          `)
          .ilike('walletAddress', walletAddress)
          .eq('blockchainId', blockchainId)
          .maybeSingle();

        if (primaryError && primaryError.code !== 'PGRST116') {
          console.error('Primary user query error:', primaryError);
        }

        if (primaryUser) {
          user = primaryUser;
          source = 'primary';
        }
      } catch (error) {
        console.warn('Primary user lookup failed:', error);
      }

      // Try cross-chain if no primary user found - USE CASE INSENSITIVE SEARCH
      if (!user) {
        try {
          const { data: crossChainUser, error: crossChainError } = await supabase
            .from('CrossChainIdentity')
            .select(`
              id,
              userId,
              creditScore,
              User!userId(
                id,
                trialStartDate,
                trialUsed,
                planId
              )
            `)
            .ilike('walletAddress', walletAddress)
            .eq('blockchainId', blockchainId)
            .maybeSingle();

          if (crossChainError && crossChainError.code !== 'PGRST116') {
            console.error('CrossChain user query error:', crossChainError);
          }

          if (crossChainUser && crossChainUser.User) {
            const userData = Array.isArray(crossChainUser.User) ? crossChainUser.User[0] : crossChainUser.User;
            user = {
              id: userData.id,
              creditScore: crossChainUser.creditScore,
              trialStartDate: userData.trialStartDate,
              trialUsed: userData.trialUsed,
              planId: userData.planId
            };
            source = 'crosschain';
            crossChainIdentityId = crossChainUser.id;
          }
        } catch (error) {
          console.warn('CrossChain user lookup failed:', error);
        }
      }

      if (!user) {
        return reply.status(404).send({ 
          success: false, 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      const hasActivePlan = !!user.planId;
      const hasActiveTrial = isTrialActive(user.trialStartDate) && !user.trialUsed;

      if (!hasActivePlan && !hasActiveTrial) {
        return reply.status(403).send({
          success: false,
          error: 'Access denied. Please upgrade your plan or start free trial.',
          code: 'NO_ACTIVE_PLAN'
        });
      }

      return reply.send({ 
        success: true, 
        creditScore: user.creditScore || 0,
        source: source,
        userId: user.id,
        crossChainIdentityId: crossChainIdentityId,
        usage: queryContext
      });
    } catch (error) {
      console.error('Credit score endpoint error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch credit score',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Wallet exists endpoint
  fastify.get('/exists/:walletAddress/:blockchainId', {
    preHandler: [queryLimitHook],
  }, async (request, reply) => {
    try {
      const { walletAddress, blockchainId } = request.params as any;
      
      const walletUser = await findExistingWalletUser(walletAddress, blockchainId);
      
      if (walletUser.found) {
        return reply.send({
          exists: true,
          source: walletUser.source,
          userId: walletUser.userId,
          crossChainIdentityId: walletUser.crossChainIdentityId,
          message: `Wallet registered as ${walletUser.source} user`
        });
      } else {
        return reply.send({
          exists: false,
          error: walletUser.error,
          message: 'Wallet not registered in system'
        });
      }

    } catch (error: unknown) {
      console.error('Wallet exists check error:', error);
      return reply.status(500).send({
        exists: false,
        error: 'Failed to check wallet registration',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Enhanced wallet limits endpoint
  fastify.get('/wallet-limits/:userId', async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };

      const planInfo = await checkUserPlanLimits(userId);
      
      // Get wallet details with blockchain information
      const [primaryWallet, crossChainWallets] = await Promise.all([
        supabase
          .from('User')
          .select(`
            id,
            walletAddress,
            blockchainId,
            creditScore,
            createdAt,
            Blockchain!blockchainId(name)
          `)
          .eq('id', userId)
          .single(),
        
        supabase
          .from('CrossChainIdentity')
          .select(`
            id,
            walletAddress,
            blockchainId,
            creditScore,
            createdAt,
            chainName,
            Blockchain!blockchainId(name)
          `)
          .eq('userId', userId)
      ]);

      const walletDetails: any[] = [];

      if (primaryWallet.data) {
        walletDetails.push({
          id: primaryWallet.data.id,
          walletAddress: primaryWallet.data.walletAddress, // PRESERVE ORIGINAL CASE
          blockchainId: primaryWallet.data.blockchainId,
          blockchainName: primaryWallet.data.Blockchain,
          creditScore: primaryWallet.data.creditScore || 0,
          hasUBID: true,
          isUnique: true,
          isPrimary: true,
          createdAt: primaryWallet.data.createdAt
        });
      }

      if (crossChainWallets.data) {
        crossChainWallets.data.forEach((wallet: any) => {
          walletDetails.push({
            id: wallet.id,
            walletAddress: wallet.walletAddress, // PRESERVE ORIGINAL CASE
            blockchainId: wallet.blockchainId,
            blockchainName: wallet.chainName || wallet.Blockchain?.name || 'Unknown',
            creditScore: wallet.creditScore || 0,
            hasUBID: true,
            isUnique: true,
            isPrimary: false,
            createdAt: wallet.createdAt
          });
        });
      }

      const enhancedPlanInfo = {
        ...planInfo,
        walletDetails: walletDetails
      };

      return reply.send({
        success: true,
        data: enhancedPlanInfo,
      });

    } catch (error) {
      console.error('Wallet limits error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get wallet limits',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Update user plan
  fastify.patch('/plan/:userId', async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const { planName } = request.body as { planName: string };

      const { data: plan, error: planError } = await supabase
        .from('Plan')
        .select('id, userLimit')
        .eq('name', planName)
        .single();

      if (planError || !plan) {
        return reply.status(404).send({ 
          success: false,
          error: 'Plan not found' 
        });
      }

      const currentPlanInfo = await checkUserPlanLimits(userId);
      
      if (currentPlanInfo.usedWallets > plan.userLimit) {
        return reply.status(400).send({
          success: false,
          error: `Cannot downgrade to ${planName}. You have ${currentPlanInfo.usedWallets} wallets but ${planName} only allows ${plan.userLimit}`,
          code: 'WALLET_COUNT_EXCEEDS_PLAN',
        });
      }

      const { data: updatedUser, error } = await supabase
        .from('User')
        .update({
          planId: plan.id,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', userId)
        .select(`
          *,
          Plan!planId (name, queryLimit, userLimit, txnLimit)
        `)
        .single();

      if (error) {
        console.error('Plan update error:', error);
        throw new Error(`Plan update failed: ${error.message}`);
      }

      return reply.send({
        success: true,
        data: updatedUser,
        message: `Plan updated to ${planName}`,
      });

    } catch (error) {
      console.error('Plan update error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update plan',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // KYC update endpoint
  fastify.patch('/kyc/:walletAddress/:blockchainId', async (request, reply) => {
    try {
      const { walletAddress, blockchainId } = request.params as any;
      const { identityHash, name, email } = request.body as any;

      // USE CASE INSENSITIVE SEARCH FOR UPDATES
      const { data: primaryUser } = await supabase
        .from('User')
        .select('id')
        .ilike('walletAddress', walletAddress)
        .eq('blockchainId', blockchainId)
        .maybeSingle();

      if (primaryUser) {
        const updateData: any = {};
        if (identityHash) updateData.metadataURI = identityHash;
        if (name) updateData.name = name.trim();
        if (email) updateData.email = email.trim().toLowerCase(); // Only email lowercase
        updateData.updatedAt = new Date().toISOString();

        const { data: updatedUser, error } = await supabase
          .from('User')
          .update(updateData)
          .eq('id', primaryUser.id)
          .select()
          .single();

        if (error) {
          console.error('Primary user update error:', error);
          throw new Error(`Primary user update failed: ${error.message}`);
        }

        return reply.send({
          success: true,
          data: updatedUser,
          message: 'Profile updated successfully'
        });
      }

      const { data: crossChainUser } = await supabase
        .from('CrossChainIdentity')
        .select('id, userId')
        .ilike('walletAddress', walletAddress)
        .eq('blockchainId', blockchainId)
        .maybeSingle();

      if (crossChainUser) {
        const updateData: any = {};
        if (identityHash) updateData.metadataURI = identityHash;
        updateData.updatedAt = new Date().toISOString();

        const { data: updatedCrossChain, error } = await supabase
          .from('CrossChainIdentity')
          .update(updateData)
          .eq('id', crossChainUser.id)
          .select()
          .single();

        if (error) {
          console.error('CrossChain update error:', error);
          throw new Error(`CrossChain update failed: ${error.message}`);
        }

        if (name || email) {
          const parentUpdateData: any = {};
          if (name) parentUpdateData.name = name.trim();
          if (email) parentUpdateData.email = email.trim().toLowerCase(); // Only email lowercase
          parentUpdateData.updatedAt = new Date().toISOString();

          await supabase
            .from('User')
            .update(parentUpdateData)
            .eq('id', crossChainUser.userId);
        }

        return reply.send({
          success: true,
          data: updatedCrossChain,
          message: 'Cross-chain identity updated successfully'
        });
      }

      return reply.status(404).send({
        success: false,
        error: 'User not found'
      });

    } catch (error) {
      console.error('KYC update error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Update failed',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get current user's plan details
  fastify.get('/plan/:walletAddress', async (request, reply) => {
    try {
      const { walletAddress } = request.params as { walletAddress: string };

      // USE CASE INSENSITIVE SEARCH
      const { data: user, error: userError } = await supabase
        .from('User')
        .select(`
          planId,
          trialStartDate,
          trialUsed
        `)
        .ilike('walletAddress', walletAddress)
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (userError) {
        console.error('Plan query error:', userError);
        throw new Error(`Plan query failed: ${userError.message}`);
      }

      if (!user) {
        return reply.status(404).send({ 
          success: false, 
          message: 'User not found' 
        });
      }

      let planName = 'Free';
      
      if (user.planId) {
        const { data: plan } = await supabase
          .from('Plan')
          .select('name')
          .eq('id', user.planId)
          .single();

        if (plan) {
          planName = plan.name;
        }
      }

      return reply.send({
        success: true,
        planName,
        trialStartDate: user.trialStartDate,
        trialUsed: user.trialUsed,
      });
    } catch (error) {
      console.error('Get plan error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch plan',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get all wallets (admin endpoint)
  fastify.get('/all-wallets', async (request, reply) => {
    try {
      const [primaryUsers, crossChainUsers] = await Promise.all([
        supabase
          .from('User')
          .select(`
            *,
            Plan!planId (name, queryLimit, userLimit, txnLimit)
          `)
          .order('createdAt', { ascending: false }),
        
        supabase
          .from('CrossChainIdentity')
          .select(`
            *,
            User!userId (
              id,
              planId,
              Plan!planId (name, queryLimit, userLimit, txnLimit)
            ),
            Blockchain!blockchainId (name, ubid)
          `)
          .order('createdAt', { ascending: false })
      ]);

      const result = {
        primaryUsers: primaryUsers.data || [],
        crossChainUsers: crossChainUsers.data || [],
        totalPrimary: primaryUsers.data?.length || 0,
        totalCrossChain: crossChainUsers.data?.length || 0
      };

      return reply.send({ 
        success: true, 
        data: result 
      });

    } catch (error) {
      console.error('All wallets error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch all wallets',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Helper function to find existing wallet user with case-insensitive search
  async function findExistingWalletUser(walletAddress: string, blockchainId: string): Promise<{
    found: boolean;
    userId?: string;
    planId?: string;
    source?: 'primary' | 'crosschain';
    crossChainIdentityId?: string | null;
    error?: string;
  }> {
    try {
      // USE CASE INSENSITIVE SEARCH
      const { data: primaryUser } = await supabase
        .from('User')
        .select('id, planId')
        .ilike('walletAddress', walletAddress)
        .eq('blockchainId', blockchainId)
        .maybeSingle();

      if (primaryUser) {
        return {
          found: true,
          userId: primaryUser.id,
          planId: primaryUser.planId,
          source: 'primary',
          crossChainIdentityId: null
        };
      }

      const { data: crossChainUser } = await supabase
        .from('CrossChainIdentity')
        .select(`
          id,
          userId,
          User!userId(id, planId)
        `)
        .ilike('walletAddress', walletAddress)
        .eq('blockchainId', blockchainId)
        .maybeSingle();

      if (crossChainUser && crossChainUser.User) {
        const userData = Array.isArray(crossChainUser.User) 
          ? crossChainUser.User[0] 
          : crossChainUser.User;

        return {
          found: true,
          userId: crossChainUser.userId,
          planId: userData.planId,
          source: 'crosschain',
          crossChainIdentityId: crossChainUser.id
        };
      }

      return {
        found: false,
        error: 'Wallet not registered. Please add this wallet through the user management system first.'
      };
    } catch (error) {
      console.error('Error in findExistingWalletUser:', error);
      return {
        found: false,
        error: error instanceof Error ? error.message : 'Database query failed'
      };
    }
  }
}

export default userRoutes;
