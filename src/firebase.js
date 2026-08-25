import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyA_2ZdTthwVbQI1SHd_YXg17K3nrZoEUNU",
  authDomain: "sandiwa-photobooth.firebaseapp.com",

  databaseURL:
    "https://sandiwa-photobooth-default-rtdb.asia-southeast1.firebasedatabase.app",

  projectId: "sandiwa-photobooth",
  storageBucket: "sandiwa-photobooth.firebasestorage.app",
  messagingSenderId: "393476825962",
  appId: "1:393476825962:web:9efc9bcbdb0b3952567b13",
  measurementId: "G-62K923CNB7"
};

const app = initializeApp(firebaseConfig);

export const database = getDatabase(app);