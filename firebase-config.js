// ============================================================
// FIREBASE CONFIG — apna project ka config yahan paste karo
// Kahan milega: Firebase Console > ⚙️ Project settings >
// "Your apps" section > Web app > SDK setup and configuration
// (README.md ka Step 4 dekhein)
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyChdaUN9nOvup95aHNlySOnNV_H-YKqM70",
  authDomain: "myinstitutionportal.firebaseapp.com",
  projectId: "myinstitutionportal",
  storageBucket: "myinstitutionportal.firebasestorage.app",
  messagingSenderId: "785167140793",
  appId: "1:785167140793:web:d5c570fcacd25107571868"
};

// Ye config public dikhna normal hai — asli security Firestore
// Rules se aati hai (firestore.rules), is key se nahi. Isliye
// isko GitHub par public repo mein rakhna bilkul safe hai.

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
