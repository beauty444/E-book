import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import nodemailer from 'nodemailer';
import base64url from 'base64url'
import hbs from 'nodemailer-express-handlebars';
import { PrismaClient } from '@prisma/client';
const baseurl = process.env.BASE_URL;
import Joi from 'joi';
import { emitSocketEvent } from '../utils/socket.js'; // Assuming you have this utility function
import { ChatEventEnum } from '../utils/constants.js';
import { createNotificationForAuthor, sendNotificationRelateToMessageToAuthor, sendNotificationRelateToMessageToUser, createNotificationForUser } from "../utils/notification.js";

import dotenv from "dotenv";
dotenv.config();
import { createErrorResponse, createSuccessResponse } from '../utils/responseUtil.js';
import { MessageEnum } from '../config/message.js';

import jwt from 'jsonwebtoken';
import fs from 'fs';

// To properly handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read private key
// const privateKey = fs.readFileSync(path.join(__dirname, '../keys/private-key.pem'), 'utf8');


// const privateKey = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCFFOygzUxLjlOPPV2+r7mZSg7dGd+ITwrJToYiFluTtpgtLsJFvBoDcd+5yM0Ozt++G6C65sPc0pZqUHWSGvXCxHTXl05J/D/IrnSlgTSo0Lz3OG3wtjHGBWd9+Uu6honNr/yAZTfhl0gO4ri5hIYckAEiHuv38UVh+FDD5b+2iMFE4b+CmToOuM2ajxReSJrg5wVJo7eVYSNqfb0+2pAKOakqSgfeObs6mbPJobSf08JUq5eyz52cUI47gNbNVNuZMUmHLSo0Zcgan8CJTlG7Cxxjaunbb2i4B6ewcJq3AgdEkQx/0NidvDerDgMR6aXQzrIPdroNZ97yfXhAzVu5AgMBAAECggEAdxe6ikwuMo8zh8PK2JI47Uyw8Hvu5fSWGoAC2Q5Y9V8533UwtWcXgG2vYHqpxs6qu13OAHPyYvKxWIKYNB+cPqfASA5HKT5rdhNon5N4pHnoIPSGrhrdf+/mJX2qn0k2mLMcq2npECBpg6iw1pQZ0AWuffJeCIwJIxssa6J2ZcnAlCOUpNCr3Ek9qLAvDJ+5Z/qFsShcLS9eSIAt+EOhXX4H/DTIfeL5g+wsPNKB6CQeLqFrRAWNV+A6VxCH8lgI8E4Qp+0c8vsm+N7TH2Yh3anKiO0FseaC1K3UbMGi31QEhoJfFdXskRoDd5RvWf4c06r+dN1UPmntaUME3iUm4QKBgQDHYG4j6cQbXuLmsBrGIwYbMZhN3hTVcQvnv7dlH0VbjOVBU+ph9+qQ2njP1Vmmv4M60lfFEwK5KCgodyRQV0SA1vAuaz/eXROOleXhvMTG+wMXgutKkve2UxE0aPDTx31UbEd2zMXrl173iC9nmZJGWJQl54bd4nO7hFzBal2zvwKBgQCq4I6q4+wy/SBpydA3ejnqwF3G+n66GWMvnsTZblImsPHEXb0KARPxh7zyuJu6gpjtHWjoAa2ZEn8hL9VRi2Z0ExBjVTSv0TWvtK5dN8WQdeE4ypsBcs6yhSf/TEqqQw1k9jgHyGRYlVVxgaS22rj65EXIUvofKc8tFtNN5bjuhwKBgFWFt7kP/V8ARLRPtixnuabQj1RXfvhPlZvDURe/YjDzLyPmqxN7FNMt48TC78HnRJNmxt9yWCi0YQV6lckgpfHeQQioWK05n7n58rHyFzaDVcAwGF3UzQ0YdLjWivdNCyW7jKwZCo0UUVg8wpjd9zDVrjbUKbXj/WDiVidhSPBhAoGBAJ7Dc2rNx9h8HRCNRNs2wfcd8kN83B/WlLRbBLSsbsGqJ4d2PLy90aTYpDK0WWSKEMJGUAE4Be4yJFJWWhGgvnlceR6BvSkZ7ZKqAlN0DSiyjaaxgCFxZSCy3T2zya+2CwziQ57fjnRLk46ZkMugHrxlOXzts50ewHI5QeyfYxqjAoGADMbxO4BzaXOl1rajcWJpQ6YUXkYi0IJ5MDPlzh5bFJlKvdQGKXOAZTjh5GtpJSV5uRmx13zh/l7wg4+GYSzxEWEBlvM/C8bkwtRtQz8emdnx3YJ8O/LCPGXE9Y5LpxramewYAO+gIrjXviTyeYNNh/pErf6OjZ0PbmARloYB7dc=';
//let privateKey = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');
// const privateKey = fs.readFileSync(
//     path.join(__dirname, 'keys', 'private-key.pem'),
//     'utf8'
//   );
const appID = 'vpaas-magic-cookie-bc7b47129b824e7a83eaaf028fa5d597';



