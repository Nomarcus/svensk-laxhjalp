import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
  } else {
    admin.initializeApp();
  }
}

export const db = admin.firestore();
export const authAdmin = admin.auth();
export const fieldValue = admin.firestore.FieldValue;
export { admin };
