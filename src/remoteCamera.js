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
// CONTROLLER → IPAD
// SEND TAKEN PHOTO TO IPAD
// =====================================================

export async function sendControllerPhoto(photo, index) {
  if (!photo) {
    throw new Error("No controller photo provided.");
  }

  await update(getSessionRef(), {
    controllerPhoto: photo,
    controllerPhotoIndex: index,
    controllerPhotoSentAt: Date.now(),
  });

  console.log(
    "💻➡️📱 Photo sent to iPad:",
    index + 1
  );
}

// =====================================================
// CONTROLLER → IPAD
// SEND FINAL RESULT TO IPAD
// =====================================================

export async function sendFinalResultToCamera(result) {
  if (!result) {
    throw new Error("No final result provided.");
  }

  await update(getSessionRef(), {
    finalResult: result,
    finalResultSentAt: Date.now(),
  });

  console.log(
    "💻➡️📱 Final result sent to iPad"
  );
}

// =====================================================
// CLEAR CONTROLLER PHOTO
// =====================================================

export async function clearControllerPhoto() {
  await update(getSessionRef(), {
    controllerPhoto: null,
    controllerPhotoIndex: null,
  });
}

// =====================================================
// CONTROLLER → CAMERA
// SHOW LATEST TAKEN PHOTO ON IPAD
// =====================================================

export async function sendControllerPreview(
  image,
  photoNumber = null
) {
  if (!image) {
    return;
  }

  const previewId =
    `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}`;

  await update(getSessionRef(), {
    controllerPreview: image,
    controllerPreviewId: previewId,
    controllerPreviewAt: Date.now(),
    controllerPreviewNumber:
      photoNumber,
    controllerStatus: "photo-preview",
  });

  console.log(
    "📱 Preview sent to iPad:",
    previewId
  );

  return previewId;
}

// =====================================================
// CONTROLLER → CAMERA
// SHOW FINAL RESULT ON IPAD
// =====================================================

export async function sendControllerResult(
  stripImage,
  printImage = null
) {
  if (!stripImage) {
    return;
  }

  const resultId =
    `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}`;

  await update(getSessionRef(), {
    controllerResult: stripImage,
    controllerPrint: printImage || null,
    controllerResultId: resultId,
    controllerResultAt: Date.now(),
    controllerStatus: "result-ready",
  });

  console.log(
    "🎉 Final result sent to iPad:",
    resultId
  );

  return resultId;
}

// =====================================================
// CLEAR PREVIEW
// =====================================================

export async function clearControllerPreview() {
  await update(getSessionRef(), {
    controllerPreview: null,
    controllerPreviewId: null,
    controllerPreviewAt: null,
    controllerPreviewNumber: null,
    controllerStatus: null,
  });

  console.log(
    "🧹 Controller preview cleared"
  );
}

// =====================================================
// CLEAR RESULT
// =====================================================

export async function clearControllerResult() {
  await update(getSessionRef(), {
    controllerResult: null,
    controllerPrint: null,
    controllerResultId: null,
    controllerResultAt: null,
  });

  console.log(
    "🧹 Controller result cleared"
  );
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