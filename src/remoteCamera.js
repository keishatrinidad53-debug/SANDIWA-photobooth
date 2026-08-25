import {
  ref,
  onValue,
  update,
  remove,
} from "firebase/database";

import { database } from "./firebase";

const SESSION_ID = "sandiwa-booth";

const SESSION_PATH = `photobooth/${SESSION_ID}`;

// =====================================================
// GET SESSION
// =====================================================

export function getSessionRef() {
  return ref(database, SESSION_PATH);
}

// =====================================================
// CONTROLLER → CAMERA
// =====================================================

export async function sendCaptureCommand() {
  const commandId =
    `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}`;

  await update(getSessionRef(), {
    command: "capture",
    commandId,
    commandSentAt: Date.now(),

    // Clear previous photo state
    status: "capture-requested",
  });

  console.log(
    "📸 Capture command sent:",
    commandId
  );

  return commandId;
}

// =====================================================
// CAMERA → CONTROLLER
// =====================================================

export async function sendCameraReady() {
  await update(getSessionRef(), {
    cameraStatus: "ready",
    cameraConnectedAt: Date.now(),

    // Tell controller that camera is alive
    deviceType: "phone-camera",
  });

  console.log(
    "📱 Camera ready status sent to Firebase"
  );
}

// =====================================================
// CAMERA → CONTROLLER
// =====================================================

export async function sendPhoto(photo) {
  if (!photo) {
    throw new Error(
      "No photo data was provided."
    );
  }

  const photoId =
    `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}`;

  await update(getSessionRef(), {
    photo,
    photoId,
    photoSentAt: Date.now(),

    status: "photo-ready",

    cameraStatus: "ready",
  });

  console.log(
    "📷 Photo sent to Firebase:",
    photoId
  );

  return photoId;
}

// =====================================================
// CLEAR PHOTO
// =====================================================

export async function clearRemotePhoto() {
  await update(getSessionRef(), {
    photo: null,
    photoId: null,
    status: "idle",
  });

  console.log(
    "🧹 Remote photo cleared"
  );
}

// =====================================================
// CLEAR CAPTURE COMMAND
// =====================================================

export async function clearCaptureCommand() {
  await update(getSessionRef(), {
    command: null,
    commandId: null,
    commandSentAt: null,
  });

  console.log(
    "🧹 Capture command cleared"
  );
}

// =====================================================
// LISTEN TO SESSION
// =====================================================

export function listenToSession(callback) {
  console.log(
    "👂 Listening to Firebase:",
    SESSION_PATH
  );

  const unsubscribe = onValue(
    getSessionRef(),
    (snapshot) => {
      const data =
        snapshot.val() || {};

      console.log(
        "🔥 Firebase session:",
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

  return unsubscribe;
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