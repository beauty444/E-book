import Joi from "joi";
import jwt from 'jsonwebtoken'
import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcrypt';
import path from 'path'
import crypto from 'crypto';
import dotenv from "dotenv";
import moment from 'moment';
import stripe from '../utils/stripeClient.js';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
const baseurl = process.env.BASE_URL;
import hbs from "nodemailer-express-handlebars"
import { generateJwt, generateOTP, getAuthorStats } from "../utils/helper.js"
import { randomStringAsBase64Url } from '../utils/helper.js';
import { emitSocketEvent } from '../utils/socket.js';
import { ChatEventEnum } from '../utils/constants.js';
import { createErrorResponse, createSuccessResponse } from '../utils/responseUtil.js';
import { MessageEnum } from '../config/message.js';
import { sendNotificationRelateToQaSessionToUser, createNotificationForUser } from "../utils/notification.js";


const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

var transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
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

export async function signupWithEmail(req, res) {
    try {
        const { email, password, fullName } = req.body;

        const schema = Joi.object({
            email: Joi.string().email().required(),
            password: Joi.string().min(8).max(15).required(),
            fullName: Joi.string().max(255).required(),
        });

        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        const existingUser = await prisma.author.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Already have an account, Please Login',
            });
        }

        const act_token = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.author.create({
            data: {
                email,
                fullName,
                password: hashedPassword,
                act_token,
            },
        });

        const mailOptions = {
            from: 'ebook.0901@gmail.com',
            to: email,
            subject: 'Activate Account',
            template: 'signupemail',
            context: {
                href_url: `${baseurl}/api/author/verifyUser/${act_token}`,
                image_logo: `${baseurl}/images/ebook.png`,
                msg: `Please click below link to activate your account.`,
            },
        };
        console.log('mailOptions', mailOptions)

        transporter.sendMail(mailOptions, async (error) => {
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Mail not delivered. Please try again later.',
                });
            }
            return res.status(200).json({
                success: true,
                message: 'Email verification required. Check your inbox for a verification link.',
            });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
}

export async function verifyUserEmail(req, res) {
    try {
        const act_token = req.params.id;

        if (!act_token) {
            const message = result.error.details.map((i) => i.message).join(",");
            return res.json({
                message: result.error.details[0].message,
                error: message,
                missingParams: result.error.details[0].message,
                status: 400,
                success: false,
            });
        }
        else {
            console.log("act_token", act_token);
            const author = await prisma.author.findFirst({
                where: {
                    act_token: act_token
                }
            })
            console.log("author", author);
            if (author) {
                const updateUser = await prisma.author.update({
                    where: {
                        id: author.id
                    },
                    data: {
                        isVerified: true
                    }
                })
                console.log('updateUser', updateUser)
                if (updateUser) {
                    res.sendFile(path.join(__dirname, '../view/verify.html'));
                }
                else {
                    res.sendFile(path.join(__dirname, '../view/notverify.html'));
                }
            }
            else {
                res.sendFile(path.join(__dirname, '../view/notverify.html'));
            }
        }
    }
    catch (error) {
        console.log(error);
        res.send(`<div class="container">
          <p>404 Error, Page Not Found</p>
          </div> `);
    }
};

const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key';
export async function login(req, res) {
    try {
        console.log('req', req);

        const secretKey = process.env.SECRET_KEY;
        console.log(">>>>>>>>>>>>>>>", req.body);
        const { email, password, fcm_token } = req.body;

        const schema = Joi.alternatives(
            Joi.object({
                email: Joi.string().min(5).max(255).email({ tlds: { allow: false } }).lowercase().optional(),
                password: Joi.string().min(8).required().messages({
                    "any.required": "{{#label}} is required!!",
                    "string.empty": "can't be empty!!",
                    "string.min": "minimum 8 value required",
                    "string.max": "maximum 15 values allowed",
                }),
                fcm_token: Joi.string().optional(),
            })
        );

        const result = schema.validate({ email, password });
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
            if (email) {
                const user = await prisma.author.findUnique({
                    where: {
                        email: email,
                    },
                });

                if (!user || !(await bcrypt.compare(password, user.password))) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid login credentials",
                        status: 400,
                    });
                }

                if (user.status === 0) {
                    return res.status(403).json({
                        success: false,
                        message: "Your account has been deactivated",
                        status: 403,
                    });
                }

                if (user.isVerified === false) {
                    return res.status(400).json({
                        message: "Please verify your account",
                        status: 400,
                        success: false,
                    });
                }


                if (user.status === 0) {
                    return res.status(403).json({
                        success: false,
                        message: "Your account has been deactivated",
                        status: 403,
                    });
                }

                if (user.isVerified === false) {
                    return res.status(400).json({
                        message: "Please verify your account",
                        status: 400,
                        success: false,
                    });
                }


                if (fcm_token) {
                    await prisma.author.update({
                        where: {
                            email: email,
                        },
                        data: {
                            fcm_token: fcm_token,
                        },
                    });
                }

                const authorData = await prisma.author.findUnique({
                    where: {
                        email: email,
                    },
                });

                const token = jwt.sign({ authorId: authorData.id }, secretKey, { expiresIn: '24W' });
                return res.json({
                    status: 200,
                    success: true,
                    message: "Login successful!",
                    token: token,
                    authorData,
                });
            }
        }
    } catch (error) {
        console.log('error', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error
        });
    }
};

