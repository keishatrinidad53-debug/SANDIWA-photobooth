import { useEffect, useRef, useState } from "react";
import {
  createRoom,
  watchRoom,
  updateRoom,
  deleteRoom,
} from "../firebase/webrtc";

export default function DeviceMode() {
  const [mode, setMode] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [inputRoom, setInputRoom] = useState("");

  const [status, setStatus] =
    useState("Not connected");

  const videoRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  // =====================================================
  // LAPTOP — CREATE ROOM
  // =====================================================

  async function startController() {
    try {
      const id = await createRoom();

      setRoomId(id);
      setMode("controller");
      setStatus("Waiting for camera...");
    } catch (error) {
      console.error(error);
      alert("Unable to create room.");
    }
  }

  // =====================================================
  // IPAD / IPHONE — JOIN ROOM
  // =====================================================

  async function startCamera() {
    if (!inputRoom.trim()) {
      alert("Enter the room code first.");
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: {
              ideal: 1920,
            },
            height: {
              ideal: 1080,
            },
          },
          audio: false,
        });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setRoomId(
        inputRoom
          .trim()
          .toUpperCase()
      );

      setMode("camera");
      setStatus("Camera ready");
    } catch (error) {
      console.error(error);

      alert(
        "Camera permission was denied or unavailable."
      );
    }
  }

  // =====================================================
  // CLEANUP
  // =====================================================

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }

      if (peerRef.current) {
        peerRef.current.close();
      }
    };
  }, []);

  // =====================================================
  // MODE SELECTION
  // =====================================================

  if (!mode) {
    return (
      <div className="device-mode">

        <h2>
          SANDIWA DEVICE SETUP
        </h2>

        <p>
          Choose how this device
          will be used.
        </p>

        <div className="device-buttons">

          <button
            onClick={
              startController
            }
          >
            💻
            <strong>
              CONTROLLER
            </strong>
            <small>
              Use laptop
            </small>
          </button>

          <button
            onClick={() =>
              setMode("camera-entry")
            }
          >
            📱
            <strong>
              CAMERA
            </strong>
            <small>
              Use iPhone / iPad
            </small>
          </button>

        </div>

      </div>
    );
  }

  // =====================================================
  // CAMERA ROOM ENTRY
  // =====================================================

  if (mode === "camera-entry") {
    return (
      <div className="device-mode">

        <h2>
          📱 CAMERA MODE
        </h2>

        <p>
          Enter the code shown
          on the laptop.
        </p>

        <input
          value={inputRoom}
          onChange={(e) =>
            setInputRoom(
              e.target.value
            )
          }
          placeholder="ROOM CODE"
          maxLength={6}
        />

        <button
          className="primary"
          onClick={
            startCamera
          }
        >
          CONNECT CAMERA
        </button>

      </div>
    );
  }

  // =====================================================
  // CAMERA SCREEN
  // =====================================================

  if (mode === "camera") {
    return (
      <div className="camera-device">

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
        />

        <div className="camera-status">

          🟢 CAMERA READY

          <br />

          ROOM:
          {" "}
          {roomId}

        </div>

      </div>
    );
  }

  // =====================================================
  // CONTROLLER SCREEN
  // =====================================================

  return (
    <div className="controller-device">

      <h2>
        💻 SANDIWA CONTROLLER
      </h2>

      <div className="room-code">

        <small>
          CAMERA CODE
        </small>

        <strong>
          {roomId}
        </strong>

      </div>

      <p>
        {status}
      </p>

      <button
        className="primary"
        onClick={() => {
          deleteRoom(roomId);
          setMode(null);
          setRoomId("");
        }}
      >
        DISCONNECT
      </button>

    </div>
  );
}