const prisma = new PrismaClient();

var transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    auth: {
        user: "kpatel74155@gmail.com",
        pass: "mitbpoatzprnwfac",
    },
});

const handlebarOptions = {
    viewEngine: {
        partialsDir: path.resolve(__dirname, "../view/"),
        defaultLayout: false,
    },
    viewPath: path.resolve(__dirname, "../view/"),
};

transporter.use("compile", hbs(handlebarOptions));


export async function generateOTP(length = 4) {
    const chars = "0123456789";
    let OTP = "";

    for (let i = 0; i < length; i++) {
        const randomIndex = crypto.randomInt(0, chars.length);
        OTP += chars.charAt(randomIndex);
    }

    return OTP;
}


export async function getFollowedAuthors(userId) {
    try {
        const followedAuthors = await prisma.follow.count({
            where: { followerId: userId }, // Assuming status 1 means "following"
            select: {
                following: { // Fetch author details
                    select: {
                        id: true,
                        name: true, // Assuming `name` exists in the Author model
                        bio: true,  // Assuming `bio` exists in the Author model
                        profilePicture: true, // Assuming `profilePicture` exists in the Author model
                    },
                },
            },
        });

        return followedAuthors.map(follow => follow.following);
    } catch (error) {
        console.error("Error fetching followed authors:", error);
        throw new Error("Could not retrieve followed authors");
    }
}

export function randomStringAsBase64Url(size) {
    return base64url(crypto.randomBytes(size));
}

export async function getAuthorStats(authorId) {
    // Count the number of books published by the author
    const publishedCount = await prisma.book.count({
        where: { authorId }
    });

    // Count the number of followers for the author
    const followersCount = await prisma.follow.count({
        where: { followingId: authorId }
    });

    return { publishedCount, followersCount };
}



// export async function sendMessagesByAuthor(req, res) {
//     try {
//         console.log('req.params', req.params);
//         console.log('req.body', req.body);

//         const { chatId } = req.params;
//         const { content, isLink, fileName } = req.body;

//         const chat = await prisma.chat.findUnique({
//             where: { id: parseInt(chatId) },
//             include: { participants: true }
//         });
//         console.log('chat', chat);

//         const message = await prisma.chatMessage.create({
//             data: {
//                 content: content || '',
//                 senderAuthorId: req.user.id,
//                 chatId: parseInt(chatId),
//                 isLink: isLink ? parseInt(isLink) : 0,
//                 fileName: fileName || null
//             }
//         });
//         console.log('message', message);

//         const updateChat = await prisma.chat.update({
//             where: { id: parseInt(chatId) },
//             data: { lastMessageId: message.id },
//             include: { participants: true }
//         });

//         const socketMessage = await prisma.chatMessage.findUnique({
//             where: { id: message.id },
//             include: { senderAuthor: true, chat: true }
//         });
//         console.log("updateChat", updateChat);

//         await Promise.all(updateChat.participants.map(async (participant) => {
//             if (participant.authorId === req.user.id) return;
//             const recipientId = participant.userId || participant.authorId;
//             const roomName = participant.userId ? `user_${participant.userId}` : `author_${participant.authorId}`;

//             emitSocketEvent(req, roomName, ChatEventEnum.MESSAGE_RECEIVED_EVENT, socketMessage);

