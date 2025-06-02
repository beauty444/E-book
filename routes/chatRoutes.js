import express from "express";
import { auth } from "../middlewares/auth.js";
import { upload } from "../middlewares/upload.js";
import {createOrGetAOneOnOneChatInUser, getAllGroupChats, activateDeactivateChat, createOrGetAOneOnOneChat, getAllChats, getAllMessages, clearChat, fileUploadforImage, leaveGroupChat} from "../controllers/chatController.js";
export const chatRouter = express.Router();


chatRouter.get('/getAllChats',auth, getAllChats);

chatRouter.post('/chatStatus', auth,  activateDeactivateChat);

chatRouter.post('/chatOnetoOne/:receiverId',auth, createOrGetAOneOnOneChat);

chatRouter.post('/members/:receiverId',  createOrGetAOneOnOneChatInUser);

chatRouter.get('/getAllGroupChats',auth, getAllGroupChats);

chatRouter.post('/leaveGroup',auth,  leaveGroupChat);


// message 
chatRouter.get('/getAllMessages/:chatId', auth, getAllMessages);

chatRouter.delete('/:chatId', auth, clearChat);

chatRouter.post('/uploadImages', auth, upload.array("files", 10), fileUploadforImage);





