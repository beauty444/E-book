import Joi from "joi";
import jwt from 'jsonwebtoken'
import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcrypt';
import path from 'path'
import crypto from 'crypto';
import dotenv from "dotenv";
import nodemailer from 'nodemailer';
import { randomStringAsBase64Url } from "../utils/helper.js";
import { fileURLToPath } from 'url';
const baseurl = process.env.BASE_URL;
import hbs from "nodemailer-express-handlebars";
import { generateOTP, getAuthorStats } from "../utils/helper.js"
import { emitSocketEvent } from '../utils/socket.js'; // Assuming you have this utility function
import { ChatEventEnum } from '../utils/constants.js';
import { createErrorResponse, createSuccessResponse } from '../utils/responseUtil.js';
import { MessageEnum } from '../config/message.js';


dotenv.config();
const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

var transporter = nodemailer.createTransport({
    // service: 'gmail',
    host: "smtp.gmail.com",
    port: 587,
    // secure: true,
    auth: {
        user: "yashraj.ctinfotech@gmail.com",
        pass: "lggh qqgx fkuc efwq",
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

export async function login(req, res) {
    try {
        const secretKey = process.env.SECRET_KEY;
        const { email, password, fcm_token } = req.body;
        const schema = Joi.alternatives(
            Joi.object({
                //email: Joi.string().min(5).max(255).email({ tlds: { allow: false } }).lowercase().required(),
                email: Joi.string()
                    .min(5)
                    .max(255)
                    .email({ tlds: { allow: false } })
                    .lowercase()
                    .required(),
                password: Joi.string().min(8).max(15).required().messages({
                    "any.required": "{{#label}} is required!!",
                    "string.empty": "can't be empty!!",
                    "string.min": "minimum 8 value required",
                    "string.max": "maximum 15 values allowed",
                }),
                fcm_token: Joi.string().optional(),
            })
        );
        const result = schema.validate({ email, password, fcm_token });

        if (result.error) {
            const message = result.error.details.map((i) => i.message).join(",");
            return res.json({
                message: result.error.details[0].message,
                error: message,
                missingParams: result.error.details[0].message,
                status: 400,
                success: false,
            });
        } else {
            const user = await prisma.admin.findUnique({
                where: {
                    email: email,
                },
            });
            if (!user || !(await bcrypt.compare(password, user.password))) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid credentials",
                    status: 400,
                });
            }
            if (fcm_token) {
                await prisma.admin.update({
                    where: {
                        email: email,
                    },
                    data: {
                        fcm_token: fcm_token,
                    },
                });
            }

            const userData = await prisma.admin.findUnique({
                where: {
                    email: email,
                },
            });

            const token = jwt.sign(
                { adminId: user.id, email: user.email },
                secretKey,
                { expiresIn: "3d" }
            );
            return res.json({
                status: 200,
                success: true,
                message: "Login successful!",
                token: token,
                admin: userData,
            });
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: 500,
            message: "Internal Server Error",
            success: false,
            error: error,
        });
    }
}

export async function forgotPassword(req, res) {
    const { email } = req.body;

    try {
        if (email) {
            const schema = Joi.object({
                email: Joi.string().min(5).max(255).email({ tlds: { allow: false } }).lowercase().required(),
            });

            const result = schema.validate({ email });
            if (result.error) {
                const message = result.error.details.map((i) => i.message).join(",");
                return res.status(400).json({
                    message: result.error.details[0].message,
                    error: message,
                    missingParams: result.error.details[0].message,
                    status: 400,
                    success: false,
                });
            }

            const user = await prisma.admin.findUnique({
                where: { email }
            });

            if (!user) {
                return res.status(400).json({
                    success: false,
                    status: 400,
                    message: 'Email not registered'
                });
            }

            const otp = await generateOTP(4);
            console.log('otp', otp);
            const otpExpiration = new Date(Date.now() + 1 * 60000);

            let mailOptions = {
                from: "dataCollector.0901@gmail.com",
                to: email,
                subject: 'Password Reset Request',
                template: 'forgetPassword',
                context: {
                    otp: otp,
                    imgUrl: `${baseurl}/mainLogo.png`
                }
            };

            transporter.sendMail(mailOptions, async function (error, info) {
                if (error) {
                    console.log(error);
                    return res.status(400).json({
                        success: false,
                        status: 400,
                        message: 'Mail Not Delivered'
                    });
                } else {
                    await prisma.admin.update({
                        where: { email },
                        data: {
                            otp: otp,
                            otpExpiration: otpExpiration
                        }
                    });
                    return res.status(200).json({
                        success: true,
                        message: "OTP sent to your email. Please check your inbox.",
                        status: 200,
                    });
                }
            });
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: 500,
            message: 'Internal Server Error',
            success: false,
            error: error
        });
    }
}