//             const recipient = await prisma.user.findUnique({
//                 where: { id: recipientId },
//                 select: { fcm_token: true }
//             });

//             await sendMessageNotification({
//                 token: recipient.fcm_token,
//                 senderId: req.user.id,
//                 receiverId: recipientId,
//                 senderName: req.user.fullName,
//                 isAuthor: true
//             });

//             await prisma.userNotification.create({
//                 data: {
//                     senderId: req.user.id,
//                     receiverId: recipientId,
//                     messageId: message.id,
//                     createdAt: new Date(),
//                     isRead: false
//                 }
//             });
//         }));

//         return res.status(200).json({
//             status: 200,
//             message: 'Message sent successfully',
//             success: true,
//             message: socketMessage
//         });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({
//             status: 500,
//             message: 'Internal Server Error',
//             success: false,
//             error: error.message
//         });
//     }
// }


export async function sendMessagesByAuthor(req, res) {
    try {
        console.log('req.params', req.params)
        console.log('req.body', req.body)
        const { chatId } = req.params;
        const { content, isLink, fileNames } = req.body;
        console.log("??????????????????????", req.user)
        const uploadedFiles = fileNames ? fileNames.split(",") : [];
        // const uploadedFiles = fileNames || [];

        const chat = await prisma.chat.findUnique({
            where: {
                id: parseInt(chatId)
            },
            include: {
                participants: true
            }
        })
        console.log('chat', chat)
        const message = await prisma.chatMessage.create({
            data: {
                content: content || '',
                senderAuthorId: req.user.id,
                chatId: parseInt(chatId),
                isLink: isLink ? parseInt(isLink) : 0,
                // fileNames: uploadedFiles.length > 0 ? uploadedFiles.join(",") : null,
                // fileName: fileName || null
            }
        });
        console.log('message', message)

        if (uploadedFiles.length > 0) {
            await prisma.chatMessageFiles.createMany({
                data: uploadedFiles.map(file => ({
                    messageId: message.id,
                    fileName: file
                }))
            });
        }
        const updateChat = await prisma.chat.update({
            where: {
                id: parseInt(chatId)
            },
            data: {
                lastMessageId: message.id
            }, include: {
                participants: true
            }
        })
        const socketMessage = await prisma.chatMessage.findUnique({
            where: {
                id: message.id
            },
            include: {
                senderAuthor: true,
                chat: true,
                ChatMessageFiles: true
            }
        })

        if (socketMessage && socketMessage.ChatMessageFiles && socketMessage.ChatMessageFiles.length > 0) {
            socketMessage.ChatMessageFiles = socketMessage.ChatMessageFiles.map(file => ({
                ...file,
                fileName: file.fileName ? `${baseurl}/books/${file.fileName}` : null
            }));
        }
        const author = await prisma.author.findUnique({
            where: {
                id: req.user.id
            }
        })


        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id
            }
        })

        console.log('user', user)

        await Promise.all(updateChat.participants.map(async (participant) => {
            if (participant.authorId === req.user.id) return;

            if (participant.authorId) {
                console.log("for author");
                const roomName = `author_${participant.authorId}`
                emitSocketEvent(
                    req,
                    roomName,
                    ChatEventEnum.MESSAGE_RECEIVED_EVENT,
                    socketMessage
                );
                const unreadCount = await prisma.authorUnreadCount.findFirst({
                    where: {
                        authorId: participant.authorId,
                        chatId: parseInt(chatId)
                    }
                });

                console.log('unreadCount', unreadCount)

                if (unreadCount) {
                    // If UnreadCount exists, update the unreadCount by 1
                    await prisma.authorUnreadCount.update({
                        where: {
                            id: unreadCount.id
                        },
                        data: {
                            unreadCount: unreadCount.unreadCount + 1
                        }
                    });
                } else {
                    // If UnreadCount does not exist, create a new one
                    await prisma.authorUnreadCount.create({
                        data: {
                            authorId: participant.authorId,
                            chatId: parseInt(chatId),
                            unreadCount: 1
                        }
                    });
                }
            }

            if (participant.userId) {
                console.log("for user>>>>>>>>>>>>>")
                const roomName = `user_${participant.userId}`
                emitSocketEvent(
                    req,
                    roomName,
                    ChatEventEnum.MESSAGE_RECEIVED_EVENT,
                    socketMessage
                );
                await sendNotificationRelateToMessageToUser({
                    token: user.fcm_token,
                    body: `${req.user.full_name} sent you a message`,
                });


                // ✅ Create notification inside the loop where `participant` is defined
                await createNotificationForUser({
                    toUserId: participant.userId,
                    byAuthorId: req.user.id,
                    data: {
                        userId: req.user.id
                    },
                    type: "chat",
                    content: `${req.user.fullName} sent you a message`
                });

                const unreadCount = await prisma.userUnreadCount.findFirst({
                    where: {
                        userId: participant.userId,
                        chatId: parseInt(chatId)
                    }
                });

                if (unreadCount) {
                    // If UnreadCount exists, update the unreadCount by 1
                    await prisma.userUnreadCount.update({
                        where: {
                            id: unreadCount.id
                        },
                        data: {
                            unreadCount: unreadCount.unreadCount + 1
                        }
                    });
                } else {
                    // If UnreadCount does not exist, create a new one
                    await prisma.userUnreadCount.create({
                        data: {
                            userId: participant.userId,
                            chatId: parseInt(chatId),
                            unreadCount: 1
                        }
                    });
                }
            }
        }));

        // Send push notification outside the loop (no need for `participant` here)


    } catch (error) {
        console.log(error);

    }
}

