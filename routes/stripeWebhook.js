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
        // if (metadata.plan_id && metadata.authorId) {
        //   const authorId = parseInt(metadata.authorId);
        //   const planId = parseInt(metadata.plan_id);

        //   const plan = await prisma.plan.findUnique({
        //     where: { id: planId },
        //   });

        //   if (!plan) throw new Error("Plan not found");

        //   const now = new Date();
        //   let extendedDate = new Date(now);

        //   // Adjust duration based on plan
        //   if (planId === 1) {
        //     extendedDate.setMonth(extendedDate.getMonth() + 6); // Plan 1: 6 months
        //   } else if (planId === 2) {
        //     extendedDate.setMonth(extendedDate.getMonth() + 12); // Plan 2: 12 months
        //   } else {
        //     throw new Error("Invalid plan ID");
        //   }

        //   // Update author's subscription date
        //   await prisma.author.update({
        //     where: { id: authorId },
        //     data: { subscribedUntil: extendedDate },
        //   });

        //   // Create subscription entry
        //   await prisma.subscription.create({
        //     data: {
        //       authorId,
        //       planId,
        //       status: 'active',
        //       startDate: new Date(),
        //       endDate: extendedDate,
        //     },
        //   });

        //   // Create transaction entry
        //   await prisma.transaction.create({
        //     data: {
        //       type: 'SUBSCRIPTION',
        //       authorId,
        //       amount, // make sure amount is defined
        //       stripeRef: session.id,
        //       status: 'completed',
        //     },
        //   });

        //   console.log(`✅ Subscription completed for Author ID: ${authorId}`);
        // }

        if (metadata.plan_id && metadata.authorId) {
          const authorId = parseInt(metadata.authorId);
          const planId = parseInt(metadata.plan_id);

          const plan = await prisma.plan.findUnique({
            where: { id: planId },
          });
          if (!plan) throw new Error("Plan not found");

          const now = new Date();

          // Calculate new end date based on the plan duration
          let newEndDate = new Date();
          newEndDate.setMonth(newEndDate.getMonth() + (planId === 1 ? 6 : planId === 2 ? 12 : 0));
          if (newEndDate.getTime() === now.getTime()) {
            throw new Error("Invalid plan duration");
          }

          // Fetch existing active subscription for this author
          const existingSubscription = await prisma.subscription.findFirst({
            where: {
              authorId,
              status: 'active',
            },
            orderBy: {
              endDate: 'desc',
            },
          });

          let startDate = new Date();

          if (existingSubscription) {
            startDate = existingSubscription.startDate;

            // If current subscription end date is in the future, check upgrade
            if (existingSubscription.endDate > now) {
              // Only upgrade if the new plan's end date is later than the current end date
              if (newEndDate > existingSubscription.endDate) {
                // Extend end date
                await prisma.subscription.update({
                  where: { id: existingSubscription.id },
                  data: { endDate: newEndDate, planId },
                });

                await prisma.author.update({
                  where: { id: authorId },
                  data: { subscribedUntil: newEndDate },
                });
              }
              // Else no update needed, user already has equal or longer subscription
            } else {
              // Subscription expired, create a new subscription starting now
              await prisma.subscription.create({
                data: {
                  authorId,
                  planId,
                  status: 'active',
                  startDate: now,
                  endDate: newEndDate,
                },
              });

              await prisma.author.update({
                where: { id: authorId },
                data: { subscribedUntil: newEndDate },
              });
            }
          } else {
            // No existing subscription, create a new one
            await prisma.subscription.create({
              data: {
                authorId,
                planId,
                status: 'active',
                startDate: now,
                endDate: newEndDate,
              },
            });

            await prisma.author.update({
              where: { id: authorId },
              data: { subscribedUntil: newEndDate },
            });
          }

          // Record the transaction anyway
          await prisma.transaction.create({
            data: {
              type: 'SUBSCRIPTION',
              authorId,
              amount,  // ensure amount is defined earlier
              stripeRef: session.id,
              status: 'completed',
            },
          });

          console.log(`✅ Subscription processed for Author ID: ${authorId}`);
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
