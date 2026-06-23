import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import firebaseConfigFallback from '../../firebase-applet-config.json';

const env = (import.meta as any).env || {};

// Helper para limpar e sanitizar chaves do ambiente, ignorando placeholders de exemplo ou strings inválidas
function cleanValue(val: any, fallback: string, isApiKey = false): string {
  if (!val || typeof val !== 'string') return fallback;
  let trimmed = val.trim();
  
  // Remove aspas simples ou duplas extras se houver (caso venha do .env do usuário com aspas)
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  
  const upper = trimmed.toUpperCase();
  if (
    trimmed === '' ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    upper.startsWith('SUA_') ||
    upper.startsWith('YOUR_') ||
    trimmed.startsWith('<') ||
    (isApiKey && !trimmed.startsWith('AIzaSy'))
  ) {
    return fallback;
  }
  return trimmed;
}

// Dynamically construct config preferring environment variables (from Easypanel/Vite) over static config file
const firebaseConfig = {
  apiKey: cleanValue(env.VITE_FIREBASE_API_KEY, "AIzaSyBoQvK-EALDG3aVxymxxefCEJNJ5Yzz7MA", true),
  authDomain: cleanValue(env.VITE_FIREBASE_AUTH_DOMAIN, "gen-lang-client-0279925838.firebaseapp.com"),
  projectId: cleanValue(env.VITE_FIREBASE_PROJECT_ID, "gen-lang-client-0279925838"),
  storageBucket: cleanValue(env.VITE_FIREBASE_STORAGE_BUCKET, "gen-lang-client-0279925838.firebasestorage.app"),
  messagingSenderId: cleanValue(env.VITE_FIREBASE_MESSAGING_SENDER_ID, "814709675367"),
  appId: cleanValue(env.VITE_FIREBASE_APP_ID, "1:814709675367:web:d9f538032f72b70998cbc2"),
};

if (!firebaseConfig.apiKey) {
  console.warn(
    "[FIREBASE-CONFIG] AVISO: VITE_FIREBASE_API_KEY não foi encontrada nas variáveis de ambiente nem no config local padrão."
  );
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Standardize Google permissions/custom scopes if needed, empty by default
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export { signInWithPopup, signOut };
