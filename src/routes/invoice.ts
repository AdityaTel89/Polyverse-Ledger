// src/routes/invoice.ts - GASLESS VERSION USING SUPABASE CLIENT (SCHEMA CORRECTED)
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabase } from '../lib/supabaseClient.js';
import { generateUUID } from '../utils/ubid.js';
import { queryLimitHook } from '../middleware/queryLimit.js';
import { walletValidationHook } from '../middleware/validateWallet.js';
import { transactionLimitHook } from '../middleware/transactionLimit.js';
import { sanitizeObject } from '../utils/sanitization.js';

// Validation schemas
const createInvoiceSchema = z.object({
  blockchainId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.number().positive().max(1000000).refine(val => Number.isFinite(val)),
  dueDate: z.string().refine((date) => {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return false;
    const now = new Date();
    const minDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const maxDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    return parsed >= minDate && parsed <= maxDate;
  }),
  tokenized: z.boolean().optional().default(false),
  tokenAddress: z.string().optional().nullable().transform(val => val === '' ? null : val)
    .refine(val => !val || /^0x[a-fA-F0-9]{40}$/.test(val)),
  escrowAddress: z.string().optional().nullable().transform(val => val === '' ? null : val)
    .refine(val => !val || /^0x[a-fA-F0-9]{40}$/.test(val)),
  subscriptionId: z.string().optional().nullable(),
  userWalletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  // GASLESS: Optional blockchain transaction fields
  blockchainTxHash: z.string().optional().nullable(),
  blockchainInvoiceId: z.string().optional().nullable(),
});

const invoiceIdSchema = z.object({ 
  id: z.string().min(10).max(50).regex(/^[a-zA-Z0-9_-]+$/) 
});

const walletParamsSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  blockchainId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
});

const markPaidSchema = z.object({ 
  userWalletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/), 
  hash: z.string().optional() 
});

// Helper functions
async function getETHUSDPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
    const data = await response.json();
    return data.ethereum?.usd ?? 3000;
  } catch {
    return 3000; // Fallback price
  }
}

async function findExistingWalletUser(walletAddress: string, blockchainId: string): Promise<{
  found: boolean;
  userId?: string;
  planId?: string;
  source?: 'primary' | 'crosschain';
  crossChainIdentityId?: string | null;
  error?: string;
}> {
  try {
    // Try primary user first - CASE INSENSITIVE SEARCH
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

    // Try cross-chain user
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
      const userData = Array.isArray(crossChainUser.User) ? crossChainUser.User[0] : crossChainUser.User;
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
    console.error('Error finding wallet user:', error);
    return { 
      found: false, 
      error: 'Database query failed' 
    };
  }
}

function convertUSDToETH(usdAmount: number, ethPrice: number): number {
  if (ethPrice <= 0) throw new Error('Invalid ETH price');
  return usdAmount / ethPrice;
}

function ethToWei(ethAmount: number): string {
  if (ethAmount < 0) throw new Error('ETH amount cannot be negative');
  const weiAmount = ethAmount * Math.pow(10, 18);
  return Math.floor(weiAmount).toString();
}

