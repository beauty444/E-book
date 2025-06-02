import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { emitSocketEvent } from '../utils/socket.js'; // Assuming you have this utility function
import { ChatEventEnum } from '../utils/constants.js';

import dotenv from "dotenv";
dotenv.config();
import { createErrorResponse, createSuccessResponse } from '../utils/responseUtil.js';
import { MessageEnum } from '../config/message.js';
// import { getMyFollowers } from '../utils/helper.js';
const baseurl = process.env.BASE_URL;
const prisma = new PrismaClient();



export async function createOrGetAOneOnOneChat(req, res) {
    const { receiverId } = req.params; // Author's ID
    console.log('receiverId', receiverId)
    const userId = req.user.id; // Logged-in user ID
    console.log('userId', userId)

    console.log('userId', userId)

    console.log('authorId:', receiverId);

    // Validate request params
    const schema = Joi.object({
        receiverId: Joi.number().required(),
    });

    const { error } = schema.validate({ receiverId });
    if (error) {
        return res.status(400).json({ message: error.details[0].message, success: false });
    }

    try {
        // Check if receiver (author) exists
        const receiver = await prisma.author.findUnique({ where: { id: parseInt(receiverId) } });
        if (!receiver) {
            return createErrorResponse(res, 404, MessageEnum.AUTHOR_NOT_FOUND);
        }

        console.log('Receiver (Author):', receiver);

        
        if(receiver.avatar_url)
            {
                receiver.avatar_url = `${baseurl}/books/${receiver.avatar_url}`
            }
            if(receiver.coverImage)
            {
                receiver.coverImage = `${baseurl}/books/${receiver.coverImage}`
            }

        // Check if a chat already exists between the user and author
        let existingChat = await prisma.chat.findFirst({
            where: {
                isGroupChat: false,
                participants: {
                    every: {
                        authorId: parseInt(receiverId),
                        userId: userId
                    }

                }
            },
            include: { participants: true }
        });

        console.log('existingChat', existingChat)
    
        if (existingChat) {

            return res.status(200).json({
                status: 200,
                message: 'Chat retrieved successfully',
                success: true,
                payload: { ...existingChat, participants: [receiver] }
            })
        }


        // If no chat exists, create a new one
        const chat = await prisma.chat.create({
            data: {
                name: "One-on-One Chat",
                isGroupChat: false,
                participants: {
                    create: [
                        { userId: userId },
                        { authorId: parseInt(receiverId) }
                    ]
                }
            },
            include: { participants: true }
        });


        // Notify the author via WebSockets (optional)
        const payload = {
            ...chat,
            participants: [receiver]
        };

        emitSocketEvent(req, receiver.id.toString(), ChatEventEnum.NEW_CHAT_EVENT, payload);

        return createSuccessResponse(res, 201, true, MessageEnum.CHAT_CREATE, payload);

    } catch (error) {
        console.log(error);
        return createErrorResponse(res, 500, MessageEnum.INTERNAL_SERVER_ERROR);
    }
}