// export async function sendMessagesByAuthor(req, res) {
//     try {
//         const { chatId } = req.params;
//         const { content, isLink, fileNames } = req.body;
//         const uploadedFiles = fileNames ? fileNames.split(",") : [];
//         const parsedChatId = parseInt(chatId);

//         const chat = await prisma.chat.findUnique({
//             where: { id: parsedChatId },
//             include: { participants: true }
//         });

//         if (!chat) {
//             return res.status(404).json({ error: "Chat not found" });
//         }

//         const message = await prisma.chatMessage.create({
//             data: {
//                 content: content || '',
//                 senderAuthorId: req.user.id,
//                 chatId: parsedChatId,
//                 isLink: isLink ? parseInt(isLink) : 0
//             }
//         });

//         if (uploadedFiles.length > 0) {
//             await prisma.chatMessageFiles.createMany({
//                 data: uploadedFiles.map(file => ({
//                     messageId: message.id,
//                     fileName: file
//                 }))
//             });
//         }

//         const updateChat = await prisma.chat.update({
//             where: { id: parsedChatId },
//             data: { lastMessageId: message.id },
//             include: { participants: true }
//         });

//         const socketMessage = await prisma.chatMessage.findUnique({
//             where: { id: message.id },
//             include: {
//                 senderAuthor: true,
//                 chat: true,
//             }
//         });

//         const author = await prisma.author.findUnique({
//             where: { id: req.user.id }
//         });

//         await Promise.all(updateChat.participants.map(async (participant) => {
//             if (participant.authorId === req.user.id) return;

//             if (participant.authorId) {
//                 const roomName = `author_${participant.authorId}`;
//                 emitSocketEvent(
//                     req,
//                     roomName,
//                     ChatEventEnum.MESSAGE_RECEIVED_EVENT,
//                     socketMessage
//                 );
//             }

//             const existingUnread = await prisma.authorUnreadCount.findFirst({
//                 where: {
//                     authorId: participant.authorId,
//                     chatId: parsedChatId
//                 }
//             });

//             if (existingUnread) {
//                 await prisma.authorUnreadCount.update({
//                     where: { id: existingUnread.id },
//                     data: { unreadCount: existingUnread.unreadCount + 1 }
//                 });
//             } else {
//                 await prisma.authorUnreadCount.create({
//                     data: {
//                         authorId: participant.authorId,
//                         chatId: parsedChatId,
//                         unreadCount: 1
//                     }
//                 });
//             }

//             if (participant.userId) {
//                 const roomName = `user_${participant.userId}`;
//                 emitSocketEvent(
//                     req,
//                     roomName,
//                     ChatEventEnum.MESSAGE_RECEIVED_EVENT,
//                     socketMessage
//                 );
//             }