export async function socialLogin(req, res) {
    try {
        const { email, fullName } = req.body;
        if (!email || !fullName) {
            return res.status(400).json({ message: "Email and full name are required" });
        }

        let author = await prisma.author.findUnique({ where: { email } });

        if (!author) {
            author = await prisma.author.create({
                data: { email, fullName },
            });
        }

        const token = jwt.sign({ authorId: author.id, email: author.email }, SECRET_KEY, { expiresIn: "7d" });
        return res.status(200).json({
            success: true,
            message: "Login successful",
            status: 200,
            token, author
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

            const author = await prisma.admin.findUnique({
                where: { email }
            });

            if (!author) {
                return res.status(400).json({
                    success: false,
                    status: 400,
                    message: 'Email not registered'
                });
            }
            if (author.isVerified == 0) {
                return res.status(400).json({
                    success: false,
                    message: "Please verify your account",
                    status: 400,
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
                    await prisma.author.update({
                        where: { email },
                        data: {
                            otp: otp,
                            otpExpiration: otpExpiration
                        }
                    });
                    return res.status(200).json({
                        success: true,
                        message: "We've sent an OTP to your registered email for password reset. Please check your inbox and enter the code to continue.",
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

            console.log("userotp", user.otp)
            console.log("otp", otp)

            if (user && user.otp === otp && new Date(user.otpExpiration) > new Date()) {
                await prisma.author.update({
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

            const user = await prisma.admin.findUnique({
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
        const { email, password, phone_no } = req.body;

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
            const user = await prisma.author.update({
                where: {
                    email: email
                },
                data: {
                    password: hashedPassword
                }
            })

            return res.status(200).json({
                status: 200,
                message: 'Password Reset Successfully,You can now login',
                success: true,
                user
            })
        }
        else if (phone_no) {
            const schema = Joi.alternatives(Joi.object({
                phone_no: Joi.string().min(10).max(15).required(),
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
            const user = await prisma.author.update({
                where: {
                    phone_no: phone_no
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

        const user_id = req.user.id;

        console.log('user_id', user_id)

        const user = await prisma.author.findUnique({
            where: { id: user_id },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
                status: 404
            });
        }
        console.log("user")

        const isPasswordCorrect = await bcrypt.compare(current_password, user.password);

        console.log('isPasswordCorrect', isPasswordCorrect)
        if (!isPasswordCorrect) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect",
                status: 400
            });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);


        await prisma.author.update({
            where: { id: user_id },
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

export async function myProfile(req, res) {
    try {
        const { publishedCount, followersCount } = await getAuthorStats(req.user.id);

        const user = await prisma.author.findUnique({
            where: {
                id: req.user.id
            },
            include: {
                AuthorCategory: {
                    include: {
                        category: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: "Author not found"
            });
        }

        if (user.avatar_url) {
            user.avatar_url = `${baseurl}/books/${user.avatar_url}`;
        }

        if (user.coverImage) {
            user.coverImage = `${baseurl}/books/${user.coverImage}`;
        }
        let onboardingCompleted = false

        if (user.stripeAccountId) {
            const accountDetails = await stripe.accounts.retrieve(user.stripeAccountId);
            if (accountDetails.charges_enabled && accountDetails.payouts_enabled) {
                onboardingCompleted = true
            }
        }

        return res.status(200).json({
            status: 200,
            message: 'My Profile Data',
            success: true,
            user: { ...user, publishedCount, followersCount, onboardingCompleted }
        });

    } catch (error) {
        console.error("My Profile Error:", error);
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Internal Server Error',
            error: error.message
        });
    }
}

export async function getAllBook(req, res) {
    try {
        const { search, categories, authorId, minPrice, maxPrice } = req.query;

        const categoryIds = categories ? categories.split(',').map(id => parseInt(id.trim())) : [];

        console.log('categoryIds', categoryIds)

        const filterQuery = {
            ...(search && {
                OR: [
                    { title: { contains: search } },
                ]
            }),
            ...(authorId && {
                authorId: parseInt(authorId)
            }),
            ...(minPrice || maxPrice ? {
                price: {
                    ...(minPrice && { gte: parseFloat(minPrice) }),
                    ...(maxPrice && { lte: parseFloat(maxPrice) })
                }
            } : {}),
        };

        const books = await prisma.book.findMany({
            where: {
                authorId: req.user.id,
                ...filterQuery,
                ...(categoryIds.length > 0 && {
                    books: {
                        some: {
                            categoryId: { in: categoryIds }
                        }
                    }
                })
            },
            include: {
                author: true,
                books: {
                    include: {
                        category: true
                    }
                },
            },
            orderBy: [
                { createdAt: 'desc' },
            ],
        });

        books.map(book => {
            if (book.author && book.author.coverImage) {
                book.author.coverImage = `${baseurl}/books/${book.author.coverImage}`;
            }
            if (book.author && book.author.avatar_url) {
                book.author.avatar_url = `${baseurl}/books/${book.author.avatar_url}`;
            }
        });

        books.map((item) => {
            item.coverImage = item.coverImage ? `${baseurl}/books/${item.coverImage}` : null;
            item.pdfUrl = item.pdfUrl ? `${baseurl}/books/${item.pdfUrl}` : null;
            item.audioUrl = item.audioUrl ? `${baseurl}/books/${item.audioUrl}` : null;
            item.bookMedia = item.bookMedia ? `${baseurl}/books/${item.bookMedia}` : null;
            return item;
        });

        return res.status(200).json({
            success: true,
            message: "Books retrieved successfully",
            status: 200,
            books
        });

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

// export const getBookById = async (req, res) => {
//     const { id } = req.params;
//     try {
//         const book = await prisma.book.findUnique({
//             where: { id: parseInt(id) },
//             include: {
//                 bookMedia: true,
//                 author: {
//                     select: {
//                         id: true,
//                         fullname: true,
//                         imageUrl: true
//                     }
//                 },
//                 Purchase: {
//                     include: {
//                         user: { // Ensure you have a relation between Purchase and User in your Prisma schema
//                             select: {
//                                 id: true,
//                                 fullname: true,
//                                 imageUrl: true
//                             }
//                         }
//                     }
//                 },
//                 books: {
//                     include: {
//                         category: true
//                     }
//                 }
//             }
//         });

//         if (!book) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Book not found",
//                 status: 404
//             });
//         }

//         // Add base URL to book files
//         book.coverImage = book.coverImage ? baseurl + "/books/" + book.coverImage : null;
//         book.pdfUrl = book.pdfUrl ? baseurl + "/books/" + book.pdfUrl : null;
//         book.audioUrl = book.audioUrl ? baseurl + "/books/" + book.audioUrl : null;

//         // Add base URL to bookMedia files
//         book.bookMedia = book.bookMedia.map((item) => ({
//             ...item,
//             mediaUrl: baseurl + "/books/" + item.mediaUrl
//         }));

//         // Add base URL to author image
//         if (book.author?.imageUrl) {
//             book.author.imageUrl = baseurl + "/author/" + book.author.imageUrl;
//         }

//         // Add base URL to user avatar in Purchase
//         book.Purchase = book.Purchase.map((purchase) => {
//             if (purchase.user) {
//                 purchase.user.imageUrl = purchase.user.imageUrl
//                     ? baseurl + "/users/" + purchase.user.imageUrl
//                     : null;
//             }
//             return purchase;
//         });

//         const totalViews = await prisma.bookRead.count({
//             where: { bookId: parseInt(id) }
//         });

//         book.totalViews = totalViews;

//         return res.status(200).json({
//             success: true,
//             message: "Book retrieved successfully",
//             status: 200,
//             book
//         });

//     } catch (error) {
//         console.error("Error fetching book:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             status: 500,
//             error: error.message
//         });
//     }
// };


export const getBookById = async (req, res) => {
    const { id } = req.params;
    try {
        const book = await prisma.book.findUnique({
            where: { id: parseInt(id) },
            include: {
                bookMedia: true,
                author: true,
                Purchase: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                avatar_url: true
                            }
                        }
                    }
                },
                books: {
                    include: {
                        category: true
                    }
                }
            }
        });

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found",
                status: 404
            });
        }


        console.log('book', book)

        book.coverImage = book.coverImage ? baseurl + "/books/" + book.coverImage : null
        book.pdfUrl = book.pdfUrl ? baseurl + "/books/" + book.pdfUrl : null
        book.audioUrl = book.audioUrl ? baseurl + "/books/" + book.audioUrl : null
        console.log('book.bookMedia.mediaUrl', book.bookMedia);
        let booksMedia = book.bookMedia

        console.log('booksMedia.length ', booksMedia.length)
        if (booksMedia.length > 0) {
            booksMedia.map((item) => {
                item.mediaUrl = baseurl + "/books/" + item.mediaUrl
                return item
            })
        } else {
            booksMedia = []
        }

        const totalViews = await prisma.bookRead.count({
            where: { bookId: parseInt(id) }
        })

        // Add base URL to user avatar in Purchase
        book.Purchase = book.Purchase.map((purchase) => {
            if (purchase.user) {
                purchase.user.avatar_url = purchase.user.avatar_url
                    ? baseurl + "/books/" + purchase.user.avatar_url
                    : null;
            }
            return purchase;
        });

        book.totalViews = totalViews
        // return false
        // book.bookMedia.mediaUrl = book.bookMedia.mediaUrl ? baseurl + "/books/" + book.bookMedia.mediaUrl : null

        return res.status(200).json({
            success: true,
            message: "Books retrieved successfully",
            status: 200,
            book
        });

    } catch (error) {
        console.error("Error fetching books:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

export async function editProfile(req, res) {
    try {
        const { fullName, dob, tagline, isFree, instagram, facebook, categoryIds } = req.body;

        const schema = Joi.object({
            fullName: Joi.string().optional().allow(null, ''),
            dob: Joi.date().optional().allow(null, ''),
            tagline: Joi.string().optional().allow(null, ''),
            instagram: Joi.string().optional().allow(null, ''),
            facebook: Joi.string().optional().allow(null, ''),
            categoryIds: Joi.string().optional().allow(null, ''),
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

        const categoryIdsArray = categoryIds ? categoryIds.split(',').map(id => parseInt(id)) : [];

        let updateData = {
            fullName,
            dob,
            tagline,
            instagram,
            facebook,
            // fullName: fullName !== undefined ? fullName : req.user.fullName,
            // dob: dob !== undefined ? new Date(dob) : req.user.dob,
            // tagline : tagline ? tagline : req.user.tagline,
            // instagram : instagram ? instagram : req.user.instagram, 
            // facebook: facebook ? facebook : req.user.facebook,
        };

        if (req.files) {
            if (req.files["avatar_url"]) {
                updateData.avatar_url = req.files["avatar_url"][0].filename;
            }
            if (req.files["coverImage"]) {
                updateData.coverImage = req.files["coverImage"][0].filename;
            }
        }

        await prisma.author.update({
            where: { id: req.user.id },
            data: updateData,
        });

        await prisma.authorCategory.deleteMany({
            where: { authorId: req.user.id },
        });
        await prisma.authorCategory.createMany({
            data: categoryIdsArray.map((categoryId) => ({
                authorId: req.user.id,
                categoryId,
            })),
        });

        const updatedUser = await prisma.author.findUnique({
            where: { id: req.user.id },
            include: {
                AuthorCategory: {
                    include: { category: true },
                },
            },
        });

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            status: 200,
            user: updatedUser,
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

export const createBook = async (req, res) => {
    try {
        let {
            title,
            categoryIds,
            price,
            costPrice,
            description,
            type,
            isFree,
        } = req.body;


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
                authorId: req.user.id,
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
            message: "Book uploaded successfully",
            status: 200,
            book: newBook,
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


export const getReview = async (req, res) => {
    try {
        const authorId = req.user.id;

        const {
            search,
            page = 1,
            limit = 10,
            startDate,
            endDate,
            rating,
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const filterConditions = {
            book: {
                authorId: authorId,
                ...(search && {
                    title: {
                        contains: search,
                    },
                }),
            },
            ...(rating && {
                rating: parseFloat(rating),
            }),
            ...(startDate || endDate
                ? {
                    createdAt: {
                        ...(startDate && { gte: new Date(startDate) }),
                        ...(endDate && { lte: new Date(endDate) }),
                    },
                }
                : {}),
        };


        const reviews = await prisma.review.findMany({
            where: filterConditions,
            skip,
            take,
            include: {
                book: true,
                user: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return res.status(200).json({
            success: true,
            message: "Fetched reviews with filters & pagination",
            status: 200,
            reviews,
            totalCount: reviews.length
        });

    } catch (error) {
        console.error("Error fetching reviews:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};


// export const getReview = async (req, res) => {
//     try {

//         const authorId = req.user.id;

//         const reviews = await prisma.review.findMany({
//             where: {
//                 book: {
//                     authorId: authorId
//                 }
//             },
//             include: {
//                 book: true,
//                 user: true
//             }
//         });

//         return res.status(200).json({
//             success: true,
//             message: "Fetched all reviews for author's books",
//             status: 200,
//             reviews
//         });

//     } catch (error) {
//         console.error("Error fetching reviews:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             status: 500,
//             error: error.message,
//         });
//     }
// };
// export const createBook = async (req, res) => {
//     try {
//         const { title, categoryIds, price, costPrice, description, type, stock, isFree } = req.body;

//         const schema = Joi.object({
//             title: Joi.string().required(),
//             description: Joi.string().required(),
//             categoryIds: Joi.string().required(),
//             price: Joi.number().required(),
//             type: Joi.number().required(),
//             isFree: Joi.boolean().optional(),
//             costPrice: Joi.number().optional(),
//             stock: Joi.number().required(),
//         });

//         const { error } = schema.validate(req.body);
//         if (error) {
//             return res.status(400).json({
//                 message: error.details.map((i) => i.message).join(", "),
//                 status: 400,
//                 success: false,
//             });
//         }

//         const categoryIdsArray = categoryIds.split(',');

//         let coverImage = null;
//         let pdfUrl = null;
//         let audioUrl = null;

//         if (req.files) {
//             if (req.files["coverImage"]) coverImage = req.files["coverImage"][0].filename;
//             if (req.files["pdfUrl"]) pdfUrl = req.files["pdfUrl"][0].filename;
//             if (req.files["audioUrl"]) audioUrl = req.files["audioUrl"][0].filename;
//         }

//         let bookMediaFiles = [];
//         if (req.files && req.files["bookMedia"]) {
//             bookMediaFiles = req.files["bookMedia"].map((file) => ({
//                 bookId: null,
//                 mediaUrl: file.filename,
//                 type: "image",
//             }));
//         }

//         const newBook = await prisma.book.create({
//             data: {
//                 title,
//                 type: parseInt(type),
//                 price: parseFloat(price),
//                 costPrice: costPrice ? parseFloat(costPrice) : null,
//                 stock: parseInt(stock),
//                 description,
//                 coverImage,
//                 isFree,
//                 authorId: req.user.id,
//                 pdfUrl,
//                 audioUrl,
//                 books: {
//                     create: categoryIdsArray.map((categoryId) => ({
//                         category: { connect: { id: parseInt(categoryId) } },
//                     })),
//                 },
//             },
//             include: {
//                 books: true,
//             },
//         });

//         if (bookMediaFiles.length > 0) {
//             bookMediaFiles.forEach((file) => (file.bookId = newBook.id));
//             await prisma.bookMedia.createMany({
//                 data: bookMediaFiles,
//             });
//         }

//         return res.status(200).json({
//             success: true,
//             message: "Book uploaded successfully",
//             status: 200,
//             book: newBook
//         });

//     } catch (error) {
//         console.error("Error uploading book:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             status: 500,
//             error: error.message,
//         });
//     }
// };

export const editBook = async (req, res) => {
    try {
        let {
            title,
            categoryIds,
            price,
            costPrice,
            type,
            description,
            isFree,
            id,
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
            type: Joi.number().optional(),
            isFree: Joi.boolean().optional(),
        });

        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                message: error.details.map((i) => i.message).join(', '),
                success: false,
                status: 400,
            });
        }

        const book = await prisma.book.findUnique({
            where: { id: parseInt(id) },
        });

        if (!book) {
            return res.status(404).json({ success: false, message: 'Book not found' });
        }

        let coverImage = book.coverImage;
        let pdfUrl = book.pdfUrl;
        let audioUrl = book.audioUrl;

        if (req.files) {
            if (req.files["coverImage"]) coverImage = req.files["coverImage"][0].filename;
            if (req.files["pdfUrl"]) pdfUrl = req.files["pdfUrl"][0].filename;
            if (req.files["audioUrl"]) audioUrl = req.files["audioUrl"][0].filename;
        }

        const updateData = {
            title: title ?? book.title,
            type: type ? parseInt(type) : book.type,
            description: description ?? book.description,
            price: price !== undefined ? parseFloat(price) : book.price,
            costPrice: costPrice !== undefined ? parseFloat(costPrice) : book.costPrice,
            isFree: isFree !== undefined ? isFree : book.isFree,
            coverImage,
            pdfUrl,
            audioUrl,
        };

        const updatedBook = await prisma.book.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        if (req.files?.["bookMedia"]?.length > 0) {
            const bookMediaFiles = req.files["bookMedia"].map((file) => ({
                bookId: updatedBook.id,
                mediaUrl: file.filename,
                type: "image",
            }));

            await prisma.bookMedia.createMany({
                data: bookMediaFiles,
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
            include: { bookMedia: true, books: true }
        });

        return res.status(200).json({
            success: true,
            message: "Book updated successfully",
            updatedBook: finalBook,
            status: 200,
        });

    } catch (err) {
        console.error("Error updating book:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: err.message,
            status: 500,
        });
    }
};


// export const editBook = async (req, res) => {
//     const {
//         title, categoryIds, price, costPrice, type, description, id,
//     } = req.body;


//     const schema = Joi.object({
//         title: Joi.string().optional(),
//         description: Joi.string().optional(),
//         categoryIds: Joi.string().optional(),
//         price: Joi.number().optional(),
//         costPrice: Joi.number().optional(),
//         stock: Joi.number().optional(),
//         type: Joi.number().optional(),
//         id: Joi.number().integer().required()
//     });

//     const { error } = schema.validate(req.body);
//     if (error) {
//         return res.status(400).json({
//             message: error.details.map(i => i.message).join(', '),
//             success: false,
//             status: 400,
//         });
//     }

//     try {
//         // Find existing book
//         const book = await prisma.book.findUnique({
//             where: { id: parseInt(id) },
//             include: { bookMedia: true }
//         });

//         if (!book) {
//             return res.status(404).json({ success: false, message: 'Book not found' });
//         }

//         let coverImage = book.coverImage;
//         let pdfUrl = book.pdfUrl;

//         let audioUrl = book.audioUrl;

//         if (req.files) {
//             if (req.files["coverImage"]?.[0]) coverImage = req.files["coverImage"][0].filename;
//             if (req.files["pdfUrl"]?.[0]) pdfUrl = req.files["pdfUrl"][0].filename;
//             if (req.files["audioUrl"]?.[0]) audioUrl = req.files["audioUrl"][0].filename;
//         }


//         const updateData = {
//             title: title ?? book.title,
//             type: type ? parseInt(type) : book.type,
//             description: description ?? book.description,
//             price: price !== undefined ? parseFloat(price) : book.price,
//             costPrice: costPrice !== undefined ? parseFloat(costPrice) : book.costPrice,
//             stock: stock !== undefined ? parseInt(stock) : book.stock,
//             coverImage,
//             pdfUrl,
//             audioUrl,
//         };

//         const updatedBook = await prisma.book.update({
//             where: { id: parseInt(id) },
//             data: updateData,
//             include: { bookMedia: true }
//         });


//         if (req.files?.["bookMedia"]?.length > 0) {
//             const newMedia = req.files["bookMedia"].map(file => ({
//                 mediaUrl: file.filename,
//                 type: file.mimetype.startsWith("image/") ? "image"
//                     : file.mimetype.startsWith("audio/") ? "audio"
//                         : file.mimetype === "application/pdf" ? "pdf"
//                             : "other",
//                 bookId: updatedBook.id
//             }));

//             await prisma.bookMedia.createMany({
//                 data: newMedia
//             });
//         }

//         if (categoryIds) {
//             const categoryIdsArray = categoryIds.split(',').map(Number);

//             await prisma.bookCategory.deleteMany({
//                 where: { bookId: parseInt(id) }
//             });

//             await prisma.bookCategory.createMany({
//                 data: categoryIdsArray.map(categoryId => ({
//                     bookId: parseInt(id),
//                     categoryId
//                 }))
//             });
//         }

//         const finalBook = await prisma.book.findUnique({
//             where: { id: parseInt(id) },
//             include: { bookMedia: true }
//         });


//         return res.status(200).json({
//             success: true,
//             message: "Book updated successfully",
//             updatedBook: finalBook,
//             status: 200
//         });

//     } catch (err) {
//         console.error("Error updating book:", err);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             error: err.message,
//             status: 500
//         });
//     }
// };

export const deleteBook = async (req, res) => {
    try {
        const { id } = req.params;
        const schema = Joi.alternatives(
            Joi.object({
                id: Joi.number().required(),
            })
        )
        console.log("param", req.params)
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

        const book = await prisma.book.findUnique({
            where: {
                id: parseInt(id)
            }
        })
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        await prisma.book.delete({
            where: { id: parseInt(id) }
        });
        return res.json({
            status: 200,
            success: true,
            message: "Book Deleted successfully",
        })

    } catch (error) {
        console.error("Error fetching books:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

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

export const addToCart = async (req, res) => {
    const { userId, bookId, quantity } = req.body;

    try {

        const existingCartItem = await prisma.cart.findUnique({
            where: {
                userId_bookId: { userId, bookId },
            },
        });

        if (existingCartItem) {

            const updatedCart = await prisma.cart.update({
                where: { id: existingCartItem.id },
                data: { quantity: existingCartItem.quantity + quantity },
            });
            return res.json({ message: "Quantity updated", cart: updatedCart });
        }

        const cartItem = await prisma.cart.create({
            data: {
                userId,
                bookId,
                quantity,
            },
        });
        return res.status(200).json({
            success: true,
            message: "Cart added successfully",
            status: 200,
            cart: cartItem
        });

    } catch (error) {
        console.error("Error fetching books:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

export async function getAllCategories(req, res) {
    try {
        const categories = await prisma.category.findMany({
            include: {
                books: {
                    include: {
                        book: true,
                    },
                },
            },
        });

        await Promise.all(
            categories.map(async (category) => {
                await Promise.all(
                    category.books.map(async (item) => {
                        if (item.book) {
                            item.book.coverImage = item.book.coverImage
                                ? baseurl + "/books/" + item.book.coverImage
                                : null;
                            item.book.pdfUrl = item.book.pdfUrl
                                ? baseurl + "/books/" + item.book.pdfUrl
                                : null;
                            item.book.audioUrl = item.book.audioUrl
                                ? baseurl + "/books/" + item.book.audioUrl
                                : null;
                        }
                    })
                );
            })
        );

        return res.status(200).json({
            success: true,
            message: "Categories retrieved successfully",
            status: 200,
            categories
        });

    } catch (error) {
        console.error("Error fetching books:", error);
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
        const authorId = req.user.id;

        // Get all book IDs of the author
        const authorBooks = await prisma.book.findMany({
            where: { authorId },
            select: { id: true }
        });

        const bookIds = authorBooks.map(book => book.id);

        // Total Views on Author's Books
        const totalViews = await prisma.bookRead.count({
            where: { bookId: { in: bookIds } }
        });

        console.log('totalViews', totalViews)

        // Total Books Count
        const totalBooks = authorBooks.length;

        // Total Reviews on Author's Books
        const totalReviews = await prisma.review.count({
            where: { bookId: { in: bookIds } }
        });

        // Total Earnings from Purchases of Author's Books
        const purchases = await prisma.purchase.findMany({
            where: { bookId: { in: bookIds } },
            select: { amount: true }
        });

        console.log("Book IDs:", bookIds);

        console.log('purchases', purchases)

        const totalEarning = purchases.reduce((sum, p) => sum + p.amount, 0);

        console.log('totalEarning', totalEarning)

        // Optional: Held Amount logic (if you use it)
        const heldAmountResult = await prisma.purchase.aggregate({
            where: { bookId: { in: bookIds }, isHeld: true },
            _sum: { amount: true }
        });

        const totalChatrooms = await prisma.chat.count({
            where: {
                OR: [
                    { adminId: req.user.id },
                    {
                        participants: {
                            some: {
                                authorId: req.user.id
                            }
                        }
                    }
                ]
            },


        })

        const uniqueBooksPurchased = await prisma.purchase.groupBy({
            by: ['bookId'],
            where: {
                authorId: authorId
            }
        });


        const totalSales = await prisma.purchase.findMany({
            where: {
                authorId: req.user.id
            },
            include: {
                book: true,
                user: true
            },
            orderBy: { createdAt: 'desc' },
        })

        const uniqueBooksPurchasedCount = uniqueBooks.length;

        const heldAmount = heldAmountResult._sum.amount || 0;

        return res.status(200).json({
            success: true,
            message: "Dashboard retrieved successfully",
            status: 200,
            data: {
                totalViews,
                totalBooks,
                totalReviews,
                totalEarning,
                totalChatrooms,
                uniqueBooksPurchasedCount,
                totalSales
            }
        });



    } catch (error) {
        console.error('Dashboard Error:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message
        });
    }
};

// export const getdashboard = async (req, res) => {
//     try {
//         const authorId = req.user.id;

//         const bookIds = (await prisma.book.findMany({
//             where: {
//                 authorId: authorId
//             }
//         })).map((item) => item.id)

//         const totalViews = await prisma.bookRead.count({
//             where: {
//                 bookId: {
//                     in: bookIds
//                 }
//             }
//         });

//         console.log('totalViews', totalViews)

//         const books = await prisma.book.count({
//             where: {
//                 authorId: authorId
//             }
//         });

//         console.log('books', books)

//         const totalEarning = 0
//         const review = await prisma.review.count({
//             where: {
//                 userId: authorId
//             }
//         })

//         console.log('review', review)

//         return res.status(200).json({
//             success: true,
//             message: "Dashboard retrieved successfully",
//             status: 200,
//             totalViews, books,
//             review, totalEarning
//         });

//     } catch (error) {
//         console.log('error', error)
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             status: 500,
//             error
//         });
//     }
// };

export async function getAllAuthorNotification(req, res) {
    try {
        const notifications = await prisma.authorNotification.findMany({
            where: {
                toAuthorId: req.user.id
            },
            include: {
                byUser: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        await Promise.all(
            notifications.map(async (notification) => {
                if (notification.byUser) {
                    notification.byUser.avatar_url = notification.byUser.avatar_url
                        ? baseurl + "/books/" + notification.byUser.avatar_url
                        : null;
                    notification.byUser.coverImage = notification.byUser.coverImage
                        ? baseurl + "/books/" + notification.byUser.coverImage
                        : null;
                    notification.byUser.pdfUrl = notification.byUser.pdfUrl
                        ? baseurl + "/books/" + notification.byUser.pdfUrl
                        : null;
                    notification.byUser.audioUrl = notification.byUser.audioUrl
                        ? baseurl + "/books/" + notification.byUser.audioUrl
                        : null;
                }
            })
        );

        return res.status(200).json({
            status: 200,
            success: true,
            message: "Notifications fetched successfully",
            data: notifications
        });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return res.status(500).json({
            status: 500,
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
}

export async function deleteNotification(req, res) {
    try {
        let { notificationId } = req.params;

        notificationId = parseInt(notificationId);

        const notification = await prisma.authorNotification.findUnique({
            where: {
                id: notificationId,
                toAuthorId: req.user.id
            }
        })

        if (!notification) {
            return res.status(400).json({
                status: 400,
                message: 'Notification Not found',
                success: false,
            })
        }
        await prisma.authorNotification.delete({
            where: {
                id: notificationId,
                toAuthorId: req.user.id
            }
        })
        return res.status(200).json({
            status: 200,
            message: 'Notification Deleted',
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

export async function deleteAllNotification(req, res) {
    try {
        const result = await prisma.authorNotification.deleteMany({
            where: {
                toAuthorId: req.user.id
            }
        });

        return res.status(200).json({
            status: 200,
            message: 'Notifications Deleted',
            success: true,
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
};

// export async function getAllFollwedUser(req, res) {
//     try {
//         // Assuming the author is the logged-in user
//         const authorId = req.user.id;

//         console.log('authorId', authorId)

//         const followers = await prisma.follow.findMany({
//             where: {
//                 followingId: authorId,
//                 isFollowed: true
//             },
//             include: {
//                 follower: true
//             }
//         });
//         console.log('followers', followers)

//         const usersFollowing = followers.map(f => f.follower);

//         return res.status(200).json({
//             success: true,
//             message: "Users who follow the author retrieved successfully",
//             status: 200,
//             users: usersFollowing,
//         });

//     } catch (error) {
//         console.error("Error fetching followers:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             status: 500,
//             error: error.message,
//         });
//     }
// }

export async function getAllFollwedUser(req, res) {
    try {
        const authorId = req.user.id;

        console.log('authorId', authorId);

        const followers = await prisma.follow.findMany({
            where: {
                followingId: authorId,
                isFollowed: true
            },
            include: {
                follower: true
            }
        });

        console.log('followers', followers);

        const usersFollowing = followers.map(f => {
            const user = f.follower;

            if (user && user.avatar_url) {
                user.avatar_url = `${baseurl}/books/${user.avatar_url}`;
            }

            return user;
        });

        return res.status(200).json({
            success: true,
            message: "Users who follow the author retrieved successfully",
            status: 200,
            users: usersFollowing,
        });

    } catch (error) {
        console.error("Error fetching followers:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

export async function createOrGetAOneOnOneChat(req, res) {
    const { receiverId } = req.params;
    const authorId = req.user.id;

    console.log('userId:', receiverId);

    const schema = Joi.object({
        receiverId: Joi.number().required(),
    });

    const { error } = schema.validate(req.params);
    if (error) {
        return res.status(400).json({ message: error.details[0].message, success: false });
    }

    try {
        const receiver = await prisma.user.findUnique({ where: { id: parseInt(receiverId) } });
        if (!receiver) {
            return createErrorResponse(res, 404, MessageEnum.USER_NOT_FOUND);
        }

        console.log('receiver', receiver)

        if (receiver.avatar_url) {
            receiver.avatar_url = `${baseurl}/books/${receiver.avatar_url}`
        }
        if (receiver.coverImage) {
            receiver.coverImage = `${baseurl}/books/${receiver.coverImage}`
        }

        const existingChat = await prisma.chat.findFirst({
            where: {
                isGroupChat: false,
                participants: {
                    every: {
                        authorId: authorId,
                        userId: parseInt(receiverId),
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
        const newChat = await prisma.chat.create({
            data: {
                name: "One-on-One Chat",
                isGroupChat: false,
                participants: {
                    create: [
                        { userId: parseInt(receiverId) },
                        { authorId: authorId }
                    ]
                }
            },
            include: { participants: true }
        });

        console.log('newChat', newChat)

        const payload = {
            ...newChat,
            participants: [receiver]
        };

        payload.participants.forEach(participant => {
            emitSocketEvent(req, participant.id.toString(), ChatEventEnum.NEW_CHAT_EVENT, payload);
        });
        return createSuccessResponse(res, 201, true, MessageEnum.CHAT_CREATE, payload)

    } catch (error) {
        console.log(error);
        return createErrorResponse(res, 500, MessageEnum.INTERNAL_SERVER_ERROR);

    }
};

export async function getAllChats(req, res) {
    try {
        const chats = await prisma.chat.findMany({
            where: {
                participants: {
                    some: { authorId: req.user.id },
                }
            },
            include: {
                participants: {
                    include: {
                        User: true,
                        Author: true
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

        // Append full URLs to images
        await Promise.all(
            chats.map(chat => {
                if (chat.profilePic) {
                    chat.profilePic = `${baseurl}/books/${chat.profilePic}`;
                }

                chat.participants.map(participant => {
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

        // Add unread counts
        await Promise.all(chats.map(async (chat) => {
            const unreadCountData = await prisma.authorUnreadCount.findFirst({
                where: {
                    chatId: chat.id,
                    authorId: req.user.id
                }
            });
            chat.unreadCount = unreadCountData ? unreadCountData.unreadCount : 0;
        }));

        const filteredChats = chats.map(chat => {
            if (chat.isGroupChat) {
                return chat;
            }

            return {
                ...chat,
                participants: chat.participants.filter(participant => participant.authorId !== req.user.id)
            };
        });

        return createSuccessResponse(res, 200, true, MessageEnum.ALL_CHATS, filteredChats);

    } catch (error) {
        console.log("Get All Chats Error:", error);
        return createErrorResponse(res, 500, MessageEnum.INTERNAL_SERVER_ERROR);
    }
};

// export async function getAllChats(req, res) {
//     try {
//         const chats = await prisma.chat.findMany({
//             where: {
//                 participants: {
//                     some:
//                         { authorId: req.user.id },
//                 }
//             },
//             include: {
//                 participants: {
//                     include: {
//                         User: true
//                     },
//                 },
//                 lastMessage: true,
//             }, orderBy: {
//                 lastMessage: {
//                     updatedAt: 'desc'
//                 }
//             }
//         })

//         // if (chats.profilePic) {
//         //     chats.profilePic = `${baseurl}/books/${chats.profilePic}`;
//         // }



//         await Promise.all(
//             chats.map(chat => {
//                 chats.profilePic = `${baseurl}/books/${chats.profilePic}`;
//                 chat.participants.map(participant => {
//                     if (participant.User) {
//                         participant.User.avatar_url = participant.User.avatar_url
//                             ? `${baseurl}/books/${participant.User.avatar_url}`
//                             : null;
//                         participant.User.coverImage = participant.User.coverImage
//                             ? `${baseurl}/books/${participant.User.coverImage}`
//                             : null;
//                         participant.User.pdfUrl = participant.User.pdfUrl
//                             ? `${baseurl}/books/${participant.User.pdfUrl}`
//                             : null;
//                         participant.User.audioUrl = participant.User.audioUrl
//                             ? `${baseurl}/books/${participant.User.audioUrl}`
//                             : null;
//                     }
//                 })
//             }
//             )
//         );

//         await Promise.all(chats.map(async (chat) => {
//             const unreadCountData = await prisma.authorUnreadCount.findFirst({
//                 where: {
//                     chatId: chat.id,
//                     authorId: req.user.id
//                 }
//             });
//             chat.unreadCount = unreadCountData ? unreadCountData.unreadCount : 0;
//         }));

//         const filteredChats = chats.map(chat => ({
//             ...chat,
//             participants: chat.participants.filter(participant => participant.authorId !== req.user.id)
//         }));

//         return createSuccessResponse(res, 200, true, MessageEnum.ALL_CHATS, filteredChats)
//     } catch (error) {
//         console.log(error);
//         createErrorResponse(res, 500, MessageEnum.INTERNAL_SERVER_ERROR);
//     }
// };

// export async function createGroupChat(req, res) {
//     const { receiverIds, chatName } = req.body;

//     // Validation schema
//     const schema = Joi.object({
//         receiverIds: Joi.array().items(Joi.number()).optional(), // At least one user required
//         chatName: Joi.string().required()
//     });

//     // Validate request body
//     const result = schema.validate(req.body);
//     if (result.error) {
//         return res.status(400).json({
//             message: result.error.details[0].message,
//             status: 400,
//             success: false,
//         });
//     }

//     try {
//         // Ensure the sender (author) is an author, not a user
//         const author = await prisma.author.findUnique({
//             where: { id: req.user.id }
//         });

//         if (!author) {
//             return res.status(403).json({
//                 success: false,
//                 message: "Only authors can create a group chat.",
//                 status: 403
//             });
//         }

//         if (receiverIds.length <= 0) {

//             let participantsData = []

//             // Add the author
//             participantsData.push({ authorId: req.user.id });


//             const newChat = await prisma.chat.create({
//                 data: {
//                     name: chatName,
//                     adminId: req.user.id, // Author is the admin
//                     isGroupChat: true,
//                     participants: {
//                         create: participantsData
//                     }
//                 },
//                 include: {
//                     participants: {
//                         include: {
//                             User: true,
//                             Author: true
//                         }
//                     }
//                 }
//             });

//         }

//         else {
//             const users = await prisma.user.findMany({
//                 where: { id: { in: receiverIds } }
//             });
//             const participantsData = receiverIds.map(userId => ({
//                 userId
//             }));

//             // Add the author
//             participantsData.push({ authorId: req.user.id });



//             // Create the group chat
//             const newChat = await prisma.chat.create({
//                 data: {
//                     name: chatName,
//                     adminId: req.user.id, // Author is the admin
//                     isGroupChat: true,
//                     participants: {
//                         create: participantsData
//                     }
//                 },
//                 include: {
//                     participants: {
//                         include: {
//                             User: true,
//                             Author: true
//                         }
//                     }
//                 }
//             });


//             // Notify participants via socket event
//             newChat.participants.forEach(participant => {
//                 emitSocketEvent(req, participant.id.toString(), ChatEventEnum.NEW_CHAT_EVENT, newChat);
//             });
//         }

//         return res.status(200).json({
//             success: true,
//             message: "Group chat created successfully",
//             status: 200,
//         });

//     } catch (error) {
//         console.error("Create Group Chat Error:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             status: 500,
//             error: error.message,
//         });
//     }
// };

export async function createGroupChat(req, res) {
    const { receiverIds, name, description } = req.body;

    // Handle receiverIds as a comma-separated string
    const parsedReceiverIds = receiverIds ? receiverIds.split(',').map(id => parseInt(id.trim(), 10)) : [];

    // Validation schema
    const schema = Joi.object({
        receiverIds: Joi.array().items(Joi.number()).optional(),
        name: Joi.string().required(),
        description: Joi.string().optional(),
    });

    // Validate request body
    const result = schema.validate({
        receiverIds: parsedReceiverIds, // Use parsedReceiverIds here
        name,
        description
    });

    if (result.error) {
        return res.status(400).json({
            message: result.error.details[0].message,
            status: 400,
            success: false,
        });
    }

    try {
        // Ensure the sender (author) is an author
        const author = await prisma.author.findUnique({
            where: { id: req.user.id }
        });

        if (!author) {
            return res.status(403).json({
                success: false,
                message: "Only authors can create a group chat.",
                status: 403
            });
        }

        let participantsData = [{ authorId: req.user.id }]; // Add the author

        if (parsedReceiverIds && parsedReceiverIds.length > 0) {
            const users = await prisma.user.findMany({
                where: { id: { in: parsedReceiverIds } }
            });

            participantsData = [
                ...participantsData,
                ...parsedReceiverIds.map(userId => ({ userId }))
            ];
        }

        let filename = null;
        if (req.file) {
            filename = req.file.filename;
        }

        const newChat = await prisma.chat.create({
            data: {
                name: name,
                description,
                profilePic: filename,
                adminId: req.user.id,
                isGroupChat: true,
                participants: {
                    create: participantsData
                }
            },
            include: {
                participants: {
                    include: {
                        User: true,
                        Author: true
                    }
                }
            }
        });

        if (newChat.profilePic) {
            newChat.profilePic = `${baseurl}/books/${newChat.profilePic}`;
        }

        // Emit socket event to all participants
        newChat.participants.forEach(participant => {
            emitSocketEvent(req, participant.id.toString(), ChatEventEnum.NEW_CHAT_EVENT, newChat);
        });

        return res.status(200).json({
            success: true,
            message: "Group chat created successfully",
            status: 200,
            data: newChat
        });

    } catch (error) {
        console.error("Create Group Chat Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

export const editGroupChat = async (req, res) => {
    const { name, description } = req.body;
    const chatId = parseInt(req.params.id);

    const schema = Joi.object({
        name: Joi.string().optional(),
        description: Joi.string().optional(),
    });

    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({
            message: error.details.map(i => i.message).join(", "),
            status: 400,
            success: false,
        });
    }

    try {
        const groupChat = await prisma.chat.findUnique({
            where: { id: chatId },
        });

        if (!groupChat) {
            return createErrorResponse(res, 404, 'Group Chat not found');
        }

        const updatedData = {
            name: name ?? groupChat.name,
            description: description ?? groupChat.description,
        };

        if (req.file) {
            updatedData.profilePic = req.file.filename;
        }

        const updatedGroupChat = await prisma.chat.update({
            where: { id: chatId },
            data: updatedData,
        });

        return createSuccessResponse(res, 200, true, MessageEnum.UPDATED_GROUP_CHAT, updatedGroupChat);
    } catch (err) {
        console.error(err);
        return createErrorResponse(res, 500, MessageEnum.INTERNAL_SERVER_ERROR);
    }
};

export async function deleteGroupChat(req, res) {
    const { chatId } = req.params;

    try {
        const chat = await prisma.chat.findUnique({
            where: { id: parseInt(chatId) },
        });

        if (!chat || !chat.isGroupChat) {
            return res.status(404).json({
                success: false,
                message: "Group chat not found",
                status: 404,
            });
        }

        const author = await prisma.author.findUnique({
            where: { id: req.user.id },
        });

        if (!author) {
            return res.status(403).json({
                success: false,
                message: "Only authors can delete group chats",
                status: 403,
            });
        }

        await prisma.chatMessage.deleteMany({
            where: { chatId: parseInt(chatId) },
        });

        await prisma.chatParticipant.deleteMany({
            where: { chatId: parseInt(chatId) },
        });

        await prisma.chat.delete({
            where: { id: parseInt(chatId) },
        });

        // Optional: Emit socket event to participants
        // emitSocketEvent(req, `chat_${chatId}`, ChatEventEnum.CHAT_DELETED_EVENT, { chatId });

        return res.status(200).json({
            success: true,
            message: "Group chat deleted successfully",
            status: 200,
        });

    } catch (error) {
        console.error("Delete Group Chat Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
}

export async function addMemberInTeam(req, res) {
    const { receiverIds, chatId } = req.body;

    // Validation schema for the request body
    const schema = Joi.object({
        receiverIds: Joi.array().items(Joi.number()).required(),
        chatId: Joi.number().required()
    });

    // Validate the request body
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

    try {

        const chat = await prisma.chat.findUnique({
            where: {
                id: parseInt(chatId),
                adminId: req.user.id
            },
            include: {
                participants: true
            }
        })

        console.log('chat', chat)

        if (!chat) {
            return createErrorResponse(res, 400, MessageEnum.CHAT_NOT_FOUND)
        }

        // await Promise.all(receiverIds.map(async (id) => {
        //     const user = await prisma.user.findUnique({
        //         where: {
        //             id: id
        //         }
        //     });
        //     if (!user) {
        //         return createErrorResponse(res, 404, MessageEnum.USER_NOT_FOUND)
        //     }
        // }))

        const members = chat.participants.filter(participant =>
            participant.authorId !== req.user.id
        );
        const memberIds = members.map((member) => member.userId
        )

        for (let i = 0; i < receiverIds.length; i++) {
            if (memberIds.includes(receiverIds[i])) {
                return createErrorResponse(res, 400, MessageEnum.MEMBER_EXISTS)
            }
        }

        // Build the participants array with the coach and all specified users
        const participantsData = receiverIds.map(id => ({
            userId: id,
        }));
        console.log('participantsData', participantsData)

        // Create a new group chat
        const newChat = await prisma.chat.update({
            where: {
                id: parseInt(chatId)
            },
            data: {
                participants: {
                    create: participantsData
                }
            },
            include: {
                participants: {
                    include: {
                        User: true,
                        Author: true
                    }
                }
            }
        });

        // Emit socket event to inform participants about the new chat
        newChat.participants.forEach(participant => {
            emitSocketEvent(req, participant.id.toString(), ChatEventEnum.NEW_CHAT_EVENT, newChat);
        });

        // Send success response
        return createSuccessResponse(res, 201, true, MessageEnum.CHAT_MEMBERS_ADDED, newChat);
    } catch (error) {
        console.log(error);
        return createErrorResponse(res, 500, MessageEnum.INTERNAL_SERVER_ERROR);
    }
}

export async function removeMemberFromTeam(req, res) {
    const { chatId, receiverIds } = req.params;

    const schema = Joi.object({
        chatId: Joi.number().required(),
        receiverIds: Joi.string().required(), // because it will be comma separated
    });

    const result = schema.validate(req.params);
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

    const receiverIdArray = receiverIds.split(',').map(id => parseInt(id.trim())); // converting to array of numbers

    try {
        const chat = await prisma.chat.findUnique({
            where: {
                id: parseInt(chatId),
                adminId: req.user.id
            },
            include: {
                participants: true
            }
        });

        if (!chat) {
            return createErrorResponse(res, 400, MessageEnum.CHAT_NOT_FOUND);
        }

        const memberIds = chat.participants.map(participant => participant.userId);

        for (let i = 0; i < receiverIdArray.length; i++) {
            if (!memberIds.includes(receiverIdArray[i])) {
                return createErrorResponse(res, 400, MessageEnum.MEMBER_NOT_IN_CHAT);
            }
        }

        await prisma.chat.update({
            where: {
                id: parseInt(chatId)
            },
            data: {
                participants: {
                    deleteMany: receiverIdArray.map(id => ({
                        userId: id
                    }))
                }
            },
            include: {
                participants: {
                    include: {
                        User: true,
                        Author: true
                    }
                }
            }
        });

        return createSuccessResponse(res, 200, true, MessageEnum.CHAT_MEMBER_REMOVED, { chatId, removedMembers: receiverIdArray });
    } catch (error) {
        console.log(error);
        return createErrorResponse(res, 500, MessageEnum.INTERNAL_SERVER_ERROR);
    }
}

// export async function removeMemberFromTeam(req, res) {
//     const { receiverIds, chatId } = req.body;

//     // Validation schema for the request body
//     const schema = Joi.object({
//         receiverIds: Joi.array().items(Joi.number()).required(),
//         chatId: Joi.number().required()
//     });

//     // Validate the request body
//     const result = schema.validate(req.body);
//     if (result.error) {
//         const message = result.error.details.map((i) => i.message).join(",");
//         return res.status(400).json({
//             message: result.error.details[0].message,
//             error: message,
//             missingParams: result.error.details[0].message,
//             status: 400,
//             success: false,
//         });
//     }

//     try {
//         const chat = await prisma.chat.findUnique({
//             where: {
//                 id: parseInt(chatId),
//                 adminId: req.user.id
//             },
//             include: {
//                 participants: true
//             }
//         });

//         if (!chat) {
//             return createErrorResponse(res, 400, MessageEnum.CHAT_NOT_FOUND);
//         }

//         console.log('chat', chat)

//         // Ensure that only members in the chat can be removed
//         const memberIds = chat.participants.map(participant => participant.userId);
//         console.log('memberIds', memberIds)

//         for (let i = 0; i < receiverIds.length; i++) {
//             if (!memberIds.includes(receiverIds[i])) {
//                 return createErrorResponse(res, 400, MessageEnum.MEMBER_NOT_IN_CHAT);
//             }
//         }
//         console.log('memberIds', memberIds)

//         // Remove the specified members from the chat
//         await prisma.chat.update({
//             where: {
//                 id: parseInt(chatId)
//             },
//             data: {
//                 participants: {
//                     deleteMany: receiverIds.map(id => ({
//                         userId: id
//                     }))
//                 }
//             },
//             include: {
//                 participants: {
//                     include: {
//                         User: true,
//                         Author: true
//                     }
//                 }
//             }
//         });

//         // Emit socket event to inform participants about the member removal
//         // receiverIds.forEach(id => {
//         //     emitSocketEvent(req, id.toString(), ChatEventEnum.MEMBER_REMOVED_EVENT, { chatId, memberId: id });
//         // });

//         // Send success response
//         return createSuccessResponse(res, 200, true, MessageEnum.CHAT_MEMBER_REMOVED, { chatId, removedMembers: receiverIds });
//     } catch (error) {
//         console.log(error);
//         return createErrorResponse(res, 500, MessageEnum.INTERNAL_SERVER_ERROR);
//     }
// }

// export async function getMembersToAddInTeam(req, res) {
//     try {
//         const { chatId } = req.params;
//         const schema = Joi.alternatives(
//             Joi.object({
//                 chatId: Joi.number().required(),
//             })
//         )
//         console.log("param", req.params)
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
//                 id: parseInt(chatId),
//                 adminId: req.user.id
//             },
//             include: {
//                 participants: true
//             }
//         })

//         if (!chat) {
//             return createErrorResponse(res, 400, MessageEnum.CHAT_NOT_FOUND)
//         }

//         const members = chat.participants.filter(participant =>
//             participant.authorId !== req.user.id
//         );
//         const memberIds = members.map((member) => member.userId
//         )
//         console.log(">>>>>>>>>>", members);
//         console.log(">>>>>>>>>>", memberIds);
//         const followerIds = await getMyFollowers(req.user.id);

//         const membersToAdd = await prisma.user.findMany({
//             where: {
//                 id: {
//                     in: followerIds,
//                     notIn: memberIds
//                 }
//             }
//         })

//         return createSuccessResponse(res, 200, true, MessageEnum.USER_Data, membersToAdd)

//     } catch (error) {
//         console.log(error);
//         return createErrorResponse(res, 500, MessageEnum.INTERNAL_SERVER_ERROR);
//     }
// }

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
        const isActivateChat = await prisma.authorActivateChat.findFirst({
            where: {
                authorId: req.user.id,
                chatId: chatId
            }
        })
        console.log('isActivateChat', isActivateChat)

        if (isActivateChat) {
            await prisma.authorActivateChat.delete({
                where: {
                    id: isActivateChat.id
                }
            })
            return createSuccessResponse(res, 200, true, MessageEnum.CHAT_DEACTIVATE)

        }
        else {
            const authorActivateChat = await prisma.authorActivateChat.create({
                data: {
                    authorId: req.user.id,
                    chatId: chatId
                }
            })
            return res.status(200).json({
                success: true,
                message: "Author chat Activated successfully",
                status: 200,
                authorActivateChat
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

export async function getAllMessages(req, res) {
    try {
        const { chatId } = req.params;

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
            // Add baseurl to fileName
            if (chatMessage.ChatMessageFiles && chatMessage.ChatMessageFiles.length > 0) {
                chatMessage.ChatMessageFiles = chatMessage.ChatMessageFiles.map(file => ({
                    ...file,
                    fileName: file.fileName ? `${baseurl}/books/${file.fileName}` : null
                }));
            }

            // Add baseurl to senderAuthor's media
            if (chatMessage.senderAuthor) {
                const author = chatMessage.senderAuthor;

                author.avatar_url = author.avatar_url ? `${baseurl}/books/${author.avatar_url}` : null;
                author.coverImage = author.coverImage ? `${baseurl}/books/${author.coverImage}` : null;
                author.pdfUrl = author.pdfUrl ? `${baseurl}/books/${author.pdfUrl}` : null;
                author.audioUrl = author.audioUrl ? `${baseurl}/books/${author.audioUrl}` : null;
            }


            if (chatMessage.senderUser) {
                const user = chatMessage.senderUser;

                user.avatar_url = user.avatar_url ? `${baseurl}/books/${user.avatar_url}` : null;
                user.coverImage = user.coverImage ? `${baseurl}/books/${user.coverImage}` : null;
                user.pdfUrl = user.pdfUrl ? `${baseurl}/books/${user.pdfUrl}` : null;
                user.audioUrl = user.audioUrl ? `${baseurl}/books/${user.audioUrl}` : null;
            }

            return chatMessage;
        });


        const unreadCountData = await prisma.authorUnreadCount.findFirst({
            where: {
                authorId: req.user.id,
                chatId: parseInt(chatId),
            },
        });

        console.log('unreadCountData', unreadCountData);

        if (unreadCountData) {
            await prisma.authorUnreadCount.update({
                where: {
                    id: unreadCountData.id,
                },
                data: {
                    unreadCount: 0,
                },
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

//         const unreadCountData = await prisma.authorUnreadCount.findFirst({
//             where: {
//                 authorId: req.user.id,
//                 chatId: parseInt(chatId),
//             },
//         });

//         console.log('unreadCountData', unreadCountData);

//         if (unreadCountData) {
//             await prisma.authorUnreadCount.update({
//                 where: {
//                     id: unreadCountData.id,
//                 },
//                 data: {
//                     unreadCount: 0,
//                 },
//             });
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
};

// export const startQASession = async (req, res) => {
//     try {
//         const { sessionId } = req.params;
//         const { roomId } = req.body;

//         const schema = Joi.object({
//             roomId: Joi.string().required(),
//         });

//         const { error } = schema.validate(req.body);
//         if (error) {
//             const message = error.details.map((i) => i.message).join(", ");
//             return res.status(400).json({
//                 message,
//                 missingParams: error.details[0].message,
//                 status: 400,
//                 success: false,
//             });
//         }

//         const authorId = req.user.id;

//         // Check if session exists
//         const existingSession = await prisma.qASession.findUnique({
//             where: {
//                 id: parseInt(sessionId),
//             },
//         });

//         let startQASession;
//         let action;

//         if (existingSession) {
//             // Toggle isActive
//             const newIsActiveStatus = !existingSession.isActive;

//             startQASession = await prisma.qASession.update({
//                 where: {
//                     id: parseInt(sessionId),
//                 },
//                 data: {
//                     roomId,
//                     isActive: newIsActiveStatus,
//                 },
//             });

//             action = newIsActiveStatus ? "started" : "ended";
//         } else {
//             // Create new session and set isActive true
//             startQASession = await prisma.qASession.create({
//                 data: {
//                     id: parseInt(sessionId),
//                     authorId,
//                     roomId,
//                     isActive: true,
//                 },
//             });

//             action = "started";
//         }

//         if (startQASession.isActive) {
//             // Only send notifications when session is starting
//             const followers = await prisma.follow.findMany({
//                 where: {
//                     followingId: authorId,
//                     isFollowed: true,
//                 },
//                 include: {
//                     follower: true,
//                 },
//             });

//             await Promise.all(
//                 followers.map(async ({ follower }) => {
//                     if (follower.fcm_token) {
//                         await sendNotificationRelateToQaSessionToUser({
//                             token: follower.fcm_token,
//                             body: `${req.user.fullName} has started a new Live Q&A session`,
//                         });
//                     }
//                     await createNotificationForUser({
//                         toUserId: follower.id,
//                         byAuthorId: req.user.id,
//                         data: {
//                             userId: req.user.id,
//                             sessionId: startQASession.id,
//                         },
//                         type: "Q&A",
//                         content: `${req.user.fullName} has started a live Q&A session`,
//                     });
//                 })
//             );
//         }

//         return res.status(200).json({
//             success: true,
//             message: `Session ${action} successfully`,
//             status: 200,
//             startQASession,
//         });

//     } catch (error) {
//         console.error("Error starting/updating Q&A session:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             status: 500,
//             error: error.message,
//         });
//     }
// };

export const startQASession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { roomId } = req.body;

        const schema = Joi.object({
            roomId: Joi.string().required(),
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

        const authorId = req.user.id;

        // ✅ Check if session already exists
        const existingSession = await prisma.qASession.findUnique({
            where: {
                id: parseInt(sessionId),
            },
        });

        let startQASession;

        if (existingSession) {
            // ✅ Update the roomId and set isActive true
            startQASession = await prisma.qASession.update({
                where: {
                    id: parseInt(sessionId),
                },
                data: {
                    roomId,
                    isActive: true, // ✅ set isActive true if updating
                },
            });
        } else {
            // ✅ Create session and set isActive true
            startQASession = await prisma.qASession.create({
                data: {
                    id: parseInt(sessionId),
                    authorId,
                    roomId,
                    isActive: true, // ✅ set isActive true if creating
                },
            });
        }

        // Fetch all followers
        const followers = await prisma.follow.findMany({
            where: {
                followingId: authorId,
                isFollowed: true,
            },
            include: {
                follower: true,
            },
        });

        // Send notifications
        await Promise.all(
            followers.map(async ({ follower }) => {
                if (follower.fcm_token) {
                    await sendNotificationRelateToQaSessionToUser({
                        token: follower.fcm_token,
                        body: `${req.user.fullName} has started a new Live Q&A session`,
                    });
                }
                await createNotificationForUser({
                    toUserId: follower.id,
                    byAuthorId: req.user.id,
                    data: {
                        userId: req.user.id,
                        sessionId: startQASession.id,
                    },
                    type: "Q&A",
                    content: `${req.user.fullName} has started a live Q&A session`,
                });
            })
        );

        return res.status(200).json({
            success: true,
            message: "Session started and notifications sent",
            status: 200,
            startQASession,
        });

    } catch (error) {
        console.error("Error starting/updating Q&A session:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

export const endQASession = async (req, res) => {
    try {
        const { sessionId } = req.params;

        // ✅ Check if session exists
        const existingSession = await prisma.qASession.findUnique({
            where: {
                id: parseInt(sessionId),
            },
        });

        if (!existingSession) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
                status: 404,
            });
        }

        // ✅ Update isActive to false
        const endedSession = await prisma.qASession.update({
            where: {
                id: parseInt(sessionId),
            },
            data: {
                isActive: false,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Session ended successfully",
            status: 200,
            endedSession,
        });

    } catch (error) {
        console.error("Error ending Q&A session:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

// export const startQASession = async (req, res) => {
//     try {
//         const { sessionId } = req.params;
//         const { roomId } = req.body;

//         const schema = Joi.object({
//             roomId: Joi.string().required(),
//         });

//         const { error } = schema.validate(req.body);
//         if (error) {
//             const message = error.details.map((i) => i.message).join(", ");
//             return res.status(400).json({
//                 message,
//                 missingParams: error.details[0].message,
//                 status: 400,
//                 success: false,
//             });
//         }

//         const authorId = req.user.id;

//         // ✅ Check if session already exists
//         const existingSession = await prisma.qASession.findUnique({
//             where: {
//                 id: parseInt(sessionId),
//             },
//         });

//         let startQASession;

//         if (existingSession) {
//             // ✅ Update the roomId if session already exists
//             startQASession = await prisma.qASession.update({
//                 where: {
//                     id: parseInt(sessionId),
//                 },
//                 data: {
//                     roomId,
//                 },
//             });
//         } else {
//             // ✅ Create session if it doesn't exist
//             startQASession = await prisma.qASession.create({
//                 data: {
//                     id: parseInt(sessionId),
//                     authorId,
//                     roomId,
//                 },
//             });
//         }

//         const followers = await prisma.follow.findMany({
//             where: {
//                 followingId: authorId,
//                 isFollowed: true,
//             },
//             include: {
//                 follower: true,
//             },
//         });

//         await Promise.all(
//             followers.map(async ({ follower }) => {
//                 if (follower.fcm_token) {
//                     await sendNotificationRelateToQaSessionToUser({
//                         token: follower.fcm_token,
//                         body: `${req.user.fullName} has started a new Live Q&A session`,
//                     });
//                 }
//                 await createNotificationForUser({
//                     toUserId: follower.id,
//                     byAuthorId: req.user.id,
//                     data: {
//                         userId: req.user.id,
//                         sessionId: startQASession.id,
//                     },
//                     type: "Q&A",
//                     content: `${req.user.fullName} has started a live Q&A session`,
//                 });
//             })
//         );

//         return res.status(200).json({
//             success: true,
//             message: "Session started and notifications sent",
//             // message: existingSession
//             //     ? "Session updated and notifications sent"
//             //     : "Session started and notifications sent",
//             status: 200,
//             startQASession,
//         });

//     } catch (error) {
//         console.error("Error starting/updating Q&A session:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             status: 500,
//             error: error.message,
//         });
//     }
// };

// export const startQASession = async (req, res) => {
//     try {
//         const { sessionId } = req.params; // renamed from `id` to `sessionId`
//         const { roomId } = req.body;

//         const schema = Joi.object({
//             roomId: Joi.string().required(),
//         });

//         const { error } = schema.validate(req.body);
//         if (error) {
//             const message = error.details.map((i) => i.message).join(", ");
//             return res.status(400).json({
//                 message,
//                 missingParams: error.details[0].message,
//                 status: 400,
//                 success: false,
//             });
//         }

//         const authorId = req.user.id;

//         const startQASession = await prisma.qASession.create({
//             data: {
//                 id: parseInt(sessionId), // use sessionId from route params
//                 authorId,
//                 roomId,
//             },
//         });

//         const followers = await prisma.follow.findMany({
//             where: {
//                 followingId: authorId,
//                 isFollowed: true,
//             },
//             include: {
//                 follower: true,
//             },
//         });

//         await Promise.all(
//             followers.map(async ({ follower }) => {
//                 if (follower.fcm_token) {
//                     await sendNotificationRelateToQaSessionToUser({
//                         token: follower.fcm_token,
//                         body: `${req.user.fullName} has started a new Live Q&A session`,
//                     });
//                 }
//                 await createNotificationForUser({
//                     toUserId: follower.id,
//                     byAuthorId: req.user.id,
//                     data: {
//                         userId: req.user.id,
//                         sessionId: startQASession.id,
//                     },
//                     type: "Q&A",
//                     content: `${req.user.fullName} has started a live Q&A session`,
//                 });
//             })
//         );

//         return res.status(200).json({
//             success: true,
//             message: "Session started and notifications sent",
//             status: 200,
//             startQASession,
//         });

//     } catch (error) {
//         console.error("Error starting Q&A session:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             status: 500,
//             error: error.message,
//         });
//     }
// };

export const getSessionById = async (req, res) => {
    const { id } = req.params;
    try {
        const Sessions = await prisma.qASession.findUnique({
            where: { id: parseInt(id) },
            include: {
                author: true,
            }
        });

        if (!Sessions) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
                status: 404
            });
        }

        if (Sessions.thumbnail) {
            Sessions.thumbnail = `${baseurl}/books/${Sessions.thumbnail}`;
        }

        return res.status(200).json({
            success: true,
            message: "Session retrieved successfully",
            status: 200,
            Sessions
        });

    } catch (error) {
        console.error("Error fetching session:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

export const scheduleLiveSession = async (req, res) => {
    const { title, date, time } = req.body;

    const schema = Joi.object({
        title: Joi.string().required(),
        date: Joi.date().required(),
        time: Joi.string()
            .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
            .required(),
    });


    const { error } = schema.validate(req.body);
    if (error) {
        const message = error.details.map(i => i.message).join(', ');
        return res.status(400).json({
            message,
            missingParams: error.details[0].message,
            status: 400,
            success: false,
        });
    }

    let filename = null;
    if (req.file) {
        filename = req.file.filename;
    }

    try {
        const session = await prisma.qASession.create({
            data: {
                title,
                date: new Date(date),
                time,
                thumbnail: filename,
                authorId: req.user.id,
            },
        });

        if (session.thumbnail) {
            session.thumbnail = `${baseurl}/books/${session.thumbnail}`;
        }

        // session.map((item) => {
        //     item.coverImage = item.coverImage ? `${baseurl}/books/${item.coverImage}` : null;
        //     return item;
        // });

        const followers = await prisma.follow.findMany({
            where: {
                followingId: req.user.id,
                isFollowed: true,
            },
            include: {
                follower: true,
            },
        });

        const formattedDate = new Date(date).toLocaleDateString();
        const formattedTime = time;


        await Promise.all(
            followers.map(async ({ follower }) => {
                if (follower.fcm_token) {
                    await sendNotificationRelateToQaSessionToUser({
                        token: follower.fcm_token,
                        body: `${req.user.fullName} has started a new Live Q&A session. It will start on ${formattedDate} at ${formattedTime}`,
                    });
                }
                await createNotificationForUser({
                    toUserId: follower.id,
                    byAuthorId: req.user.id,
                    data: {
                        userId: req.user.id,
                        sessionId: session.id,
                    },
                    type: "Q&A",
                    content: `${req.user.fullName} has started a live Q&A session. It will start on ${formattedDate} at ${formattedTime}`,
                });
            })
        );


        return res.status(201).json({
            success: true,
            message: "Live session scheduled successfully!",
            status: 200,
            session,
        });


        // return res.status(201).json({
        //     message: 'Live session scheduled successfully!',
        //     session,
        // });
    } catch (error) {
        console.error("Error starting Live session:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

export const getSessionDashboard = async (req, res) => {
    try {
        const nowUTC = new Date();
        const nowIST = new Date(nowUTC.getTime() + (5.5 * 60 * 60 * 1000)); // IST offset
        const currentTimeStr = nowIST.toTimeString().slice(0, 5);
        const nowDate = new Date(nowIST.toISOString().slice(0, 10));

        const totalSessions = await prisma.qASession.count();
        const totalViewers = await prisma.user.count();

        const upcomingSessionsCount = await prisma.qASession.count({
            where: {
                OR: [
                    { date: { gt: nowDate } },
                    { date: { equals: nowDate }, time: { gt: currentTimeStr } }
                ]
            }
        });

        const completedSessionsCount = await prisma.qASession.count({
            where: {
                OR: [
                    { date: { lt: nowDate } },
                    { date: { equals: nowDate }, time: { lt: currentTimeStr } }
                ]
            }
        });

        const upcomingSessions = await prisma.qASession.findMany({
            where: {
                OR: [
                    { date: { gt: nowDate } },
                    { date: { equals: nowDate }, time: { gt: currentTimeStr } }
                ]
            },
            orderBy: { date: 'asc' }
        });

        const completedSessions = await prisma.qASession.findMany({
            where: {
                OR: [
                    { date: { lt: nowDate } },
                    { date: { equals: nowDate }, time: { lt: currentTimeStr } }
                ]
            },
            orderBy: { date: 'desc' }
        });

        res.status(200).json({
            totalSessions,
            totalViewers,
            upcomingSessionsCount,
            completedSessionsCount,
            upcomingSessions,
            completedSessions
        });

    } catch (error) {
        console.error('Error fetching dashboard:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error
        });
    }
};

// export const editSession = async (req, res) => {

//     const { sessionId } = req.params;
//     const { title, date, time } = req.body;


//     const schema = Joi.object({
//         title: Joi.string().optional(),
//         date: Joi.date().optional(),
//         time: Joi.string()
//             .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
//             .optional(),
//     });


//     const result = schema.validate(req.body);
//     if (result.error) {
//         const message = result.error.details.map((i) => i.message).join(",");
//         return res.status(400).json({
//             message: result.error.details[0].message,
//             error: message,
//             missingParams: result.error.details[0].message,
//             status: 400,
//             success: false,
//         });
//     }

//     const Sessions = await prisma.qASession.findUnique({
//         where: { id: parseInt(sessionId) },
//     });

//     try {
//         const updatedSession = await prisma.qASession.update({
//             where: { id: parseInt(sessionId) },
//             data: {
//                 title,
//                 date,
//                 time
//             },
//         });

//         return res.status(200).json({
//             success: true,
//             message: "Session updated successfully",
//             status: 200,
//             data: updatedSession,
//         });

//     } catch (error) {
//         console.error("Error updating cart:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             status: 500,
//             error: error.message,
//         });
//     }
// };


// import Joi from "joi";
// import multer from "multer";
// import { prisma } from "../prismaClient.js"; // adjust path as needed

// // Multer setup (for file uploads)
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "uploads/"); // adjust your upload path
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + "-" + file.originalname);
//   },
// });
// export const upload = multer({ storage });

// export const editSession = async (req, res) => {
//   const { sessionId } = req.params;
//   const { title, date, time } = req.body;

//   const schema = Joi.object({
//     title: Joi.string().optional(),
//     date: Joi.date().optional(),
//     time: Joi.string()
//       .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
//       .optional(),
//   });

//   const result = schema.validate(req.body);
//   if (result.error) {
//     const message = result.error.details.map((i) => i.message).join(",");
//     return res.status(400).json({
//       message: result.error.details[0].message,
//       error: message,
//       missingParams: result.error.details[0].message,
//       status: 400,
//       success: false,
//     });
//   }

//   try {
//     const session = await prisma.qASession.findUnique({
//       where: { id: parseInt(sessionId) },
//     });

//     if (!session) {
//       return res.status(404).json({
//         success: false,
//         message: "Session not found",
//         status: 404,
//       });
//     }

//     // If a new file is uploaded, use it. Otherwise, keep the old thumbnail.
//     const updatedThumbnail = req.file ? req.file.filename : session.thumbnail;

//     const updatedSession = await prisma.qASession.update({
//       where: { id: parseInt(sessionId) },
//       data: {
//         title: title ?? session.title,
//         date: date ?? session.date,
//         time: time ?? session.time,
//         thumbnail: updatedThumbnail,
//       },
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Session updated successfully",
//       status: 200,
//       data: updatedSession,
//     });
//   } catch (error) {
//     console.error("Error updating session:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       status: 500,
//       error: error.message,
//     });
//   }
// };

export const editSession = async (req, res) => {
    const { sessionId } = req.params;
    const { title, date, time } = req.body;

    const schema = Joi.object({
        title: Joi.string().optional(),
        date: Joi.string().optional(), // Accept as string, parse later
        time: Joi.string()
            .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
            .optional(),
    });

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

    const session = await prisma.qASession.findUnique({
        where: { id: parseInt(sessionId) },
    });

    if (!session) {
        return res.status(404).json({
            success: false,
            message: "Session not found",
            status: 404,
        });
    }

    // Combine date and time into ISO datetime
    let isoDateTime = session.date;
    if (date && time) {
        isoDateTime = new Date(`${date}T${time}:00`);
    } else if (date) {
        isoDateTime = new Date(`${date}T00:00:00`);
    }

    // Handle thumbnail upload
    // let thumbnail = session.thumbnail;
    // if (req.file) {
    //   thumbnail = req.file.filename;
    // }

    let thumbnail = null;
    if (req.file) {
        thumbnail = req.file.filename;
    }


    try {
        const updatedSession = await prisma.qASession.update({
            where: { id: parseInt(sessionId) },
            data: {
                title: title ?? session.title,
                date: isoDateTime,
                thumbnail: thumbnail != null ? thumbnail : session.thumbnail,
                time: time ?? session.time,
                thumbnail,
            },
        });

        if (updatedSession.thumbnail) {
            updatedSession.thumbnail = `${baseurl}/books/${updatedSession.thumbnail}`;
        }


        return res.status(200).json({
            success: true,
            message: "Session updated successfully",
            status: 200,
            data: updatedSession,
        });

    } catch (error) {
        console.error("Error updating session:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

export async function deleteSession(req, res) {
    try {
        let { sessionId } = req.params;

        sessionId = parseInt(sessionId);

        const Sessions = await prisma.qASession.findUnique({
            where: {
                id: sessionId,
                authorId: req.user.id
            }
        })

        if (!Sessions) {
            return res.status(400).json({
                status: 400,
                message: 'Session Not found',
                success: false,
            })
        }
        await prisma.qASession.delete({
            where: {
                id: sessionId,
                authorId: req.user.id
            }
        })
        return res.status(200).json({
            status: 200,
            message: 'Session Deleted successfully',
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

export async function generateLiveStreamToken(req, res) {
    try {
        const { roomName, userName } = req.body;

        if (!roomName || !userName) {
            return res.status(400).json({
                status: 400,
                message: 'roomName and userName are required',
                success: false,
            });
        }

        const jwtToken = await generateJwt(roomName, userName);

        return res.status(200).json({
            status: 200,
            message: 'Token created successfully',
            success: true,
            token: jwtToken,
        });

    } catch (error) {
        console.error('Error generating token:', error);
        return res.status(500).json({
            status: 500,
            message: 'Internal server error',
            success: false,
        });
    }
}

export const createSubscriptionSession = async (req, res) => {
    try {
        const { plan_id, success_url, cancel_url } = req.body;

        // Get authorId from token (middleware should set req.user)
        const authorId = req.user.id;

        if (!plan_id) {
            return res.status(400).json({ status: false, message: 'plan_id is required.' });
        }

        // Fetch the plan from DB
        const plan = await prisma.plan.findUnique({ where: { id: Number(plan_id) } });

        if (!plan) {
            return res.status(404).json({ status: false, message: 'Plan not found.' });
        }

        // Validate URLs or fallback to default
        const successUrl = success_url || `${process.env.FRONTEND_URL}/success`;
        const cancelUrl = cancel_url || `${process.env.FRONTEND_URL}/cancel`;

        // Create Stripe Checkout session for one-time payment
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Author Subscription (${plan.name.replace('_', ' ')})`,
                        },
                        unit_amount: Math.round(plan.price * 100),
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                authorId: authorId.toString(),
                plan_id: plan.id.toString(),
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
        });

        res.status(200).json({ status: true, url: session.url });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Failed to create subscription session.',
            error: error.message,
        });
    }
};

// export const createSubscriptionSession = async (req, res) => {
//     try {
//         const { plan_id } = req.body;

//         // Get authorId from token (middleware should set req.user)
//         const authorId = req.user.id;

//         if (!plan_id) {
//             return res.status(400).json({ status: false, message: 'plan_id is required.' });
//         }

//         // Fetch the plan from DB
//         const plan = await prisma.plan.findUnique({ where: { id: Number(plan_id) } });

//         if (!plan) {
//             return res.status(404).json({ status: false, message: 'Plan not found.' });
//         }

//         // Create Stripe Checkout session for one-time payment
//         const session = await stripe.checkout.sessions.create({
//             payment_method_types: ['card'],
//             mode: 'payment', // 'subscription' if recurring
//             line_items: [
//                 {
//                     price_data: {
//                         currency: 'usd',
//                         product_data: {
//                             name: `Author Subscription (${plan.name.replace('_', ' ')})`,
//                         },
//                         unit_amount: Math.round(plan.price * 100), // convert to cents
//                     },
//                     quantity: 1,
//                 },
//             ],
//             metadata: { authorId: authorId.toString(), plan_id: plan.id.toString() },
//             success_url: `${process.env.FRONTEND_URL}/success`,
//             cancel_url: `${process.env.FRONTEND_URL}/cancel`,
//         });

//         res.status(200).json({ status: true, url: session.url });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ status: false, message: 'Failed to create subscription session.', error: error.message });
//     }
// };

export const onboard_author = async (req, res) => {
    try {
        const {
            user_id,
            firstName,
            lastName,
            dob, // YYYY-MM-DD
            emailAddress,
            phoneNumber, // must be in E.164 format e.g. +1234567890
            residentialAddress,
            postal_code,
            city,
            state,
            account_holder_name,
            routing_number, // Use routing_number instead of swift_code for US banks
            account_number
        } = req.body;

        if (
            !user_id ||
            !firstName ||
            !lastName ||
            !dob ||
            !emailAddress ||
            !phoneNumber ||
            !residentialAddress ||
            !postal_code ||
            !city ||
            !state ||
            !account_holder_name ||
            !routing_number ||
            !account_number
        ) {
            return res.status(400).json({
                status: false,
                message: "All fields are required",
            });
        }

        // Create bank account token (for US only)
        const bankAccountToken = await stripe.tokens.create({
            bank_account: {
                country: 'US',        // Make sure this matches the user's bank country
                currency: 'usd',
                account_holder_name,
                account_holder_type: 'individual',
                routing_number,
                account_number,
            },
        });

        // Create a Standard account (change country if needed)
        const account = await stripe.accounts.create({
            type: 'standard',
            country: 'US',       // Change to 'IN' or appropriate country if needed
            email: emailAddress,
        });

        // Create account onboarding link so user can finish KYC
        const accountLink = await stripe.accountLinks.create({
            account: account.id,
            refresh_url: 'https://your-frontend.com/onboarding/refresh', // your URL to retry onboarding
            return_url: 'https://your-frontend.com/onboarding/success',  // your success URL after onboarding
            type: 'account_onboarding',
        });

        // Create a Stripe customer for author
        const customer = await stripe.customers.create({
            name: `${firstName} ${lastName}`,
            email: emailAddress,
            description: 'Author account for receiving payments',
        });

        // Prepare bank info object
        const bank_info = {
            firstName,
            lastName,
            dob,
            emailAddress,
            phoneNumber,
            residentialAddress,
            postal_code,
            city,
            state,
            account_holder_name,
            routing_number,
            account_number,
        };

        // Find author by user_id
        const author = await prisma.author.findUnique({
            where: { id: Number(user_id) },
        });

        if (!author) {
            return res.status(404).json({
                status: false,
                message: "Author not found",
            });
        }

        // Delete existing bank info for this author (if any)
        await prisma.bankInfo.deleteMany({
            where: { authorId: author.id },
        });

        // Add new bank info linked to author
        const newBankInfo = await prisma.bankInfo.create({
            data: {
                accountId: account.id,
                customerId: customer.id,
                bankInfo: bank_info,
                author: { connect: { id: author.id } },
            },
        });

        // Send back onboarding URL so author can complete onboarding on Stripe
        return res.status(200).json({
            status: true,
            message: 'Author onboarded successfully. Please complete onboarding.',
            onboarding_url: accountLink.url,
            data: {
                accountId: account.id,
                customerId: customer.id,
                bankInfoId: newBankInfo.id,
            },
        });

    } catch (error) {
        if (error.type === 'StripeInvalidRequestError') {
            return res.status(400).json({
                status: false,
                message: error.message,
                param: error.param,
                code: error.code,
                doc_url: error.doc_url,
                request_log_url: error.raw?.request_log_url || null,
            });
        }
        console.error('Error onboarding author:', error);
        return res.status(500).json({
            status: false,
            message: 'Internal Server Error',
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
};

export async function getMyPlans(req, res) {
    try {
        const authorId = req.user.id;

        // Find active subscription for this author
        const activeSubscription = await prisma.subscription.findFirst({
            where: {
                authorId,
                status: 'active',
                endDate: {
                    gt: new Date(), // subscription still valid (not expired)
                },
            },
            include: {
                plan: true, // include plan details
            },
            orderBy: {
                endDate: 'desc', // get latest active subscription
            },
        });

        if (!activeSubscription) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: "No active subscription found for this author",
                plan: null,
            });
        }

        return res.status(200).json({
            status: 200,
            success: true,
            message: "Active subscription plan retrieved",
            subscription: activeSubscription,
            plan: activeSubscription.plan,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 500,
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};

export const getSubscriptionStatus = async (req, res) => {
    const authorId = req.user.id;

    const subscription = await prisma.subscription.findFirst({
        where: { authorId, status: 'active' },
        include: { plan: true },
    });

    if (!subscription) {
        return res.json({ subscribed: false });
    }

    res.json({
        subscribed: true,
        plan: subscription.plan.name,
        endsAt: subscription.endsAt,
    });
};

export const getAllPurchase = async (req, res) => {
    try {

        const authorId = req.user.id;
        console.log('authorId', authorId)

        const {
            page = 1,
            limit = 10,
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);


        const purchases = await prisma.purchase.findMany({
            where: {
                book: {
                    authorId: authorId,
                },
            },
            skip,
            take,
            include: {
                user: true,
                book: true,
                author: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        const totalCount = await prisma.purchase.count({
        })


        const transformedPurchases = purchases.map((purchase) => {
            if (purchase.book) {

                purchase.book.coverImage = purchase.book.coverImage
                    ? `${baseurl}/books/${purchase.book.coverImage}`
                    : null;
                purchase.book.pdfUrl = purchase.book.pdfUrl
                    ? `${baseurl}/books/${purchase.book.pdfUrl}`
                    : null;
                purchase.book.audioUrl = purchase.book.audioUrl
                    ? `${baseurl}/books/${purchase.book.audioUrl}`
                    : null;
            }
            return purchase;
        });

        return res.status(200).json({
            status: 200,
            message: 'Purchases fetched successfully for author',
            purchases: transformedPurchases,
            totalCount: purchases.length,
        });
    } catch (error) {
        console.error("Error fetching author's purchases:", error);
        return res.status(500).json({
            status: 500,
            message: 'Internal Server Error',
            success: false,
            error: error.message,
        });
    }
};



export const getAuthorEarnings = async (req, res) => {
    try {
        const { authorId } = req.params;

        const earnings = await prisma.order.aggregate({
            _sum: { authorEarning: true },
            where: { authorId: parseInt(authorId), status: 'paid' },
        });

        return res.status(200).json({
            status: 200,
            message: 'Order Fetched successfully',
            earnings: earnings._sum.authorEarning || 0,
            order
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: 500,
            message: 'Internal Server Error',
            success: false,
            error: error.message,
        });
    }
};



// export const onboard_author = async (req, res) => {
//     try {
//         const authorId = req.user.id;

//         const {
//             businessName,
//             businessType,
//             businessAddress,
//             businessEmail,
//             businessWebsite,
//             firstName,
//             lastName,
//             dob,
//             emailAddress,
//             phoneNumber,
//             residentialAddress,
//             postal_code,
//             city,
//             state,
//             country,
//             currency,
//             account_holder_name,
//             routing_number,
//             account_number,
//         } = req.body;

//         // Validate author exists
//         const author = await prisma.author.findUnique({ where: { id: Number(authorId) } });
//         if (!author) {
//             return res.status(404).json({ status: false, message: 'Author not found' });
//         }

//         // Validate IFSC if country is India
//         if (country === 'IN') {
//             const ifscRegex = /^[A-Z]{4}0[0-9]{6}$/;
//             if (!ifscRegex.test(routing_number)) {
//                 return res.status(400).json({
//                     status: false,
//                     message: "Invalid IFSC number format. It should be 11 characters like ABCD0123456.",
//                 });
//             }

//             const validIndianStates = [
//                 'JK', 'HP', 'PB', 'CH', 'UT', 'HR', 'DL', 'RJ', 'UP', 'BR', 'SK', 'AR', 'NL',
//                 'MN', 'MZ', 'TR', 'ML', 'AS', 'WB', 'JH', 'OR', 'CT', 'MP', 'GJ', 'DD', 'DN',
//                 'MH', 'AP', 'KA', 'GA', 'LD', 'KL', 'TN', 'PY', 'AN', 'TG', 'LH', 'DH'
//             ];
//             if (!validIndianStates.includes(state)) {
//                 return res.status(400).json({
//                     status: false,
//                     message: `Indian state must be one of: ${validIndianStates.join(', ')}`,
//                 });
//             }
//         }

//         const countryCode = country?.toUpperCase() || 'US';
//         const currencyCode = currency?.toLowerCase() || 'usd';

//         // Step 1: Create an Express connected account
//         const account = await stripe.accounts.create({
//             type: 'express',
//             country: countryCode,
//             email: emailAddress,
//             capabilities: {
//                 card_payments: { requested: true },
//                 transfers: { requested: true },
//             },
//         });

//         // Step 2: Generate onboarding link
//         const accountLink = await stripe.accountLinks.create({
//             account: account.id,
//             refresh_url: `${process.env.BASE_URL}/reauth`,
//             return_url: `${process.env.BASE_URL}/dashboard`,
//             type: 'account_onboarding',
//         });

//         // Step 3: Create a customer (optional, still valid)
//         const customer = await stripe.customers.create({
//             name: `${firstName} ${lastName}`,
//             email: emailAddress,
//             description: 'Author Customer',
//         });

//         const bankInfoPayload = {
//             businessName,
//             businessType,
//             businessAddress,
//             businessEmail,
//             businessWebsite,
//             firstName,
//             lastName,
//             dob,
//             emailAddress,
//             phoneNumber,
//             residentialAddress,
//             postal_code,
//             city,
//             state,
//             country,
//             currency,
//             account_holder_name,
//             routing_number,
//             account_number,
//         };

//         const existing = await prisma.bankInfo.findFirst({ where: { authorId } });

//         let savedBankInfo;
//         if (existing) {
//             savedBankInfo = await prisma.bankInfo.update({
//                 where: { id: existing.id },
//                 data: {
//                     accountId: account.id,
//                     customerId: customer.id,
//                     bankInfo: bankInfoPayload,
//                 },
//             });
//         } else {
//             savedBankInfo = await prisma.bankInfo.create({
//                 data: {
//                     authorId,
//                     accountId: account.id,
//                     customerId: customer.id,
//                     bankInfo: bankInfoPayload,
//                 },
//             });
//         }

//         return res.status(200).json({
//             status: true,
//             message: 'Author onboarding started. Complete onboarding via Stripe.',
//             onboardingUrl: accountLink.url,
//             bankInfo: savedBankInfo,
//         });

//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({
//             status: false,
//             message: 'Stripe onboarding failed',
//             error: error.message,
//         });
//     }
// };




