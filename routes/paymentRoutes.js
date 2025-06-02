import express from "express";
import { auth } from "../middlewares/auth.js";
import { paymentThroughStripe, stripeSuccessAndPurchasePlan } from "../controllers/paymentController.js";


export const paymentRouter = express.Router();

paymentRouter.post('/purchasePlan', auth, paymentThroughStripe);

paymentRouter.get('/success', stripeSuccessAndPurchasePlan);

