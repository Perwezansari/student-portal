// Firebase SDK Initialization and Service Connectors
const firebaseConfig = {
  apiKey: "AIzaSyChdaUN9nOvup95aHNlySOnNV_H-YKqM70",
  authDomain: "myinstitutionportal.firebaseapp.com",
  projectId: "myinstitutionportal",
  storageBucket: "myinstitutionportal.firebasestorage.app",
  messagingSenderId: "785167140793",
  appId: "1:785167140793:web:d5c570fcacd25107571868"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();