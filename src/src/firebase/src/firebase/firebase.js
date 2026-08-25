import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  onValue,
  update,
} from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyA_2ZdTthwVbQI1SHd_YXg17K3nrZoEUNU",
  authDomain: "sandiwa-photobooth.firebaseapp.com",
  projectId: "sandiwa-photobooth",
  storageBucket: "sandiwa-photobooth.firebasestorage.app",
  messagingSenderId: "393476825962",
  appId: "1:393476825962:web:9efc9bcbdb0b3952567b13",
  measurementId: "G-62K923CNB7",
};

const app = initializeApp(firebaseConfig);

export const database = getDatabase(app);

export const createSession = async (sessionId) => {
  await set(ref(database, `sessions/${sessionId}`), {
    status: "waiting",
    command: "idle",
    createdAt: Date.now(),
  });
};

export const listenToSession = (sessionId, callback) => {
  return onValue(
    ref(database, `sessions/${sessionId}`),
    (snapshot) => {
      callback(snapshot.val());
    }
  );
};

export const updateSession = async (sessionId, data) => {
  await update(
    ref(database, `sessions/${sessionId}`),
    data
  );
};