export async function getAllChats(req, res) {
    try {
        const chats = await prisma.chat.findMany({
            where: {
                participants: {
                    some: { userId: req.user.id }
                }
            },
            include: {
                participants: {
                    include: {
                        Author: true,
                        User: true,
                    },
                },
                lastMessage: true,
            },
            orderBy: {
                lastMessage: {
                    updatedAt: 'desc'
                }
            }
        });

        // Apply full URLs to media
        await Promise.all(
            chats.map(chat => {
                if (chat.profilePic) {
                    chat.profilePic = `${baseurl}/books/${chat.profilePic}`;
                }

                chat.participants.forEach(participant => {
                    if (participant.User) {
                        participant.User.avatar_url = participant.User.avatar_url
                            ? `${baseurl}/books/${participant.User.avatar_url}`
                            : null;
                        participant.User.coverImage = participant.User.coverImage
                            ? `${baseurl}/books/${participant.User.coverImage}`
                            : null;
                        participant.User.pdfUrl = participant.User.pdfUrl
                            ? `${baseurl}/books/${participant.User.pdfUrl}`
                            : null;
                        participant.User.audioUrl = participant.User.audioUrl
                            ? `${baseurl}/books/${participant.User.audioUrl}`
                            : null;
                    }

                    if (participant.Author) {
                        participant.Author.avatar_url = participant.Author.avatar_url
                            ? `${baseurl}/books/${participant.Author.avatar_url}`
                            : null;
                        participant.Author.coverImage = participant.Author.coverImage
                            ? `${baseurl}/books/${participant.Author.coverImage}`
                            : null;
                        participant.Author.pdfUrl = participant.Author.pdfUrl
                            ? `${baseurl}/books/${participant.Author.pdfUrl}`
                            : null;
                        participant.Author.audioUrl = participant.Author.audioUrl
                            ? `${baseurl}/books/${participant.Author.audioUrl}`
                            : null;
                    }
                });
            })
        );

        // Add unread count for current user
        await Promise.all(chats.map(async chat => {
            const unreadCountData = await prisma.userUnreadCount.findFirst({
                where: {
                    chatId: chat.id,
                    userId: req.user.id
                }
            });
            chat.unreadCount = unreadCountData ? unreadCountData.unreadCount : 0;
        }));

        // Filter out self from participants for 1-on-1 chats
        const filteredChats = chats.map(chat => {
            if (chat.isGroupChat) return chat;

            return {
                ...chat,
                participants: chat.participants.filter(p => p.userId !== req.user.id)
            };
        });

        return createSuccessResponse(res, 200, true, MessageEnum.ALL_CHATS, filteredChats);
    } catch (error) {
        console.error("Error fetching chats:", error);
        return createErrorResponse(res, 500, MessageEnum.INTERNAL_SERVER_ERROR);
    }
}

