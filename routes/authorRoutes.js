import express from 'express';
import {
    signupWithEmail,
    verifyUserEmail,
    login,
    deleteImage,
    forgotPassword,
    verifyForgetPasswordOtp,
    resetPassword,
    editProfile,
    createBook,
    editBook,
    socialLogin,
    myProfile,
    changePassword,
    deleteBook,
    getAllBook,
    getBookById,
    addToCart,
    getdashboard,
    createGroupChat,
    getAllCategories,
    addMemberInTeam,
    removeMemberFromTeam,
    getAllChats,
    activateDeactivateChat,
    createOrGetAOneOnOneChat,
    createOrGetAOneOnOneChatInUser,
    getAllMessages,
    clearChat,
    fileUploadforImage,
    getAllAuthorNotification,
    deleteAllNotification,
    deleteNotification,
    startQASession,
    getSessionById,
    getAllFollwedUser,
    scheduleLiveSession,
    getSessionDashboard,
    editSession,
    editGroupChat,
    deleteGroupChat,
    deleteSession,
    generateLiveStreamToken,
    createSubscriptionSession,
    onboard_author,
    endQASession,
    getPlans,
    getMyPlans,
    getSubscriptionStatus,
    getReview,
    getAuthorEarnings
} from '../controllers/authorController.js';
import { upload } from "../middlewares/upload.js";
import { authorAuth } from "../middlewares/authorAuth.js";

export const authorRouter = express.Router();

authorRouter.post('/signupByEmail', signupWithEmail);

authorRouter.get('/verifyUser/:id', verifyUserEmail);

authorRouter.post('/login', login);

authorRouter.post('/social-login', socialLogin);

authorRouter.post('/forgetPassword', forgotPassword);

authorRouter.post('/verifyForgetPasswordOtp', verifyForgetPasswordOtp);

authorRouter.post('/resetPassword', resetPassword);

authorRouter.post('/changePassword', authorAuth, changePassword);

authorRouter.get('/myProfile', authorAuth, myProfile);

authorRouter.post('/addToCart', authorAuth, addToCart);

authorRouter.get('/getAllCategories', authorAuth, getAllCategories);

authorRouter.get('/getAllBook', authorAuth, getAllBook);

authorRouter.get('/getAllBook/:id', authorAuth, getBookById);

authorRouter.put('/editProfile', authorAuth, upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "avatar_url", maxCount: 1 },
]), editProfile);

authorRouter.post(
    "/create",
    authorAuth,
    upload.fields([
        { name: "coverImage", maxCount: 1 },
        { name: "pdfUrl", maxCount: 1 },
        { name: "audioUrl", maxCount: 1 },
        { name: "bookMedia", maxCount: 10 },
    ]),
    createBook
);

authorRouter.get('/getReview', authorAuth, getReview);

authorRouter.put(
    '/editBook',
    authorAuth,
    upload.fields([
        { name: 'coverImage', maxCount: 1 },
        { name: 'pdfUrl', maxCount: 1 },
        { name: 'audioUrl', maxCount: 1 },
        { name: 'bookMedia', maxCount: 10 },
    ]),
    editBook
);

authorRouter.delete('/deleteBook/:id', authorAuth, deleteBook);

authorRouter.delete('/deleteImages/:id', authorAuth, deleteImage);

authorRouter.get('/getdashboard', authorAuth, getdashboard);

authorRouter.get('/getAllAuthorNotification', authorAuth, getAllAuthorNotification);

authorRouter.delete('/deleteAll', authorAuth, deleteAllNotification);

authorRouter.delete('/delete/:notificationId', authorAuth, deleteNotification);

authorRouter.get('/getAllFollwedUser', authorAuth, getAllFollwedUser);

authorRouter.post('/startQASession/:sessionId', authorAuth, startQASession);

authorRouter.delete('/endQASession/:sessionId', authorAuth, endQASession);

authorRouter.get('/getQASession/:id', authorAuth, getSessionById);

authorRouter.post('/scheduleLiveSession', authorAuth, upload.single("thumbnail"), scheduleLiveSession);

authorRouter.get('/getSessionDashboard', authorAuth, getSessionDashboard);

authorRouter.delete('/deleteSession/:sessionId', authorAuth, deleteSession);

authorRouter.put('/editSession/:sessionId', authorAuth, upload.fields([
    { name: "thumbnail", maxCount: 1 },
]), editSession);

//Subscription

authorRouter.post('/onboard-author', authorAuth, onboard_author);

authorRouter.post('/subscribe',authorAuth, createSubscriptionSession);

authorRouter.get('/allPlans', authorAuth, getPlans);

authorRouter.get('/getMyPlans', authorAuth, getMyPlans);

authorRouter.get('/subscription/status', authorAuth, getSubscriptionStatus);

authorRouter.get('/getAuthorEarnings/status', authorAuth, getAuthorEarnings);
//chat 

authorRouter.post('/createGroupChat', authorAuth, upload.single("profilePic"), createGroupChat);

authorRouter.put('/editGroupChat/:id', authorAuth, upload.single("profilePic"), editGroupChat);

authorRouter.put('/deleteGroupChat/:chatId', authorAuth, deleteGroupChat);

authorRouter.post('/members', authorAuth, addMemberInTeam);

authorRouter.delete('/members/:chatId/:receiverIds', authorAuth, removeMemberFromTeam);

authorRouter.get('/getAllChats', authorAuth, getAllChats);

authorRouter.post('/chatStatus', authorAuth, activateDeactivateChat);

authorRouter.post('/chatOnetoOne/:receiverId', authorAuth, createOrGetAOneOnOneChat);

authorRouter.post('/members/:receiverId', createOrGetAOneOnOneChatInUser);

// message 

authorRouter.get('/getAllMessages/:chatId', authorAuth, getAllMessages);

authorRouter.delete('/:chatId', authorAuth, clearChat);

authorRouter.post('/uploadImages', authorAuth, upload.array("files", 10), fileUploadforImage);

authorRouter.post('/generate-LiveStreamToken', generateLiveStreamToken);

