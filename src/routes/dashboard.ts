// src/routes/dashboard.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface WalletParams {
  walletAddress: string;
  blockchainId: string;
}

export async function dashboardRoutes(fastify: FastifyInstance) {
  // ✅ Global Dashboard Stats (for admin/overview purposes)
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const totalUsers = await prisma.user.count();
      const totalInvoices = await prisma.invoice.count();
      const totalBlockchains = await prisma.blockchain.count();

      const average = await prisma.user.aggregate({
        _avg: { creditScore: true }
      });

      return reply.send({
        totalUsers,
        totalInvoices,
        totalBlockchains,
        averageScore: Math.round(average._avg.creditScore ?? 0)
      });
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error);
      return reply.code(500).send({ error: 'Failed to fetch dashboard stats' });
    }
  });

  // ✅ Global Recent Activity (for admin purposes)
  fastify.get('/activity', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const recentUsers = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          blockchain: true
        }
      });

      const recentInvoices = await prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: true
        }
      });

      const recentBlockchains = await prisma.blockchain.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      const activity = [
        ...recentUsers.map((user: any) => ({
          type: 'user',
          description: 'New user registered',
          details: `Wallet: ${user.walletAddress}`,
          timestamp: user.createdAt
        })),
        ...recentInvoices.map((invoice: any) => ({
          type: 'invoice',
          description: 'Invoice created',
          details: `Amount: ${invoice.amount} ${invoice.currency || 'USD'}`,
          timestamp: invoice.createdAt
        })),
        ...recentBlockchains.map((chain: any) => ({
          type: 'blockchain',
          description: 'Blockchain connected',
          details: `${chain.name}`,
          timestamp: chain.createdAt
        }))
      ];

      activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return reply.send(activity.slice(0, 6));
    } catch (error: any) {
      console.error('Error fetching dashboard activity:', error);
      return reply.code(500).send({ error: 'Failed to fetch activity' });
    }
  });

  // ✅ User-Specific Stats
  fastify.get<{ Params: WalletParams }>('/user-stats/:walletAddress/:blockchainId', async (request: FastifyRequest<{ Params: WalletParams }>, reply: FastifyReply) => {
    try {
      const { walletAddress, blockchainId } = request.params;
      
      // Find user with all related data
      const user = await prisma.user.findUnique({
        where: {
          blockchainId_walletAddress: {
            blockchainId,
            walletAddress
          }
        },
        include: {
          plan: true,
          invoices: {
            orderBy: { createdAt: 'desc' }
          },
          queryUsages: {
            where: {
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear()
            }
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          crossChainIds: {
            include: {
              blockchain: true
            }
          }
        }
      });

      if (!user) {
        return reply.code(404).send({ 
          success: false, 
          error: 'User not found. Please register your wallet first.' 
        });
      }

      // Get current month's query usage
      const currentUsage = user.queryUsages[0];
      const planQueryLimit = user.plan?.queryLimit || 20;
      const queriesUsed = currentUsage?.used || 0;
      const queriesRemaining = Math.max(planQueryLimit - queriesUsed, 0);

      // Calculate trial info
      let trialDaysRemaining = null;
      let trialActive = false;
      
      if (user.trialStartDate && !user.trialUsed) {
        const trialStart = new Date(user.trialStartDate);
        const trialEnd = new Date(trialStart);
        trialEnd.setDate(trialEnd.getDate() + 5); // 5-day trial
        
        const now = new Date();
        if (now < trialEnd) {
          trialActive = true;
          trialDaysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      // Get invoice statistics
      const totalInvoices = user.invoices.length;
      const paidInvoices = user.invoices.filter(inv => inv.status === 'PAID').length;
      const pendingInvoices = user.invoices.filter(inv => inv.status === 'UNPAID').length;
      const totalInvoiceAmount = user.invoices
        .filter(inv => inv.status === 'PAID')
        .reduce((sum, inv) => sum + inv.amount, 0);

      return reply.send({
        success: true,
        data: {
          // User basic info
          userId: user.id,
          walletAddress: user.walletAddress,
          blockchainId: user.blockchainId,
          creditScore: user.creditScore,
          
          // Invoice stats
          totalInvoices,
          paidInvoices,
          pendingInvoices,
          totalInvoiceAmount,
          
          // Query usage
          queryUsage: {
            used: queriesUsed,
            limit: planQueryLimit,
            remaining: queriesRemaining,
            percentage: planQueryLimit > 0 ? Math.round((queriesUsed / planQueryLimit) * 100) : 0
          },
          
          // Plan information
          planInfo: {
            name: user.plan?.name || 'Free',
            features: user.plan?.features || [],
            queryLimit: planQueryLimit,
            userLimit: user.plan?.userLimit || 1,
            price: user.plan?.price || 0
          },
          
          // Trial information
          trial: {
            active: trialActive,
            daysRemaining: trialDaysRemaining,
            startDate: user.trialStartDate,
            used: user.trialUsed
          },
          
          // Account info
          accountAge: Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
          
          // Cross-chain wallets count
          crossChainWallets: user.crossChainIds.length,
          
          // Recent transactions count
          recentTransactions: user.transactions.length
        }
      });
    } catch (error: any) {
      console.error('Error fetching user stats:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to fetch user statistics' 
      });
    }
  });

  // ✅ User-Specific Activity
  fastify.get<{ Params: WalletParams }>('/user-activity/:walletAddress/:blockchainId', async (request: FastifyRequest<{ Params: WalletParams }>, reply: FastifyReply) => {
    try {
      const { walletAddress, blockchainId } = request.params;
      
      // Find user
      const user = await prisma.user.findUnique({
        where: {
          blockchainId_walletAddress: {
            blockchainId,
            walletAddress
          }
        }
      });

      if (!user) {
        return reply.code(404).send({ 
          success: false, 
          error: 'User not found' 
        });
      }

      const activities: any[] = [];

      // 1. User registration activity
      activities.push({
        id: `user-reg-${user.id}`,
        type: 'registration',
        description: 'Wallet registered',
        details: `Welcome to MythosNet! Your wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} has been successfully registered.`,
        timestamp: user.createdAt,
        userId: user.id
      });

      // 2. Get user's invoices
      const userInvoices = await prisma.invoice.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          blockchain: true
        }
      });

      userInvoices.forEach(invoice => {
        // ✅ FIXED: Safe access to invoiceNumber
        const invoiceId = (invoice as any).invoiceNumber || invoice.id.slice(0, 8);
        
        activities.push({
          id: `invoice-${invoice.id}`,
          type: 'invoice',
          description: invoice.status === 'PAID' ? 'Invoice paid' : 'Invoice created',
          details: `Invoice #${invoiceId} - ${invoice.amount} ${invoice.currency}`,
          timestamp: invoice.status === 'PAID' ? (invoice.paidAt || invoice.createdAt) : invoice.createdAt,
          userId: user.id
        });
      });

      // 3. Get user's transactions
      const userTransactions = await prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      userTransactions.forEach(transaction => {
        // ✅ FIXED: Safe access to currency field
        const currency = (transaction as any).currency || 'USD';
        
        activities.push({
          id: `transaction-${transaction.id}`,
          type: 'transaction',
          description: `Transaction ${transaction.status.toLowerCase()}`,
          details: `${transaction.type} - ${transaction.amount} ${currency}`,
          timestamp: transaction.createdAt,
          userId: user.id
        });
      });

      // 4. Get user's cross-chain identities
      const crossChainIds = await prisma.crossChainIdentity.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          blockchain: true
        }
      });

      crossChainIds.forEach(identity => {
        activities.push({
          id: `crosschain-${identity.id}`,
          type: 'crosschain',
          description: 'Cross-chain wallet added',
          details: `Added wallet on ${identity.blockchain.name} (Chain ID: ${identity.blockchainId})`,
          timestamp: identity.createdAt,
          userId: user.id
        });
      });

      // 5. Credit score updates
      const creditHistory = await prisma.creditScoreHistory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      creditHistory.forEach(credit => {
        // ✅ FIXED: Safe access to change and reason fields
        const change = (credit as any).change || 0;
        const reason = (credit as any).reason || 'Updated';
        
        activities.push({
          id: `credit-${credit.id}`,
          type: 'credit',
          description: change > 0 ? 'Credit score increased' : change < 0 ? 'Credit score decreased' : 'Credit score updated',
          details: `Score: ${credit.score} (${change > 0 ? '+' : ''}${change}) - ${reason}`,
          timestamp: credit.createdAt,
          userId: user.id
        });
      });

      // Sort all activities by timestamp (most recent first)
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return reply.send({
        success: true,
        data: activities.slice(0, 15) // Return last 15 activities
      });
    } catch (error: any) {
      console.error('Error fetching user activity:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to fetch user activity' 
      });
    }
  });

  // ✅ User Summary Endpoint (for dashboard header)
  fastify.get<{ Params: WalletParams }>('/user-summary/:walletAddress/:blockchainId', async (request: FastifyRequest<{ Params: WalletParams }>, reply: FastifyReply) => {
    try {
      const { walletAddress, blockchainId } = request.params;
      
      const user = await prisma.user.findUnique({
        where: {
          blockchainId_walletAddress: {
            blockchainId,
            walletAddress
          }
        },
        include: {
          plan: true,
          blockchain: true
        }
      });

      if (!user) {
        return reply.code(404).send({ 
          success: false, 
          error: 'User not found' 
        });
      }

      return reply.send({
        success: true,
        data: {
          id: user.id,
          name: (user as any).name || null, // ✅ FIXED: Safe access to name
          email: (user as any).email || null, // ✅ FIXED: Safe access to email
          walletAddress: user.walletAddress,
          blockchainId: user.blockchainId,
          blockchainName: user.blockchain.name,
          creditScore: user.creditScore,
          plan: {
            name: user.plan?.name || 'Free'
          },
          isVerified: (user as any).isVerified || false, // ✅ FIXED: Safe access to isVerified
          createdAt: user.createdAt,
          lastLoginAt: (user as any).lastLoginAt || null, // ✅ FIXED: Safe access to lastLoginAt
          trialStartDate: user.trialStartDate,
          trialUsed: user.trialUsed,
          subscriptionId: user.subscriptionId
        }
      });
    } catch (error: any) {
      console.error('Error fetching user summary:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to fetch user summary' 
      });
    }
  });

  // ✅ Quick Stats for Dashboard Cards
  fastify.get<{ Params: WalletParams }>('/user-quick-stats/:walletAddress/:blockchainId', async (request: FastifyRequest<{ Params: WalletParams }>, reply: FastifyReply) => {
    try {
      const { walletAddress, blockchainId } = request.params;
      
      const user = await prisma.user.findUnique({
        where: {
          blockchainId_walletAddress: {
            blockchainId,
            walletAddress
          }
        },
        include: {
          plan: true
        }
      });

      if (!user) {
        return reply.code(404).send({ 
          success: false, 
          error: 'User not found' 
        });
      }

      // Get counts efficiently
      const [
        invoiceCount,
        transactionCount,
        crossChainCount,
        queryUsage
      ] = await Promise.all([
        prisma.invoice.count({ where: { userId: user.id } }),
        prisma.transaction.count({ where: { userId: user.id } }),
        prisma.crossChainIdentity.count({ where: { userId: user.id } }),
        prisma.queryUsage.findFirst({
          where: {
            userId: user.id,
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear()
          }
        })
      ]);

      // Use plan query limit or fallback to user's individual limit
      const queryLimit = user.plan?.queryLimit || user.queriesLimit || 20;

      return reply.send({
        success: true,
        data: {
          creditScore: user.creditScore,
          totalInvoices: invoiceCount,
          totalTransactions: transactionCount,
          crossChainWallets: crossChainCount,
          queriesUsed: queryUsage?.used || 0,
          queriesLimit: queryLimit,
          queriesRemaining: Math.max(queryLimit - (queryUsage?.used || 0), 0)
        }
      });
    } catch (error: any) {
      console.error('Error fetching quick stats:', error);
      return reply.code(500).send({ 
        success: false, 
        error: 'Failed to fetch quick statistics' 
      });
    }
  });
}