//             await createNotificationForUser({
//                 toUserId: participant.userId,
//                 byAuthorId: req.user.id,
//                 data: { userId: req.user.id },
//                 type: "chat",
//                 content: `${req.user.fullName} sent you a message`
//             });
//         }));

//         await sendNotificationRelateToMessageToUser({
//             token: author.fcm_token,
//             body: `${req.user.fullName} sent you a message`,
//         });

//     } catch (error) {
//         console.error("Error in sendMessagesByAuthor:", error);

//     }
// }




// export async function sendMessagesByUser(req, res) {
//     try {
//         console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>here')
//         console.log('req.params', req.params)
//         console.log('req.body', req.body)
//         const { chatId } = req.params;
//         const { content, isLink, fileName } = req.body;
//         // const userId = req.user.id;
//         const chat = await prisma.chat.findUnique({
//             where: {
//                 id: parseInt(chatId)
//             },
//             include: {
//                 participants: true
//             }
//         })
//         console.log('chat', chat)
//         const message = await prisma.chatMessage.create({
//             data: {
//                 content: content || '',
//                 senderUserId: req.user.id,
//                 chatId: parseInt(chatId),
//                 isLink: isLink ? parseInt(isLink) : 0,
//                 fileName: fileName || null
//             }
//         });
//         console.log('message', message)
//         const updateChat = await prisma.chat.update({
//             where: {
//                 id: parseInt(chatId)
//             },
//             data: {
//                 lastMessageId: message.id
//             }, include: {
//                 participants: true
//             }
//         })
//         const socketMessage = await prisma.chatMessage.findUnique({
//             where: {
//                 id: message.id
//             },
//             include: {
//                 senderUser: true,
//                 chat: true,
//             }
//         })

//         const user = await prisma.user.findUnique({
//             where: {
//                 id: req.user.id
//             }
//         })

//         console.log('user', user)

//         socketMessage.fileName = socketMessage.fileName ? baseurl + "/books/" + socketMessage.fileName : null

//         console.log("updateChat", updateChat)

//         await Promise.all(updateChat.participants.map(async (participant) => {
//             if (participant.userId === req.user.id) return;

//             if (participant.authorId) {
//                 console.log("for author");
//                 const roomName = `author_${participant.authorId}`
//                 emitSocketEvent(
//                     req,
//                     roomName,
//                     ChatEventEnum.MESSAGE_RECEIVED_EVENT,
//                     socketMessage
//                 );
//                 await createNotificationForUser({
//                     toAuthorId: participant.authorId,
//                     byUserId: req.user.id,
//                     data: {
//                         userId: req.user.id
//                     },
//                     type: "chat",
//                     content: `${req.user.full_name} send you a message`
//                 })
//                 await sendNotificationRelateToMessageToAuthor({
//                     token: user.fcm_token,
//                     body: `${req.user.full_name} send you a message`,
//                 })

//             }
//             if (participant.userId) {
//                 console.log("for user")
//                 const roomName = `user_${participant.userId}`
//                 emitSocketEvent(
//                     req,
//                     roomName,
//                     ChatEventEnum.MESSAGE_RECEIVED_EVENT,
//                     socketMessage
//                 );
//             }

//         }))

//     } catch (error) {
//         console.log(error);

//     }
// }


// export async function sendMessagesByUser(req, res) {
//     try {
//         console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>here')
//         console.log('req.params', req.params)
//         console.log('req.body', req.body)
//         const { chatId } = req.params;
//         const { content, isLink, fileNames } = req.body;
//         const uploadedFiles = fileNames ? fileNames.split(",") : [];
//         // const uploadedFiles = fileNames || [];

//         // const userId = req.user.id;
//         const chat = await prisma.chat.findUnique({
//             where: {
//                 id: parseInt(chatId)
//             },
//             include: {
//                 participants: true
//             }
//         })
//         console.log('chat', chat)
//         const message = await prisma.chatMessage.create({
//             data: {
//                 content: content || '',
//                 senderUserId: req.user.id,
//                 chatId: parseInt(chatId),
//                 isLink: isLink ? parseInt(isLink) : 0,
//                 // fileNames: uploadedFiles.length > 0 ? uploadedFiles.join(",") : null, // Convert array to comma-separated string
//                 // fileName: fileName || null
//             }
//         });
//         console.log('message', message)
//         if (uploadedFiles.length > 0) {
//             await prisma.chatMessageFiles.createMany({
//                 data: uploadedFiles.map(file => ({
//                     messageId: message.id,
//                     fileName: file
//                 }))
//             });
//         }
//         const updateChat = await prisma.chat.update({
//             where: {
//                 id: parseInt(chatId)
//             },
//             data: {
//                 lastMessageId: message.id
//             }, include: {
//                 participants: true
//             }
//         })
//         const socketMessage = await prisma.chatMessage.findUnique({
//             where: {
//                 id: message.id
//             },
//             include: {
//                 senderUser: true,
//                 chat: true,
//             }
//         })

