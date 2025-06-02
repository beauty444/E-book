import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import admin from '../utils/firebaseAdmin.js';


export async function sendNotificationRelateToFollow(params) {

    if (params.token === null) {
        console.log("User does not have fcm token")
        return;
    }
    console.log("till here ")

    var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
        token: params.token,
        notification: {
            title: 'Follow Notification',
            body: `${params.body}`,
        },
        data: {  //you can send only notification or only data(or include both)
            type: "follow"
        },
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Successfully sent message:', response);
    } catch (error) {
        console.error('Error sending message:', error);
    }
};

export async function sendNotificationRelateToMessageToAuthor(params) {

    if (params.token === null) {
        console.log("Author does not have fcm token")
        return;
    }
    console.log("till here ")

    var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
        token: params.token,
        notification: {
            title: 'Chat Notification',
            body: `${params.body}`,
        },
        data: {  //you can send only notification or only data(or include both)
            type: "chat"
        },
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Successfully sent message:', response);
    } catch (error) {
        console.error('Error sending message:', error);
    }
};


export async function sendNotificationRelateToMessageToUser(params) {

    if (params.token === null) {
        console.log("user does not have fcm token")
        return;
    }
    console.log("till here ")

    var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
        token: params.token,
        notification: {
            title: 'Chat Notification',
            body: `${params.body}`,
        },
        data: {  //you can send only notification or only data(or include both)
            type: "chat"
        },
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Successfully sent message:', response);
    } catch (error) {
        console.error('Error sending message:', error);
    }
};

export async function sendNotificationRelateToQaSessionToUser(params) {

    if (params.token === null) {
        console.log("user does not have fcm token")
        return;
    }
    console.log("till here ")

    var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
        token: params.token,
        notification: {
            title: 'Q&A Session Notification',
            body: `${params.body}`,
        },
        data: {  //you can send only notification or only data(or include both)
            type: "Q&A"
        },
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Successfully sent message:', response);
    } catch (error) {
        console.error('Error sending message:', error);
    }
};


export async function createNotificationForAuthor(params) {
    try {
        const { byUserId, toAuthorId, content, type, data } = params;

        const notification = await prisma.authorNotification.create({
            data: {
                byUserId,
                toAuthorId,
                content,
                type,
                data: JSON.stringify(data)
            }
        });

        console.log("Notification created successfully:", notification);
        return notification;
    } catch (error) {
        console.log("Error creating notification:", error);
        throw error;
    }
}

export async function createNotificationForUser(params) {
    try {
        const { byAuthorId, toUserId, content, type, data } = params;

        const notification = await prisma.notification.create({
            data: {
                byAuthorId,
                toUserId,
                content,
                type,
                data: JSON.stringify(data)
            }
        });

        console.log("Notification created successfully:", notification);
        return notification;
    } catch (error) {
        console.log("Error creating notification:", error);
        throw error;
    }
}
