// import admin from 'firebase-admin';
// import { promises as fs } from 'fs';
// import path from 'path';

// const serviceAccountPath = path.join(process.cwd(), 'config/firebase-config.json');
// const serviceAccount = {JSON.parse(await fs.readFile(serviceAccountPath, 'utf-8'));}

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// export default admin;


import admin from 'firebase-admin';
import { promises as fs } from 'fs';
import path from 'path';

// Load service account JSON file
const serviceAccountPath = path.join(process.cwd(), 'config/firebase-config.json');
const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, 'utf-8'));

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

export default admin;
