import {
  ref,
  set,
  update,
  onValue,
  remove,
} from "firebase/database";

import { database } from "./firebase";

function createRoomId() {
  return Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}

// =====================================================
// CREATE ROOM — LAPTOP
// =====================================================

export async function createRoom() {
  const roomId = createRoomId();

  const roomRef = ref(
    database,
    `rooms/${roomId}`
  );

  await set(roomRef, {
    createdAt: Date.now(),
    status: "waiting",
  });

  return roomId;
}

// =====================================================
// WAIT FOR IPAD
// =====================================================

export function watchRoom(
  roomId,
  callback
) {
  const roomRef = ref(
    database,
    `rooms/${roomId}`
  );

  return onValue(
    roomRef,
    (snapshot) => {
      callback(
        snapshot.val()
      );
    }
  );
}

// =====================================================
// SEND SIGNAL
// =====================================================

export async function updateRoom(
  roomId,
  data
) {
  const roomRef = ref(
    database,
    `rooms/${roomId}`
  );

  await update(
    roomRef,
    data
  );
}

// =====================================================
// DELETE ROOM
// =====================================================

export async function deleteRoom(
  roomId
) {
  const roomRef = ref(
    database,
    `rooms/${roomId}`
  );

  await remove(roomRef);
}