export async function verifyForgetPasswordOtp(req, res) {
    const { email, otp, phone_no } = req.body;

    try {
        if (email && otp) {
            const schema = Joi.alternatives(Joi.object({
                email: Joi.string().min(5).max(255).email({ tlds: { allow: false } }).lowercase().required(),
                otp: Joi.string().required()
            }))
            const result = schema.validate(req.body);
            if (result.error) {
                const message = result.error.details.map((i) => i.message).join(",");
                return res.status(400).json({
                    message: result.error.details[0].message,
                    error: message,
                    missingParams: result.error.details[0].message,
                    status: 400,
                    success: false,
                });
            }
            const user = await prisma.admin.findUnique({
                where: { email }
            });

            if (user && user.otp === otp && new Date(user.otpExpiration) > new Date()) {
                await prisma.admin.update({
                    where: { email },
                    data: { otp: null, otpExpiration: null }
                });
                return res.status(200).json({
                    message: 'Otp Verified Successfully',
                    status: 200,
                    success: true,
                });
            } else {
                return res.status(400).json({
                    message: 'Invalid or expired OTP',
                    status: 400,
                    success: true
                });
            }
        }
        if (phone_no && otp) {
            console.log(req.body);
            console.log("after");

            const phoneSchema = Joi.object({
                phone_no: Joi.string().min(10).max(15).required(),
                otp: Joi.string().required()
            });

            const phoneResult = phoneSchema.validate({ phone_no, otp });
            if (phoneResult.error) {
                const message = phoneResult.error.details.map((i) => i.message).join(",");
                return res.status(400).json({
                    message: phoneResult.error.details[0].message,
                    error: message,
                    missingParams: phoneResult.error.details[0].message,
                    status: 400,
                    success: false,
                });
            }


            const user = await prisma.user.findUnique({
                where: { phone_no }
            });
            if (user) {
                const response = await fetch(`${SINCH_BASE_URL}/verifications/number/${encodeURIComponent(phone_no)}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Basic ' + Buffer.from(`${SINCH_APPLICATION_KEY}:${SINCH_APPLICATION_SECRET}`).toString('base64')
                    },
                    body: JSON.stringify({
                        method: 'sms',
                        sms: { code: otp }
                    })
                });

                const data = await response.json();
                if (response.ok) {
                    if (data.status === 'FAIL') {
                        return res.status(400).json({ message: `OTP ${data.reason}`, status: 200, success: false });
                    }
                    await prisma.admin.update({
                        where: { phone_no },
                        data: { otp: null, otpExpiration: null }
                    });
                    return res.status(200).json({
                        message: 'Otp verified successfully',
                        status: 200,
                        success: true,
                    });
                } else {
                    res.status(response.status).json({ message: `${data.message}`, error: data });
                }
            }
            else {
                return res.status(400).json({
                    success: false,
                    status: 400,
                    message: 'User not found'
                });
            }

        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 200,
            message: 'Internal Server Error',
            success: false,
            error: error
        })

    }
}

export async function resetPassword(req, res, next) {
    try {
        const secretKey = process.env.SECRET_KEY;
        const { email, password } = req.body;

        console.log(req.body)

        if (email) {
            const schema = Joi.alternatives(Joi.object({
                email: Joi.string().min(5).max(255).email({ tlds: { allow: false } }).lowercase().required(),
                password: Joi.string().min(8).max(15).required()
            }))
            const result = schema.validate(req.body);
            if (result.error) {
                const message = result.error.details.map((i) => i.message).join(",");
                return res.status(400).json({
                    message: result.error.details[0].message,
                    error: message,
                    missingParams: result.error.details[0].message,
                    status: 400,
                    success: false,
                });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            const user = await prisma.admin.update({
                where: {
                    email: email
                },
                data: {
                    password: hashedPassword
                }
            })
            // const token = jwt.sign({ userId: user.id }, secretKey, { expiresIn: '3d' });
            return res.status(200).json({
                status: 200,
                message: 'Password Reset Successfully,You can now login',
                success: true,
                // token,
                user
            })
        }
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

export async function changePassword(req, res) {
    try {
        const { current_password, new_password } = req.body;

        const schema = Joi.object({
            current_password: Joi.string().required().messages({
                "any.required": "Current password is required",
                "string.empty": "Current password cannot be empty"
            }),
            new_password: Joi.string().min(8).required().messages({
                "any.required": "New password is required",
                "string.empty": "New password cannot be empty",
                "string.min": "New password must be at least 8 characters"
            }),
        });

        const { error } = schema.validate(req.body);
        if (error) {
            const message = error.details.map(i => i.message).join(', ');
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
                error: message,
                status: 400
            });
        }

        const adminId = req.user.id;

        console.log('adminId', adminId)

        const admin = await prisma.admin.findUnique({
            where: { id: adminId },
        });

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "User not found",
                status: 404
            });
        }

        const isPasswordCorrect = await bcrypt.compare(current_password, admin.password);

        console.log('isPasswordCorrect', isPasswordCorrect)
        if (!isPasswordCorrect) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect",
                status: 400
            });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);


        await prisma.admin.update({
            where: { id: adminId },
            data: { password: hashedPassword }
        });

        return res.status(200).json({
            success: true,
            message: "Password changed successfully",
            status: 200
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message
        });
    }
}

export async function getMyProfile(req, res, next) {
    try {
        const adminId = req.user.id;

        const admin = await prisma.admin.findUnique({
            where: { id: adminId },
        });

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found",
            });
        }

        if (admin.avatar_url) {
            admin.avatar_url = `${baseurl}/books/${admin.avatar_url}`;
        }

        return res.status(200).json({
            success: true,
            message: "Admin profile fetched successfully",
            profile: admin,
        });

    } catch (error) {
        console.error("Error fetching admin profile:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

export async function editProfile(req, res) {
    try {
        const { fullName } = req.body;

        console.log('fullName', fullName)

        const schema = Joi.object({
            fullName: Joi.string().optional().allow(null, ''),
        });

        const result = schema.validate(req.body);
        if (result.error) {
            return res.status(400).json({
                message: result.error.details[0].message,
                error: result.error.details.map((i) => i.message).join(","),
                status: 400,
                success: false,
            });
        }


        let updateData = {
            fullName
        };

        if (req.files) {
            if (req.files["avatar_url"]) {
                updateData.avatar_url = req.files["avatar_url"][0].filename;
            }
        }

        await prisma.admin.update({
            where: { id: req.user.id },
            data: updateData,
        });
        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            status: 200,
            updateData
        });

    } catch (error) {
        console.error("Edit Profile Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

export const getdashboard = async (req, res) => {
    try {


        const TotalUsers = await prisma.user.count({
        });

        console.log('TotalUsers', TotalUsers)

        const TotalAuthors = await prisma.author.count({
        });

        const TotalBooks = await prisma.book.count();

        const ActiveChatRoom = await prisma.chat.count({
            where: {
                isGroupChat: true,
            }
        });
        res.json({
            TotalUsers, TotalAuthors, TotalBooks, ActiveChatRoom
        });
    } catch (error) {
        console.log('error', error)
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error
        });
    }
};

export async function getAllReader(req, res) {
    try {
        const { search, page = 1, limit = 10 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const filterQuery = {
            ...(search && {
                OR: [
                    { fullName: { contains: search } },
                    { email: { contains: search } },
                ],
            }),
        };

        const readers = await prisma.user.findMany({
            where: filterQuery,
            skip,
            take,
            orderBy: {
                id: "desc",
            },
        });

        const totalCount = await prisma.user.count({
            where: filterQuery
        })

        const formattedReaders = readers.map((item) => ({
            ...item,
            coverImage: item.coverImage ? `${baseurl}/books/${item.coverImage}` : null,
            pdfUrl: item.pdfUrl ? `${baseurl}/books/${item.pdfUrl}` : null,
            audioUrl: item.audioUrl ? `${baseurl}/books/${item.audioUrl}` : null,
            bookMedia: item.bookMedia ? `${baseurl}/books/${item.bookMedia}` : null,
            avatar_url: item.avatar_url ? `${baseurl}/books/${item.avatar_url}` : null,
        }));

        return res.status(200).json({
            success: true,
            message: "Readers retrieved successfully",
            status: 200,
            readers: formattedReaders,
            totalCount
        });

    } catch (error) {
        console.error("Error fetching readers:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
}

export async function getAllAuthor(req, res) {
    try {
        const { search, page = 1, limit = 10 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const filterQuery = {
            ...(search && {
                OR: [
                    { fullName: { contains: search } },
                    { email: { contains: search } },
                ],
            }),
        };

        const authors = await prisma.author.findMany({
            where: filterQuery,
            skip,
            take,
            orderBy: { id: 'desc' }
        });

        const totaCount = await prisma.author.count({
            where: filterQuery
        })

        // Run getAuthorStats() for each author in parallel
        const authorStats = await Promise.all(
            authors.map(author => getAuthorStats(author.id))
        );

        // Merge stats and format image URLs
        const updatedAuthors = authors.map((author, index) => {
            const stats = authorStats[index];
            return {
                ...author,
                publishedBooksCount: stats.publishedCount,
                followersCount: stats.followersCount,
                avatar_url: author.avatar_url ? `${baseurl}/books/${author.avatar_url}` : null,
                coverImage: author.coverImage ? `${baseurl}/books/${author.coverImage}` : null,
            };
        });

        return res.status(200).json({
            success: true,
            message: "Authors retrieved successfully",
            status: 200,
            authors: updatedAuthors,
            totaCount
        });

    } catch (error) {
        console.error("Error fetching authors:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message
        });
    }
}

export async function getAuthorById(req, res) {
    const { id } = req.params;
    console.log("id", id);

    try {
        const author = await prisma.author.findUnique({
            where: { id: parseInt(id) },
            include: {
                books: {
                    orderBy: {
                        createdAt: "desc"
                    }
                },
                AuthorCategory: {
                    include: {
                        category: true,
                    },
                },
                following: true,
            },
        });

        const isFollowed = await prisma.follow.findFirst({
            where: {
                followerId: req.user.id,
                followingId: parseInt(id)
            }
        })

        if (isFollowed) {
            author.isFollowed = true
        }
        else {
            author.isFollowed = false
        }

        if (!author) {
            return res.status(404).json({
                success: false,
                message: "Author not found",
                status: 404,
            });
        }

        author.coverImage = author.coverImage ? baseurl + "/books/" + author.coverImage : null;
        author.avatar_url = author.avatar_url ? baseurl + "/books/" + author.avatar_url : null;

        await Promise.all(
            author.books.map(async (book) => {
                book.coverImage = book.coverImage ? baseurl + "/books/" + book.coverImage : null;
                book.pdfUrl = book.pdfUrl ? baseurl + "/books/" + book.pdfUrl : null;
                book.audioUrl = book.audioUrl ? baseurl + "/books/" + book.audioUrl : null;
            })
        );

        return res.status(200).json({
            success: true,
            message: "Author retrieved successfully",
            status: 200,
            author,
        });
    } catch (error) {
        console.error("Error fetching author:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
}

export async function toggleUserStatusByAdmin(req, res) {
    try {
        const { id } = req.params;

        await prisma.user.findUnique({
            where: { id: req.user.id },
        });

        const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const newStatus = user.status === 1 ? 0 : 1;

        const updatedUser = await prisma.user.update({
            where: { id: parseInt(id) },
            data: { status: newStatus },
        });

        return res.status(200).json({ message: `User  ${newStatus === 1 ? 'Activated' : 'Deactivated'} Successfully`, updatedUser });
        // return res.status(200).json({ message: `User status updated Successfully`, updatedUser });
    } catch (error) {
        console.log('error', error)
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error
        });
    }
};

export async function toggleAuthorStatusByAdmin(req, res) {
    try {
        const { id } = req.params;

        await prisma.author.findUnique({
            where: { id: req.user.id },
        });

        const user = await prisma.author.findUnique({ where: { id: parseInt(id) } });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const newStatus = user.status === 1 ? 0 : 1;

        const updatedUser = await prisma.author.update({
            where: { id: parseInt(id) },
            data: { status: newStatus },
        });

        return res.status(200).json({ message: `User  ${newStatus === 1 ? 'Activated' : 'Deactivated'} Successfully`, updatedUser });
        // return res.status(200).json({ message: `User status updated Successfully`, updatedUser });
    } catch (error) {
        console.log('error', error)
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error
        });
    }
};

export async function getAllEbook(req, res) {
    try {
        const { search, page = 1, limit = 10 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const filterQuery = {
            ...(search && {
                title: {
                    contains: search,
                },
            }),
        };

        const ebook = await prisma.book.findMany({
            where: filterQuery,
            skip,
            take,
            include: {
                Review: true,
                author: true,
                books: {
                    include: {
                        category: true
                    }
                }
            },
            orderBy: {
                id: "desc"
            }
        });

        const totalCount = await prisma.book.count({
            where: filterQuery
        })

        ebook.forEach(item => {
            if (item.author) {
                if (item.author.coverImage) {
                    item.author.coverImage = `${baseurl}/books/${item.author.coverImage}`;
                }
                if (item.author.avatar_url) {
                    item.author.avatar_url = `${baseurl}/books/${item.author.avatar_url}`;
                }
            }

            item.coverImage = item.coverImage ? `${baseurl}/books/${item.coverImage}` : null;
            item.pdfUrl = item.pdfUrl ? `${baseurl}/books/${item.pdfUrl}` : null;
            item.audioUrl = item.audioUrl ? `${baseurl}/books/${item.audioUrl}` : null;
        });

        return res.status(200).json({
            success: true,
            message: "Ebooks retrieved successfully",
            status: 200,
            ebook,
            totalCount
        });
    } catch (error) {
        console.error("Error fetching ebooks:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
}

export const getAllEbookById = async (req, res) => {
    const { id } = req.params;
    try {
        const book = await prisma.book.findUnique({
            where: { id: parseInt(id) },
            include: {
                bookMedia: true,
                author: true,
                books: {
                    include: {
                        category: true
                    }
                },
            }
        });

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found",
                status: 404
            });
        }

        // Check if book is favorited by the user
        const isFavorite = await prisma.favorite.findFirst({
            where: {
                userId: req.user.id,
                bookId: parseInt(id)
            }
        });

        console.log('isFavorite', isFavorite)

        book.isFavorite = !!isFavorite;

        // Format media URLs
        book.coverImage = book.coverImage ? baseurl + "/books/" + book.coverImage : null;
        book.pdfUrl = book.pdfUrl ? baseurl + "/books/" + book.pdfUrl : null;
        book.audioUrl = book.audioUrl ? baseurl + "/books/" + book.audioUrl : null;

        if (book.bookMedia.length > 0) {
            book.bookMedia = book.bookMedia.map(item => ({
                ...item,
                mediaUrl: baseurl + "/books/" + item.mediaUrl
            }));
        }

        const favorite = await prisma.favorite.count({
            where: { bookId: parseInt(id) }
        })

        book.favorite = favorite

        const totalViews = await prisma.bookRead.count({
            where: { bookId: parseInt(id) }
        })

        book.totalViews = totalViews

        return res.status(200).json({
            success: true,
            message: "Book retrieved successfully",
            status: 200,
            book
        });

    } catch (error) {
        console.error("Error fetching book:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

export async function getAllChats(req, res) {
    try {
        const { search, page = 1, limit = 10 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const filterQuery = {
            isGroupChat: true,
            ...(search && {
                name: {
                    contains: search
                }
            })
        };

        const chats = await prisma.chat.findMany({
            where: filterQuery,
            skip,
            take,
            include: {
                participants: {
                    include: {
                        User: true
                    },
                },
                admin: {
                    select: {
                        fullName: true
                    }
                }
            },
            orderBy: {
                id: "desc"
            }
        });

        const totalCount = await prisma.chat.count({
            where: filterQuery
        });

        const updatedChats = chats.map(chat => {
            const adminName = chat.admin ? chat.admin.fullName : null;

            const chatProfilePic = chat.profilePic ? `${baseurl}/books/${chat.profilePic}` : null;

            const updatedParticipants = chat.participants.map(p => {
                if (p.User) {
                    p.User.avatar_url = p.User.avatar_url ? `${baseurl}/books/${p.User.avatar_url}` : null;
                    p.User.profilePic = p.User.profilePic ? `${baseurl}/books/${p.User.profilePic}` : null;
                }
                return p;
            });

            return {
                ...chat,
                adminName,
                profilePic: chatProfilePic,
                participants: updatedParticipants,
            };
        });
        return res.status(200).json({
            success: true,
            message: "Chats Retrieved Successfully",
            status: 200,
            chats: updatedChats,
            totalCount
        });
    } catch (error) {
        console.error("Error fetching book:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

export async function getChatMessagesByChatId(req, res) {
    const { chatId } = req.params;

    try {
        const chat = await prisma.chat.findUnique({
            where: { id: parseInt(chatId) },
            include: {
                participants: {
                    include: {
                        User: true,
                        Author: true
                    },
                },
                ChatMessage: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        senderUser: true,
                        senderAuthor: true,
                        ChatMessageFiles: true
                    }
                }
            }
        });

        if (!chat) {
            return res.status(404).json({
                success: false,
                message: "Chat not found",
                status: 404,
            });
        }

        const updatedParticipants = chat.participants.map(p => {
            if (p.User) {
                p.User.avatar_url = p.User.avatar_url ? `${baseurl}/books/${p.User.avatar_url}` : null;
                p.User.profilePic = p.User.profilePic ? `${baseurl}/books/${p.User.profilePic}` : null;
                p.User.coverImage = p.User.coverImage ? `${baseurl}/books/${p.User.coverImage}` : null;
            }

            if (p.Author) {
                p.Author.avatar_url = p.Author.avatar_url ? `${baseurl}/books/${p.Author.avatar_url}` : null;
                p.Author.profilePic = p.Author.profilePic ? `${baseurl}/books/${p.Author.profilePic}` : null;
                p.Author.coverImage = p.Author.coverImage ? `${baseurl}/books/${p.Author.coverImage}` : null;
            }

            return p;
        });

        const updatedMessages = chat.ChatMessage.map(message => {
            if (message.senderUser) {
                message.senderUser.avatar_url = message.senderUser.avatar_url
                    ? `${baseurl}/books/${message.senderUser.avatar_url}` : null;

                message.senderUser.profilePic = message.senderUser.profilePic
                    ? `${baseurl}/books/${message.senderUser.profilePic}` : null;

                message.senderUser.coverImage = message.senderUser.coverImage
                    ? `${baseurl}/books/${message.senderUser.coverImage}` : null;
            }

            if (message.senderAuthor) {
                message.senderAuthor.avatar_url = message.senderAuthor.avatar_url
                    ? `${baseurl}/books/${message.senderAuthor.avatar_url}` : null;

                message.senderAuthor.profilePic = message.senderAuthor.profilePic
                    ? `${baseurl}/books/${message.senderAuthor.profilePic}` : null;

                message.senderAuthor.coverImage = message.senderAuthor.coverImage
                    ? `${baseurl}/books/${message.senderAuthor.coverImage}` : null;
            }

            if (message.ChatMessageFiles && Array.isArray(message.ChatMessageFiles)) {
                message.ChatMessageFiles = message.ChatMessageFiles.map(file => ({
                    ...file,
                    fileName: file.fileName ? `${baseurl}/books/${file.fileName}` : null
                }));
            }

            return message;
        });

        return res.status(200).json({
            success: true,
            message: "Chat messages retrieved successfully",
            status: 200,
            data: {
                chat,
                participants: updatedParticipants,
                messages: updatedMessages
            }
        });

    } catch (error) {
        console.error("Error fetching chat messages:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
}

export async function deleteBook(req, res) {
    const { bookId } = req.params;

    try {
        const book = await prisma.book.findUnique({
            where: { id: parseInt(bookId) }
        });

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found",
                status: 404
            });
        }

        await prisma.book.delete({
            where: { id: parseInt(bookId) }
        });

        return res.status(200).json({
            success: true,
            message: "Book deleted successfully",
            status: 200
        });

    } catch (error) {
        console.error("Error deleting book:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message
        });
    }
}

export const addCategory = async (req, res) => {
    try {
        const { name } = req.body;

        const schema = Joi.object({
            name: Joi.string().required(),
        });

        const { error } = schema.validate(req.body);
        if (error) {
            const message = error.details.map((i) => i.message).join(", ");
            return res.status(400).json({
                message,
                missingParams: error.details[0].message,
                status: 400,
                success: false,
            });
        }

        const existingCategory = await prisma.category.findUnique({
            where: { name },
        });

        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: "Category already exists",
                status: 400,
            });
        }

        const category = await prisma.category.create({
            data: { name }
        });


        return res.status(200).json({
            success: true,
            message: "Category created successfully",
            status: 200,
            category
        });

    } catch (error) {
        console.error("Error deleting book:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message
        });
    }
}

export const getAllCategory = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const filterQuery = {
            ...(search && {
                name: {
                    contains: search,
                },
            }),
        };

        const category = await prisma.category.findMany({
            where: filterQuery,
            skip,
            take,
            orderBy: {
                id: 'desc'
            }
        });

        const totalCount = await prisma.category.count({
            where: filterQuery
        });

        return res.status(200).json({
            success: true,
            message: "Category fetched successfully",
            status: 200,
            category,
            totalCount
        });

    } catch (error) {
        console.error("Error fetching category:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message
        });
    }
};

export const getAllCategoryById = async (req, res) => {
    const { id } = req.params;
    try {
        const category = await prisma.category.findUnique({
            where: { id: parseInt(id) },
        })

        return res.status(200).json({
            success: true,
            message: "Category fetched successfully",
            status: 200,
            category
        });

    } catch (error) {
        console.error("Error deleting book:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message
        });
    }
}

export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;


        const schema = Joi.object({
            name: Joi.string().optional().allow(null, ''),
            description: Joi.string().optional().allow(null, ''),
            date: Joi.string().optional().allow(null, ''),
        });

        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                message: error.details[0].message,
                error: error.details.map((i) => i.message).join(", "),
                status: 400,
                success: false,
            });
        }

        const category = await prisma.category.update({
            where: { id: parseInt(id) },
            data: { name }
        });

        return res.status(200).json({
            success: true,
            message: "Category updated successfully",
            status: 200,
            category
        });

    } catch (error) {
        console.error("Error deleting book:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message
        });
    }
}

export const getAllContact = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);


        const filterQuery = {
            ...(search && {
                user: {
                    fullName: {
                        contains: search,
                    }
                }
            }),
        };

        const contact = await prisma.contactIssue.findMany({
            where: filterQuery,
            skip,
            take,
            include: {
                user: true
            },
            orderBy: {
                id: 'desc'
            }
        });

        const totalCount = await prisma.contactIssue.count({
            where: filterQuery
        })

        return res.status(200).json({
            success: true,
            message: "Contacts fetched successfully",
            status: 200,
            contact,
            totalCount
        });

    } catch (error) {
        console.error("Error fetching contacts:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message
        });
    }
};

export const updateContactIssue = async (req, res) => {
    try {
        const { id } = req.params;
        const { isResolved } = req.body;

        const schema = Joi.object({
            isResolved: Joi.boolean().required()
        });

        const { error } = schema.validate({ isResolved });
        if (error) {
            return res.status(400).json({
                message: error.details[0].message,
                error: error.details.map(i => i.message).join(", "),
                status: 400,
                success: false,
            });
        }

        const updatedIssue = await prisma.contactIssue.update({
            where: { id: parseInt(id) },
            data: { isResolved }
        });

        return res.status(200).json({
            success: true,
            message: "Contact issue updated successfully",
            status: 200,
            data: updatedIssue
        });

    } catch (error) {
        console.error("Error updating contact issue:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message
        });
    }
};

export const createBook = async (req, res) => {
    try {
        let { title, categoryIds, price, costPrice, description, type, isFree, authorId } = req.body;

        if (isFree !== undefined) {
            isFree = isFree === 'true';
            req.body.isFree = isFree;
        }

        const schema = Joi.object({
            title: Joi.string().required(),
            description: Joi.string().required(),
            categoryIds: Joi.string().required(),
            price: Joi.number().optional(),
            type: Joi.number().required(),
            isFree: Joi.boolean().optional(),
            costPrice: Joi.number().optional(),
            authorId: Joi.number().required(),
        });


        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                message: error.details.map((i) => i.message).join(", "),
                status: 400,
                success: false,
            });
        }

        const categoryIdsArray = categoryIds.split(',');

        let coverImage = null;
        let pdfUrl = null;
        let audioUrl = null;

        if (req.files) {
            if (req.files["coverImage"]) coverImage = req.files["coverImage"][0].filename;
            if (req.files["pdfUrl"]) pdfUrl = req.files["pdfUrl"][0].filename;
            if (req.files["audioUrl"]) audioUrl = req.files["audioUrl"][0].filename;
        }

        let bookMediaFiles = [];
        if (req.files && req.files["bookMedia"]) {
            bookMediaFiles = req.files["bookMedia"].map((file) => ({
                bookId: null,
                mediaUrl: file.filename,
                type: "image",
            }));
        }

        const newBook = await prisma.book.create({
            data: {
                title,
                type: parseInt(type),
                price: parseFloat(price),
                costPrice: costPrice ? parseFloat(costPrice) : null,
                description,
                coverImage,
                isFree: isFree,
                authorId: parseInt(authorId),
                pdfUrl,
                audioUrl,
                books: {
                    create: categoryIdsArray.map((categoryId) => ({
                        category: { connect: { id: parseInt(categoryId) } },
                    })),
                },
            },
            include: {
                books: true,
            },
        });

        if (bookMediaFiles.length > 0) {
            bookMediaFiles.forEach((file) => (file.bookId = newBook.id));
            await prisma.bookMedia.createMany({
                data: bookMediaFiles,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Book uploaded successfully on behalf of author",
            status: 200,
            book: newBook
        });

    } catch (error) {
        console.error("Error uploading book:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

export const editBook = async (req, res) => {
    const {
        title, categoryIds, price, costPrice, type, description, id, authorId, isFree
    } = req.body;

    if (isFree !== undefined) {
        isFree = isFree === 'true';
        req.body.isFree = isFree;
    }

    const schema = Joi.object({
        id: Joi.number().integer().required(),
        title: Joi.string().optional(),
        description: Joi.string().optional(),
        categoryIds: Joi.string().optional(),
        price: Joi.number().optional(),
        costPrice: Joi.number().optional(),
        authorId: Joi.number().optional(),
        type: Joi.number().optional(),
        isFree: Joi.boolean().optional(),
    });

    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({
            message: error.details.map(i => i.message).join(', '),
            success: false,
            status: 400,
        });
    }

    try {
        // Find existing book
        const book = await prisma.book.findUnique({
            where: { id: parseInt(id) },
            include: { bookMedia: true }
        });

        if (!book) {
            return res.status(404).json({ success: false, message: 'Book not found' });
        }

        let coverImage = book.coverImage;
        let pdfUrl = book.pdfUrl;

        let audioUrl = book.audioUrl;

        if (req.files) {
            if (req.files["coverImage"]?.[0]) coverImage = req.files["coverImage"][0].filename;
            if (req.files["pdfUrl"]?.[0]) pdfUrl = req.files["pdfUrl"][0].filename;
            if (req.files["audioUrl"]?.[0]) audioUrl = req.files["audioUrl"][0].filename;
        }


        const updateData = {
            title: title ?? book.title,
            type: type ? parseInt(type) : book.type,
            description: description ?? book.description,
            price: price !== undefined ? parseFloat(price) : book.price,
            costPrice: costPrice !== undefined ? parseFloat(costPrice) : book.costPrice,
            authorId: authorId !== undefined ? parseInt(authorId) : book.authorId,
            isFree: isFree !== undefined ? isFree : book.isFree,
            coverImage,
            pdfUrl,
            audioUrl,
        };

        const updatedBook = await prisma.book.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: { bookMedia: true }
        });


        if (req.files?.["bookMedia"]?.length > 0) {
            const newMedia = req.files["bookMedia"].map(file => ({
                mediaUrl: file.filename,
                type: file.mimetype.startsWith("image/") ? "image"
                    : file.mimetype.startsWith("audio/") ? "audio"
                        : file.mimetype === "application/pdf" ? "pdf"
                            : "other",
                bookId: updatedBook.id
            }));

            await prisma.bookMedia.createMany({
                data: newMedia
            });
        }

        if (categoryIds) {
            const categoryIdsArray = categoryIds.split(',').map(Number);

            await prisma.bookCategory.deleteMany({
                where: { bookId: parseInt(id) }
            });

            await prisma.bookCategory.createMany({
                data: categoryIdsArray.map(categoryId => ({
                    bookId: parseInt(id),
                    categoryId
                }))
            });
        }

        const finalBook = await prisma.book.findUnique({
            where: { id: parseInt(id) },
            include: { bookMedia: true }
        });


        return res.status(200).json({
            success: true,
            message: "Book updated successfully",
            updatedBook: finalBook,
            status: 200
        });

    } catch (err) {
        console.error("Error updating book:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: err.message,
            status: 500
        });
    }
};

// import { startOfDay, format, subDays } from "date-fns";

// export async function getAllUploadBook(req, res) {
//     try {
//         const days = parseInt(req.query.days) || 7;

//         const fromDate = startOfDay(subDays(new Date(), days));
//         const today = startOfDay(new Date());

//         // Fetch books from DB
//         const books = await prisma.book.findMany({
//             where: {
//                 createdAt: {
//                     gte: fromDate,
//                     lte: today,
//                 },
//             },
//             select: {
//                 createdAt: true,
//             },
//         });

//         // Count books per day
//         const dailyCountMap = {};

//         books.forEach(book => {
//             const day = format(book.createdAt, 'yyyy-MM-dd');
//             dailyCountMap[day] = (dailyCountMap[day] || 0) + 1;
//         });

//         // Build full date range with zeroes
//         const result = [];
//         for (let i = 0; i <= days; i++) {
//             const date = format(subDays(today, i), 'yyyy-MM-dd');
//             result.unshift({ date, count: dailyCountMap[date] || 0 });
//         }

//         return res.status(200).json({
//             success: true,
//             message: `Daily book upload count for last ${days} days`,
//             status: 200,
//             data: result
//         });

//     } catch (error) {
//         console.error("Error fetching daily book uploads:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             status: 500,
//             error: error.message,
//         });
//     }
// }

export async function getAllUploadBook(req, res) {
    try {
        const days = parseInt(req.query.days) || 7;

        const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000); // X days ago

        console.log('fromDate', fromDate)

        const ebook = await prisma.book.findMany({
            where: {
                createdAt: {
                    gte: fromDate, // Only fetch books created since `fromDate`
                },
            },
            orderBy: {
                id: "desc",
            },
        });

        return res.status(200).json({
            success: true,
            message: `Books from the last ${days} days fetched successfully`,
            status: 200,
            ebook,
            totalCount: ebook.length,
        });
    } catch (error) {
        console.error("Error fetching ebooks:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
}

export async function getActiveUser(req, res) {
    try {
        const days = parseInt(req.query.days) || 7;

        const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        console.log('fromDate', fromDate);

        const users = await prisma.user.findMany({
            where: {
                createdAt: {
                    gte: fromDate,
                },
            },
            orderBy: {
                id: 'desc',
            },
        });

        return res.status(200).json({
            success: true,
            message: `Users registered in the last ${days} days fetched successfully`,
            status: 200,
            users,
            totalCount: users.length,
        });

    } catch (error) {
        console.error("Error fetching users:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
}

export const deleteImage = async (req, res) => {
    try {
        const { id } = req.params;
        const schema = Joi.object({
            id: Joi.number().required(),
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

        const image = await prisma.bookMedia.findUnique({
            where: {
                id: parseInt(id),
            },
        });

        if (!image) {
            return res.status(404).json({ message: "Image not found" });
        }

        await prisma.bookMedia.delete({
            where: { id: parseInt(id) },
        });

        return res.json({
            status: 200,
            success: true,
            message: "Image deleted successfully",
        });

    } catch (error) {
        console.error("Error deleting image:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

export async function addAuthor(req, res) {
    try {
        const { fullName } = req.body;

        const schema = Joi.object({

            fullName: Joi.string().max(255).required(),
        });

        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: error.details[0].message,
            });
        }

        let data = {
            fullName,
            isCreatedByAdmin: true
        };


        if (req.files) {
            if (req.files["avatar_url"]) {
                data.avatar_url = req.files["avatar_url"][0].filename;
            }
            if (req.files["coverImage"]) {
                data.coverImage = req.files["coverImage"][0].filename;
            }
        }

        await prisma.author.create({
            data: data
        })

        return res.status(200).json({
            success: true,
            message: 'Author Created Successfully',
            status: 200
        });


    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
}

export const getAllPurchase = async (req, res) => {
    try {

        const {
            search,
            page = 1,
            limit = 10,
            bookName,
            authorName,
        } = req.query;


        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);


        const filterConditions = {
            ...(search && {
                OR: [
                    {
                        book: {
                            is: {
                                title: {
                                    contains: search,
                                },
                            },
                        },
                    },
                    {
                        author: {
                            is: {
                                fullName: {
                                    contains: search,
                                },
                            },
                        },
                    },
                ],
            }),
        };



        const purchases = await prisma.purchase.findMany({
            where: filterConditions,
            skip,
            take,
            include: {
                user: true,
                book: true,
                author: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        const totalCount = await prisma.purchase.count({
            where: filterConditions
        })

        const updatedPurchases = purchases.map((purchase) => {
            if (purchase.book) {
                purchase.book.coverImage = purchase.book.coverImage
                    ? `${baseurl}/books/${purchase.book.coverImage}`
                    : null;

                purchase.book.pdfUrl = purchase.book.pdfUrl
                    ? `${baseurl}/books/${purchase.book.pdfUrl}`
                    : null;
            }
            return purchase;
        });

        return res.status(200).json({
            status: 200,
            message: 'Purchase records fetched successfully',
            purchases: updatedPurchases,
            totalCount
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 500,
            message: 'Internal Server Error',
            success: false,
            error: error.message,
        });
    }
};

export async function getPlans(req, res) {
    try {
        const plans = await prisma.plan.findMany({
            orderBy: { id: "asc" },
        });

        return res.status(200).json({
            status: 200,
            message: 'Get All Plans',
            success: true,
            plans
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: 500,
            message: 'Internal Server Error',
            success: false,
            error: error.message
        });
    }
}

export const getAdminSalesSummary = async (req, res) => {
    try {
        const summary = await prisma.order.aggregate({
            _sum: { commissionAmount: true, price: true },
        });

        return res.status(200).json({
            status: 200,
            message: 'Get All Plans',
            success: true,
            totalRevenue: summary._sum.price || 0,
            platformEarnings: summary._sum.commissionAmount || 0,
            plans
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: 500,
            message: 'Internal Server Error',
            success: false,
            error: error.message
        });
    }
}


// export const overrideBookPrice = async (req, res) => {
//   try {
//     const { bookId } = req.params;
//     const { isFree, price } = req.body;

//     if (typeof isFree !== 'boolean') {
//       return res.status(400).json({ success: false, message: 'isFree must be a boolean.' });
//     }

//     if (!isFree && (price === undefined || price === null)) {
//       return res.status(400).json({ success: false, message: 'Price must be provided for paid books.' });
//     }

//     const dataToUpdate = { isFree };

//     // Only include price if book is not free
//     if (!isFree) {
//       dataToUpdate.price = price;
//     }

//     const book = await prisma.book.update({
//       where: { id: Number(bookId) },
//       data: dataToUpdate,
//     });

//     return res.status(200).json({
//       success: true,
//       message: 'Book price updated successfully',
//       book,
//     });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//     });
//   }
// };
