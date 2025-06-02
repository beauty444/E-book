// import express from 'express';
// import Stripe from 'stripe';
// import dotenv from 'dotenv';
// import prisma from '../utils/prismaClient.js';

// dotenv.config();
//  const stripeWebhookRouter = express.Router();
// // const router = express.Router();
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // initialize Stripe
// const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// // stripeWebhookRouter.post('/webhook', express.json(), async (req, res) => {
// //   const event = req.body;

// //   try {
// //     if (event.type === 'checkout.session.completed') {
// //       const session = event.data.object;

// //       // 1. Subscription purchase
// //       if (session.metadata && session.metadata.plan_id) {
// //         const authorId = parseInt(session.metadata.authorId);
// //         const planId = parseInt(session.metadata.plan_id);

// //         const now = new Date();
// //         const extendedDate = new Date(now.setMonth(now.getMonth() + 6)); // adjust to plan duration

// //         // ✅ Update author's subscription info
// //         await prisma.author.update({
// //           where: { id: authorId },
// //           data: {
// //             subscribedUntil: extendedDate,
// //           },
// //         });

// //         // ✅ Save subscription record
// //         await prisma.subscription.create({
// //           data: {
// //             authorId,
// //             planId,
// //             status: 'active',
// //             startDate: new Date(),
// //             endDate: extendedDate,
// //           },
// //         });

// //         // ✅ Create a transaction log
// //         await prisma.transaction.create({
// //           data: {
// //             type: 'SUBSCRIPTION',
// //             authorId,
// //             amount: session.amount_total / 100,
// //             stripeRef: session.id,
// //             status: 'completed',
// //           },
// //         });

// //         console.log(`✅ Subscription completed for Author ID: ${authorId}`);
// //       }

// //       // 2. Book purchase
// //       if (session.metadata && session.metadata.bookId) {
// //         const userId = parseInt(session.metadata.userId);
// //         const bookId = parseInt(session.metadata.bookId);
// //         const authorId = parseInt(session.metadata.authorId);
// //         const isOnboarded = session.metadata.isOnboarded === 'true';

// //         // Avoid duplicate
// //         const existing = await prisma.purchase.findFirst({
// //           where: { userId, bookId },
// //         });

// //         if (!existing) {
// //           await prisma.purchase.create({
// //             data: {
// //               userId,
// //               bookId,
// //               amount: session.amount_total / 100,
// //               authorId,
// //               isHeld: !isOnboarded, // mark as held if author not onboarded
// //             },
// //           });

// //           console.log(
// //             isOnboarded
// //               ? `✅ Book purchased, earnings routed to author ${authorId}`
// //               : `⚠️ Book purchased, earnings held (author ${authorId} not onboarded)`
// //           );
// //         }
// //       }
// //     }

// //     // ✅ Stripe Connect onboarding completed
// //     if (event.type === 'account.updated') {
// //       const account = event.data.object;

// //       if (account.charges_enabled) {
// //         await prisma.author.updateMany({
// //           where: { stripeAccountId: account.id },
// //           data: { onboardingComplete: true },
// //         });

// //         console.log(`✅ Onboarding complete for Stripe Account ID: ${account.id}`);
// //       }
// //     }

// //     res.status(200).json({ received: true });
// //   } catch (error) {
// //     console.error('❌ Webhook processing error:', error.message);
// //     res.status(500).send('Webhook processing error.');
// //   }
// // });


// stripeWebhookRouter.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
//   const sig = req.headers['stripe-signature'];

//   let event;

//   try {
//     // Verify webhook signature
//     event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
//   } catch (err) {
//     console.error('❌ Webhook signature verification failed:', err.message);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   try {
//     if (event.type === 'checkout.session.completed') {
//       const session = event.data.object;

//       // ✅ Handle Subscription Purchase
//       if (session.metadata?.plan_id) {
//         const authorId = parseInt(session.metadata.authorId);
//         const planId = parseInt(session.metadata.plan_id);

//         const now = new Date();
//         const extendedDate = new Date(now.setMonth(now.getMonth() + 6)); // Adjust based on actual plan

//         // Update author's subscription
//         await prisma.author.update({
//           where: { id: authorId },
//           data: { subscribedUntil: extendedDate },
//         });

//         // Save subscription record
//         await prisma.subscription.create({
//           data: {
//             authorId,
//             planId,
//             status: 'active',
//             startDate: new Date(),
//             endDate: extendedDate,
//           },
//         });

//         // Log transaction
//         await prisma.transaction.create({
//           data: {
//             type: 'SUBSCRIPTION',
//             authorId,
//             amount: session.amount_total / 100,
//             stripeRef: session.id,
//             status: 'completed',
//           },
//         });

//         console.log(`✅ Subscription completed for Author ID: ${authorId}`);
//       }

//       // ✅ Handle Book Purchase
//       if (session.metadata?.bookId) {
//         const userId = parseInt(session.metadata.userId);
//         const bookId = parseInt(session.metadata.bookId);
//         const authorId = parseInt(session.metadata.authorId);
//         const isOnboarded = session.metadata.isOnboarded === 'true';

