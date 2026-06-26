import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, User, Auth } from "firebase/auth";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/forms.body");

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    if (!app) {
      const res = await fetch("/api/firebase-config");
      if (!res.ok) throw new Error("Firebase config not available");
      const firebaseConfig = await res.json();
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
    }

    const result = await signInWithPopup(auth!, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get access token");
    }
    return { user: result.user, accessToken: credential.accessToken };
  } catch (err) {
    console.error(err);
    throw err;
  }
};