export async function activateDeactivateChat(req, res) {
    try {
        const { chatId } = req.body;
        const schema = Joi.alternatives(Joi.object({
            chatId: Joi.number().required()
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
        const isActivateChat = await prisma.userActivateChat.findFirst({
            where: {
                userId: req.user.id,
                chatId: chatId
            }
        })
        console.log('isActivateChat', isActivateChat)

        if (isActivateChat) {
            await prisma.userActivateChat.delete({
                where: {
                    id: isActivateChat.id
                }
            })
            return createSuccessResponse(res, 200, true, MessageEnum.CHAT_DEACTIVATE)

        }
        else {
            const userActivateChat = await prisma.userActivateChat.create({
                data: {
                    userId: req.user.id,
                    chatId: chatId
                }
            });
            return res.status(200).json({
                success: true,
                message: "User chat Activated successfully",
                status: 200,
                userActivateChat
            });
        }
    } catch (error) {
        console.error("Error fetching books:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
}

export async function deactivateAllUserChats(req, res) {
    try {

        const userActivatedChats = (await prisma.coachActiveChat.findMany({
            where: {
                coachId: req.user.id
            }
        })).map((chat) => chat.id);
        await prisma.coachActiveChat.deleteMany({
            where: {
                id: {
                    in: userActivatedChats
                }
            }
        })
        return res.status(200).json({
            status: 200,
            message: 'Deactivated All Chats',
            success: true,
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: 200,
            message: 'Internal Server Error',
            success: false,
            error: error
        })
    }
}

export async function createOrGetAOneOnOneChatInUser(req, res) {
    const { receiverId } = req.params;
    const userId = req.user.id;

    console.log('userId', userId)

    const schema = Joi.object({
        receiverId: Joi.number().required(),
    });

    console.log("param", req.params);
    const result = schema.validate(req.params);
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

    try {
        // Check if receiver exists
        const receiver = await prisma.user.findUnique({
            where: { id: parseInt(receiverId) },
        });

        if (!receiver) {
            return createErrorResponse(res, 404, MessageEnum.USER_NOT_FOUND);
        }

        // Check if a chat already exists between the two users
        const existingChat = await prisma.chat.findFirst({
            where: {
                isGroupChat: false,
                participants: {
                    every: {
                        OR: [
                            { userId: parseInt(receiverId) },
                            { userId: userId }
                        ]
                    }
                }
            }
        });

        console.log('existingChat', existingChat)


        if (existingChat) {
            return createSuccessResponse(res, 200, true, MessageEnum.CHAT_FOUND, { ...existingChat, participants: [receiver] });
        }

        // Create a new chat between the two users
        const newChat = await prisma.chat.create({
            data: {
                name: "One on one chat",
                participants: {
                    create: [
                        {
                            userId: parseInt(receiverId),
                            role: 'USER',
                        },
                        {
                            userId: userId,
                            role: 'USER',
                        }
                    ]
                }
            }
        });

        // Prepare and emit socket event to notify both users about the new chat
        const payload = {
            ...newChat,
            participants: [receiver, { id: userId }]
        };

        // Emit event to all participants except the current user
        payload.participants.forEach(participant => {
            emitSocketEvent(req, participant.id.toString(), ChatEventEnum.NEW_CHAT_EVENT, payload);
        });

        return createSuccessResponse(res, 201, true, MessageEnum.CHAT_CREATE, payload);
    } catch (error) {
        console.log(error);
        return createErrorResponse(res, 500, MessageEnum.INTERNAL_SERVER_ERROR);
    }
}

export const getAllGroupChats = async (req, res) => {
  try {
    const groupChats = await prisma.chat.findMany({
      where: {
        isGroupChat: true, 
      },
      include: {
        participants: {
          include: {
            User: true,   
            Author: true, 
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    return res.status(200).json({
        success: true,
        message: "Group fetched successfully",
        status: 200,
        data: groupChats
    });
} catch (error) {
    console.log(error);
    return res.status(500).json({
        success: false,
        message: "Internal server error",
        status: 500,
        error: error.message
    });
}
}

export const leaveGroupChat = async (req, res) => {
  const { chatId, userId, authorId } = req.body;

  try {
    if (!chatId || (!userId && !authorId)) {
      return res.status(400).json({ success: false, message: "chatId and userId or authorId are required" });
    }

    const participant = await prisma.chatParticipant.deleteMany({
      where: {
        chatId: chatId,
        ...(userId && { userId: userId }),
        ...(authorId && { authorId: authorId }),
      },
    });

    if (participant.count === 0) {
      return res.status(404).json({ success: false, message: "Participant not found" });
    }

    return res.status(200).json({
        success: true,
        message: "Left the group successfully",
        status: 200,
    });
} catch (error) {
    console.log(error);
    return res.status(500).json({
        success: false,
        message: "Internal server error",
        status: 500,
        error: error.message
    });
}
}





//Message 

export async function getAllMessages(req, res) {
    try {
        const { chatId } = req.params;

        console.log('chatId', chatId);

        const schema = Joi.alternatives(Joi.object({
            chatId: Joi.number().required()
        }));
        const result = schema.validate(req.params);
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

        const chat = await prisma.chat.findUnique({
            where: {
                id: parseInt(chatId)
            },
            include: {
                participants: true
            }
        });

        console.log('chat', chat);

        if (!chat) {
            return res.status(404).json({
                status: 404,
                message: 'Chat does not exist',
                success: false,
            });
        }

        let messages = await prisma.chatMessage.findMany({
            where: {
                chatId: parseInt(chatId),
            },
            include: {
                senderAuthor: true,
                senderUser: true,
                chat: true,
                ChatMessageFiles: true
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        messages = messages.map(chatMessage => {
            // Add baseurl to message file names
            if (chatMessage.ChatMessageFiles && chatMessage.ChatMessageFiles.length > 0) {
                chatMessage.ChatMessageFiles = chatMessage.ChatMessageFiles.map(file => ({
                    ...file,
                    fileName: file.fileName ? `${baseurl}/books/${file.fileName}` : null
                }));
            }

            // Add baseurl to senderAuthor media fields
            if (chatMessage.senderAuthor) {
                const author = chatMessage.senderAuthor;

                author.avatar_url = author.avatar_url ? `${baseurl}/books/${author.avatar_url}` : null;
                author.coverImage = author.coverImage ? `${baseurl}/books/${author.coverImage}` : null;
                author.pdfUrl = author.pdfUrl ? `${baseurl}/books/${author.pdfUrl}` : null;
                author.audioUrl = author.audioUrl ? `${baseurl}/books/${author.audioUrl}` : null;
            }

            else{
                const user = chatMessage.senderUser;

                user.avatar_url = user.avatar_url ? `${baseurl}/books/${user.avatar_url}` : null;
                user.coverImage = user.coverImage ? `${baseurl}/books/${user.coverImage}` : null;
                user.pdfUrl = user.pdfUrl ? `${baseurl}/books/${user.pdfUrl}` : null;
                user.audioUrl = user.audioUrl ? `${baseurl}/books/${user.audioUrl}` : null;
            }

            return chatMessage;
        });

        // Reset unread count to 0
        const unreadCountData = await prisma.userUnreadCount.findFirst({
            where: {
                userId: req.user.id,
                chatId: parseInt(chatId)
            }
        });

        if (unreadCountData) {
            console.log("unreadCount exists");
            await prisma.userUnreadCount.update({
                where: {
                    id: unreadCountData.id
                },
                data: {
                    unreadCount: 0
                }
            });
        }

        return res.status(200).json({
            status: 200,
            message: 'Messages fetched successfully',
            success: true,
            messages
        });

    } catch (error) {
        console.error("Error fetching messages:", error);
        return res.status(500).json({
            status: 500,
            message: 'Internal Server Error',
            success: false,
            error
        });
    }
}

// export async function getAllMessages(req, res) {
//     try {
//         const { chatId } = req.params;

//         console.log('chatId', chatId)
    
//         const schema = Joi.alternatives(Joi.object({
//             chatId: Joi.number().required()
//         }))
//         const result = schema.validate(req.params);
//         if (result.error) {
//             const message = result.error.details.map((i) => i.message).join(",");
//             return res.json({
//                 message: result.error.details[0].message,
//                 error: message,
//                 missingParams: result.error.details[0].message,
//                 status: 400,
//                 success: false,
//             });
//         }

//         const chat = await prisma.chat.findUnique({
//             where: {
//                 id: parseInt(chatId)
//             },
//             include: {
//                 participants: true
//             }
//         });

//         console.log('chat', chat)

//         if (!chat) {
//             return res.status(404).json({
//                 status: 404,
//                 message: 'Chat does not exist',
//                 success: false,
//             });
//         }

//         let messages = await prisma.chatMessage.findMany({
//             where: {
//                 chatId: parseInt(chatId),
//             },
//             include: {
//                 senderAuthor: true,
//                 senderUser: true,
//                 chat: true,
//                 ChatMessageFiles: true
//             },
//             orderBy: {
//                 createdAt: "desc"
//             }
//         });

//         messages = messages.map(chatMessage => {
//             if (chatMessage.ChatMessageFiles && chatMessage.ChatMessageFiles.length > 0) {
//                 chatMessage.ChatMessageFiles = chatMessage.ChatMessageFiles.map(file => ({
//                     ...file,
//                     fileName: file.fileName ? `${baseurl}/books/${file.fileName}` : null
//                 }));
//             }
//             return chatMessage;


//         });

//         const unreadCountData = await prisma.userUnreadCount.findFirst({
//             where: {
//                 userId: req.user.id,
//                 chatId: parseInt(chatId)
//             }
//         })
//         if (unreadCountData) {
//             console.log("unredadCount")
//             await prisma.userUnreadCount.update({
//                 where: {
//                     id: unreadCountData.id
//                 },
//                 data: {
//                     unreadCount: 0
//                 }
//             })
//         }


//         return res.status(200).json({
//             status: 200,
//             message: 'Messages fetched successfully',
//             success: true,
//             messages
//         });

//     } catch (error) {
//         console.error("Error fetching messages:", error);
//         return res.status(500).json({
//             status: 500,
//             message: 'Internal Server Error',
//             success: false,
//             error
//         });
//     }
// }

export async function clearChat(req, res) {
    try {
        const { chatId } = req.params;
        const chat = await prisma.chat.findUnique({
            where: {
                id: parseInt(chatId)
            },
            include: {
                participants: true
            }
        })
        if (!chat) {
            return res.status(404).json({
                status: 404,
                message: 'Chat does not exists',
                success: false,
            })
        }
        await prisma.chatMessage.deleteMany({
            where: {
                chatId: parseInt(chatId)
            }
        })
        return res.status(200).json({
            status: 200,
            message: 'Chat Cleared Successfully',
            success: true,
        })

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: 200,
            message: 'Internal Server Error',
            success: false,
            error: error
        })
    }
}


export const fileUploadforImage = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No files uploaded"
            });
        }

        const filenames = req.files.map(file => file.filename);

        return res.status(200).json({
            success: true,
            message: "Images uploaded successfully",
            filenames
        });

    } catch (error) {
        console.error("Error uploading images:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
}
