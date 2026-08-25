import {
  ref,
  set,
  onValue,
  update
} from "firebase/database";

import { database } from "./firebase";

const SESSION_ID = "sandiwa-booth";

export function getSessionRef() {
  return ref(
    database,
    `photobooth/${SESSION_ID}`
  );
}

export function sendCaptureCommand() {
  return update(
    getSessionRef(),
    {
      command: "capture",
      commandId: Date.now(),
      status: "waiting"
    }
  );
}

export function sendCameraReady() {
  return update(
    getSessionRef(),
    {
      cameraStatus: "ready"
    }
  );
}

export function sendPhoto(photo) {
  return update(
    getSessionRef(),
    {
      photo,
      status: "photo-ready",
      photoId: Date.now()
    }
  );
}

export function clearRemotePhoto() {
  return update(
    getSessionRef(),
    {
      photo: null,
      status: "idle"
    }
  );
}

export function listenToSession(callback) {
  return onValue(
    getSessionRef(),
    (snapshot) => {
      callback(
        snapshot.val() || {}
      );
    }
  );
}