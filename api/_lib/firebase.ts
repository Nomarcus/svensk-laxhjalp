import admin from 'firebase-admin';

// In ESM context, firebase-admin default export might be wrapped
const firebaseAdmin = (admin as any).default || admin;

if (!firebaseAdmin.apps?.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(JSON.parse(serviceAccount)),
    });
  } else {
    firebaseAdmin.initializeApp();
  }
}

export const db = firebaseAdmin.firestore();
export const authAdmin = firebaseAdmin.auth();
export const fieldValue = firebaseAdmin.firestore.FieldValue;
export { firebaseAdmin as admin };