//         const user = await prisma.user.findUnique({
//             where: {
//                 id: req.user.id
//             }
//         })

//         console.log('user', user)

//         socketMessage.fileName = socketMessage.fileName ? baseurl + "/books/" + socketMessage.fileName : null

//         console.log("updateChat", updateChat)

//         // ✅ Handle unread count + socket notifications
//         await Promise.all(updateChat.participants.map(async (participant) => {
//             if (participant.userId === req.user.id) return; // Skip sender

//             console.log('participant.userId', participant.userId)

//             console.log('req.user.id', req.user.id)

//             if (participant.authorId) {
//                 console.log("for author");
//                 const roomName = `author_${participant.authorId}`
//                 emitSocketEvent(
//                     req,
//                     roomName,
//                     ChatEventEnum.MESSAGE_RECEIVED_EVENT,
//                     socketMessage
//                 );
//                 await createNotificationForAuthor({
//                     toAuthorId: participant.authorId,
//                     byUserId: req.user.id,
//                     data: {
//                         userId: req.user.id
//                     },
//                     type: "chat",
//                     content: `${req.user.fullName} send you a message`
//                 })
//                 await sendNotificationRelateToMessageToAuthor({
//                     token: user.fcm_token,
//                     body: `${req.user.fullName} send you a message`,
//                 })

//             }
//             if (participant.userId) {
//                 console.log("for user")
//                 const roomName = `user_${participant.userId}`
//                 emitSocketEvent(
//                     req,
//                     roomName,
//                     ChatEventEnum.MESSAGE_RECEIVED_EVENT,
//                     socketMessage
//                 );
//             }
//         }))
//     } catch (error) {
//         console.log(error);

//     }
// }

