import express from 'express';
import {
    login,
    forgotPassword,
    verifyForgetPasswordOtp,
    resetPassword,
    getdashboard,
    getAllReader,
    toggleUserStatusByAdmin,
    getAllAuthor,
    getAllEbook,
    toggleAuthorStatusByAdmin,
    getAllChats,
    editProfile,
    getMyProfile,
    changePassword,
    getChatMessagesByChatId,
    deleteBook,
    getAuthorById,
    getAllEbookById,
    addCategory,
    getAllCategory,
    updateCategory,
    getAllCategoryById,
    getAllContact,
    updateContactIssue,
    createBook,
    getAllUploadBook,
    getActiveUser,
    editBook,
    deleteImage,
    addAuthor,
    getAllPurchase,
    getPlans,
    getAdminSalesSummary,
    getAllSubscription,
} from '../controllers/adminController.js';
import { upload } from "../middlewares/upload.js";
import { adminAuth } from "../middlewares/adminAuth.js";

export const adminRoutes = express.Router();

adminRoutes.post('/login', login);

adminRoutes.post('/forgotPassword', forgotPassword);

adminRoutes.post('/verifyForgetPasswordOtp', verifyForgetPasswordOtp);

adminRoutes.post('/resetPassword', resetPassword);

adminRoutes.put('/editProfile', adminAuth, upload.fields([
    { name: "avatar_url", maxCount: 1 },
]), editProfile);

adminRoutes.post('/changePassword', adminAuth, changePassword);

adminRoutes.get('/getMyProfile', adminAuth, getMyProfile);

adminRoutes.get('/getdashboard', adminAuth, getdashboard);

adminRoutes.get('/getAllReader', adminAuth, getAllReader);

adminRoutes.get('/getAllAuthor', adminAuth, getAllAuthor);

adminRoutes.get('/toggleUserStatusByAdmin/:id', adminAuth, toggleUserStatusByAdmin);

adminRoutes.get('/toggleAuthorStatusByAdmin/:id', adminAuth, toggleAuthorStatusByAdmin);

adminRoutes.get('/getAllAuthor', adminAuth, getAllAuthor);

adminRoutes.get('/getAllAuthor/:id', adminAuth, getAuthorById);

adminRoutes.get('/getAllEbook', adminAuth, getAllEbook);

adminRoutes.get('/getAllEbook/:id', adminAuth, getAllEbookById);

adminRoutes.get('/getAllChats', adminAuth, getAllChats);

adminRoutes.get('/getAllChats/:chatId', adminAuth, getChatMessagesByChatId);

adminRoutes.delete('/deleteBook/:bookId', adminAuth, deleteBook);

adminRoutes.post('/addCategory', adminAuth, addCategory);

adminRoutes.get('/getAllCategory', adminAuth, getAllCategory);

adminRoutes.get('/getAllCategory/:id', adminAuth, getAllCategoryById);

adminRoutes.put('/updateCategory/:id', adminAuth, updateCategory);

adminRoutes.get('/getAllContact', adminAuth, getAllContact);

adminRoutes.put('/UpdateContactIssue/:id', adminAuth, updateContactIssue);

adminRoutes.post(
    "/createBook",
    adminAuth,
    upload.fields([
        { name: "coverImage", maxCount: 1 },
        { name: "pdfUrl", maxCount: 1 },
        { name: "audioUrl", maxCount: 1 },
        { name: "bookMedia", maxCount: 10 },
    ]),
    createBook
);

adminRoutes.put(
    '/editBook',
    adminAuth,
    upload.fields([
        { name: 'coverImage', maxCount: 1 },
        { name: 'pdfUrl', maxCount: 1 },
        { name: 'audioUrl', maxCount: 1 },
        { name: 'bookMedia', maxCount: 10 },
    ]),
    editBook
);

adminRoutes.get('/getAllUploadBook', adminAuth, getAllUploadBook);

adminRoutes.get('/getActiveUser', adminAuth, getActiveUser);

adminRoutes.delete('/deleteImages/:id', adminAuth, deleteImage);

adminRoutes.post('/addAuthor', adminAuth, upload.fields([
    { name: 'avatar_url', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
]), addAuthor);

adminRoutes.get('/getAllPurchase', adminAuth, getAllPurchase);

adminRoutes.get('/allPlans', adminAuth, getPlans);

adminRoutes.get('/getAdminSalesSummary', adminAuth, getAdminSalesSummary);

adminRoutes.get('/getAllSubscription', adminAuth,getAllSubscription);

// adminRoutes.post('/overrideBookPrice/:bookId', adminAuth, overrideBookPrice);