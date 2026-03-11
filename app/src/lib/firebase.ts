'use client'

import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import {
  getAuth,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
}

let app: FirebaseApp
let auth: Auth

if (typeof window !== 'undefined') {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig)
  } else {
    app = getApps()[0]
  }
  auth = getAuth(app)
}

const googleProvider = new GoogleAuthProvider()

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

export async function getIdToken(): Promise<string | null> {
  const user = auth?.currentUser
  if (!user) return null
  return user.getIdToken()
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}

export { app, auth }
export type { FirebaseUser }
