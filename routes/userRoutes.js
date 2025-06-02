import express from 'express';
import {
    signupWithEmail,
    verifyUserEmail,
    login,
    socialLogin,
    forgotPassword,
    verifyForgetPasswordOtp,
    resetPassword,
    myProfile,
    editProfile,
    createReview,
    getReviewsBook,
    changePassword,
    recordBookRead,
    follow,
    unFollow,
    getAllBooks,
    favOrUnFavBook,
    getAllfavBook,
    followedAuthor,
    getAllCart,
    updateCart,
    deleteCart,
    addQuantity,
    removeQuantity,
    getAllAuthor,
    getTopAuthor,
    getAllAnonymousBook,
    getAnonymousTopAuthor,
    getAllNewBook,
    getAllCategories,
    getBookById,
    addToCart,
    getAllAnonymousCategories,
    getAllAnonymousAuthor,
    getAllAnonymousNewBook,
    getAllAnonymousBookById,
    getAllAnonymousAuthorById,
    getAllAuthorById,
    getAllUserNotification,
    deleteAllNotification,
    deleteNotification,
    getQASession,
    getAllFollwedUser,
    ContactIssue,
    purchaseBook,
    updateContactIssue,
    anonymousContactIssue
} from '../controllers/userController.js';

import { auth } from "../middlewares/auth.js";
import { upload } from "../middlewares/upload.js";

export const userRouter = express.Router();

userRouter.post('/signupByEmail', signupWithEmail);

userRouter.get('/verifyUser/:id', verifyUserEmail);

userRouter.post('/login', login);

userRouter.post('/forgetPassword', forgotPassword);

userRouter.post('/verifyForgetPasswordOtp', verifyForgetPasswordOtp);

userRouter.post('/resetPassword', resetPassword);

userRouter.post('/changePassword',auth, changePassword);

userRouter.post('/social-login', socialLogin);

userRouter.get('/myProfile', auth, myProfile);

userRouter.put('/editProfile', auth, upload.fields([
    { name: "avatar_url", maxCount: 1 },
]), editProfile);

userRouter.post('/follow/:id',auth, follow);

userRouter.post('/unfollow/:id',auth, unFollow);

userRouter.get('/getAllBooks',auth,  getAllBooks);

userRouter.get('/getAllAuthor',auth,  getAllAuthor);

userRouter.post('/favBook',auth, favOrUnFavBook);

userRouter.get('/getAllfavBook',auth, getAllfavBook);

userRouter.get('/followedAuthor',auth, followedAuthor);

userRouter.post('/addToCart', auth,  addToCart);

userRouter.get('/getAllCart', auth,  getAllCart);

userRouter.put('/updateCart', auth,  updateCart);

userRouter.delete('/deleteCart/:id', auth,  deleteCart);

userRouter.post('/addQuantity', auth,  addQuantity);

userRouter.post('/removeQuantity', auth, removeQuantity);

userRouter.post('/createReview', auth, createReview);

userRouter.get('/getReviewsBook/:bookId', auth, getReviewsBook);

userRouter.get('/getTopAuthor',auth, getTopAuthor);

userRouter.get('/getAllCategories',auth, getAllCategories);

userRouter.get('/getAllNewBook', auth, getAllNewBook);

userRouter.get('/getAllBook/:id',auth,  getBookById);

userRouter.get('/getAllAuthor/:id', auth, getAllAuthorById);

userRouter.post('/recordBookRead', auth,  recordBookRead); 

userRouter.get('/getAllUserNotification', auth,  getAllUserNotification); 

userRouter.delete('/deleteAll',auth, deleteAllNotification);

userRouter.delete('/delete/:notificationId', auth, deleteNotification);

userRouter.get('/getQASession', auth, getQASession);

userRouter.get('/getAllFollwedUser', auth, getAllFollwedUser);

userRouter.post('/ContactIssue',auth, ContactIssue);

userRouter.put('/UpdateContactIssue/:id',auth, updateContactIssue);

userRouter.post('/purchaseBook',auth, purchaseBook);


// Anynomous User

userRouter.get('/getAllAnonymousBook', getAllAnonymousBook);

userRouter.post('/AnonymousContactIssue',auth, anonymousContactIssue);

userRouter.get('/getAnonymousTopAuthor', getAnonymousTopAuthor);

userRouter.get('/getAllAnonymousCategories', getAllAnonymousCategories); 

userRouter.get('/getAllAnonymousAuthor', getAllAnonymousAuthor);

userRouter.get('/getAllAnonymousNewBook', getAllAnonymousNewBook);

userRouter.get('/getAllAnonymousBook/:id', getAllAnonymousBookById);

userRouter.get('/getAllAnonymousAuthor/:id', getAllAnonymousAuthorById);

 
