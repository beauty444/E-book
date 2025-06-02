// import multer from 'multer';

// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, 'public/boat/');
//     },
//     filename: (req, file, cb) => {
//         cb(null, Date.now() + '-' + file.originalname);
//     },
// });

// export const upload = multer({ storage: storage });

// import multer from "multer";
// // import path from "path";

// // Storage Configuration
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     let folder = "public/boat/";

//     if (file.mimetype.startsWith("image/")) folder += "images/";
//     else if (file.mimetype === "application/pdf") folder += "pdfs/";
//     else if (file.mimetype.startsWith("audio/")) folder += "audio/";
//     else if (file.mimetype.startsWith("video/")) folder += "videos/";

//     cb(null, folder);
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + "-" + file.originalname);
//   },
// });

// // File Filter
// const fileFilter = (req, file, cb) => {
//   const allowedTypes = ["image/", "application/pdf", "audio/", "video/"];
//   if (allowedTypes.some((type) => file.mimetype.startsWith(type))) {
//     cb(null, true);
//   } else {
//     cb(new Error("Invalid file type"), false);
//   }
// };

// // Multer Middleware
// export const upload = multer({
//   storage: storage,
//   fileFilter: fileFilter,
// });

// import multer from "multer";

// // Configure storage for different media types
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         let folder = "public/uploads/";
//         if (file.mimetype.startsWith("image/")) folder += "images/";
//         else if (file.mimetype === "application/pdf") folder += "pdfs/";
//         else if (file.mimetype.startsWith("audio/")) folder += "audios/";
//         else if (file.mimetype.startsWith("video/")) folder += "videos/";

//         cb(null, folder);
//     },
//     filename: (req, file, cb) => {
//         cb(null, Date.now() + "-" + file.originalname);
//     },
// });

// export const upload = multer({ storage });

import multer from "multer";
// import path from "path";
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/books/"); // Folder where images & files will be stored
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});
 
export const upload = multer({
    storage: storage,
});






// const multer = require('multer');

// const storage_product = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, "public/profile/");
//     },
//     filename: function (req, file, cb) {
//         cb(null, file.fieldname + Date.now() + '.jpg')
//     }
// });
// exports.upload = multer({ storage: storage_product });
