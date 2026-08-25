import { useEffect, useRef, useState } from "react";
import { listenToSession, updateSession } from "./firebase";

export default function Camera() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [sessionId, setSessionId] = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("camera");

    if (!id) return;

    setSessionId(id);

    let stream;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setConnected(true);
      } catch (error) {
        console.error("Camera error:", error);
      }
    };

    startCamera();

    const unsubscribe = listenToSession(id, (data) => {
      if (!data) return;

      if (data.command === "take-photo") {
        takePhoto(id);
      }
    });

    return () => {
      unsubscribe();

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const takePhoto = (id) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const photo = canvas.toDataURL("image/jpeg", 0.9);

    updateSession(id, {
      command: "photo-taken",
      photo,
    });
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      <canvas
        ref={canvasRef}
        style={{ display: "none" }}
      />

      {!connected && (
        <div
          style={{
            position: "absolute",
            color: "white",
            fontSize: "24px",
          }}
        >
          Starting camera...
        </div>
      )}
    </div>
  );
}