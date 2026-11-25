import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

let cachedWorkspaceAccessToken: string | null = null;
let isSigningIn = false;

export const initAuthListener = (
  onAuthenticated: (user: User) => void,
  onUnauthenticated: () => void
) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      onAuthenticated(user);
    } else if (!isSigningIn) {
      cachedWorkspaceAccessToken = null;
      onUnauthenticated();
    }
  });
};

export const signInWithGoogle = async (): Promise<{
  user: User;
  workspaceToken: string | null;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedWorkspaceAccessToken = credential.accessToken;
    }
    return {
      user: result.user,
      workspaceToken: cachedWorkspaceAccessToken,
    };
  } finally {
    isSigningIn = false;
  }
};

export const getWorkspaceAccessToken = (): string | null => {
  return cachedWorkspaceAccessToken;
};

export const getFirebaseIdToken = async (): Promise<string | null> => {
  if (!auth.currentUser) return null;
  return await auth.currentUser.getIdToken();
};

export const signOutUser = async () => {
  cachedWorkspaceAccessToken = null;
  await auth.signOut();
};
