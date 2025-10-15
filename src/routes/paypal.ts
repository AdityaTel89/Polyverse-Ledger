// src/routes/paypal.ts - PRODUCTION READY
import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { getPayPalAccessToken } from '../utils/getPayPalAccessToken.js';
import { PrismaClient } from '@prisma/client';
import { CreditScoreService } from '../services/creditScore.js';

export const prisma = new PrismaClient();

export async function paypalRoutes(fastify: FastifyInstance) {
  
  // ✅ Config endpoint
  fastify.get('/config', async (request, reply) => {
    try {
      return reply.send({
        paypalClientId: process.env.PAYPAL_CLIENT_ID,
        paypalMode: process.env.PAYPAL_MODE || 'sandbox',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      return reply.status(500).send({ 
        error: 'Failed to load configuration',
        details: error.message 
      });
    }
  });

  // ✅ Test PayPal connection
  fastify.get('/test-paypal-connection', async (request, reply) => {
    try {
      const accessToken = await getPayPalAccessToken();
      
      return reply.send({ 
        success: true, 
        message: 'PayPal connection successful',
        mode: process.env.PAYPAL_MODE || 'sandbox',
        tokenLength: accessToken.length,
        tokenPreview: accessToken.substring(0, 20) + '...',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('PayPal connection test failed:', error.message);
      return reply.status(500).send({ 
        success: false,
        error: 'PayPal connection failed',
        details: error.message,
        suggestions: [
          "Create a new PayPal sandbox app at https://developer.paypal.com/",
          "Ensure the app has 'Accept payments' feature enabled",
          "Update your .env file with the new credentials",
          "Restart your server after updating credentials"
        ],
        timestamp: new Date().toISOString()
      });
    }
  });

  // ✅ Create new PayPal subscription plans (use this to create working plans)
  fastify.post('/create-plans', async (request, reply) => {
    try {
      const accessToken = await getPayPalAccessToken();
      const mode = process.env.PAYPAL_MODE || 'sandbox';
      const baseUrl = mode === 'live' 
        ? 'https://api-m.paypal.com' 
        : 'https://api-m.sandbox.paypal.com';

      // Step 1: Create a product first
      const productResponse = await axios.post(
        `${baseUrl}/v1/catalogs/products`, 
        {
          name: "MythosNet Subscription Services",
          description: "Blockchain identity and credit scoring platform",
          type: "SERVICE",
          category: "SOFTWARE"
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      const productId = productResponse.data.id;
      console.log('✅ Product created:', productId);

      // Step 2: Create subscription plans
      const plans = [
        {
          name: "Basic Plan",
          description: "Small businesses & individuals - 1,000 queries per month",
          price: "149.00"
        },
        {
          name: "Pro Plan", 
          description: "Medium businesses & DeFi protocols - 15,000 queries per month",
          price: "699.00"
        },
        {
          name: "Premium Plan",
          description: "Financial institutions - 1M queries per month", 
          price: "3699.00"
        }
      ];

      const createdPlans = [];

      for (const planData of plans) {
        const planResponse = await axios.post(
          `${baseUrl}/v1/billing/plans`,
          {
            product_id: productId,
            name: planData.name,
            description: planData.description,
            status: "ACTIVE",
            billing_cycles: [{
              frequency: {
                interval_unit: "MONTH",
                interval_count: 1
              },
              tenure_type: "REGULAR", 
              sequence: 1,
              total_cycles: 0, // 0 = infinite
              pricing_scheme: {
                fixed_price: {
                  value: planData.price,
                  currency_code: "USD"
                }
              }
            }],
            payment_preferences: {
              auto_bill_outstanding: true,
              setup_fee_failure_action: "CONTINUE",
              payment_failure_threshold: 3
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          }
        );

        createdPlans.push({
          name: planData.name,
          id: planResponse.data.id,
          status: planResponse.data.status
        });

        console.log(`✅ Plan created: ${planData.name} (${planResponse.data.id})`);
      }

      return reply.send({
        success: true,
        message: 'PayPal plans created successfully',
        productId,
        plans: createdPlans,
        note: "Update your frontend with these new plan IDs",
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Failed to create PayPal plans:', error?.response?.data || error.message);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create PayPal plans',
        details: error?.response?.data || error.message
      });
    }
  });

  // ✅ Create subscription
  fastify.post('/create-subscription', async (request, reply) => {
    try {
      const { plan_id, userId, prismaPlanId, subscriptionId } = request.body as {
        plan_id?: string;
        userId?: string;
        prismaPlanId?: string;
        subscriptionId?: string;
      };

      console.log('🔄 Processing subscription:', { plan_id, userId, prismaPlanId, subscriptionId });

      // Validate required fields
      if (!plan_id || !userId || !prismaPlanId || !subscriptionId) {
        return reply.code(400).send({ 
          error: 'Missing required fields',
          required: ['plan_id', 'userId', 'prismaPlanId', 'subscriptionId'],
          received: { plan_id, userId, prismaPlanId, subscriptionId: !!subscriptionId }
        });
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!existingUser) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Check if plan exists in database
      const plan = await prisma.plan.findUnique({
        where: { id: prismaPlanId },
      });

      if (!plan) {
        return reply.code(404).send({ error: 'Plan not found in database' });
      }

      // Verify subscription with PayPal
      try {
        const accessToken = await getPayPalAccessToken();
        const mode = process.env.PAYPAL_MODE || 'sandbox';
        const baseUrl = mode === 'live' 
          ? 'https://api-m.paypal.com' 
          : 'https://api-m.sandbox.paypal.com';

        const verifyResponse = await axios.get(
          `${baseUrl}/v1/billing/subscriptions/${subscriptionId}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('✅ PayPal subscription verified:', {
          id: verifyResponse.data.id,
          status: verifyResponse.data.status,
          plan_id: verifyResponse.data.plan_id
        });

        // Ensure the subscription uses the correct plan
        if (verifyResponse.data.plan_id !== plan_id) {
          return reply.code(400).send({ 
            error: 'Subscription plan mismatch',
            expected: plan_id,
            actual: verifyResponse.data.plan_id
          });
        }

      } catch (verifyError: any) {
        console.error('❌ PayPal subscription verification failed:', verifyError?.response?.data);
        return reply.code(400).send({ 
          error: 'Invalid subscription ID',
          details: verifyError?.response?.data || verifyError.message
        });
      }

      // Update user with new plan
      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            planId: prismaPlanId,
            subscriptionId: subscriptionId,
            trialUsed: true,
            trialStartDate: null,
            trialEndDate: null,
          },
        });

        console.log('✅ User plan updated successfully');
      } catch (userUpdateError: any) {
        console.error('❌ Failed to update user plan:', userUpdateError.message);
        return reply.code(500).send({ 
          error: 'Failed to update user plan',
          details: userUpdateError.message
        });
      }

      // Create transaction record
      try {
        await prisma.transaction.create({
          data: {
            userId,
            amount: plan.price,
            type: 'debit',
            status: 'SUCCESS',
            hash: subscriptionId,
            riskScore: 0.1,
          },
        });

        console.log('✅ Transaction record created');
      } catch (transactionError: any) {
        console.warn('⚠️ Transaction record creation failed:', transactionError.message);
        // Continue - this is not critical
      }

      return reply.send({
        success: true,
        message: 'Subscription activated successfully',
        subscriptionId: subscriptionId,
        planName: plan.name,
        userId: userId
      });

    } catch (err: any) {
      console.error('❌ Subscription creation failed:', err.message);
      return reply.code(500).send({ 
        error: 'Subscription processing failed',
        details: err.message 
      });
    }
  });

  // ✅ Webhook handler
  fastify.post('/webhook', async (request, reply) => {
    try {
      const event = request.body as {
        event_type: string;
        resource: { id: string; status?: string };
      };

      console.log('🔔 PayPal webhook received:', event.event_type);

      const eventType = event.event_type;
      const subscriptionId = event.resource.id;

      if (!subscriptionId) {
        return reply.code(400).send({ error: 'Missing subscription ID in webhook' });
      }

      switch (eventType) {
        case 'BILLING.SUBSCRIPTION.CANCELLED':
          await prisma.user.updateMany({
            where: { subscriptionId },
            data: {
              planId: process.env.FREE_PLAN_ID || null,
              subscriptionId: null,
              trialUsed: true,
            },
          });
          console.log('✅ Subscription cancelled:', subscriptionId);
          break;

        case 'BILLING.SUBSCRIPTION.SUSPENDED':
          await prisma.user.updateMany({
            where: { subscriptionId },
            data: {
              planId: process.env.FREE_PLAN_ID || null,
            },
          });
          console.log('✅ Subscription suspended:', subscriptionId);
          break;

        case 'BILLING.SUBSCRIPTION.ACTIVATED':
          console.log('✅ Subscription activated via webhook:', subscriptionId);
          break;

        default:
          console.log('ℹ️ Unhandled webhook event:', eventType);
      }

      return reply.code(200).send({ received: true, eventType });
    } catch (err: any) {
      console.error('❌ Webhook processing failed:', err.message);
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });
}

export default paypalRoutes;
