import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';

let firebaseConfig = {};
try {
  // We'll fetch this from the server
} catch (e) {}

let app: any;
export let auth: any;
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/forms.body');

export const initFirebase = async () => {
  if (app) return;
  const res = await fetch('/api/firebase-config');
  firebaseConfig = await res.json();
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  await initFirebase();
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token');
    }
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  }
};
