import admin from 'firebase-admin'

function getServiceAccount() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('[Firebase Admin] FIREBASE_SERVICE_ACCOUNT env var is not set')
    return null
  }
  try {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  } catch {
    console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON')
    return null
  }
}

let _initialized = false

function ensureInitialized() {
  if (_initialized) return
  _initialized = true

  const serviceAccount = getServiceAccount()
  if (serviceAccount && !admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ||
        process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    })
  }
}

export function getAuth() {
  ensureInitialized()
  return admin.apps.length > 0 ? admin.auth() : null
}

export function getRtdb() {
  ensureInitialized()
  return admin.apps.length > 0 ? admin.database() : null
}

export default admin
