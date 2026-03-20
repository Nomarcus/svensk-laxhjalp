// firebase-admin is CJS — use dynamic import with interop
let _admin: any = null;
let _db: any = null;
let _authAdmin: any = null;
let _fieldValue: any = null;

async function getAdmin() {
  if (_admin) return _admin;
  const mod = await import('firebase-admin');
  _admin = mod.default || mod;

  if (!_admin.apps?.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccount) {
      _admin.initializeApp({
        credential: _admin.credential.cert(JSON.parse(serviceAccount)),
      });
    } else {
      _admin.initializeApp();
    }
  }

  _db = _admin.firestore();
  _authAdmin = _admin.auth();
  _fieldValue = _admin.firestore.FieldValue;
  return _admin;
}

export async function getDb() {
  await getAdmin();
  return _db;
}

export async function getAuthAdmin() {
  await getAdmin();
  return _authAdmin;
}

export async function getFieldValue() {
  await getAdmin();
  return _fieldValue;
}
