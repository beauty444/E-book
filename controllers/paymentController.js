import Joi from "joi";
import jwt from 'jsonwebtoken'
import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcrypt';
import path from 'path'
import dotenv from "dotenv";
import crypto from 'crypto'
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import hbs from "nodemailer-express-handlebars";
import Stripe from "stripe";
import { CustomSignalOperator } from "firebase-admin/remote-config";
// import { generateOTP, generateRandomUICNumber, getActivePlanForUser, getReportedAssetIds, getReportedUserIds } from "../utils/helper.js";
dotenv.config();
const prisma = new PrismaClient();
const baseurl = process.env.BASE_URL;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SINCH_APPLICATION_KEY = process.env.SINCH_APPLICATION_KEY
const SINCH_APPLICATION_SECRET = process.env.SINCH_APPLICATION_SECRET
const SINCH_BASE_URL = process.env.SINCH_BASE_URL;
//withour weebhook
// export async function paymentThroughStripe(req, res) {
//     const { planId } = req.body;

//     const schema = Joi.alternatives(
//         Joi.object({
//             planId: Joi.number().required(),
//         })
//     )
//     console.log("body", req.body)
//     const result = schema.validate(req.body);
//     if (result.error) {
//         const message = result.error.details.map((i) => i.message).join(",");
//         return res.json({
//             message: result.error.details[0].message,
//             error: message,
//             missingParams: result.error.details[0].message,
//             status: 400,
//             success: false,
//         });
//     }

//     const plan = await prisma.plan.findUnique({
//         where: { id: parseInt(planId) }
//     });

//     if (!plan) {
//         return res.status(404).json({ message: "Plan not found" });
//     }

//     const session = await stripe.checkout.sessions.create({
//         payment_method_types: ['card'],
//         line_items: [{
//             price_data: {
//                 currency: 'usd',
//                 product_data: {
//                     name: plan.plan_name,
//                 },
//                 unit_amount: parseFloat(plan.amount) * 100, // Stripe expects amount in cents
//             },
//             quantity: 1,
//         }],
//         mode: 'payment',
//         success_url: `${baseurl}/user/payment/success?planId=${planId}&userId=${req.user.id}`,
//         cancel_url: `https://your-backend-url/cancel`,
//         metadata: {
//             // req.user.id,
//             // planId
//         }
//     });

//     res.json({ id: session.url });
// };
export async function paymentThroughStripe(req, res) {
    const { planId } = req.body;

    const schema = Joi.object({
        planId: Joi.number().required(),
    });

    const result = schema.validate(req.body);

    if (result.error) {
        const message = result.error.details.map((i) => i.message).join(",");
        return res.status(400).json({
            message: result.error.details[0].message,
            error: message,
            missingParams: result.error.details[0].message,
            success: false,
        });
    }

    const plan = await prisma.plan.findUnique({
        where: { id: parseInt(planId) }
    });

    console.log()

    if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
    }

    const existingSubscription = await prisma.userSubscription.findFirst({
        where: {
            userId: parseInt(req.user.id),
            sub_status: 1
        }
    });

    if(existingSubscription){
        if(existingSubscription.planId===parseInt(planId)){
            return res.status(400).json({
                status: 400,
                message: 'A plan is already running',
                success: false,
            }) 
        }
        if (existingSubscription.planId > parseInt(planId)) {
            return res.status(400).json({
                status: 400,
                message: 'You cannot downgrade a running plan.',
                success: false,
            })
        }
    }

    

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
            price_data: {
                currency: 'usd',
                product_data: {
                    name: plan.plan_name,
                },
                unit_amount: parseFloat(plan.amount) * 100, // Stripe expects amount in cents
            },
            quantity: 1,
        }],
        mode: 'payment',
        success_url: `http://localhost:4003/success`,
        cancel_url: `http://localhost:4003/cancel`,
        metadata: {
            userId: req.user.id,
            planId: planId
        }
    });

    res.json({ url: session.url });
};
export async function stripeSuccessAndPurchasePlan(req, res) {
    const { userId, planId } = req.query;

    if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
    }

    // const session = await stripe.checkout.sessions.retrieve(session_id);

    // if (!session) {
    //     return res.status(404).json({ message: "Session not found" });
    // }


    const plan = await prisma.plan.findUnique({
        where: { id: parseInt(planId) }
    });

    if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
    }

    const existingSubscription = await prisma.userSubscription.findFirst({
        where: { userId: parseInt(userId), sub_status: 1 }
    });

    const startDate = new Date();
    const expiredAt = new Date(startDate);
    expiredAt.setMonth(startDate.getMonth() + plan.plan_days);

    const newSubscription = await prisma.userSubscription.create({
        data: {
            planId: parseInt(planId),
            userId: parseInt(userId),
            start_date: startDate,
            expired_at: expiredAt,
            sub_status: 1,  // Active status
            overlap_status: 0,  // Default value
            refund_status: 0,  // Default value
            overlap_date: expiredAt,  // Assuming overlap date is the same as expiry date
        }
    });

    await prisma.user.update({
        where: { id: parseInt(userId) },
        data: { promotedAssetCount: 0 }
    });

    res.render(path.join(__dirname, '../view/', 'confirmation.ejs'), {
        user: userId,
        plan: plan,
        startDate: startDate,
        expiredAt: expiredAt
    });
    // // Create a URL for the confirmation page
    // const confirmationUrl = `${process.env.FRONTEND_URL}/confirmation?session_id=${session_id}`;

    // res.json({ confirmationUrl });
};

export async function successPage(req, res){
    const filePath = path.join(__dirname, '../view/English_ligth/terms-condition.html');
    res.sendFile(filePath);
};

