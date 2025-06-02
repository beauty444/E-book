import jwt from 'jsonwebtoken';
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();
const prisma = new PrismaClient();


export async function authorAuth(req, res, next) {
  try {
    const header = req.headers.authorization;

    const secretKey = process.env.SECRET_KEY;

    if (!header) {
      return res.status(401).json({
        message: "Token Not Provided",
        status: 400,
        success: false,
      });
    }
    const [bearer, token] = header.split(' ');
    console.log(token);
    console.log(secretKey);
    // Verify the token
    const decoded = jwt.verify(token, secretKey);
    console.log(decoded);
    const user = await prisma.author.findUnique({
      where: {
        id: decoded.authorId,
      },
    })

    console.log('user',user )
    if (user) {
      req.user = user;
      next();
    }
    else {
      return res.status(403).json({
        message: "Access Forbidden",
        status: 401,
        success: false,
      });
    }
  } catch (error) {
    return res.status(403).json({
      message: "Access forbidden",
      status: 401,
      success: false,
    });

  }

}
// export async function authorAuth(req, res, next) {
//   try {
//     const header = req.headers.authorization;
//     const secretKey = process.env.SECRET_KEY;

//     if (!header) {
//       return res.status(401).json({
//         message: "Token Not Provided",
//         status: 400,
//         success: false,
//       });
//     }

//     const [bearer, token] = header.split(" ");
//     if (!token) {
//       return res.status(401).json({ message: "Invalid token format" });
//     }

//     // Verify the token
//     const decoded = jwt.verify(token, secretKey);
//     if (!decoded || !decoded.userId) {
//       return res.status(401).json({ message: "Invalid token" });
//     }

//     // Fetch author
//     const user = await prisma.author.findUnique({
//       where: {
//         id: decoded.userId,
//       },
//     });

//     if (!user) {
//       return res.status(403).json({ message: "Access Forbidden" });
//     }

//     req.user = user; // Attach user object to request
//     next();
//   } catch (error) {
//     console.error("Authorization error:", error.message);
//     return res.status(403).json({ message: "Access forbidden" });
//   }
// }
