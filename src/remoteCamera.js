import {
  ref,
  onValue,
  update,
  remove,
} from "firebase/database";

import { database } from "./firebase";

const SESSION_ID = "sandiwa-booth";

export function getSessionRef() {
  return ref(
    database,
    `photobooth/${SESSION_ID}`
  );
}

// =====================================================
// CONTROLLER → CAMERA
// =====================================================

export async function sendCaptureCommand() {
  const commandId = Date.now();

  await update(getSessionRef(), {
    command: "capture",
    commandId,
    status: "capture-requested",
  });

  console.log(
    "📸 Capture command sent:",
    commandId
  );
}

// =====================================================
// CAMERA → CONTROLLER
// =====================================================

export async function sendCameraReady() {
  await update(getSessionRef(), {
    cameraStatus: "ready",
    cameraConnectedAt: Date.now(),
  });

  console.log(
    "📱 Camera ready status sent to Firebase"
  );
}

// =====================================================
// CAMERA → CONTROLLER
// =====================================================

export async function sendPhoto(photo) {
  const photoId = Date.now();

  await update(getSessionRef(), {
    photo,
    photoId,
    status: "photo-ready",
    cameraStatus: "ready",
  });

  console.log(
    "📷 Photo uploaded to Firebase:",
    photoId
  );
}

// =====================================================
// CLEAR PHOTO
// =====================================================

export async function clearRemotePhoto() {
  await update(getSessionRef(), {
    photo: null,
    status: "idle",
  });

  console.log(
    "🧹 Remote photo cleared"
  );
}

// =====================================================
// LISTEN TO SESSION
// =====================================================

export function listenToSession(callback) {
  console.log(
    "👂 Listening to Firebase session:",
    `photobooth/${SESSION_ID}`
  );

  return onValue(
    getSessionRef(),
    (snapshot) => {
      const data =
        snapshot.val() || {};

      console.log(
        "🔥 Firebase session update:",
        data
      );

      callback(data);
    },
    (error) => {
      console.error(
        "❌ Firebase listener error:",
        error
      );
    }
  );
}

// =====================================================
// RESET SESSION
// =====================================================

export async function resetRemoteSession() {
  await remove(getSessionRef());

  console.log(
    "🧹 Firebase photobooth session reset"
  );
}