export async function sendMessagesByUser(req, res) {
    try {
        console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>here')
        console.log('req.params', req.params)
        console.log('req.body', req.body)
        const { chatId } = req.params;
        const { content, isLink, fileNames } = req.body;
        const uploadedFiles = fileNames ? fileNames.split(",") : [];
        // const uploadedFiles = fileNames || [];

        // const userId = req.user.id;
        const chat = await prisma.chat.findUnique({
            where: {
                id: parseInt(chatId)
            },
            include: {
                participants: true
            }
        })
        console.log('chat', chat)
        const message = await prisma.chatMessage.create({
            data: {
                content: content || '',
                senderUserId: req.user.id,
                chatId: parseInt(chatId),
                isLink: isLink ? parseInt(isLink) : 0,
                // fileNames: uploadedFiles.length > 0 ? uploadedFiles.join(",") : null, // Convert array to comma-separated string
                // fileName: fileName || null
            }
        });
        console.log('message', message)
        if (uploadedFiles.length > 0) {
            await prisma.chatMessageFiles.createMany({
                data: uploadedFiles.map(file => ({
                    messageId: message.id,
                    fileName: file
                }))
            });
        }
        const updateChat = await prisma.chat.update({
            where: {
                id: parseInt(chatId)
            },
            data: {
                lastMessageId: message.id
            }, include: {
                participants: true
            }
        })
        const socketMessage = await prisma.chatMessage.findUnique({
            where: {
                id: message.id
            },
            include: {
                senderUser: true,
                chat: true,
                ChatMessageFiles: true
            }
        })

        if (socketMessage && socketMessage.ChatMessageFiles && socketMessage.ChatMessageFiles.length > 0) {
            socketMessage.ChatMessageFiles = socketMessage.ChatMessageFiles.map(file => ({
                ...file,
                fileName: file.fileName ? `${baseurl}/books/${file.fileName}` : null
            }));
        }

        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id
            }
        })

        console.log('user', user)

        const author = await prisma.author.findUnique({
            where: {
                id: req.user.id
            }
        })

        console.log('author', author)

        socketMessage.fileName = socketMessage.fileName ? baseurl + "/books/" + socketMessage.fileName : null

        console.log("updateChat", updateChat)

        // ✅ Handle unread count + socket notifications
        await Promise.all(updateChat.participants.map(async (participant) => {
            if (participant.userId === req.user.id) return; // Skip sender

            console.log('participant.userId', participant.userId)

            console.log('req.user.id', req.user.id)

            if (participant.authorId) {
                console.log("for author");

                const roomName = `author_${participant.authorId}`
                emitSocketEvent(
                    req,
                    roomName,
                    ChatEventEnum.MESSAGE_RECEIVED_EVENT,
                    socketMessage
                );
                await createNotificationForAuthor({
                    toAuthorId: participant.authorId,
                    byUserId: req.user.id,
                    data: {
                        userId: req.user.id
                    },
                    type: "chat",
                    content: `${req.user.fullName} send you a message`
                })
                await sendNotificationRelateToMessageToAuthor({
                    token: author.fcm_token,
                    body: `${req.user.fullName} send you a message`,
                })

                const unreadCount = await prisma.authorUnreadCount.findFirst({
                    where: {
                        authorId: participant.authorId,
                        chatId: parseInt(chatId)
                    }
                });

                console.log('unreadCount', unreadCount)

                if (unreadCount) {
                    // If UnreadCount exists, update the unreadCount by 1
                    await prisma.authorUnreadCount.update({
                        where: {
                            id: unreadCount.id
                        },
                        data: {
                            unreadCount: unreadCount.unreadCount + 1
                        }
                    });
                } else {
                    // If UnreadCount does not exist, create a new one
                    await prisma.authorUnreadCount.create({
                        data: {
                            authorId: participant.authorId,
                            chatId: parseInt(chatId),
                            unreadCount: 1
                        }
                    });
                }

            }
            if (participant.userId) {
                console.log("for user")
                const roomName = `user_${participant.userId}`
                emitSocketEvent(
                    req,
                    roomName,
                    ChatEventEnum.MESSAGE_RECEIVED_EVENT,
                    socketMessage
                );
                const unreadCount = await prisma.userUnreadCount.findFirst({
                    where: {
                        userId: participant.userId,
                        chatId: parseInt(chatId)
                    }
                });

                console.log('unreadCount', unreadCount)

                if (unreadCount) {
                    // If UnreadCount exists, update the unreadCount by 1
                    await prisma.userUnreadCount.update({
                        where: {
                            id: unreadCount.id
                        },
                        data: {
                            unreadCount: unreadCount.unreadCount + 1
                        }
                    });
                } else {
                    // If UnreadCount does not exist, create a new one
                    await prisma.userUnreadCount.create({
                        data: {
                            userId: participant.userId,
                            chatId: parseInt(chatId),
                            unreadCount: 1
                        }
                    });
                }
            }

        }))
    } catch (error) {
        console.log(error);

    }
}


// export async function sendMessagesByUser(req, res) {
//     try {
//         console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>here');
//         console.log('req.params', req.params);
//         console.log('req.body', req.body);

//         const { chatId } = req.params;
//         const { content, isLink, fileNames } = req.body;
//         const uploadedFiles = fileNames ? fileNames.split(",") : [];

//         const chat = await prisma.chat.findUnique({
//             where: { id: parseInt(chatId) },
//             include: { participants: true }
//         });

//         if (!chat) {
//             return res.status(404).json({ message: "Chat not found" });
//         }

//         const message = await prisma.chatMessage.create({
//             data: {
//                 content: content || '',
//                 senderUserId: req.user.id,
//                 chatId: parseInt(chatId),
//                 isLink: isLink ? parseInt(isLink) : 0,
//             }
//         });

//         if (uploadedFiles.length > 0) {
//             await prisma.chatMessageFiles.createMany({
//                 data: uploadedFiles.map(file => ({
//                     messageId: message.id,
//                     fileName: file
//                 }))
//             });
//         }

