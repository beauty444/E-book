import Joi from "joi";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import Stripe from "stripe";
dotenv.config();
const prisma = new PrismaClient();
const baseurl = process.env.BASE_URL;
import stripe from '../utils/stripeClient.js';
export const createStripeAccountLink = async (req, res) => {
  try {


    const { frontend_url } = req.body;
    const schema = Joi.alternatives(Joi.object({
      frontend_url: Joi.string().required()
    }))
    const result = schema.validate(req.body);
    if (result.error) {
      const message = result.error.details.map((i) => i.message).join(",");
      return res.json({
        message: result.error.details[0].message,
        error: message,
        missingParams: result.error.details[0].message,
        status: 400,
        success: false,
      });
    }

    let author = await prisma.author.findUnique({ where: { id: req.user.id } });

    if (!author) return res.status(404).json({ message: 'Author not found', status: 404, success: false });

    if (author.stripeAccountId) {
      const accountDetails = await stripe.accounts.retrieve(author.stripeAccountId);
      if (accountDetails.charges_enabled && accountDetails.payouts_enabled) {
        return res.status(200).json({
          completed: true,
          success: true,
          status: 200,
          message: "Stripe onboarding is complete.",
        });
      }
      const accountLink = await stripe.accountLinks.create({
        account: accountDetails.id,
        refresh_url: frontend_url,
        return_url: frontend_url,
        type: 'account_onboarding',
      });
      return res.status(200).json({
        status: 200,
        success: true,
        message: "Updated URL",
        url: accountLink.url
      });

    }

    const account = await stripe.accounts.create({
      type: 'express', // or 'custom'
      country: 'US',
      email: author.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      }
    });

    await prisma.author.update({
      where: {
        id: author.id
      },
      data: {
        stripeAccountId: account.id
      }
    })


    // Step 2: Create account onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: frontend_url,
      return_url: frontend_url,
      type: 'account_onboarding',
    });
    return res.status(200).json({
      status: 200,
      success: true,
      message: "New Url",
      url: accountLink.url
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Stripe error', staus: 200, success: false });
  }
};

export const checkStatus = async (req, res) => {
  try {
    let author = await prisma.author.findUnique({ where: { id: req.user.id } });

    if (!author) return res.status(404).json({ message: 'Author not found' });
    const account = await stripe.accounts.retrieve(author.stripeAccountId);
    if (account.charges_enabled && account.payouts_enabled) {
      return res.status(200).json({
        completed: true,
        success: true,
        status: 200,
        message: "Stripe onboarding is complete.",
        currentlyDue: [],
        detailsSubmitted: true,
        chargesEnabled: true,
        payoutsEnabled: true
      });
    }

    const requirements = account.requirements?.currently_due || [];

    return res.status(200).json({
      completed: false,
      success: true,
      status: 200,
      message: "Stripe onboarding is incomplete.",
      currentlyDue: requirements,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Stripe error', status: 200, success: false });
  }
};

export const resumeStripeOnboarding = async (req, res) => {
  try {
    const author = await prisma.author.findUnique({ where: { id: req.user.id } });
    if (!author || !author.stripeAccountId) {
      return res.status(404).json({ message: 'No Stripe account found.', status: 404, success: false });
    }


    const account = await stripe.accounts.retrieve(author.stripeAccountId);

    if (account.charges_enabled) {
      return res.json({
        message: 'Stripe onboarding already completed.',
        success: true,
        status: 200,
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'https://yourfrontend.com/stripe/refresh',
      return_url: 'https://yourfrontend.com/stripe/return',
      type: 'account_onboarding',
    });

    res.json({
      url: accountLink.url,
      status: 200,
      success: true,
      progress: {
        details_submitted: account.details_submitted,
        requirements_due: account.requirements?.currently_due || [],
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

