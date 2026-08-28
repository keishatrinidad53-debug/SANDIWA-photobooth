import {
  ref,
  onValue,
  update,
  remove,
  onDisconnect,
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
// CAMERA CONNECTION
// SET UP DISCONNECT HANDLER
// =====================================================

export async function setupCameraConnection() {
  const sessionRef = getSessionRef();

  try {
    await onDisconnect(sessionRef).update({
      cameraStatus: "offline",
      cameraDisconnectedAt: Date.now(),
    });

    console.log(
      "📱 Firebase camera disconnect handler registered"
    );

    return true;
  } catch (error) {
    console.error(
      "❌ Could not register camera disconnect handler:",
      error
    );

    return false;
  }
}

// =====================================================
// CAMERA → CONTROLLER
// CAMERA READY
// =====================================================

export async function sendCameraReady() {
  try {
    await update(getSessionRef(), {
      cameraStatus: "ready",
      cameraConnectedAt: Date.now(),
      cameraLastSeenAt: Date.now(),
      deviceType: "phone-camera",
    });

    console.log(
      "📱 Camera ready status sent to Firebase"
    );

    return true;
  } catch (error) {
    console.error(
      "❌ Failed to send camera ready:",
      error
    );

    return false;
  }
}

// =====================================================
// CAMERA → CONTROLLER
// HEARTBEAT
// =====================================================

export async function sendCameraHeartbeat() {
  try {
    await update(getSessionRef(), {
      cameraStatus: "ready",
      cameraLastSeenAt: Date.now(),
      deviceType: "phone-camera",
    });

    console.log("💓 Camera heartbeat sent");

    return true;
  } catch (error) {
    console.error(
      "❌ Camera heartbeat failed:",
      error
    );

    return false;
  }
}

// =====================================================
// CONTROLLER → CAMERA
// SEND CAPTURE COMMAND
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
// SEND PHOTO
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
    cameraLastSeenAt: Date.now(),
    deviceType: "phone-camera",
  });

  console.log(
    "📷 Photo sent to Firebase:",
    photoId
  );

  return photoId;
}

// =====================================================
// CONTROLLER → IPAD
// SEND TAKEN PHOTO
// =====================================================

export async function sendControllerPhoto(
  photo,
  index
) {
  if (!photo) {
    throw new Error(
      "No controller photo provided."
    );
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
// SEND FINAL RESULT
// =====================================================

export async function sendFinalResultToCamera(
  result
) {
  if (!result) {
    throw new Error(
      "No final result provided."
    );
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
// CONTROLLER → IPAD
// SHOW PHOTO PREVIEW
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
// CONTROLLER → IPAD
// SHOW FINAL RESULT
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
// CLEAR CONTROLLER PHOTO
// =====================================================

export async function clearControllerPhoto() {
  await update(getSessionRef(), {
    controllerPhoto: null,
    controllerPhotoIndex: null,
  });
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
// CLEAR REMOTE PHOTO
// =====================================================

export async function clearRemotePhoto() {
  await update(getSessionRef(), {
    photo: null,
    photoId: null,
    status: "idle",
  });

  console.log(
    "🧹 Firebase remote photo cleared"
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