export async function invoiceRoutes(fastify: FastifyInstance) {

  fastify.setErrorHandler(async (error, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({ 
        error: 'Validation failed', 
        details: error.validation 
      });
    }
    const status = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    return reply.status(status).send({ 
      error: message, 
      timestamp: new Date().toISOString() 
    });
  });

  // ✅ GASLESS: Create Invoice (POST /)
  fastify.post('/', {
    preHandler: [queryLimitHook, transactionLimitHook],
  }, async (request, reply) => {
    try {
      const sanitizedBody = sanitizeObject(request.body);
      const parsed = createInvoiceSchema.parse(sanitizedBody);

      // Find wallet user
      const walletUser = await findExistingWalletUser(parsed.userWalletAddress, parsed.blockchainId);

      if (!walletUser.found) {
        return reply.status(400).send({
          success: false,
          error: walletUser.error || 'Wallet not registered',
          code: 'WALLET_NOT_REGISTERED',
          message: 'Please add this wallet through your user management system first (via /register or /add-wallet).'
        });
      }

      const userId = walletUser.userId!;
      const walletSource = walletUser.source!;
      const crossChainIdentityId = walletUser.crossChainIdentityId;

      // Get user with plan info
      const { data: userWithPlan, error: userError } = await supabase
        .from('User')
        .select(`
          id,
          invoiceCount,
          Plan!planId(name, txnLimit)
        `)
        .eq('id', userId)
        .single();

      if (userError || !userWithPlan) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Check transaction limits
      const planData = Array.isArray(userWithPlan.Plan) ? userWithPlan.Plan[0] : userWithPlan.Plan;
      if (planData?.txnLimit && userWithPlan.invoiceCount >= planData.txnLimit) {
        return reply.status(403).send({
          success: false,
          error: `Transaction limit exceeded. Your ${planData.name} plan allows ${planData.txnLimit} invoices.`,
          code: 'PLAN_TXN_LIMIT_EXCEEDED'
        });
      }

      // Calculate ETH conversion
      const ethPrice = await getETHUSDPrice();
      const ethAmount = convertUSDToETH(parsed.amount, ethPrice);
      const weiAmount = ethToWei(ethAmount);

      // GASLESS: Create invoice directly in database (bypass blockchain)
      const now = new Date().toISOString();
      const invoiceId = generateUUID();

      // ✅ FIXED: Use correct database column names (no blockchainInvoiceId)
      const invoiceData = {
        id: invoiceId,
        userId: userId,
        crossChainIdentityId: crossChainIdentityId,
        blockchainId: parsed.blockchainId,
        walletAddress: parsed.walletAddress, // PRESERVE ORIGINAL CASE
        amount: parsed.amount,
        ethAmount: ethAmount,
        weiAmount: weiAmount,
        ethPrice: ethPrice,
        dueDate: parsed.dueDate,
        status: 'UNPAID',
        tokenized: parsed.tokenized || false,
        tokenAddress: parsed.tokenAddress,
        escrowAddress: parsed.escrowAddress,
        subscriptionId: parsed.subscriptionId,
        createdAt: now,
        updatedAt: now,
        // ✅ FIXED: Use existing database columns
        paymentHash: parsed.blockchainTxHash, // Maps to paymentHash column
        // Note: blockchainInvoiceId is not in schema, store in description or custom field if needed
        description: parsed.blockchainInvoiceId ? `Blockchain Invoice ID: ${parsed.blockchainInvoiceId}` : null
      };

      // Insert invoice
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('Invoice')
        .insert([invoiceData])
        .select()
        .single();

      if (invoiceError) {
        console.error('Invoice creation error:', invoiceError);
        throw new Error(`Failed to create invoice: ${invoiceError.message}`);
      }

      // Update invoice count
      try {
        if (walletSource === 'primary') {
          await supabase
            .from('User')
            .update({ invoiceCount: userWithPlan.invoiceCount + 1 })
            .eq('id', userId);
        } else if (crossChainIdentityId) {
          // Get current cross-chain invoice count
          const { data: crossChainData } = await supabase
            .from('CrossChainIdentity')
            .select('invoiceCount')
            .eq('id', crossChainIdentityId)
            .single();
          
          if (crossChainData) {
            await supabase
              .from('CrossChainIdentity')
              .update({ invoiceCount: (crossChainData.invoiceCount || 0) + 1 })
              .eq('id', crossChainIdentityId);
          }
        }
      } catch (updateError) {
        console.warn('Failed to update invoice count:', updateError);
      }

      // Create transaction record (optional)
      try {
        const transactionId = generateUUID();
        await supabase
          .from('Transaction')
          .insert([{
            id: transactionId,
            userId: userId,
            invoiceId: newInvoice.id,
            amount: parsed.amount,
            type: 'invoice_created',
            status: 'SUCCESS', // Gasless = immediate success
            hash: parsed.blockchainTxHash,
            riskScore: 0,
            createdAt: now,
            updatedAt: now
          }]);
      } catch (transactionError) {
        console.warn('Failed to create transaction record:', transactionError);
      }

      return reply.status(201).send({ 
        message: `✅ Invoice created successfully using ${walletSource} wallet (gasless)`, 
        data: {
          invoice: newInvoice,
          blockchain: {
            txHash: parsed.blockchainTxHash || null,
            status: 'gasless_success',
            blockchainInvoiceId: parsed.blockchainInvoiceId || null,
            explorerUrl: parsed.blockchainTxHash ? 
              `https://etherscan.io/tx/${parsed.blockchainTxHash}` : null,
            error: null
          },
          conversion: {
            usdAmount: parsed.amount,
            ethAmount: ethAmount,
            weiAmount: weiAmount,
            ethPrice: ethPrice,
            displayText: `This is ~${ethAmount.toFixed(6)} ETH`
          },
          source: walletSource,
          crossChainIdentityId: crossChainIdentityId,
          gasless: true
        }
      });

    } catch (err: unknown) {
      console.error('Invoice creation error:', err);
      
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ 
          error: 'Validation failed', 
          details: err.errors 
        });
      }

      return reply.status(500).send({ 
        error: 'Failed to create invoice',
        details: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });

  // ✅ GASLESS: Mark Invoice as Paid (POST /:id/markPaid)
  fastify.post('/:id/markPaid', {
    preHandler: [transactionLimitHook],
  }, async (request, reply) => {
    try {
      const sanitizedParams = sanitizeObject(request.params);
      const sanitizedBody = sanitizeObject(request.body);
      const { id } = invoiceIdSchema.parse(sanitizedParams);
      const { userWalletAddress, hash } = markPaidSchema.parse(sanitizedBody);

      // Get existing invoice
      const { data: existingInvoice, error: invoiceError } = await supabase
        .from('Invoice')
        .select(`
          *,
          User!userId(id, walletAddress)
        `)
        .eq('id', id)
        .single();

      if (invoiceError || !existingInvoice) {
        return reply.status(404).send({ error: 'Invoice not found' });
      }

      if (existingInvoice.status === 'PAID') {
        return reply.status(400).send({ 
          error: 'Invoice is already marked as paid' 
        });
      }

      const userData = Array.isArray(existingInvoice.User) ? existingInvoice.User[0] : existingInvoice.User;
      const isCreator = userData?.walletAddress?.toLowerCase() === userWalletAddress.toLowerCase();
      const isRecipient = existingInvoice.walletAddress?.toLowerCase() === userWalletAddress.toLowerCase();

      if (!isCreator && !isRecipient) {
        return reply.status(403).send({ 
          error: 'Unauthorized: You can only mark invoices as paid if you are the creator or recipient' 
        });
      }

      // Update invoice status
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('Invoice')
        .update({
          status: 'PAID',
          paymentHash: hash || null,
          updatedAt: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update invoice: ${updateError.message}`);
      }

      // Update related transactions (optional)
      try {
        await supabase
          .from('Transaction')
          .update({
            status: 'SUCCESS',
            hash: hash || undefined,
            updatedAt: new Date().toISOString()
          })
          .eq('invoiceId', id);
      } catch (transactionUpdateError) {
        console.warn('Failed to update transaction status:', transactionUpdateError);
      }

      return reply.send({
        message: '✅ Invoice marked as paid successfully (gasless)',
        data: {
          invoice: updatedInvoice,
          markedBy: isCreator ? 'creator' : 'recipient',
          gasless: true
        },
      });

    } catch (error: unknown) {
      console.error('Mark paid error:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ 
          error: 'Validation failed', 
          details: error.errors 
        });
      }

      return reply.status(500).send({ 
        error: 'Failed to mark invoice as paid',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ✅ GASLESS: Get Invoices by Wallet (GET /wallet/:walletAddress/:blockchainId)
  fastify.get('/wallet/:walletAddress/:blockchainId', {
    preHandler: [walletValidationHook, queryLimitHook],
  }, async (request, reply) => {
    try {
      const sanitizedParams = sanitizeObject(request.params);
      const { walletAddress, blockchainId } = walletParamsSchema.parse(sanitizedParams);

      // Find wallet user first to get their userId
      const walletUser = await findExistingWalletUser(walletAddress, blockchainId);
      
      // Get invoices where user is creator OR recipient - CASE INSENSITIVE
      const [createdInvoices, receivedInvoices] = await Promise.all([
        // Invoices created by this wallet (if user found)
        walletUser.found ? supabase
          .from('Invoice')
          .select(`
            *,
            User!userId(id, walletAddress, blockchainId)
          `)
          .eq('userId', walletUser.userId!)
          .order('createdAt', { ascending: false }) : Promise.resolve({ data: [] }),
        
        // Invoices sent to this wallet
        supabase
          .from('Invoice')
          .select(`
            *,
            User!userId(id, walletAddress, blockchainId)
          `)
          .ilike('walletAddress', walletAddress)
          .order('createdAt', { ascending: false })
      ]);

      // Combine and deduplicate
      const allInvoices = [
        ...(createdInvoices.data || []),
        ...(receivedInvoices.data || [])
      ].filter((invoice, index, array) => 
        array.findIndex(inv => inv.id === invoice.id) === index
      );

      // Add conversion data
      const invoicesWithConversion = allInvoices.map(invoice => ({
        ...invoice,
        userWalletAddress: Array.isArray(invoice.User) ? invoice.User[0]?.walletAddress : invoice.User?.walletAddress,
        conversion: {
          usdAmount: invoice.amount,
          ethAmount: invoice.ethAmount,
          weiAmount: invoice.weiAmount,
          ethPrice: invoice.ethPrice,
          displayText: invoice.ethAmount ? `This is ~${invoice.ethAmount.toFixed(6)} ETH` : null,
        }
      }));

      return reply.send({
        message: 'Wallet-specific invoices retrieved successfully (gasless)',
        data: invoicesWithConversion,
        count: invoicesWithConversion.length,
        walletAddress,
        blockchainId,
        gasless: true
      });

    } catch (err: unknown) {
      console.error('Get wallet invoices error:', err);
      
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ 
          error: 'Invalid wallet address or blockchain ID format', 
          details: err.errors 
        });
      }

      return reply.status(500).send({ 
        error: 'Failed to fetch wallet invoices',
        details: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });

  // ✅ GASLESS: Get Invoice by ID (GET /:id)
  fastify.get('/:id', {
    preHandler: [queryLimitHook],
  }, async (request, reply) => {
    try {
      const sanitizedParams = sanitizeObject(request.params);
      const { id } = invoiceIdSchema.parse(sanitizedParams);
      
      const { data: invoice, error: invoiceError } = await supabase
        .from('Invoice')
        .select(`
          *,
          User!userId(id, walletAddress, blockchainId),
          Transaction!invoiceId(id, amount, type, status, hash, createdAt)
        `)
        .eq('id', id)
        .single();

      if (invoiceError || !invoice) {
        return reply.status(404).send({ error: 'Invoice not found' });
      }

      // Add conversion data
      const invoiceWithConversion = {
        ...invoice,
        conversion: {
          usdAmount: invoice.amount,
          ethAmount: invoice.ethAmount,
          weiAmount: invoice.weiAmount,
          ethPrice: invoice.ethPrice,
          displayText: invoice.ethAmount ? `This is ~${invoice.ethAmount.toFixed(6)} ETH` : null,
        }
      };

      return reply.send({
        message: 'Invoice retrieved successfully (gasless)',
        data: invoiceWithConversion,
        gasless: true
      });

    } catch (err: unknown) {
      console.error('Get invoice error:', err);
      
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ 
          error: 'Invalid input format', 
          details: err.errors 
        });
      }

      return reply.status(500).send({ 
        error: 'Failed to fetch invoice',
        details: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });

  // ✅ GASLESS: Get All Invoices with Pagination (GET /)
  fastify.get('/', {
    preHandler: [queryLimitHook],
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const page = parseInt(query.page || '1');
      const limit = Math.min(parseInt(query.limit || '20'), 100);
      const offset = (page - 1) * limit;
      const status = query.status;
      const userWalletAddress = query.userWalletAddress;
      const blockchainId = query.blockchainId || 'ethereum';

      let invoiceQuery = supabase
        .from('Invoice')
        .select(`
          *,
          User!userId(id, walletAddress, blockchainId),
          Transaction!invoiceId(id, amount, type, status, hash, createdAt)
        `, { count: 'exact' })
        .order('createdAt', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (status) {
        invoiceQuery = invoiceQuery.eq('status', status);
      }

      // If userWalletAddress is provided, filter for that user
      if (userWalletAddress) {
        const walletUser = await findExistingWalletUser(userWalletAddress, blockchainId);
        if (walletUser.found) {
          invoiceQuery = invoiceQuery.eq('userId', walletUser.userId!);
        } else {
          // Return empty result if wallet not found
          return reply.send({
            message: 'No invoices found for wallet',
            data: {
              invoices: [],
              pagination: {
                currentPage: page,
                totalPages: 0,
                totalCount: 0,
                limit,
                hasNext: false,
                hasPrevious: false,
              },
            },
            gasless: true
          });
        }
      }

      const { data: invoices, error: invoiceError, count } = await invoiceQuery;

      if (invoiceError) {
        throw new Error(`Failed to fetch invoices: ${invoiceError.message}`);
      }

      const totalPages = Math.ceil((count || 0) / limit);

      // Add conversion data
      const invoicesWithConversion = (invoices || []).map(invoice => ({
        ...invoice,
        userWalletAddress: Array.isArray(invoice.User) ? invoice.User[0]?.walletAddress : invoice.User?.walletAddress,
        conversion: {
          usdAmount: invoice.amount,
          ethAmount: invoice.ethAmount,
          weiAmount: invoice.weiAmount,
          ethPrice: invoice.ethPrice,
          displayText: invoice.ethAmount ? `This is ~${invoice.ethAmount.toFixed(6)} ETH` : null,
        }
      }));

      return reply.send({
        message: userWalletAddress ? 
          'Wallet-specific invoices retrieved successfully (gasless)' : 
          'Invoices retrieved successfully (gasless)',
        data: {
          invoices: invoicesWithConversion,
          pagination: {
            currentPage: page,
            totalPages,
            totalCount: count || 0,
            limit,
            hasNext: page < totalPages,
            hasPrevious: page > 1,
          },
        },
        gasless: true
      });

    } catch (err: unknown) {
      console.error('Get invoices error:', err);
      
      return reply.status(500).send({ 
        error: 'Failed to fetch invoices',
        details: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });

  // ✅ GASLESS: Update Invoice (PUT /:id)
  fastify.put('/:id', {
    preHandler: [queryLimitHook],
  }, async (request, reply) => {
    try {
      const sanitizedParams = sanitizeObject(request.params);
      const sanitizedBody = sanitizeObject(request.body);
      const { id } = invoiceIdSchema.parse(sanitizedParams);

      const updateSchema = z.object({
        amount: z.number().positive().max(1000000).optional(),
        dueDate: z.string().refine((date) => {
          const parsed = new Date(date);
          if (isNaN(parsed.getTime())) return false;
          const now = new Date();
          const minDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          const maxDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          return parsed >= minDate && parsed <= maxDate;
        }).optional(),
        tokenAddress: z.string().nullable().optional().refine(val => !val || /^0x[a-fA-F0-9]{40}$/.test(val)),
        escrowAddress: z.string().nullable().optional().refine(val => !val || /^0x[a-fA-F0-9]{40}$/.test(val)),
        userWalletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      });

      const parsed = updateSchema.parse(sanitizedBody);

      // Get existing invoice
      const { data: existingInvoice, error: invoiceError } = await supabase
        .from('Invoice')
        .select(`
          *,
          User!userId(id, walletAddress)
        `)
        .eq('id', id)
        .single();

      if (invoiceError || !existingInvoice) {
        return reply.status(404).send({ error: 'Invoice not found' });
      }

      if (existingInvoice.status === 'PAID') {
        return reply.status(400).send({ 
          error: 'Cannot update a paid invoice' 
        });
      }

      const userData = Array.isArray(existingInvoice.User) ? existingInvoice.User[0] : existingInvoice.User;
      const isOwner = userData?.walletAddress?.toLowerCase() === parsed.userWalletAddress.toLowerCase();

      if (!isOwner) {
        return reply.status(403).send({ 
          error: 'Unauthorized: You can only update your own invoices' 
        });
      }

      // Prepare update data
      let updateData: any = {
        updatedAt: new Date().toISOString(),
      };

      if (parsed.amount !== undefined) {
        const ethPrice = await getETHUSDPrice();
        const ethAmount = convertUSDToETH(parsed.amount, ethPrice);
        const weiAmount = ethToWei(ethAmount);

        updateData = {
          ...updateData,
          amount: parsed.amount,
          ethAmount: ethAmount,
          weiAmount: weiAmount,
          ethPrice: ethPrice,
        };
      }

      if (parsed.dueDate) {
        updateData.dueDate = parsed.dueDate;
      }

      if (parsed.tokenAddress !== undefined) {
        updateData.tokenAddress = parsed.tokenAddress;
      }

      if (parsed.escrowAddress !== undefined) {
        updateData.escrowAddress = parsed.escrowAddress;
      }

      // Update invoice
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('Invoice')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          User!userId(id, walletAddress, blockchainId),
          Transaction!invoiceId(id, amount, type, status, hash, createdAt)
        `)
        .single();

      if (updateError) {
        throw new Error(`Failed to update invoice: ${updateError.message}`);
      }

      return reply.send({
        message: '✅ Invoice updated successfully (gasless)',
        data: {
          invoice: {
            ...updatedInvoice,
            conversion: {
              usdAmount: updatedInvoice.amount,
              ethAmount: updatedInvoice.ethAmount,
              weiAmount: updatedInvoice.weiAmount,
              ethPrice: updatedInvoice.ethPrice,
              displayText: updatedInvoice.ethAmount ? `This is ~${updatedInvoice.ethAmount.toFixed(6)} ETH` : null,
            }
          }
        },
        gasless: true
      });

    } catch (error: unknown) {
      console.error('Update invoice error:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ 
          error: 'Validation failed', 
          details: error.errors 
        });
      }

      return reply.status(500).send({ 
        error: 'Failed to update invoice',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ✅ GASLESS: Delete Invoice (DELETE /:id)
  fastify.delete('/:id', {
    preHandler: [queryLimitHook],
  }, async (request, reply) => {
    try {
      const sanitizedParams = sanitizeObject(request.params);
      const sanitizedQuery = sanitizeObject(request.query);
      const { id } = invoiceIdSchema.parse(sanitizedParams);
      const userWalletAddress = z.string()
        .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid user wallet address format')
        .parse(sanitizedQuery.userWalletAddress);

      // Get existing invoice
      const { data: existingInvoice, error: invoiceError } = await supabase
        .from('Invoice')
        .select(`
          *,
          User!userId(id, walletAddress)
        `)
        .eq('id', id)
        .single();

      if (invoiceError || !existingInvoice) {
        return reply.status(404).send({ error: 'Invoice not found' });
      }

      if (existingInvoice.status === 'PAID') {
        return reply.status(400).send({ 
          error: 'Cannot delete a paid invoice' 
        });
      }

      const userData = Array.isArray(existingInvoice.User) ? existingInvoice.User[0] : existingInvoice.User;
      const isOwner = userData?.walletAddress?.toLowerCase() === userWalletAddress.toLowerCase();

      if (!isOwner) {
        return reply.status(403).send({ 
          error: 'Unauthorized: You can only delete your own invoices' 
        });
      }

      // Delete related transactions first
      await supabase
        .from('Transaction')
        .delete()
        .eq('invoiceId', id);

      // Delete invoice
      const { error: deleteError } = await supabase
        .from('Invoice')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error(`Failed to delete invoice: ${deleteError.message}`);
      }

      // Update invoice count
      try {
        const { data: userData } = await supabase
          .from('User')
          .select('invoiceCount')
          .eq('id', existingInvoice.userId)
          .single();

        if (userData) {
          await supabase
            .from('User')
            .update({ invoiceCount: Math.max(0, (userData.invoiceCount || 1) - 1) })
            .eq('id', existingInvoice.userId);
        }
      } catch (updateError) {
        console.warn('Failed to update invoice count after deletion:', updateError);
      }

      return reply.status(204).send();

    } catch (error: unknown) {
      console.error('Delete invoice error:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ 
          error: 'Invalid input format', 
          details: error.errors 
        });
      }

      return reply.status(500).send({ 
        error: 'Failed to delete invoice',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ✅ GASLESS: Health Check
  fastify.get('/health', async (request, reply) => {
    try {
      // Test Supabase connection
      const { data, error } = await supabase.from('Invoice').select('id').limit(1);
      if (error) throw error;
      
      return reply.send({
        status: 'ok',
        database: 'connected',
        gasless: true,
        timestamp: new Date().toISOString(),
        invoiceCount: data?.length || 0
      });
    } catch (error) {
      return reply.status(500).send({
        status: 'error',
        database: 'disconnected',
        gasless: true,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  });
}
