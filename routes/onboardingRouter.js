import express from "express";
import { checkStatus, createStripeAccountLink, resumeStripeOnboarding } from "../controllers/onboardingController.js";
import { authorAuth } from "../middlewares/authorAuth.js";

export const onboardingRouter = express.Router();

onboardingRouter.post('/createOnboardingLink',authorAuth,createStripeAccountLink);

onboardingRouter.get('/checkStatus',authorAuth,checkStatus);

onboardingRouter.post('/resumeOnboarding',authorAuth,resumeStripeOnboarding);