//         const updateChat = await prisma.chat.update({
//             where: { id: parseInt(chatId) },
//             data: { lastMessageId: message.id },
//             include: { participants: true }
//         });

//         const socketMessage = await prisma.chatMessage.findUnique({
//             where: { id: message.id },
//             include: {
//                 senderUser: true,
//                 chat: true
//             }
//         });

//         const user = await prisma.user.findUnique({
//             where: { id: req.user.id }
//         });

//         if (socketMessage && socketMessage.fileName) {
//             socketMessage.fileName = baseurl + "/books/" + socketMessage.fileName;
//         }

//         console.log("updateChat", updateChat);

//         for (const participant of updateChat.participants) {
//             // Skip sender for both userId and authorId
//             if (participant.userId === req.user.id || participant.authorId === req.user.id) {
//                 continue;
//             }

//             // 🔄 Handle unread count and socket event for users
//             if (participant.userId) {
//                 const existingCount = await prisma.userUnreadCount.findFirst({
//                     where: {
//                         chatId: parseInt(chatId),
//                         userId: participant.userId
//                     }
//                 });

//                 if (existingCount) {
//                     await prisma.userUnreadCount.update({
//                         where: { id: existingCount.id },
//                         data: {
//                             unreadCount: { increment: 1 }
//                         }
//                     });
//                 } else {
//                     await prisma.userUnreadCount.create({
//                         data: {
//                             chatId: parseInt(chatId),
//                             userId: participant.userId,
//                             unreadCount: 1
//                         }
//                     });
//                 }

//                 console.log("for user");
//                 const roomName = `user_${participant.userId}`;
//                 emitSocketEvent(
//                     req,
//                     roomName,
//                     ChatEventEnum.MESSAGE_RECEIVED_EVENT,
//                     socketMessage
//                 );
//             }

//             // 🔔 Handle author socket and notification
//             if (participant.authorId) {
//                 console.log("for author");
//                 const roomName = `author_${participant.authorId}`;
//                 emitSocketEvent(
//                     req,
//                     roomName,
//                     ChatEventEnum.MESSAGE_RECEIVED_EVENT,
//                     socketMessage
//                 );

//                 await createNotificationForAuthor({
//                     toAuthorId: participant.authorId,
//                     byUserId: req.user.id,
//                     data: {
//                         userId: req.user.id
//                     },
//                     type: "chat",
//                     content: `${req.user.fullName} sent you a message`
//                 });

//                 await sendNotificationRelateToMessageToAuthor({
//                     token: user?.fcm_token,
//                     body: `${req.user.fullName} sent you a message`
//                 });
//             }
//         }

//     } catch (error) {
//         console.log(error);

//     }
// }



// export async function generateJwt(roomName, userName) {
//   const now = Math.floor(Date.now() / 1000);

//   const payload = {
//     context: {
//       user: {
//         name: userName,
//         email: `${userName}@example.com`,
//         avatar: "https://avatar.example.com/avatar.png",
//       },
//     },
//     aud: 'my_app',               // <-- Audience must match Jitsi config (if self-hosted, check jwt config)
//     iss: appID,             // <-- Issuer must match your Jitsi app_id
//     sub: 'meet.jit.si',           // <-- Use 'meet.jit.si' if using public Jitsi, or your own domain if self-hosted
//     room: roomName,               // <-- The room name you want access to
//     exp: now + 60 * 60,           // <-- Expiry (1 hour from now)
//     nbf: now - 10,                // <-- Not valid before 10 seconds ago (buffer)
//   };

// //   const secretKey = 'your_secret_key_here';  // <-- Use your actual Jitsi app secret

//   const token = jwt.sign(payload, secretKey, { algorithm: 'HS256' });

//   return token;
// }



export async function generateJwt(roomName, userName) {
    const payload = {
        aud: 'jitsi',
        iss: appID,
        sub: 'meet.jit.si',
        room: roomName,
        context: {
            user: {
                name: userName
            }
        },
        // exp: Math.floor(Date.now() / 1000) + (60 * 60) // Token expires in 1 hour
    };

    const token = jwt.sign(payload, process.env.SECRET_KEY, { algorithm: 'HS256', expiresIn: '1h' });

    return token;
}


