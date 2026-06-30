import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

let firebaseConfig = {};
try {
  // We'll fetch this from the server
} catch (e) {}

let app: any;
export let auth: any;
export let db: Firestore;
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/forms.body');

export const initFirebase = async () => {
  if (app) return;
  try {
    const res = await fetch('/api/firebase-config');
    if (!res.ok) {
      throw new Error(`Firebase config endpoint returned status ${res.status}`);
    }
    const config = await res.json();
    if (!config || config.error || !config.apiKey) {
      throw new Error('Firebase configuration file (firebase-applet-config.json) is missing or contains an invalid/missing apiKey. Please run "Set up Firebase" to provision/restore the Firebase credentials.');
    }
    firebaseConfig = config;
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err: any) {
    console.error('Failed to initialize Firebase:', err);
    throw new Error(err.message || 'Firebase initialization failed. Please check your Firebase configuration setup.');
  }
};


export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  await initFirebase();
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Please verify that your Firebase configuration is valid and has been set up.');
  }
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google sign-in.');
    }
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  }
};
