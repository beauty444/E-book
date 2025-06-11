import Joi from "joi";
import jwt from 'jsonwebtoken'
import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcrypt';
import axios from "axios";
import path from 'path'
import crypto from 'crypto';
// import localStorage, { getItem } from 'localStorage'
import { randomStringAsBase64Url } from '../utils/helper.js';
import dotenv from "dotenv";
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import hbs from "nodemailer-express-handlebars";
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
import { generateOTP, getAuthorStats } from "../utils/helper.js";
import { createNotificationForAuthor, sendNotificationRelateToFollow } from "../utils/notification.js";
import { CLIENT_RENEG_LIMIT } from "tls";
dotenv.config();
const prisma = new PrismaClient();
const baseurl = process.env.BASE_URL;
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

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Already have an account, Please Login',
            });
        }

        const act_token = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
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
                href_url: `${baseurl}/api/users/verifyUser/${act_token}`,
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
        // const token = generateToken();
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
            const user = await prisma.user.findFirst({
                where: {
                    act_token: act_token
                }
            })
            console.log("user", user);
            if (user) {
                const updateUser = await prisma.user.update({
                    where: {
                        id: user.id
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
                const user = await prisma.user.findUnique({
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

                if (fcm_token) {
                    await prisma.user.update({
                        where: {
                            email: email,
                        },
                        data: {
                            fcm_token: fcm_token,
                        },
                    });
                }

                const userData = await prisma.user.findUnique({
                    where: {
                        email: email,
                    },
                });

                const token = jwt.sign({ userId: user.id, role: userData.role }, secretKey, { expiresIn: '24W' });
                return res.json({
                    status: 200,
                    success: true,
                    message: "Login successful!",
                    token: token,
                    user: userData,
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

            const user = await prisma.user.findUnique({
                where: { email }
            });

            if (!user) {
                return res.status(400).json({
                    success: false,
                    status: 400,
                    message: 'Email not Registered'
                });
            }
            if (user.isVerified == 0) {
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
                    imgUrl: `${baseurl}/images/ebook.png`
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
                    await prisma.user.update({
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
            const user = await prisma.user.findUnique({
                where: { email }
            });


            if (user && user.otp === otp && new Date(user.otpExpiration) > new Date()) {
                await prisma.user.update({
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
                    await prisma.author.update({
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
            const user = await prisma.user.update({
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
            const user = await prisma.user.update({
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

        const user = await prisma.user.findUnique({
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

        // const isPasswordCorrect = await bcrypt.compare(user.password, current_password);
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


        await prisma.user.update({
            where: { id: user_id },
            data: { password: hashedPassword }
        });

        return res.status(200).json({
            success: true,
            message: "Password updated successfully",
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
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id
            },
            include: {
                Book: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
                status: 404
            });
        }

        if (user.avatar_url) {
            user.avatar_url = `${baseurl}/books/${user.avatar_url}`;
        }


        return res.status(200).json({
            success: true,
            message: "User profile fetched successfully",
            status: 200,
            user
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

export async function editProfile(req, res) {
    try {
        const { fullName, userName, email, about } = req.body;

        const schema = Joi.object({
            fullName: Joi.string().optional(),
            userName: Joi.string().optional(),
            email: Joi.string().email(),
            about: Joi.string().optional(),
        });

        const result = schema.validate(req.body);

        if (result.error) {
            const message = result.error.details.map((i) => i.message).join(',');
            return res.status(400).json({
                message: result.error.details[0].message,
                error: message,
                missingParams: result.error.details[0].message,
                status: 400,
                success: false,
            });
        }

        // Initialize userData with fallback values
        let userData = {
            fullName: fullName !== undefined ? fullName : req.user.fullName,
            userName: userName !== undefined ? userName : req.user.userName,
            email: email !== undefined ? email : req.user.email,
            about: about !== undefined ? about : req.user.about,
        };

        console.log('userData', userData)

        // Handle avatar and cover image upload
        if (req.files) {
            if (req.files["avatar_url"]) {
                userData.avatar_url = req.files["avatar_url"][0].filename;
            }
            if (req.files["coverImage"]) {
                userData.coverImage = req.files["coverImage"][0].filename;
            }
        }

        await prisma.user.update({
            where: {
                id: req.user.id,
            },
            data: userData
        });

        const updatedUser = await prisma.user.findUnique({
            where: {
                id: req.user.id
            },
        });

        return res.status(200).json({
            success: true,
            message: "Profile Updated Successfully",
            status: 200,
            user: updatedUser
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message || error
        });
    }
}

export async function follow(req, res) {
    const userToFollowId = parseInt(req.params.id);
    console.log('userToFollowId', userToFollowId)
    const userId = req.user.id;
    try {
        const user = await prisma.author.findUnique({ where: { id: userId } });
        const userToFollow = await prisma.author.findUnique({ where: { id: userToFollowId } });

        if (!userToFollow) {
            return res.status(404).json({
                success: false,
                status: 400,
                message: 'User to follow not found'
            });
        }

        const existingFollow = await prisma.follow.findFirst({
            where: {
                followerId: userId,
                followingId: userToFollowId,
            },
        });

        if (existingFollow) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: 'Follow request already exists or already following',
            });
        }

        await prisma.follow.create({
            data: {
                followerId: userId,
                followingId: userToFollowId,
                isFollowed: true,
            },
        });

        await createNotificationForAuthor({
            toAuthorId: userToFollowId,
            byUserId: userId,
            data: {
                userId: req.user.id
            },
            type: "follow",
            content: `${req.user.fullName} Followed you`
        })

        console.log('createNotificationForAuthor', createNotificationForAuthor)


        await sendNotificationRelateToFollow({
            token: userToFollow.fcm_token,
            body: `${req.user.fullName} Followed you`,
        })

        console.log('sendNotificationRelateToFollow',)

        return res.status(200).json({
            success: true,
            message: "User Successfully Followed User",
            status: 200,
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

export async function unFollow(req, res) {
    const userToUnfollowId = parseInt(req.params.id);
    const userId = req.user.id;

    try {

        const user = await prisma.author.findUnique({ where: { id: userId } });
        const userToUnfollow = await prisma.author.findUnique({ where: { id: userToUnfollowId } });

        if (!userToUnfollow) {
            return res.status(404).json({ success: false, status: 404, message: 'User to unfollow not found' });
        }

        const existingFollow = await prisma.follow.findFirst({
            where: {
                followerId: userId,
                followingId: userToUnfollowId,
                status: {
                    not: 2
                }
            },
        });

        if (!existingFollow) {
            return res.status(400).json({ success: false, status: 400, message: 'Not following this user' });
        }

        if (existingFollow.status === 1) {
            if (author.numberOfFollowing > 0) {
                const numberOfFollowing = author.numberOfFollowing - 1;
                await prisma.author.update({
                    where: {
                        id: userId
                    },
                    data: {
                        numberOfFollowing: numberOfFollowing
                    }
                })
            }
            if (userToUnfollow.numberOfFollower > 0) {
                const numberOfFollower = userToUnfollow.numberOfFollower - 1;
                await prisma.author.update({
                    where: {
                        id: userToUnfollowId
                    },
                    data: {
                        numberOfFollower: numberOfFollower
                    }
                })
            }
        }

        await prisma.follow.delete({
            where: {
                id: existingFollow.id,
            },
        });
        return res.status(200).json({
            success: true,
            message: "User Successfully Unfollowed User",
            status: 200,
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

export async function getAllNewBook(req, res) {
    try {
        const books = await prisma.book.findMany({
            where: {
                authorId: req.user.id,
            },
            include: {
                author: true,
                books: {
                    include: {
                        category: true
                    }
                }
            },
            orderBy: [
                { createdAt: 'desc' },
            ],
            take: 10,
        });

        books.map((item) => {
            item.coverImage = item.coverImage ? baseurl + "/books/" + item.coverImage : null;
            item.pdfUrl = item.pdfUrl ? baseurl + "/books/" + item.pdfUrl : null;
            item.audioUrl = item.audioUrl ? baseurl + "/books/" + item.audioUrl : null;
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

export async function getTopAuthor(req, res) {
    try {
        // Fetch all authors
        const authors = await prisma.author.findMany({
            include: {
                books: true, // Fetch all books of the author
            }
        });

        // Count followers for each author
        const followersCount = await prisma.follow.groupBy({
            by: ['followingId'],
            _count: { followingId: true },  // Count followers per author
        });

        // Merge book count, follower count, and createdAt timestamp
        const authorStats = authors.map((author) => {
            const followersStat = followersCount.find(
                (f) => f.followingId === author.id
            );

            return {
                authorId: author.id,
                bookCount: author.books.length, // Get the number of books (default 0)
                followerCount: followersStat ? followersStat._count.followingId : 0, // Default to 0 if no followers
                createdAt: author.createdAt,
            };
        });

        // Sort by book count first, then followers, then creation date
        authorStats.sort((a, b) => {
            if (b.bookCount === a.bookCount) {
                if (b.followerCount === a.followerCount) {
                    return b.createdAt - a.createdAt; // Sort by creation date (latest first)
                }
                return b.followerCount - a.followerCount; // Sort by followers
            }
            return b.bookCount - a.bookCount; // Sort by books
        });

        // Get the top 10 authors
        const topAuthors = await Promise.all(
            authorStats.slice(0, 10).map(async (stat) => {
                const author = await prisma.author.findUnique({
                    where: { id: stat.authorId },
                    include: { books: true },
                });

                if (!author) return null;

                // Format URLs
                author.avatar_url = author.avatar_url ? baseurl + "/books/" + author.avatar_url : null;
                author.coverImage = author.coverImage ? baseurl + "/books/" + author.coverImage : null;

                await Promise.all(
                    author.books.map(async (book) => {
                        book.coverImage = book.coverImage ? baseurl + "/books/" + book.coverImage : null;
                        book.pdfUrl = book.pdfUrl ? baseurl + "/books/" + book.pdfUrl : null;
                        book.audioUrl = book.audioUrl ? baseurl + "/books/" + book.audioUrl : null;
                    })
                );

                return {
                    ...author,
                    publishedCount: stat.bookCount,
                    followersCount: stat.followerCount,
                };
            })
        );

        const filteredAuthors = topAuthors.filter((author) => author !== null);

        return res.status(200).json({
            success: true,
            message: "Top authors retrieved successfully",
            topAuthors: filteredAuthors,
        });
    } catch (error) {
        console.error("Error fetching top authors:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
}

export async function getAllBooks(req, res) {
    try {
        const { search, categories, authorId, minPrice, maxPrice } = req.query;

        const categoryIds = categories ? categories.split(',').map(id => parseInt(id.trim())) : [];


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
                }
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

// export async function getAllAuthor(req, res) {
//     try {
//         const { search, categories, followerId } = req.query; // Ensure followerId is provided

//         const categoryIds = categories
//             ? categories.split(',').map(id => parseInt(id.trim()))
//             : [];

//         const filterQuery = {
//             ...(search && {
//                 OR: [
//                     { fullName: { contains: search } },
//                 ]
//             }),
//             ...(categoryIds.length > 0 && {
//                 AuthorCategory: {
//                     some: {
//                         categoryId: { in: categoryIds },
//                     },
//                 },
//             }),
//         };

//         const authors = await prisma.author.findMany({
//             where: filterQuery,
//             include: {
//                 books: {
//                     orderBy: {
//                         createdAt: "desc"
//                     }
//                 },
//                 AuthorCategory: {
//                     include: {
//                         category: true,
//                     },
//                 },
//                 following: true, // Assuming this fetches follow relationships
//             },
//             orderBy: {
//                 id: "desc",
//             },
//         });

//         // Get all author IDs
//         const authorIds = authors.map(author => author.id);

//         // Find follow relationships for the given followerId
//         const followedAuthors = await prisma.follow.findMany({
//             where: {
//                 followerId: parseInt(followerId), // Ensure followerId is provided and parsed
//                 followingId: { in: authorIds }
//             },
//             select: { followingId: true }
//         });

//         // Convert followedAuthors to a Set for quick lookup
//         const followedSet = new Set(followedAuthors.map(f => f.followingId));

//         const formattedAuthors = authors.map((item) => ({
//             ...item,
//             isFollowed: followedSet.has(item.id), // Check if author is in followed list
//             avatar_url: item.avatar_url ? `${baseurl}/books/${item.avatar_url}` : null,
//             coverImage: item.coverImage ? `${baseurl}/books/${item.coverImage}` : null,
//             books: item.books.map((book) => ({
//                 ...book,
//                 coverImage: book.coverImage ? `${baseurl}/books/${book.coverImage}` : null,
//                 pdfUrl: book.pdfUrl ? `${baseurl}/books/${book.pdfUrl}` : null,
//                 audioUrl: book.audioUrl ? `${baseurl}/books/${book.audioUrl}` : null,
//             })),
//         }));

//         return res.status(200).json({
//             success: true,
//             message: "Authors retrieved successfully",
//             status: 200,
//             authors: formattedAuthors,
//         });
//     } catch (error) {
//         console.error("Error fetching authors:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             status: 500,
//             error: error.message,
//         });
//     }
// }


// export async function getAllAuthor(req, res) {
//     try {
//         const { search, categories } = req.query;

//         const categoryIds = categories
//             ? categories.split(',').map(id => parseInt(id.trim()))
//             : [];

//         const filterQuery = {
//             ...(search && {
//                 OR: [
//                     { fullName: { contains: search } },
//                 ]
//             }),
//             ...(categoryIds.length > 0 && {
//                 AuthorCategory: {
//                     some: {
//                         categoryId: { in: categoryIds },
//                     },
//                 },
//             }),
//         };

//         const authors = await prisma.author.findMany({
//             where: filterQuery,
//             include: {
//                 books: {
//                     orderBy: {
//                         createdAt: "desc"
//                     }
//                 },
//                 AuthorCategory: {
//                     include: {
//                         category: true,
//                     },
//                 },
//                 following: true,
//             },
//             orderBy: {
//                 id: "desc",
//             },
//         });


//         const formattedAuthors = authors.map(async(item) => {
//             const isFollowed = await prisma.follow.findFirst({
//                 where: {
//                     followerId: req.user.id,
//                     followingId: parseInt(item.id)
//                 }
//             })

//             if (isFollowed) {
//                 item.isFollowed = true
//             }
//             else {
//                 item.isFollowed = false
//             }
//             return {
//                 ...item,
//                 avatar_url: item.avatar_url ? `${baseurl}/books/${item.avatar_url}` : null,
//                 coverImage: item.coverImage ? `${baseurl}/books/${item.coverImage}` : null,
//                 books: item.books.map((book) => ({
//                     ...book,
//                     coverImage: book.coverImage ? `${baseurl}/books/${book.coverImage}` : null,
//                     pdfUrl: book.pdfUrl ? `${baseurl}/books/${book.pdfUrl}` : null,
//                     audioUrl: book.audioUrl ? `${baseurl}/books/${book.audioUrl}` : null,
//                 })),
//             };
//         });

//         return res.status(200).json({
//             success: true,
//             message: "Authors retrieved successfully",
//             status: 200,
//             authors: formattedAuthors,
//         });
//     } catch (error) {
//         console.error("Error fetching authors:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             status: 500,
//             error: error.message,
//         });
//     }
// }

export async function getAllAuthor(req, res) {
    try {
        const { search, categories } = req.query;

        const categoryIds = categories
            ? categories.split(',').map(id => parseInt(id.trim()))
            : [];

        const filterQuery = {
            ...(search && {
                OR: [
                    { fullName: { contains: search } },
                ]
            }),
            ...(categoryIds.length > 0 && {
                AuthorCategory: {
                    some: {
                        categoryId: { in: categoryIds },
                    },
                },
            }),
        };

        const authors = await prisma.author.findMany({
            where: filterQuery,
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
            orderBy: {
                id: "desc",
            },
        });

        const formattedAuthors = await Promise.all(authors.map(async (item) => {
            const isFollowed = await prisma.follow.findFirst({
                where: {
                    followerId: req.user.id,
                    followingId: parseInt(item.id)
                }
            });

            return {
                ...item,
                isFollowed: !!isFollowed,
                avatar_url: item.avatar_url ? `${baseurl}/books/${item.avatar_url}` : null,
                coverImage: item.coverImage ? `${baseurl}/books/${item.coverImage}` : null,
                books: item.books.map((book) => ({
                    ...book,
                    coverImage: book.coverImage ? `${baseurl}/books/${book.coverImage}` : null,
                    pdfUrl: book.pdfUrl ? `${baseurl}/books/${book.pdfUrl}` : null,
                    audioUrl: book.audioUrl ? `${baseurl}/books/${book.audioUrl}` : null,
                })),
            };
        }));

        return res.status(200).json({
            success: true,
            message: "Authors retrieved successfully",
            status: 200,
            authors: formattedAuthors,
        });

    } catch (error) {
        console.error("Error fetching authors:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
}

export async function favOrUnFavBook(req, res) {
    try {
        const { bookId } = req.body;
        const userId = req.user.id;

        const book = await prisma.book.findUnique({
            where: { id: Number(bookId) },
        });
        if (!book) {
            return res.status(404).json({
                success: false,
                message: 'Book not found',
            });
        }

        const existingFavorite = await prisma.favorite.findFirst({
            where: {
                bookId: Number(bookId),
                userId,
            },
        });

        if (existingFavorite) {
            await prisma.favorite.delete({
                where: { id: existingFavorite.id },
            });
            return res.status(200).json({
                success: true,
                message: 'Book unfavorited successfully',
            });
        } else {
            const favorite = await prisma.favorite.create({
                data: {
                    userId,
                    bookId,
                },
            });
            return res.status(201).json({
                success: true,
                message: 'Book favorited successfully',
                favorite,
            });
        }
    } catch (error) {
        console.error("Error toggling favorite status:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
}

// export async function favBook(req, res) {
//     try {
//         const { bookId } = req.body;
//         const userId = req.user.id;

//         const book = await prisma.book.findUnique({
//             where: { id: Number(bookId) },
//         });
//         const existingFavorite = await prisma.favorite.findFirst({
//             where: {
//                 bookId: Number(bookId),
//                 userId,
//             },
//         });
//         if (existingFavorite) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Book already favorited',
//             });
//         }

//         const favorite = await prisma.favorite.create({
//             data: {
//                 userId, 
//                 bookId,
//             },
//         });

//         return res.status(201).json({
//             success: true,
//             message: 'Book favorited successfully',
//             favorite,
//         });
//     } catch (error) {
//         console.error("Error fetching top authors:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             error: error.message
//         });
//     }
// }

export async function getAllfavBook(req, res) {
    try {
        const favBooks = await prisma.favorite.findMany({
            where: {
                userId: req.user.id
            },
            include: {
                Purchase: true,
                book: true,
                user: true
            }
        });

        console.log('favBooks', favBooks)

        favBooks.map(fav => {
            if (fav.book) {
                fav.book.coverImage = fav.book.coverImage ? baseurl + "/books/" + fav.book.coverImage : null;
                fav.book.pdfUrl = fav.book.pdfUrl ? baseurl + "/books/" + fav.book.pdfUrl : null;
                fav.book.audioUrl = fav.book.audioUrl ? baseurl + "/books/" + fav.book.audioUrl : null;
            }
        });

        return res.status(200).json({
            success: true,
            message: "Books retrieved successfully",
            status: 200,
            favBooks
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

export async function followedAuthor(req, res) {
    try {
        const followedAuthor = await prisma.follow.findMany({
            where: {
                followerId: req.user.id
            },
            include: {
                following: true
            },
            orderBy: {
                id: 'desc'
            }
        });

        followedAuthor.map((follow) => {
            const following = follow.following;

            if (following) {
                following.coverImage = following.coverImage
                    ? `${baseurl}/books/${following.coverImage}`
                    : null;

                following.avatar_url = following.avatar_url
                    ? `${baseurl}/books/${following.avatar_url}`
                    : null;
            }

            return follow;
        });

        return res.status(200).json({
            success: true,
            message: "Followed authors retrieved successfully",
            status: 200,
            followedAuthor
        });

    } catch (error) {
        console.error("Error fetching followed authors:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
}

export async function getAllCategories(req, res) {
    try {
        // Step 1: Count books per category
        const categoryBookCounts = await prisma.bookCategory.groupBy({
            by: ['categoryId'],
            _count: { categoryId: true },  // Count number of books in each category
        });

        // Step 2: Fetch all categories
        let categories = await prisma.category.findMany({
            include: {
                books: {
                    include: { book: true },
                    take: 1, // Fetch only one book per category
                },
            },
        });

        // Step 3: Merge book count data into categories
        categories = categories.map((category) => {
            const bookCountData = categoryBookCounts.find(c => c.categoryId === category.id);
            return {
                ...category,
                bookCount: bookCountData ? bookCountData._count.categoryId : 0, // Default to 0 if no books
            };
        });

        // Step 4: Sort categories
        categories.sort((a, b) => {
            if (b.bookCount === a.bookCount) {
                return b.id - a.id; // If book count is the same, sort by category ID (Descending)
            }
            return b.bookCount - a.bookCount; // Sort by book count (Descending)
        });

        // Step 5: Format book URLs
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
            categories,
        });

    } catch (error) {
        console.error("Error fetching categories:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
}

export const getBookById = async (req, res) => {
    const { id } = req.params;
    try {
        const book = await prisma.book.findUnique({
            where: { id: parseInt(id) },
            include: {
                bookMedia: true,
                author: true,
                Purchase: true,
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

export async function getAllAuthorById(req, res) {
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

export const addToCart = async (req, res) => {
    const { bookId, quantity } = req.body;

    const schema = Joi.object({
        bookId: Joi.number().required(),
        quantity: Joi.number().required(),
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

    try {
        const userId = req.user.id;

        const book = await prisma.book.findUnique({
            where: { id: bookId },
        });


        const existingCartItem = await prisma.cart.findUnique({
            where: {
                userId_bookId: { userId, bookId },
            },
        });

        if (existingCartItem) {
            const newQuantity = existingCartItem.quantity + quantity;

            if (newQuantity > book.stock) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot add more than ${book.stock} items in cart.`,
                });
            }

            const updatedCart = await prisma.cart.update({
                where: { id: existingCartItem.id },
                data: { quantity: newQuantity },
            });

            return res.json({
                success: true,
                message: "Quantity updated successfully",
                status: 200,
                cart: updatedCart,
            });
        }

        if (quantity > book.stock) {
            return res.status(400).json({
                success: false,
                message: `Cannot add more than ${book.stock} items in cart.`,
            });
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
            message: "Item added to cart successfully",
            status: 200,
            cartItem,
        });

    } catch (error) {
        console.error("Error adding to cart:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

export async function getAllCart(req, res) {
    try {

        const userId = req.user.id;
        const cart = await prisma.cart.findMany({
            where: {
                userId
            },
            include: {
                book: true,
            }
        });

        console.log('userId', userId)
        await Promise.all(
            cart.map((item) => {
                item.book.coverImage = item.book.coverImage ? `${baseurl}/books/${item.book.coverImage}` : null;
                item.book.pdfUrl = item.book.pdfUrl ? `${baseurl}/books/${item.book.pdfUrl}` : null;
                item.book.audioUrl = item.book.audioUrl ? `${baseurl}/books/${item.book.audioUrl}` : null;
            })
        );

        return res.status(200).json({
            success: true,
            message: "Cart retrieved successfully",
            status: 200,
            cart
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

export const updateCart = async (req, res) => {
    const { id, bookId, quantity } = req.body;

    const schema = Joi.object({
        id: Joi.number().required(),
        bookId: Joi.number().optional(),
        quantity: Joi.number().optional(),
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

    try {
        const updatedCart = await prisma.cart.update({
            where: { id: Number(id) },
            data: {
                bookId,
                quantity
            },
        });

        return res.status(200).json({
            success: true,
            message: "Cart updated successfully",
            status: 200,
            data: updatedCart,
        });

    } catch (error) {
        console.error("Error updating cart:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
};

export const deleteCart = async (req, res) => {
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

        const cart = await prisma.cart.findUnique({
            where: {
                id: parseInt(id)
            }
        })
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        await prisma.cart.delete({
            where: { id: parseInt(id) }
        });
        return res.json({
            status: 200,
            success: true,
            message: "Cart Deleted successfully",
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

export const addQuantity = async (req, res) => {
    const { bookId } = req.body;

    const userId = req.user.id;

    try {
        const book = await prisma.book.findUnique({
            where: { id: Number(bookId) },
        });

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found",
            });
        }

        const existingItem = await prisma.cart.findFirst({
            where: {
                userId: Number(userId),
                bookId: Number(bookId),
            },
        });

        let cartItem;
        if (existingItem.quantity >= book.stock) {
            return res.status(400).json({
                success: false,
                message: `You cannot add more than ${book.stock} items for this book.`,
            });
        }

        console.log('book.stock', book.stock)

        cartItem = await prisma.cart.update({
            where: { id: existingItem.id },
            data: { quantity: { increment: 1 } },
        });

        return res.status(200).json({
            success: true,
            message: "Quantity increased",
            data: cartItem,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

export const removeQuantity = async (req, res) => {
    const { bookId } = req.body;

    const userId = req.user.id;

    try {
        const existingItem = await prisma.cart.findFirst({
            where: {
                userId: Number(userId),
                bookId: Number(bookId),
            },
        });

        if (!existingItem) {
            return res.status(404).json({
                success: false,
                message: "Item not found in cart",
            });
        }

        if (existingItem.quantity > 1) {
            const updatedItem = await prisma.cart.update({
                where: { id: existingItem.id },
                data: { quantity: { decrement: 1 } },
            });

            return res.status(200).json({
                success: true,
                message: "Quantity decreased",
                data: updatedItem,
            });
        } else {
            await prisma.cart.delete({
                where: { id: existingItem.id },
            });

            return res.status(200).json({
                success: true,
                message: "Item removed from cart",
            });
        }

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

export const createReview = async (req, res) => {
    try {
        const { bookId, rating, comment } = req.body;

        const userId = req.user.id;

        const schema = Joi.object({
            bookId: Joi.number().required(),
            rating: Joi.number().required(),
            comment: Joi.string().required(),
        });

        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                message: error.details.map((i) => i.message).join(", "),
                status: 400,
                success: false,
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Rating must be between 1 and 5" });
        }

        const review = await prisma.review.create({
            data: { userId, bookId, rating, comment },
        });

        return res.status(200).json({
            success: true,
            message: "Review added successfully",
            status: 200,
            review
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

export const getReviewsBook = async (req, res) => {
    try {
        const { bookId } = req.params;


        const reviews = await prisma.review.findMany({
            where: { bookId: parseInt(bookId) },
            include: { user: true }
        });

        // ✅ Update avatar_url paths
        reviews.map((review) => {
            if (review.user && review.user.avatar_url) {
                review.user.avatar_url = `${baseurl}/books/${review.user.avatar_url}`;
            }
        });

        return res.status(200).json({
            success: true,
            message: "Reviews fetched successfully",
            status: 200,
            reviews
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


export const recordBookRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const { bookId } = req.body;

        let bookRead = await prisma.bookRead.findFirst({
            where: { bookId: parseInt(bookId), userId: parseInt(userId) },
        });

        console.log('bookRead', bookRead)

        if (bookRead) {
            bookRead = await prisma.bookRead.update({
                where: { id: bookRead.id },
                data: {
                    views: { increment: 1 },
                },
            });
            console.log('bookRead', bookRead)
        } else {
            bookRead = await prisma.bookRead.create({
                data: {
                    bookId,
                    userId
                },
            });
        }
        return res.status(200).json({
            success: true,
            message: "Books read successfully",
            status: 200,
            bookRead
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

export async function getAllUserNotification(req, res) {
    try {
        const notifications = await prisma.notification.findMany({
            where: {
                toUserId: req.user.id
            },
            include: {
                byAuthor: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Check if notifications exist
        if (!notifications || notifications.length === 0) {
            return res.status(200).json({
                status: 200,
                success: true,
                message: "No notifications found",
                data: []
            });
        }

        await Promise.all(
            notifications.map(async (notification) => {
                if (notification.byAuthor) {
                    notification.byAuthor.avatar_url = notification.byAuthor.avatar_url
                        ? baseurl + "/books/" + notification.byAuthor.avatar_url
                        : null;
                    notification.byAuthor.coverImage = notification.byAuthor.coverImage
                        ? baseurl + "/books/" + notification.byAuthor.coverImage
                        : null;
                    notification.byAuthor.pdfUrl = notification.byAuthor.pdfUrl
                        ? baseurl + "/books/" + notification.byAuthor.pdfUrl
                        : null;
                    notification.byAuthor.audioUrl = notification.byAuthor.audioUrl
                        ? baseurl + "/books/" + notification.byAuthor.audioUrl
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

// export async function getAllUserNotification(req, res) {
//     try {
//         const notifications = await prisma.notification.findMany({
//             where: {
//                 toUserId: req.user.id 
//             },
//             include: {
//                 byAuthor: true
//             },
//             orderBy: {
//                 createdAt: 'desc'
//             }
//         });

//         await Promise.all(
//             notifications.byAuthor.map(async (byAuthor) => {
//                 byAuthor.coverImage = byAuthor.coverImage ? baseurl + "/books/" + byAuthor.coverImage : null;
//                 byAuthor.pdfUrl = byAuthor.pdfUrl ? baseurl + "/books/" + byAuthor.pdfUrl : null;
//                 byAuthor.audioUrl = byAuthor.audioUrl ? baseurl + "/books/" + byAuthor.audioUrl : null;
//             })
//         );

//         return res.status(200).json({
//             status: 200,
//             success: true,
//             message: "Notifications fetched successfully",
//             data: notifications
//         });
//     } catch (error) {
//         console.error("Error fetching notifications:", error);
//         return res.status(500).json({
//             status: 500,
//             success: false,
//             message: "Internal Server Error",
//             error: error.message
//         });
//     }
// }

export async function deleteNotification(req, res) {
    try {
        let { notificationId } = req.params;

        notificationId = parseInt(notificationId);

        const notification = await prisma.notification.findUnique({
            where: {
                id: notificationId,
                toUserId: req.user.id
            }
        })

        if (!notification) {
            return res.status(400).json({
                status: 400,
                message: 'Notification Not found',
                success: false,
            })
        }
        await prisma.notification.delete({
            where: {
                id: notificationId,
                toUserId: req.user.id
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
        const result = await prisma.notification.deleteMany({
            where: {
                toUserId: req.user.id
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
}

//Anonymous user

export async function getAllAnonymousBook(req, res) {
    try {
        const { search, categories, authorId, minPrice, maxPrice } = req.query;

        const categoryIds = categories ? categories.split(',').map(id => parseInt(id.trim())) : [];

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
                }
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

// export async function getAnonymousTopAuthor(req, res) {
//     try {
//         const topAuthorsGrouped = await prisma.follow.groupBy({
//             by: ['followingId'],
//             _count: { followingId: true },
//             orderBy: { _count: { followingId: 'desc' } },
//             take: 10, 
//         });
//         const topAuthors = await Promise.all(
//             topAuthorsGrouped.map(async (group) => {
//                 const author = await prisma.author.findUnique({
//                     where: { id: group.followingId },
//                     include: { books: true },
//                 });
//                 if (!author) return null;

//                 author.avatar_url = author.avatar_url
//                     ? baseurl + "/books/" + author.avatar_url
//                     : null;
//                 author.coverImage = author.coverImage
//                     ? baseurl + "/books/" + author.coverImage
//                     : null;

//                 await Promise.all(
//                     author.books.map(async (book) => {
//                         book.coverImage = book.coverImage
//                             ? baseurl + "/books/" + book.coverImage
//                             : null;
//                         book.pdfUrl = book.pdfUrl
//                             ? baseurl + "/books/" + book.pdfUrl
//                             : null;
//                         book.audioUrl = book.audioUrl
//                             ? baseurl + "/books/" + book.audioUrl
//                             : null;
//                     })
//                 );
//                 const stats = await getAuthorStats(author.id);

//                 return {
//                     ...author,
//                     publishedCount: stats.publishedCount,
//                     followersCount: stats.followersCount,
//                 };
//             })
//         );

//         const filteredAuthors = topAuthors.filter((author) => author !== null);

//         return res.status(200).json({
//             success: true,
//             message: "Top authors retrieved successfully",
//             topAuthors: filteredAuthors,
//         });
//     } catch (error) {
//         console.error("Error fetching top authors:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             error: error.message,
//         });
//     }
// }

export async function getAnonymousTopAuthor(req, res) {
    try {
        // Step 1: Count books for each author
        const booksCount = await prisma.book.groupBy({
            by: ['authorId'],
            _count: { authorId: true },  // Count books per author
        });

        // Step 2: Count followers for each author
        const followersCount = await prisma.follow.groupBy({
            by: ['followingId'],
            _count: { followingId: true },  // Count followers per author
        });

        // Step 3: Fetch author details (to get creation order)
        const authors = await prisma.author.findMany({
        });

        // Step 4: Merge book count, follower count, and createdAt timestamp
        const authorStats = booksCount.map((bookStat) => {
            const followersStat = followersCount.find(
                (f) => f.followingId === bookStat.authorId
            );
            const author = authors.find((a) => a.id === bookStat.authorId);

            return {
                authorId: bookStat.authorId,
                bookCount: bookStat._count.authorId, // Total books
                followerCount: followersStat ? followersStat._count.followingId : 0, // Total followers
                createdAt: author ? author.createdAt : new Date(0), // Default to oldest date if missing
            };
        });

        // Step 5: Sort by books first, then followers, then creation date
        authorStats.sort((a, b) => {
            if (b.bookCount === a.bookCount) {
                if (b.followerCount === a.followerCount) {
                    return b.createdAt - a.createdAt; // Sort by creation date (latest first)
                }
                return b.followerCount - a.followerCount; // Sort by followers
            }
            return b.bookCount - a.bookCount; // Sort by books
        });

        // Step 6: Get the top 10 authors
        const topAuthors = await Promise.all(
            authorStats.slice(0, 10).map(async (stat) => {
                const author = await prisma.author.findUnique({
                    where: { id: stat.authorId },
                    include: { books: true },
                });

                if (!author) return null;

                // Format URLs
                author.avatar_url = author.avatar_url ? baseurl + "/books/" + author.avatar_url : null;
                author.coverImage = author.coverImage ? baseurl + "/books/" + author.coverImage : null;

                await Promise.all(
                    author.books.map(async (book) => {
                        book.coverImage = book.coverImage ? baseurl + "/books/" + book.coverImage : null;
                        book.pdfUrl = book.pdfUrl ? baseurl + "/books/" + book.pdfUrl : null;
                        book.audioUrl = book.audioUrl ? baseurl + "/books/" + book.audioUrl : null;
                    })
                );

                return {
                    ...author,
                    publishedCount: stat.bookCount,
                    followersCount: stat.followerCount,
                };
            })
        );

        const filteredAuthors = topAuthors.filter((author) => author !== null);

        return res.status(200).json({
            success: true,
            message: "Top authors retrieved successfully",
            topAuthors: filteredAuthors,
        });
    } catch (error) {
        console.error("Error fetching top authors:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
}

// export async function getAllAnonymousCategories(req, res) {
//     try {
//         const categories = await prisma.category.findMany({
//             include: {
//                 books: {
//                     include: {
//                         book: true,
//                     },
//                     take: 1,
//                 },
//             },
//         });

//         await Promise.all(
//             categories.map(async (category) => {
//                 await Promise.all(
//                     category.books.map(async (item) => {
//                         if (item.book) {
//                             item.book.coverImage = item.book.coverImage
//                                 ? baseurl + "/books/" + item.book.coverImage
//                                 : null;
//                             item.book.pdfUrl = item.book.pdfUrl
//                                 ? baseurl + "/books/" + item.book.pdfUrl
//                                 : null;
//                             item.book.audioUrl = item.book.audioUrl
//                                 ? baseurl + "/books/" + item.book.audioUrl
//                                 : null;
//                         }
//                     })
//                 );
//             })
//         );

//         return res.status(200).json({
//             success: true,
//             message: "Categories retrieved successfully",
//             status: 200,
//             categories
//         });

//     } catch (error) {
//         console.error("Error fetching books:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             status: 500,
//             error: error.message,
//         });
//     }
// }

export async function getAllAnonymousCategories(req, res) {
    try {
        // Step 1: Count books per category
        const categoryBookCounts = await prisma.bookCategory.groupBy({
            by: ['categoryId'],
            _count: { categoryId: true },  // Count number of books in each category
        });

        // Step 2: Fetch all categories
        let categories = await prisma.category.findMany({
            include: {
                books: {
                    include: { book: true },
                    take: 1, // Fetch only one book per category
                },
            },
        });

        // Step 3: Merge book count data into categories
        categories = categories.map((category) => {
            const bookCountData = categoryBookCounts.find(c => c.categoryId === category.id);
            return {
                ...category,
                bookCount: bookCountData ? bookCountData._count.categoryId : 0, // Default to 0 if no books
            };
        });

        // Step 4: Sort categories
        categories.sort((a, b) => {
            if (b.bookCount === a.bookCount) {
                return b.id - a.id; // If book count is the same, sort by category ID (Descending)
            }
            return b.bookCount - a.bookCount; // Sort by book count (Descending)
        });

        // Step 5: Format book URLs
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
            categories,
        });

    } catch (error) {
        console.error("Error fetching categories:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
}

export async function getAllAnonymousAuthor(req, res) {
    try {
        const { search, categories } = req.query;

        const categoryIds = categories
            ? categories.split(',').map(id => parseInt(id.trim()))
            : [];

        const filterQuery = {
            ...(search && {
                OR: [
                    { fullName: { contains: search } },
                ]
            }),
            ...(categoryIds.length > 0 && {
                AuthorCategory: {
                    some: {
                        categoryId: { in: categoryIds },
                    },
                },
            }),
        };

        const authors = await prisma.author.findMany({
            where: filterQuery,
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
            orderBy: {
                id: "desc",
            },
        });

        const formattedAuthors = authors.map((item) => {
            return {
                ...item,
                avatar_url: item.avatar_url ? `${baseurl}/books/${item.avatar_url}` : null,
                coverImage: item.coverImage ? `${baseurl}/books/${item.coverImage}` : null,
                books: item.books.map((book) => ({
                    ...book,
                    coverImage: book.coverImage ? `${baseurl}/books/${book.coverImage}` : null,
                    pdfUrl: book.pdfUrl ? `${baseurl}/books/${book.pdfUrl}` : null,
                    audioUrl: book.audioUrl ? `${baseurl}/books/${book.audioUrl}` : null,
                })),
            };
        });

        return res.status(200).json({
            success: true,
            message: "Authors retrieved successfully",
            status: 200,
            authors: formattedAuthors,
        });
    } catch (error) {
        console.error("Error fetching authors:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
}

export async function getAllAnonymousNewBook(req, res) {
    try {
        const books = await prisma.book.findMany({
            include: {
                author: true,
                books: {
                    include: {
                        category: true
                    }
                }
            },
            orderBy: [
                { createdAt: 'desc' },
            ],
            take: 5,
        });

        books.map((item) => {
            item.coverImage = item.coverImage ? baseurl + "/books/" + item.coverImage : null;
            item.pdfUrl = item.pdfUrl ? baseurl + "/books/" + item.pdfUrl : null;
            item.audioUrl = item.audioUrl ? baseurl + "/books/" + item.audioUrl : null;
            return item;
        });

        console.log('Books:', books);

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

export const getAllAnonymousBookById = async (req, res) => {
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
                }
            }
        });

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

export async function getAllAnonymousAuthorById(req, res) {
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

export async function socialLogin(req, res) {
    try {
        const { email, fullName } = req.body;
        if (!email || !fullName) {
            return res.status(400).json({ message: "Email and full name are required" });
        }

        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            user = await prisma.user.create({
                data: { email, fullName },
            });
        }

        const token = jwt.sign({ userId: user.id, email: user.email }, SECRET_KEY, { expiresIn: "7d" });
        return res.status(200).json({
            success: true,
            message: "Login successful",
            status: 200,
            token, user
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

export async function getQASession(req, res) {
    try {
        const userId = req.user.id;

        console.log('userId', userId)

        const followingAuthors = await prisma.follow.findMany({
            where: {
                followerId: userId,
            },
        });

        console.log('followingAuthors', followingAuthors)

        const authorIds = followingAuthors.map((item) => item.followingId);

        const QaSession = await prisma.qASession.findMany({
            where: {
                authorId: {
                    in: authorIds,
                },
                isActive: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                author: {
                    select: {
                        fullName: true,
                    }
                }
            }
        });

        const updatedQaSession = QaSession.map(session => {
            if (session.thumbnail) {
                session.thumbnail = `${baseurl}/books/${session.thumbnail}`;
            }
            return session;
        });


        return res.status(200).json({
            success: true,
            message: "Sessions retrieved successfully",
            status: 200,
            QaSession: updatedQaSession,
        });

    } catch (error) {
        console.error("Error fetching Q&A sessions:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message,
        });
    }
}

export async function getAllFollwedUser(req, res) {
    try {
        // Assuming the author is the logged-in user
        const authorId = req.user.id;

        const followers = await prisma.follow.findMany({
            where: {
                followingId: authorId,
                isFollowed: true // optional: only include confirmed follows
            },
            include: {
                follower: true // includes user who is following the author
            }
        });

        const usersFollowing = followers.map(f => f.follower); // Just return users

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
}

export const ContactIssue = async (req, res) => {
    try {
        const { description, userId } = req.body;

        const issue = await prisma.contactIssue.create({
            data: {
                description,
                user: {
                    connect: { id: userId }
                }
            },
        });

        return res.status(200).json({
            success: true,
            message: "Issue registered successfully",
            status: 200,
            issue
        });

    } catch (error) {
        console.error("Error creating contact issue:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            status: 500,
            error: error.message
        });
    }
}

export const updateContactIssue = async (req, res) => {
    try {
        const { id } = req.params;
        const { description } = req.body;

        const schema = Joi.object({
            description: Joi.string().optional().allow(null, ''),
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

        const updatedIssue = await prisma.contactIssue.update({
            where: { id: parseInt(id) },
            data: { description }
        });

        console.log('updatedIssue', updatedIssue)

        return res.status(200).json({
            success: true,
            message: "Contact issue updated successfully",
            status: 200,
            updatedIssue
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

export const anonymousContactIssue = async (req, res) => {
    try {
        const { description, name, email } = req.body;

        if (!description) {
            return res.status(400).json({
                success: false,
                message: "Description is required",
                status: 400
            });
        }

        const issue = await prisma.contactIssue.create({
            data: {
                description,
                name,
                email
            }
        });

        return res.status(200).json({
            success: true,
            message: "Issue registered successfully",
            issue
        });

    } catch (error) {
        console.error("Anonymous contact issue error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};


// export const purchaseBook = async (req, res) => {
//     try {
//         const userId = req.user.id;
//         const { bookId, success_url, cancel_url } = req.body;

//         const book = await prisma.book.findUnique({
//             where: { id: bookId },
//             include: { author: true },
//         });

//         if (!book) {
//             return res.status(404).json({ error: 'Book not found.' });
//         }


//         if (book.isFree) {
//             const existing = await prisma.purchase.findFirst({
//                 where: { userId, bookId },
//             });

//             if (!existing) {
//                 await prisma.purchase.create({
//                     data: {
//                         userId,
//                         bookId,
//                         amount: 0,
//                         isHeld: false,
//                     },
//                 });
//             }

//             return res.status(200).json({ message: 'Book added to your library (free).' });
//         }

//         const author = book.author;
//         let isOnboarded = false;

//         if (author?.stripeAccountId) {
//             const account = await stripe.accounts.retrieve(author.stripeAccountId);
//             if (account.charges_enabled && account.payouts_enabled) {
//                 isOnboarded = true;
//             }
//         }

//         const lineItem = {
//             price_data: {
//                 currency: 'usd',
//                 product_data: {
//                     name: book.title,
//                 },
//                 unit_amount: Math.round(book.price * 100),
//             },
//             quantity: 1,
//         };

//         const metadata = {
//             userId: userId.toString(),
//             bookId: book.id.toString(),
//             authorId: author?.id?.toString() || '',
//             isOnboarded: isOnboarded.toString(),
//         };

//         const sessionParams = {
//             payment_method_types: ['card'],
//             mode: 'payment',
//             line_items: [lineItem],
//             metadata,
//             success_url: success_url,
//             cancel_url: cancel_url,
//         };

//         if (isOnboarded) {
//             sessionParams.payment_intent_data = {
//                 application_fee_amount: 0,
//                 transfer_data: {
//                     destination: author.stripeAccountId,
//                 },
//             };
//         }

//         const session = await stripe.checkout.sessions.create(sessionParams);
//         return res.status(200).json({
//             status: 200,
//             sessionUrl: session.url
//         });

//     } catch (error) {
//         console.log(error);
//         return res.status(500).json({
//             status: 500,
//             message: 'Internal Server Error',
//             success: false,
//             error: error.message,
//         });
//     }
// };

export const purchaseBook = async (req, res) => {
    try {
        const userId = req.user.id;
        const { bookId, success_url, cancel_url } = req.body;

        const book = await prisma.book.findUnique({
            where: { id: bookId },
            include: { author: true },
        });

        if (!book) {
            return res.status(404).json({ error: 'Book not found.' });
        }

        // Free book flow
        if (book.isFree) {
            const existing = await prisma.purchase.findFirst({
                where: { userId, bookId },
            });

            if (!existing) {
                await prisma.purchase.create({
                    data: {
                        userId,
                        bookId,
                        authorId:book.authorId,
                        amount: 0,
                        isHeld: false,
                    },
                });
            }

            return res.status(200).json({ message: 'Book added to your library (free).' });
        }

        const author = book.author;
        const priceInCents = Math.round(book.price * 100);
        let sessionParams = {
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: book.title },
                    unit_amount: priceInCents,
                },
                quantity: 1,
            }],
            metadata: {
                userId: userId.toString(),
                bookId: book.id.toString(),
                authorId: author?.id?.toString() || '',
                isCreatedByAdmin: author?.isCreatedByAdmin ? 'true' : 'false',
            },
            success_url: success_url,
            cancel_url: cancel_url,
        };

        // Paid book logic starts
        if (author?.isCreatedByAdmin) {
            // Book is created by Admin on behalf of Author → full amount to admin (platform)
            // No transfer_data applied
            sessionParams.payment_intent_data = {
                application_fee_amount: 0
            };
        } else if (author?.stripeAccountId) {
            // Normal author flow → split 90% to author, 10% to platform
            const platformFee = Math.round(priceInCents * 0.10);
            const authorAmount = priceInCents - platformFee;

            sessionParams.payment_intent_data = {
                application_fee_amount: platformFee,
                transfer_data: {
                    destination: author.stripeAccountId,
                },
            };
        } 
        // Else: author has no stripeAccountId → full amount goes to platform
        // No transfer_data applied automatically (Stripe default)

        const session = await stripe.checkout.sessions.create(sessionParams);

        return res.status(200).json({
            status: 200,
            sessionUrl: session.url
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



export const createOrder = async (req, res) => {
    try {
        const { userId, bookId, authorId, price, costPrice, quantity, discount, paymentMethod } = req.body;
        const orderId = `ORD${Date.now()}`;

        const commissionAmount = price * 0.10; // 10% platform fee
        const authorEarning = price - commissionAmount;

        const order = await prisma.order.create({
            data: {
                orderId,
                userId,
                bookId,
                authorId,
                price,
                costPrice,
                quantity,
                discount,
                commissionAmount,
                authorEarning,
                paymentMethod,
                status: 'paid',
            },
        });

        return res.status(200).json({
            status: 200,
            message: 'Order created successfully',
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

export const getAllOrder = async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            include: { user: true, book: true, author: true },
            orderBy: { createdAt: 'desc' },
        });

        return res.status(200).json({
            status: 200,
            message: 'Order Fetched successfully',
            orders
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

export const getAllOrderById = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await prisma.order.findUnique({
            where: { id: parseInt(id) },
            include: { user: true, book: true, author: true },
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        return res.status(200).json({
            status: 200,
            message: 'Order Fetched successfully',
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

export const updateOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const order = await prisma.order.update({
            where: { id: parseInt(id) },
            data: { status },
        });

        return res.status(200).json({
            status: 200,
            message: 'Order status updated successfully',
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



// export const purchaseBook = async (req, res) => {
//     try {
//         const userId = req.user.id;
//         const { bookId } = req.body;

//         const book = await prisma.book.findUnique({
//             where: { id: bookId },
//             include: { author: true },
//         });

//         if (!book) {
//             return res.status(404).json({ error: 'Book not found.' });
//         }

//         // ✅ FREE BOOK: Grant access immediately
//         if (book.isFree) {
//             // Check if user already has the book
//             const existing = await prisma.purchase.findFirst({
//                 where: { userId, bookId },
//             });

//             console.log('book.isFree', book.isFree)

//             if (!existing) {
//                 await prisma.purchase.create({
//                     data: {
//                         userId,
//                         bookId,
//                         amount: 0,
//                         isHeld: false,
//                     },
//                 });
//             }

//             return res.status(200).json({ message: 'Book added to your library (free).' });
//         }

//         const author = book.author;

//         let isOnboarded = false;

//         // ✅ Check author's Stripe status
//         if (author?.stripeAccountId) {
//             const account = await stripe.accounts.retrieve(author.stripeAccountId);

//             if (account.charges_enabled && account.payouts_enabled) {
//                 isOnboarded = true;
//             }
//         }

//         const lineItem = {
//             price_data: {
//                 currency: 'usd',
//                 product_data: {
//                     name: book.title,
//                 },
//                 unit_amount: Math.round(book.price * 100),
//             },
//             quantity: 1,
//         };

//         const metadata = {
//             userId: userId.toString(),
//             bookId: book.id.toString(),
//             authorId: author?.id?.toString() || '',
//             isOnboarded: isOnboarded.toString(),
//         };

//         const sessionParams = {
//             payment_method_types: ['card'],
//             mode: 'payment',
//             line_items: [lineItem],
//             metadata,
//             success_url: `${process.env.FRONTEND_URL}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
//             cancel_url: `${process.env.FRONTEND_URL}/book/${book.id}`,
//         };


//         // ✅ Route earnings if author is onboarded
//         if (isOnboarded) {
//             sessionParams.payment_intent_data = {
//                 application_fee_amount: 0, // add your platform fee here
//                 transfer_data: {
//                     destination: author.stripeAccountId,
//                 },
//             };
//         }

//         const session = await stripe.checkout.sessions.create(sessionParams);
//         return res.status(200).json({
//             status: 200,
//             sessionUrl: session.url
//         });
//     } catch (error) {
//         console.log(error);
//         return res.status(500).json({
//             status: 500,
//             message: 'Internal Server Error',
//             success: false,
//             error: error
//         });
//     }
// }


