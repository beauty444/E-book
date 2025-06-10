// utils/stripeClient.js
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
console.log("Stripe Key Loaded:", process.env.STRIPE_SECRET_KEY?.slice(0, 8) + '...');


export default stripe;