//         const existingPurchase = await prisma.purchase.findFirst({
//           where: { userId, bookId },
//         });

//         if (!existingPurchase) {
//           await prisma.purchase.create({
//             data: {
//               userId,
//               bookId,
//               amount: session.amount_total / 100,
//               authorId,
//               isHeld: !isOnboarded,
//             },
//           });

//           console.log(
//             isOnboarded
//               ? `✅ Book purchased, earnings routed to author ${authorId}`
//               : `⚠️ Book purchased, earnings held (author ${authorId} not onboarded)`
//           );
//         }
//       }
//     }

//     // ✅ Handle Stripe Account Onboarding
//     if (event.type === 'account.updated') {
//       const account = event.data.object;

//       if (account.charges_enabled) {
//         await prisma.author.updateMany({
//           where: { stripeAccountId: account.id },
//           data: { onboardingComplete: true },
//         });

//         console.log(`✅ Onboarding complete for Stripe Account ID: ${account.id}`);
//       }
//     }

//     res.status(200).json({ received: true });
//   } catch (error) {
//     console.error('❌ Webhook processing error:', error.message);
//     res.status(500).send('Webhook processing error.');
//   }
// });

// export default stripeWebhookRouter;




import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import prisma from '../utils/prismaClient.js';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripeWebhookRouter = express.Router();

// Use raw body for Stripe signature verification
stripeWebhookRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
      // Verify the Stripe event using the raw body
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const { type, data } = event;

    try {
      // ✅ Handle checkout session completion
      if (type === 'checkout.session.completed') {
        const session = data.object;

        const metadata = session.metadata || {};

        const amount = session.amount_total ? session.amount_total / 100 : 0;

        // 🎯 Handle Subscription Purchase
        if (metadata.plan_id && metadata.authorId) {
          const authorId = parseInt(metadata.authorId);
          const planId = parseInt(metadata.plan_id);

          const now = new Date();
          const extendedDate = new Date(now.setMonth(now.getMonth() + 6)); // Adjust as per actual plan logic

          await prisma.author.update({
            where: { id: authorId },
            data: { subscribedUntil: extendedDate },
          });

          await prisma.subscription.create({
            data: {
              authorId,
              planId,
              status: 'active',
              startDate: new Date(),
              endDate: extendedDate,
            },
          });

          await prisma.transaction.create({
            data: {
              type: 'SUBSCRIPTION',
              authorId,
              amount,
              stripeRef: session.id,
              status: 'completed',
            },
          });

          console.log(`✅ Subscription completed for Author ID: ${authorId}`);
        }

        // 🎯 Handle Book Purchase
        if (metadata.bookId && metadata.userId && metadata.authorId) {
          const userId = parseInt(metadata.userId);
          const bookId = parseInt(metadata.bookId);
          const authorId = parseInt(metadata.authorId);
          const isOnboarded = metadata.isOnboarded === 'true';

          const existing = await prisma.purchase.findFirst({
            where: { userId, bookId },
          });

          if (!existing) {
            await prisma.purchase.create({
              data: {
                userId,
                bookId,
                amount,
                authorId,
                isHeld: !isOnboarded,
              },
            });

            console.log(
              isOnboarded
                ? `✅ Book purchased, earnings routed to author ${authorId}`
                : `⚠️ Book purchased, earnings held (author ${authorId} not onboarded)`
            );
          }
        }
      }

      // ✅ Handle Stripe Account Updated
      if (type === 'account.updated') {
        const account = data.object;

        if (account.charges_enabled) {
          await prisma.author.updateMany({
            where: { stripeAccountId: account.id },
            data: { onboardingComplete: true },
          });

          console.log(`✅ Onboarding complete for Stripe Account ID: ${account.id}`);

          // 🔁 Release held purchases for this author
          const author = await prisma.author.findFirst({
            where: { stripeAccountId: account.id },
          });

          if (author) {
            const heldPurchases = await prisma.purchase.findMany({
              where: {
                authorId: author.id,
                isHeld: true,
              },
            });

            for (const purchase of heldPurchases) {
              try {
                await stripe.transfers.create({
                  amount: Math.round(purchase.amount * 100),
                  currency: 'usd',
                  destination: account.id,
                  metadata: {
                    original_purchase_id: purchase.id.toString(),
                  },
                });

                await prisma.purchase.update({
                  where: { id: purchase.id },
                  data: { isHeld: false },
                });

                console.log(`✅ Released held purchase ID ${purchase.id} to author ${author.id}`);
              } catch (err) {
                console.error(`❌ Failed to release funds for purchase ID ${purchase.id}:`, err.message);
              }
            }
          }
        }
      }
      res.status(200).json({ received: true });
    } catch (err) {
      console.error('❌ Webhook processing error:', err.message);
      res.status(500).send('Webhook processing error.');
    }
  }
);

export default stripeWebhookRouter;
