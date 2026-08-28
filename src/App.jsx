import { useEffect, useRef, useState } from "react";
import "./App.css";

import {
  sendPhoto,
  sendCameraReady,
  listenToSession,
  clearRemotePhoto,
  sendCaptureCommand,
  clearCaptureCommand,
  sendControllerPreview,
  sendControllerResult,
  clearControllerPreview,
  clearControllerResult,
} from "./remoteCamera";

import { generateQR } from "./utils/qrCode";
import { uploadPhoto } from "./utils/uploadPhoto";

const STRIP_WIDTH = 600;
const STRIP_HEIGHT = 1800;

const PRINT_WIDTH = 1200;
const PRINT_HEIGHT = 1800;

function App() {
  // =====================================================
  // REMOTE CAMERA DISPLAY
  // =====================================================

  const [remotePreview, setRemotePreview] = useState(null);
  const [remotePreviewNumber, setRemotePreviewNumber] =
    useState(null);

  const [remoteResult, setRemoteResult] = useState(null);

  // =====================================================
  // DEVICE MODE
  // =====================================================

  const [deviceMode, setDeviceMode] = useState("controller");

  // =====================================================
  // CAMERA SOURCE
  // =====================================================

  const [cameraSource, setCameraSource] = useState(null);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");

  // =====================================================
  // REFS
  // =====================================================

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const localCameraVideoRef = useRef(null);
  const localCameraStreamRef = useRef(null);

  const timerRef = useRef(null);

  const lastCommandRef = useRef(null);
  const remotePhotoIdRef = useRef(null);

  const retakingIndexRef = useRef(null);

  const cameraOperationRef = useRef(0);

  // IMPORTANT:
  // Keeps the latest photos available inside Firebase listeners.
  const photosRef = useRef([]);

  // =====================================================
  // SCREEN
  // =====================================================

  const [screen, setScreen] = useState("home");

  // =====================================================
  // PHOTO SESSION
  // =====================================================

  const [captureMode, setCaptureMode] = useState(4);

  const [photos, setPhotos] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState([]);

  // =====================================================
  // CAMERA / COUNTDOWN
  // =====================================================

  const [countdown, setCountdown] = useState(null);
  const [isCounting, setIsCounting] = useState(false);

  const [cameraReady, setCameraReady] = useState(false);

  const [
    waitingForRemotePhoto,
    setWaitingForRemotePhoto,
  ] = useState(false);

  // =====================================================
  // TEMPLATE
  // =====================================================

  const [template, setTemplate] = useState(null);
  const [templateSlots, setTemplateSlots] = useState([]);

  // =====================================================
  // FINAL IMAGES
  // =====================================================

  const [finalStrip, setFinalStrip] = useState(null);
  const [finalPrint, setFinalPrint] = useState(null);

  // =====================================================
  // QR / UPLOAD
  // =====================================================

  const [qrCode, setQrCode] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // =====================================================
  // GALLERY
  // =====================================================

  const [gallery, setGallery] = useState([]);

  // =====================================================
  // RETAKE
  // =====================================================

  const [retakingIndex, setRetakingIndex] = useState(null);

  // =====================================================
  // KEEP PHOTOS REF SYNCHRONIZED
  // =====================================================

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // =====================================================
  // DETECT DEVICE MODE
  // =====================================================

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("camera") === "1") {
      setDeviceMode("camera");
    } else {
      setDeviceMode("controller");
    }
  }, []);

  // =====================================================
  // LOAD GALLERY
  // =====================================================

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("sandiwa-gallery") || "[]"
      );

      if (Array.isArray(saved)) {
        setGallery(saved);
      } else {
        setGallery([]);
      }
    } catch (error) {
      console.error("Gallery loading error:", error);
      setGallery([]);
    }
  }, []);

  // =====================================================
  // SAVE GALLERY
  // =====================================================

  function saveGallery(image) {
    if (!image) {
      return;
    }

    try {
      const item = {
        id: Date.now(),
        image,
        date: new Date().toLocaleString(),
      };

      setGallery((previous) => {
        const updated = [item, ...previous].slice(0, 30);

        try {
          localStorage.setItem(
            "sandiwa-gallery",
            JSON.stringify(updated)
          );
        } catch (storageError) {
          console.error(
            "Gallery localStorage error:",
            storageError
          );
        }

        return updated;
      });
    } catch (error) {
      console.error("Gallery save error:", error);
    }
  }

  // =====================================================
  // STOP LOCAL CAMERA
  // =====================================================

  function stopLocalCamera() {
    console.log("🛑 Stopping local camera");

    if (localCameraStreamRef.current) {
      localCameraStreamRef.current
        .getTracks()
        .forEach((track) => {
          try {
            track.stop();
          } catch (error) {
            console.error(
              "Error stopping local track:",
              error
            );
          }
        });

      localCameraStreamRef.current = null;
    }

    if (localCameraVideoRef.current) {
      try {
        localCameraVideoRef.current.pause();
      } catch (error) {
        console.error("Video pause error:", error);
      }

      localCameraVideoRef.current.srcObject = null;
    }
  }

  // =====================================================
  // STOP REMOTE CAMERA
  // =====================================================

  function stopRemoteCamera() {
    console.log("🛑 Stopping remote camera stream");

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (error) {
          console.error(
            "Error stopping remote track:",
            error
          );
        }
      });

      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch (error) {
        console.error(
          "Remote video pause error:",
          error
        );
      }

      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
  }

  // =====================================================
  // STOP ALL CAMERAS
  // =====================================================

  function stopAllCameras() {
    cameraOperationRef.current += 1;

    stopLocalCamera();
    stopRemoteCamera();

    setCameraReady(false);
  }

  // =====================================================
  // IPAD / IPHONE REMOTE CAMERA
  // =====================================================

  useEffect(() => {
    if (deviceMode !== "camera") {
      return;
    }

    let active = true;

    async function startRemoteCamera() {
      try {
        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          throw new Error(
            "Camera API is not supported by this browser."
          );
        }

        console.log("📱 Starting iPad/iPhone camera...");

        const stream =
          await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: {
                ideal: "user",
              },
              width: {
                ideal: 1920,
              },
              height: {
                ideal: 1080,
              },
            },
            audio: false,
          });

        if (!active) {
          stream.getTracks().forEach((track) => {
            track.stop();
          });

          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          try {
            await videoRef.current.play();
          } catch (error) {
            console.error(
              "iPad video play error:",
              error
            );
          }
        }

        setCameraReady(true);

        try {
          await sendCameraReady();
        } catch (error) {
          console.error(
            "Could not send camera ready:",
            error
          );
        }

        console.log("📱 iPad camera ready");
      } catch (error) {
        console.error("Remote camera error:", error);

        setCameraReady(false);

        if (active) {
          alert(
            "Camera permission was not granted.\n\nPlease allow camera access and reload the page."
          );
        }
      }
    }

    startRemoteCamera();

    return () => {
      active = false;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });

        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setCameraReady(false);
    };
  }, [deviceMode]);

  // =====================================================
  // IPAD LISTENS FOR CAPTURE COMMAND
  // =====================================================

  useEffect(() => {
    if (deviceMode !== "camera") {
      return;
    }

    const unsubscribe = listenToSession(async (data) => {
      if (!data) {
        return;
      }

      if (data.command !== "capture") {
        return;
      }

      if (!data.commandId) {
        return;
      }

      if (data.commandId === lastCommandRef.current) {
        return;
      }

      lastCommandRef.current = data.commandId;

      console.log(
        "📸 Capture command received:",
        data.commandId
      );

      await captureRemotePhoto();
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [deviceMode]);

  // =====================================================
  // CAPTURE REMOTE PHOTO
  // =====================================================

  async function captureRemotePhoto() {
    const video = videoRef.current;

    if (!video) {
      console.error("Remote camera video not found.");
      return;
    }

    if (
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      console.error(
        "iPad camera has no video frames."
      );

      return;
    }

    try {
      const canvas = document.createElement("canvas");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      // Mirror front camera
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);

      ctx.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const photo = canvas.toDataURL(
        "image/jpeg",
        0.95
      );

      setRemotePreview(photo);

      try {
        await sendPhoto(photo);
      } catch (error) {
        console.error(
          "Could not send photo to laptop:",
          error
        );
      }

      console.log(
        "✅ Photo captured and sent"
      );

      // Do not immediately clear the preview if the
      // controller is going to send its own preview.
      setTimeout(() => {
        setRemotePreview((current) => {
          if (current === photo) {
            return null;
          }

          return current;
        });

        setRemotePreviewNumber((current) => {
          if (remoteResult) {
            return current;
          }

          return current;
        });
      }, 1500);
    } catch (error) {
      console.error(
        "Remote photo error:",
        error
      );
    }
  }

  // =====================================================
  // DETECT LOCAL CAMERAS
  // =====================================================

  async function detectCameras() {
    try {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.enumerateDevices
      ) {
        alert(
          "Your browser does not support camera detection."
        );

        return;
      }

      stopLocalCamera();

      try {
        const temporaryStream =
          await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });

        temporaryStream.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (error) {
        console.error(
          "Camera permission error:",
          error
        );
      }

      const devices =
        await navigator.mediaDevices.enumerateDevices();

      const cameras = devices.filter(
        (device) => device.kind === "videoinput"
      );

      setCameraDevices(cameras);

      if (cameras.length === 0) {
        setSelectedCameraId("");
        return;
      }

      const selectedStillExists = cameras.some(
        (camera) =>
          camera.deviceId === selectedCameraId
      );

      if (!selectedStillExists) {
        setSelectedCameraId(
          cameras[0].deviceId
        );
      }
    } catch (error) {
      console.error(
        "Camera detection error:",
        error
      );

      setCameraDevices([]);
      setSelectedCameraId("");
    }
  }

  // =====================================================
  // START LOCAL CAMERA
  // =====================================================

  async function startLocalCamera() {
    const operationId =
      cameraOperationRef.current + 1;

    cameraOperationRef.current =
      operationId;

    try {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        alert(
          "Your browser does not support camera access."
        );

        return false;
      }

      stopLocalCamera();

      cameraOperationRef.current =
        operationId;

      setCameraReady(false);

      const constraints = {
        video: selectedCameraId
          ? {
              deviceId: {
                exact: selectedCameraId,
              },
              width: {
                ideal: 1920,
              },
              height: {
                ideal: 1080,
              },
            }
          : {
              width: {
                ideal: 1920,
              },
              height: {
                ideal: 1080,
              },
            },
        audio: false,
      };

      const stream =
        await navigator.mediaDevices.getUserMedia(
          constraints
        );

      if (
        cameraOperationRef.current !==
        operationId
      ) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });

        return false;
      }

      localCameraStreamRef.current =
        stream;

      if (
        localCameraVideoRef.current
      ) {
        const video =
          localCameraVideoRef.current;

        video.srcObject = stream;

        try {
          await video.play();
        } catch (error) {
          console.error(
            "Local video play error:",
            error
          );
        }
      }

      const hasVideoFrames =
        await waitForLocalVideoFrames(5000);

      if (
        cameraOperationRef.current !==
        operationId
      ) {
        return false;
      }

      if (!hasVideoFrames) {
        stopLocalCamera();

        setCameraReady(false);

        alert(
          "The camera opened, but no video frames were received."
        );

        return false;
      }

      setCameraReady(true);

      return true;
    } catch (error) {
      console.error(
        "Local camera error:",
        error
      );

      setCameraReady(false);

      if (
        error?.name ===
        "NotAllowedError"
      ) {
        alert(
          "Camera permission was denied."
        );
      } else if (
        error?.name ===
        "NotReadableError"
      ) {
        alert(
          "The camera is being used by another app."
        );
      } else if (
        error?.name ===
        "OverconstrainedError"
      ) {
        alert(
          "This camera could not be opened using the selected settings."
        );
      } else {
        alert(
          `Unable to start this camera.\n\n${
            error?.message ||
            "Check camera permission."
          }`
        );
      }

      return false;
    }
  }

  // =====================================================
  // WAIT FOR LOCAL VIDEO
  // =====================================================

  function waitForLocalVideoFrames(timeout = 5000) {
    return new Promise((resolve) => {
      const start = Date.now();

      function check() {
        const video =
          localCameraVideoRef.current;

        if (
          video &&
          video.readyState >= 2 &&
          video.videoWidth > 0 &&
          video.videoHeight > 0
        ) {
          resolve(true);
          return;
        }

        if (Date.now() - start >= timeout) {
          resolve(false);
          return;
        }

        requestAnimationFrame(check);
      }

      check();
    });
  }

  // =====================================================
  // ATTACH LOCAL STREAM
  // =====================================================

  useEffect(() => {
    if (
      deviceMode !== "controller" ||
      screen !== "camera" ||
      cameraSource === "remote"
    ) {
      return;
    }

    const video =
      localCameraVideoRef.current;

    const stream =
      localCameraStreamRef.current;

    if (!video || !stream) {
      return;
    }

    video.srcObject = stream;

    video
      .play()
      .catch((error) =>
        console.error(
          "Video play error:",
          error
        )
      );

    waitForLocalVideoFrames(5000).then(
      (ready) => {
        if (ready) {
          setCameraReady(true);
        }
      }
    );
  }, [
    deviceMode,
    screen,
    cameraSource,
  ]);

  // =====================================================
  // CAPTURE LOCAL PHOTO
  // =====================================================

  async function captureLocalPhoto() {
    const video =
      localCameraVideoRef.current;

    if (!video) {
      return;
    }

    if (
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      setCameraReady(false);
      return;
    }

    try {
      const canvas =
        document.createElement("canvas");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      // Mirror front camera
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);

      ctx.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const photo =
        canvas.toDataURL(
          "image/jpeg",
          0.95
        );

      // =================================================
      // RETAKE
      // =================================================

      if (
        retakingIndexRef.current !==
        null
      ) {
        const index =
          retakingIndexRef.current;

        setPhotos((previous) => {
          const updated = [...previous];

          updated[index] = photo;

          return updated;
        });

        retakingIndexRef.current =
          null;

        setRetakingIndex(null);

        setSelectedPhotos(
          (previous) => {
            if (
              previous.includes(index)
            ) {
              return previous;
            }

            return [
              ...previous,
              index,
            ];
          }
        );

        setScreen(
          captureMode === 4
            ? "select"
            : "template"
        );

        return;
      }

      // =================================================
      // NORMAL PHOTO
      // =================================================

      setPhotos((previous) => [
        ...previous,
        photo,
      ]);
    } catch (error) {
      console.error(
        "Local photo error:",
        error
      );
    }
  }

  // =====================================================
  // LAPTOP LISTENS FOR REMOTE CAMERA
  // =====================================================

  useEffect(() => {
    if (deviceMode !== "controller") {
      return;
    }

    const unsubscribe =
      listenToSession(async (data) => {
        if (!data) {
          return;
        }

        // =================================================
        // CAMERA READY
        // =================================================

        if (
          cameraSource === "remote" &&
          data.cameraStatus === "ready"
        ) {
          setCameraReady(true);
        }

        // =================================================
        // IGNORE PHOTO IF NOT REMOTE
        // =================================================

        if (cameraSource !== "remote") {
          return;
        }

        // =================================================
        // REMOTE PHOTO
        // =================================================

        if (
          data.status === "photo-ready" &&
          data.photo &&
          data.photoId &&
          data.photoId !==
            remotePhotoIdRef.current
        ) {
          remotePhotoIdRef.current =
            data.photoId;

          console.log(
            "📱 Photo received from iPad"
          );

          const currentPhotos =
            photosRef.current;

          let photoNumber =
            currentPhotos.length + 1;

          // =================================================
          // RETAKE
          // =================================================

          if (
            retakingIndexRef.current !==
            null
          ) {
            const index =
              retakingIndexRef.current;

            photoNumber =
              index + 1;

            setPhotos((previous) => {
              const updated = [
                ...previous,
              ];

              updated[index] =
                data.photo;

              return updated;
            });

            setSelectedPhotos(
              (previous) => {
                if (
                  previous.includes(index)
                ) {
                  return previous;
                }

                return [
                  ...previous,
                  index,
                ];
              }
            );

            retakingIndexRef.current =
              null;

            setRetakingIndex(null);
          } else {
            setPhotos((previous) => [
              ...previous,
              data.photo,
            ]);
          }

          // =================================================
          // SEND PHOTO PREVIEW TO IPAD
          // =================================================

          try {
            setRemotePreviewNumber(
              photoNumber
            );

            await sendControllerPreview(
              data.photo,
              photoNumber
            );
          } catch (error) {
            console.error(
              "Could not send preview:",
              error
            );
          }

          setWaitingForRemotePhoto(false);

          await clearRemotePhotoSafely();
        }
      });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [
    deviceMode,
    cameraSource,
  ]);

  // =====================================================
  // SAFE CLEAR REMOTE PHOTO
  // =====================================================

  async function clearRemotePhotoSafely() {
    try {
      await clearRemotePhoto();
    } catch (error) {
      console.error(
        "Could not clear remote photo:",
        error
      );
    }
  }

  // =====================================================
  // REQUEST REMOTE PHOTO
  // =====================================================

  async function requestRemotePhoto() {
    try {
      if (cameraSource !== "remote") {
        return;
      }

      if (!cameraReady) {
        setWaitingForRemotePhoto(false);
        return;
      }

      setWaitingForRemotePhoto(true);

      await sendCaptureCommand();

      console.log(
        "📸 Capture command sent"
      );
    } catch (error) {
      console.error(
        "Remote capture error:",
        error
      );

      setWaitingForRemotePhoto(false);

      alert(
        "Could not communicate with the iPad/iPhone camera."
      );
    }
  }

  // =====================================================
  // STOP CAMERA
  // =====================================================

  function stopCamera() {
    stopAllCameras();

    setWaitingForRemotePhoto(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setCountdown(null);
    setIsCounting(false);
  }

  // =====================================================
  // CHANGE CAMERA SOURCE
  // =====================================================

  async function changeCameraSource(source) {
    stopCamera();

    try {
      await clearRemotePhoto();
      await clearControllerPreview();
      await clearControllerResult();
      await clearCaptureCommand();
    } catch (error) {
      console.error(
        "Remote cleanup error:",
        error
      );
    }

    setCameraSource(source);

    setRemotePreview(null);
    setRemoteResult(null);
    setRemotePreviewNumber(null);

    if (source === "remote") {
      setCameraReady(false);
      setScreen("camera");

      return;
    }

    setCameraReady(false);
    setScreen("camera-device");

    setTimeout(() => {
      detectCameras();
    }, 100);
  }

  // =====================================================
  // CHOOSE CAPTURE MODE
  // =====================================================

  function chooseCaptureMode(mode) {
    stopCamera();

    setCaptureMode(mode);

    setPhotos([]);
    photosRef.current = [];

    setSelectedPhotos([]);

    setFinalStrip(null);
    setFinalPrint(null);
    setQrCode(null);

    setCountdown(null);
    setIsCounting(false);

    setWaitingForRemotePhoto(false);

    setCameraReady(false);
    setCameraSource(null);

    setRetakingIndex(null);
    retakingIndexRef.current = null;

    setRemotePreview(null);
    setRemoteResult(null);
    setRemotePreviewNumber(null);

    setScreen("camera-source");
  }

  // =====================================================
  // COUNTDOWN
  // =====================================================

  async function startCountdown() {
    if (
      isCounting ||
      waitingForRemotePhoto
    ) {
      return;
    }

    if (!cameraReady) {
      return;
    }

    const video =
      cameraSource === "remote"
        ? videoRef.current
        : localCameraVideoRef.current;

    if (!video) {
      setCameraReady(false);
      return;
    }

    if (
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      setCameraReady(false);
      return;
    }

    if (
      retakingIndexRef.current ===
        null &&
      photosRef.current.length >=
        captureMode
    ) {
      return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsCounting(true);

    let seconds = 5;

    setCountdown(seconds);

    timerRef.current =
      setInterval(() => {
        seconds--;

        if (seconds > 0) {
          setCountdown(seconds);
          return;
        }

        clearInterval(timerRef.current);

        timerRef.current = null;

        setCountdown("📸");

        setTimeout(async () => {
          try {
            if (
              cameraSource === "remote"
            ) {
              await requestRemotePhoto();
            } else {
              await captureLocalPhoto();
            }
          } catch (error) {
            console.error(
              "Capture error:",
              error
            );
          } finally {
            setCountdown(null);
            setIsCounting(false);
          }
        }, 600);
      }, 1000);
  }

  // =====================================================
  // AUTOMATIC PHOTO SEQUENCE
  // =====================================================

  useEffect(() => {
    if (deviceMode !== "controller") {
      return;
    }

    if (
      screen !== "camera" ||
      !cameraReady ||
      isCounting ||
      waitingForRemotePhoto
    ) {
      return;
    }

    // =================================================
    // RETAKE
    // =================================================

    if (
      retakingIndexRef.current !==
      null
    ) {
      const delay =
        setTimeout(() => {
          startCountdown();
        }, 1200);

      return () => {
        clearTimeout(delay);
      };
    }

    // =================================================
    // FINISHED
    // =================================================

    if (
      photosRef.current.length >=
      captureMode
    ) {
      setSelectedPhotos(
        photosRef.current.map(
          (_, index) => index
        )
      );

      if (captureMode === 4) {
        setScreen("select");
      } else {
        setScreen("template");
      }

      return;
    }

    // =================================================
    // NEXT PHOTO
    // =================================================

    const delay =
      setTimeout(() => {
        startCountdown();
      }, 1200);

    return () => {
      clearTimeout(delay);
    };
  }, [
    deviceMode,
    screen,
    cameraReady,
    isCounting,
    waitingForRemotePhoto,
    photos.length,
    captureMode,
    cameraSource,
    retakingIndex,
  ]);

  // =====================================================
  // PHOTO SELECTION
  // =====================================================

  function togglePhoto(index) {
    setSelectedPhotos((previous) => {
      if (previous.includes(index)) {
        return previous.filter(
          (item) => item !== index
        );
      }

      if (previous.length >= 4) {
        return previous;
      }

      return [...previous, index];
    });
  }

  // =====================================================
  // RETAKE PHOTO
  // =====================================================

  async function retakePhoto(index) {
    retakingIndexRef.current =
      index;

    setRetakingIndex(index);

    setCountdown(null);
    setIsCounting(false);

    setWaitingForRemotePhoto(false);

    if (cameraSource === "remote") {
      setCameraReady(true);
      setScreen("camera");

      return;
    }

    setCameraReady(false);
    setScreen("camera");

    await new Promise((resolve) =>
      requestAnimationFrame(resolve)
    );

    const started =
      await startLocalCamera();

    if (!started) {
      retakingIndexRef.current =
        null;

      setRetakingIndex(null);

      setScreen(
        captureMode === 4
          ? "select"
          : "template"
      );

      return;
    }

    setCameraReady(true);
  }

  // =====================================================
  // UPLOAD TEMPLATE
  // =====================================================

  function uploadTemplate(event) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith("image/")
    ) {
      alert(
        "Please upload a JPG or PNG."
      );

      event.target.value = "";
      return;
    }

    const reader =
      new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        alert(
          "Could not read the template."
        );

        return;
      }

      setTemplate(result);

      detectTemplateSlots(result);
    };

    reader.onerror = () => {
      alert(
        "Could not read the template file."
      );
    };

    reader.readAsDataURL(file);

    // Allows the same file to be selected again.
    event.target.value = "";
  }

  // =====================================================
  // DETECT TEMPLATE SLOTS
  // =====================================================

  async function detectTemplateSlots(imageSrc) {
    try {
      const image = new Image();

      image.src = imageSrc;

      await new Promise(
        (resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
        }
      );

      const canvas =
        document.createElement("canvas");

      canvas.width = image.width;
      canvas.height = image.height;

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      ctx.drawImage(
        image,
        0,
        0,
        image.width,
        image.height
      );

      const data =
        ctx.getImageData(
          0,
          0,
          image.width,
          image.height
        ).data;

      const width = image.width;
      const height = image.height;

      const mask =
        new Uint8Array(width * height);

      // =================================================
      // GREEN MASK
      // =================================================

      for (
        let y = 0;
        y < height;
        y++
      ) {
        for (
          let x = 0;
          x < width;
          x++
        ) {
          const i =
            (y * width + x) * 4;

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          if (
            g > 120 &&
            g > r * 1.5 &&
            g > b * 1.3
          ) {
            mask[y * width + x] = 1;
          }
        }
      }

      const visited =
        new Uint8Array(width * height);

      const slots = [];

      // =================================================
      // CONNECTED COMPONENTS
      // =================================================

      for (
        let y = 0;
        y < height;
        y++
      ) {
        for (
          let x = 0;
          x < width;
          x++
        ) {
          const index =
            y * width + x;

          if (
            !mask[index] ||
            visited[index]
          ) {
            continue;
          }

          const queue = [[x, y]];

          visited[index] = 1;

          let minX = x;
          let minY = y;
          let maxX = x;
          let maxY = y;
          let area = 0;

          while (
            queue.length > 0
          ) {
            const [
              cx,
              cy,
            ] = queue.pop();

            area++;

            minX = Math.min(
              minX,
              cx
            );

            minY = Math.min(
              minY,
              cy
            );

            maxX = Math.max(
              maxX,
              cx
            );

            maxY = Math.max(
              maxY,
              cy
            );

            const neighbors = [
              [cx + 1, cy],
              [cx - 1, cy],
              [cx, cy + 1],
              [cx, cy - 1],
            ];

            for (
              const [
                nx,
                ny,
              ] of neighbors
            ) {
              if (
                nx < 0 ||
                ny < 0 ||
                nx >= width ||
                ny >= height
              ) {
                continue;
              }

              const ni =
                ny * width + nx;

              if (
                mask[ni] &&
                !visited[ni]
              ) {
                visited[ni] = 1;

                queue.push([
                  nx,
                  ny,
                ]);
              }
            }
          }

          const boxWidth =
            maxX - minX + 1;

          const boxHeight =
            maxY - minY + 1;

          if (
            area > 10000 &&
            boxWidth > 100 &&
            boxHeight > 100
          ) {
            slots.push({
              x: minX,
              y: minY,
              width: boxWidth,
              height: boxHeight,
              area,
            });
          }
        }
      }

      // =================================================
      // SORT SLOTS
      // =================================================

      slots.sort((a, b) => {
        if (
          Math.abs(a.y - b.y) < 50
        ) {
          return a.x - b.x;
        }

        return a.y - b.y;
      });

      // =================================================
      // FIX 4R TEMPLATE
      //
      // Original template:
      // 1200 × 1800
      //
      // Left strip:
      // 600 × 1800
      //
      // Therefore X/W must be multiplied by 0.5.
      // Y/H stay unchanged.
      // =================================================

      let usableSlots;

      if (
        image.width === PRINT_WIDTH &&
        image.height === PRINT_HEIGHT
      ) {
        usableSlots = slots
          .filter(
            (slot) =>
              slot.x <
              image.width / 2
          )
          .map((slot) => ({
            x: slot.x * 0.5,
            y: slot.y,
            width: slot.width * 0.5,
            height: slot.height,
            area:
              slot.area * 0.5,
          }));
      } else {
        usableSlots = slots.map(
          (slot) => ({
            ...slot,
          })
        );
      }

      setTemplateSlots(
        usableSlots
      );

      console.log(
        "Detected template slots:",
        usableSlots
      );
    } catch (error) {
      console.error(
        "Template detection error:",
        error
      );

      setTemplateSlots([]);

      alert(
        "Could not detect the photo slots in this template."
      );
    }
  }

  // =====================================================
  // LOAD IMAGE
  // =====================================================

  function loadImage(src) {
    return new Promise(
      (resolve, reject) => {
        const image = new Image();

        image.onload = () =>
          resolve(image);

        image.onerror = () =>
          reject(
            new Error(
              "Failed to load image."
            )
          );

        image.src = src;
      }
    );
  }

  // =====================================================
  // DRAW COVER IMAGE
  // =====================================================

  function drawCoverImage(
    ctx,
    image,
    x,
    y,
    width,
    height
  ) {
    const imageRatio =
      image.width /
      image.height;

    const boxRatio =
      width / height;

    let sx = 0;
    let sy = 0;

    let sw = image.width;
    let sh = image.height;

    if (
      imageRatio > boxRatio
    ) {
      sw =
        image.height *
        boxRatio;

      sx =
        (image.width - sw) /
        2;
    } else {
      sh =
        image.width /
        boxRatio;

      sy =
        (image.height - sh) /
        2;
    }

    ctx.drawImage(
      image,
      sx,
      sy,
      sw,
      sh,
      x,
      y,
      width,
      height
    );
  }

  // =====================================================
  // CREATE STRIP
  // =====================================================

  async function createStrip() {
    if (!template) {
      alert(
        "Please upload your template first."
      );

      return false;
    }

    if (
      selectedPhotos.length ===
      0
    ) {
      alert(
        "Please select at least one photo."
      );

      return false;
    }

    if (
      templateSlots.length <
      selectedPhotos.length
    ) {
      alert(
        `Only ${templateSlots.length} photo slots were detected.`
      );

      return false;
    }

    try {
      const templateImage =
        await loadImage(template);

      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        STRIP_WIDTH;

      canvas.height =
        STRIP_HEIGHT;

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        return false;
      }

      // =================================================
      // DRAW TEMPLATE
      // =================================================

      if (
        templateImage.width ===
          PRINT_WIDTH &&
        templateImage.height ===
          PRINT_HEIGHT
      ) {
        // Take only the LEFT 600px of the 4R template.
        ctx.drawImage(
          templateImage,
          0,
          0,
          PRINT_WIDTH / 2,
          PRINT_HEIGHT,
          0,
          0,
          STRIP_WIDTH,
          STRIP_HEIGHT
        );
      } else {
        ctx.drawImage(
          templateImage,
          0,
          0,
          STRIP_WIDTH,
          STRIP_HEIGHT
        );
      }

      const templateData =
        ctx.getImageData(
          0,
          0,
          STRIP_WIDTH,
          STRIP_HEIGHT
        );

      const slots =
        templateSlots.slice(
          0,
          selectedPhotos.length
        );

      // =================================================
      // INSERT PHOTOS
      // =================================================

      for (
        let i = 0;
        i < slots.length;
        i++
      ) {
        const slot = slots[i];

        const selectedIndex =
          selectedPhotos[i];

        const photoSrc =
          photosRef.current[
            selectedIndex
          ];

        if (!photoSrc) {
          console.error(
            "Photo not found:",
            selectedIndex
          );

          continue;
        }

        const photo =
          await loadImage(photoSrc);

        const slotWidth =
          Math.round(slot.width);

        const slotHeight =
          Math.round(slot.height);

        const slotX =
          Math.round(slot.x);

        const slotY =
          Math.round(slot.y);

        if (
          slotWidth <= 0 ||
          slotHeight <= 0
        ) {
          continue;
        }

        const photoCanvas =
          document.createElement(
            "canvas"
          );

        photoCanvas.width =
          slotWidth;

        photoCanvas.height =
          slotHeight;

        const photoCtx =
          photoCanvas.getContext(
            "2d"
          );

        if (!photoCtx) {
          continue;
        }

        drawCoverImage(
          photoCtx,
          photo,
          0,
          0,
          slotWidth,
          slotHeight
        );

        const photoData =
          photoCtx.getImageData(
            0,
            0,
            slotWidth,
            slotHeight
          );

        // =================================================
        // REPLACE GREEN PIXELS
        // =================================================

        for (
          let sy = 0;
          sy < slotHeight;
          sy++
        ) {
          for (
            let sx = 0;
            sx < slotWidth;
            sx++
          ) {
            const templateX =
              slotX + sx;

            const templateY =
              slotY + sy;

            if (
              templateX < 0 ||
              templateY < 0 ||
              templateX >=
                STRIP_WIDTH ||
              templateY >=
                STRIP_HEIGHT
            ) {
              continue;
            }

            const sourceIndex =
              (
                templateY *
                  STRIP_WIDTH +
                templateX
              ) * 4;

            const photoIndex =
              (
                sy *
                  slotWidth +
                sx
              ) * 4;

            const r =
              templateData.data[
                sourceIndex
              ];

            const g =
              templateData.data[
                sourceIndex + 1
              ];

            const b =
              templateData.data[
                sourceIndex + 2
              ];

            if (
              g > 120 &&
              g > r * 1.5 &&
              g > b * 1.3
            ) {
              templateData.data[
                sourceIndex
              ] =
                photoData.data[
                  photoIndex
                ];

              templateData.data[
                sourceIndex + 1
              ] =
                photoData.data[
                  photoIndex + 1
                ];

              templateData.data[
                sourceIndex + 2
              ] =
                photoData.data[
                  photoIndex + 2
                ];

              templateData.data[
                sourceIndex + 3
              ] = 255;
            }
          }
        }
      }

      ctx.putImageData(
        templateData,
        0,
        0
      );

      // =================================================
      // CLOUDINARY + QR
      // =================================================

      setIsUploading(true);

      let finalResult;

      try {
        const baseStrip =
          canvas.toDataURL(
            "image/jpeg",
            0.96
          );

        const response =
          await fetch(baseStrip);

        const blob =
          await response.blob();

        const photoUrl =
          await uploadPhoto(blob);

        const qr =
          await generateQR(photoUrl);

        const qrImage =
          await loadImage(qr);

        // =================================================
        // QR CODE
        // =================================================

        const qrSize = 65;
        const qrMargin = 12;

        ctx.fillStyle = "white";

        ctx.fillRect(
          qrMargin - 3,
          STRIP_HEIGHT -
            qrSize -
            qrMargin -
            3,
          qrSize + 6,
          qrSize + 6
        );

        ctx.drawImage(
          qrImage,
          qrMargin,
          STRIP_HEIGHT -
            qrSize -
            qrMargin,
          qrSize,
          qrSize
        );

        finalResult =
          canvas.toDataURL(
            "image/jpeg",
            0.96
          );

        setQrCode(qr);
      } catch (error) {
        // =================================================
        // FALLBACK
        // =================================================

        console.error(
          "Cloudinary / QR error:",
          error
        );

        finalResult =
          canvas.toDataURL(
            "image/jpeg",
            0.96
          );

        setQrCode(null);
      }

      setFinalStrip(finalResult);

      saveGallery(finalResult);

      // =================================================
      // CREATE 4R
      // =================================================

      const print =
        await createTwoUpPrint(
          finalResult
        );

      // =================================================
      // SEND FINAL RESULT TO IPAD
      // =================================================

      if (
        cameraSource ===
        "remote"
      ) {
        try {
          await sendControllerResult(
            finalResult
          );

          console.log(
            "🎉 Final result sent to iPad"
          );
        } catch (error) {
          console.error(
            "Could not send final result to iPad:",
            error
          );
        }
      }

      setIsUploading(false);

      // IMPORTANT:
      // Navigation is now INSIDE the successful flow.
      setScreen("result");

      return print;
    } catch (error) {
      console.error(
        "Create strip error:",
        error
      );

      setIsUploading(false);

      alert(
        "Something went wrong while creating the photo."
      );

      return false;
    }
  }

  // =====================================================
  // CREATE TWO-UP 4R
  // =====================================================

  async function createTwoUpPrint(
    stripImage
  ) {
    if (!stripImage) {
      return null;
    }

    try {
      const strip =
        await loadImage(
          stripImage
        );

      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        PRINT_WIDTH;

      canvas.height =
        PRINT_HEIGHT;

      const ctx =
        canvas.getContext(
          "2d"
        );

      if (!ctx) {
        return null;
      }

      // White background
      ctx.fillStyle = "white";

      ctx.fillRect(
        0,
        0,
        PRINT_WIDTH,
        PRINT_HEIGHT
      );

      // LEFT COPY
      ctx.drawImage(
        strip,
        0,
        0,
        STRIP_WIDTH,
        STRIP_HEIGHT
      );

      // RIGHT COPY
      ctx.drawImage(
        strip,
        STRIP_WIDTH,
        0,
        STRIP_WIDTH,
        STRIP_HEIGHT
      );

      const result =
        canvas.toDataURL(
          "image/jpeg",
          0.96
        );

      setFinalPrint(result);

      return result;
    } catch (error) {
      console.error(
        "4R creation error:",
        error
      );

      return null;
    }
  }

  // =====================================================
  // SAVE IMAGE
  // =====================================================

  function saveImage(
    image,
    name
  ) {
    if (!image) {
      alert(
        "There is no image available to save."
      );

      return;
    }

    try {
      const link =
        document.createElement(
          "a"
        );

      link.href = image;

      link.download =
        name ||
        `SANDIWA-${Date.now()}.jpg`;

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );
    } catch (error) {
      console.error(
        "Save image error:",
        error
      );
    }
  }

  // =====================================================
  // PRINT
  // =====================================================

  function printTwoUp() {
    if (!finalPrint) {
      alert(
        "The print image is not ready."
      );

      return;
    }

    const printWindow =
      window.open(
        "",
        "_blank"
      );

    if (!printWindow) {
      alert(
        "Please allow pop-ups for printing."
      );

      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>SANDIWA Photobooth</title>

        <style>
          @page {
            size: 4in 6in;
            margin: 0;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            width: 4in;
            height: 6in;
            overflow: hidden;
          }

          img {
            display: block;
            width: 4in;
            height: 6in;
            object-fit: fill;
          }
        </style>
      </head>

      <body>

        <img
          src="${finalPrint}"
          alt="SANDIWA 4R"
        />

        <script>
          window.onload = function () {
            setTimeout(function () {
              window.print();
            }, 500);
          };
        <\/script>

      </body>
      </html>
    `);

    printWindow.document.close();
  }

  // =====================================================
  // NEW SESSION
  // =====================================================

  async function newSession() {
    stopCamera();

    try {
      await clearRemotePhoto();
      await clearControllerPreview();
      await clearControllerResult();
      await clearCaptureCommand();
    } catch (error) {
      console.error(
        "Remote reset error:",
        error
      );
    }

    setPhotos([]);
    photosRef.current = [];

    setSelectedPhotos([]);

    setFinalStrip(null);
    setFinalPrint(null);
    setQrCode(null);

    setIsUploading(false);

    setCountdown(null);
    setIsCounting(false);

    setWaitingForRemotePhoto(false);

    setCameraSource(null);
    setCameraReady(false);

    setRetakingIndex(null);

    setRemotePreview(null);
    setRemotePreviewNumber(null);
    setRemoteResult(null);

    retakingIndexRef.current =
      null;

    remotePhotoIdRef.current =
      null;

    lastCommandRef.current =
      null;

    if (
      deviceMode ===
      "controller"
    ) {
      setScreen("home");
    }
  }

  // =====================================================
  // IPAD LISTENS FOR FINAL RESULT / PREVIEW
  // =====================================================

  useEffect(() => {
    if (deviceMode !== "camera") {
      return;
    }

    const unsubscribe =
      listenToSession((data) => {
        if (!data) {
          return;
        }

        // =================================================
        // FINAL RESULT
        // =================================================

        if (
          data.controllerResult
        ) {
          setRemoteResult(
            data.controllerResult
          );

          setRemotePreview(null);
        }

        // =================================================
        // PREVIEW
        // =================================================

        if (
          data.controllerPreview
        ) {
          setRemotePreview(
            data.controllerPreview
          );

          if (
            data.controllerPreviewNumber
          ) {
            setRemotePreviewNumber(
              data.controllerPreviewNumber
            );
          }
        }
      });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [deviceMode]);

  // =====================================================
  // CLEANUP
  // =====================================================

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(
          timerRef.current
        );
      }

      if (
        localCameraStreamRef.current
      ) {
        localCameraStreamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }
    };
  }, []);

  // =====================================================
  // IPAD / IPHONE CAMERA SCREEN
  // =====================================================

  if (
    deviceMode === "camera"
  ) {
    return (
      <div
        className="remote-camera"
        style={{
          position: "relative",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          background: "#000",
        }}
      >
        {/* LIVE CAMERA */}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="remote-camera-video"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            background: "#000",
            zIndex: 1,
          }}
        />

        {/* =================================================
            CAPTURED PHOTO PREVIEW
        ================================================= */}

        {remotePreview &&
          !remoteResult && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 20,
                background:
                  "rgba(0,0,0,0.92)",
                display: "flex",
                flexDirection:
                  "column",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                padding: "20px",
              }}
            >
              <h1
                style={{
                  color: "white",
                  marginBottom:
                    "15px",
                }}
              >
                PHOTO{" "}
                {remotePreviewNumber ||
                  ""}
              </h1>

              <img
                src={
                  remotePreview
                }
                alt="Captured"
                style={{
                  maxWidth:
                    "90%",
                  maxHeight:
                    "75%",
                  objectFit:
                    "contain",
                  borderRadius:
                    "12px",
                }}
              />

              <p
                style={{
                  color:
                    "white",
                  fontSize:
                    "18px",
                  marginTop:
                    "15px",
                }}
              >
                📸 Photo captured!
              </p>
            </div>
          )}

        {/* =================================================
            FINAL RESULT
        ================================================= */}

        {remoteResult && (
          <div
            style={{
              position:
                "absolute",
              inset: 0,
              zIndex: 30,
              background:
                "rgba(0,0,0,0.94)",
              display: "flex",
              flexDirection:
                "column",
              alignItems:
                "center",
              justifyContent:
                "center",
              padding: "20px",
              overflow: "auto",
            }}
          >
            <h1
              style={{
                color:
                  "white",
                marginBottom:
                  "15px",
              }}
            >
              🎉 PHOTO READY!
            </h1>

            <img
              src={
                remoteResult
              }
              alt="Final SANDIWA"
              style={{
                maxWidth:
                  "80%",
                maxHeight:
                  "75%",
                objectFit:
                  "contain",
                borderRadius:
                  "10px",
              }}
            />

            <p
              style={{
                color:
                  "white",
                fontSize:
                  "18px",
                marginTop:
                  "15px",
              }}
            >
              Your SANDIWA photo is ready!
            </p>
          </div>
        )}

        {/* =================================================
            CAMERA STATUS
        ================================================= */}

        {!remotePreview &&
          !remoteResult && (
            <div
              style={{
                position:
                  "absolute",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10,
                padding:
                  "20px",
                textAlign:
                  "center",
                background:
                  "linear-gradient(rgba(0,0,0,0.45), transparent)",
                color:
                  "white",
              }}
            >
              <h1>
                SANDIWA
              </h1>

              {cameraReady ? (
                <>
                  <div
                    style={{
                      fontWeight:
                        "bold",
                      fontSize:
                        "18px",
                    }}
                  >
                    📱 CAMERA READY
                  </div>

                  <p>
                    Look at the
                    camera!
                  </p>
                </>
              ) : (
                <>
                  <div
                    style={{
                      fontWeight:
                        "bold",
                      fontSize:
                        "18px",
                    }}
                  >
                    📷 STARTING CAMERA...
                  </div>

                  <p>
                    Please allow
                    camera permission.
                  </p>
                </>
              )}
            </div>
          )}
      </div>
    );
  }

  // =====================================================
  // CAMERA SOURCE
  // =====================================================

  if (
    screen ===
    "camera-source"
  ) {
    return (
      <div className="app centered">
        <div className="setup-card">

          <h2>
            CHOOSE CAMERA
          </h2>

          <p>
            Select the camera you
            want to use.
          </p>

          <div className="camera-source-grid">

            <button
              className="camera-source-card"
              onClick={() =>
                changeCameraSource(
                  "remote"
                )
              }
            >
              <span>
                📱
              </span>

              <strong>
                PHONE / IPAD
              </strong>

              <small>
                Use another device
                as the camera
              </small>
            </button>

            <button
              className="camera-source-card"
              onClick={() =>
                changeCameraSource(
                  "webcam"
                )
              }
            >
              <span>
                🎥
              </span>

              <strong>
                WEBCAM
              </strong>

              <small>
                External USB webcam
              </small>
            </button>

            <button
              className="camera-source-card"
              onClick={() =>
                changeCameraSource(
                  "integrated"
                )
              }
            >
              <span>
                💻
              </span>

              <strong>
                INTEGRATED CAMERA
              </strong>

              <small>
                Built-in laptop camera
              </small>
            </button>

            <button
              className="camera-source-card"
              onClick={() =>
                changeCameraSource(
                  "dslr"
                )
              }
            >
              <span>
                📷
              </span>

              <strong>
                DSLR / CAMERA
              </strong>

              <small>
                Connected camera
              </small>
            </button>

          </div>

          <div className="button-row">
            <button
              className="secondary"
              onClick={() =>
                setScreen("home")
              }
            >
              BACK
            </button>
          </div>

        </div>
      </div>
    );
  }

  // =====================================================
  // CAMERA DEVICE
  // =====================================================

  if (
    screen ===
    "camera-device"
  ) {
    return (
      <div className="app centered">
        <div className="setup-card">

          <h2>
            SELECT CAMERA
          </h2>

          <p>
            Choose the exact
            camera.
          </p>

          {cameraDevices.length ===
          0 ? (
            <div className="camera-empty">

              <span>
                📷
              </span>

              <strong>
                No cameras detected
              </strong>

              <p>
                Connect your camera
                and try again.
              </p>

              <button
                className="primary"
                onClick={
                  detectCameras
                }
              >
                🔄 DETECT CAMERAS
              </button>

            </div>
          ) : (
            <>
              <select
                value={
                  selectedCameraId
                }
                onChange={(event) =>
                  setSelectedCameraId(
                    event.target.value
                  )
                }
              >
                {cameraDevices.map(
                  (
                    camera,
                    index
                  ) => (
                    <option
                      key={
                        camera.deviceId
                      }
                      value={
                        camera.deviceId
                      }
                    >
                      {camera.label ||
                        `Camera ${
                          index + 1
                        }`}
                    </option>
                  )
                )}
              </select>

              <div className="camera-device-info">

                <strong>
                  {cameraSource ===
                  "webcam"
                    ? "🎥 Webcam"
                    : cameraSource ===
                      "integrated"
                    ? "💻 Integrated Camera"
                    : "📷 DSLR / Camera"}
                </strong>

                <p>
                  {
                    cameraDevices.length
                  }{" "}
                  camera
                  {cameraDevices.length !==
                  1
                    ? "s"
                    : ""}{" "}
                  detected.
                </p>

              </div>
            </>
          )}

          <div className="button-row">

            <button
              className="secondary"
              onClick={() => {
                stopLocalCamera();
                setCameraReady(false);
                setCameraSource(null);
                setScreen(
                  "camera-source"
                );
              }}
            >
              BACK
            </button>

            {cameraDevices.length >
              0 && (
              <button
                className="primary"
                onClick={async () => {
                  setScreen(
                    "camera"
                  );

                  await new Promise(
                    (resolve) =>
                      requestAnimationFrame(
                        resolve
                      )
                  );

                  const started =
                    await startLocalCamera();

                  if (!started) {
                    setScreen(
                      "camera-device"
                    );
                  }
                }}
              >
                CONTINUE
              </button>
            )}

          </div>

        </div>
      </div>
    );
  }

  // =====================================================
  // HOME
  // =====================================================

  if (
    screen === "home"
  ) {
    return (
      <div className="app">

        <header className="brand-header">

          <h1>
            SANDIWA
          </h1>

          <p>
            Happy 107th Anniversary
            Tangos IEMELIF Church
          </p>

        </header>

        <main className="home">

          <div className="capture-grid">

            <button
              onClick={() =>
                chooseCaptureMode(1)
              }
            >
              <span>
                📷
              </span>

              <strong>
                SINGLE
              </strong>

              <small>
                1 PHOTO
              </small>
            </button>

            <button
              onClick={() =>
                chooseCaptureMode(2)
              }
            >
              <span>
                📷📷
              </span>

              <strong>
                DOUBLE
              </strong>

              <small>
                2 PHOTOS
              </small>
            </button>

            <button
              onClick={() =>
                chooseCaptureMode(3)
              }
            >
              <span>
                📷📷📷
              </span>

              <strong>
                TRIPLE
              </strong>

              <small>
                3 PHOTOS
              </small>
            </button>

            <button
              onClick={() =>
                chooseCaptureMode(4)
              }
            >
              <span>
                📷📷📷📷
              </span>

              <strong>
                QUADRUPLE
              </strong>

              <small>
                4 PHOTOS
              </small>
            </button>

          </div>

          <div className="home-buttons">

            <button
              className="outline-button"
              onClick={() =>
                setScreen("template")
              }
            >
              🎨 TEMPLATE
            </button>

            <button
              className="outline-button"
              onClick={() =>
                setScreen("gallery")
              }
            >
              🖼️ GALLERY
            </button>

          </div>

          <div
            style={{
              marginTop:
                "20px",
              textAlign:
                "center",
              fontSize:
                "14px",
              opacity: 0.7,
            }}
          >
            {cameraSource ===
            "remote"
              ? cameraReady
                ? "📱 PHONE / IPAD CONNECTED"
                : "📱 PHONE / IPAD NOT CONNECTED"
              : cameraSource
              ? cameraReady
                ? "🟢 LOCAL CAMERA CONNECTED"
                : "🔴 LOCAL CAMERA NOT CONNECTED"
              : "⚪ NO CAMERA SELECTED"}
          </div>

        </main>

      </div>
    );
  }

  // =====================================================
  // CAMERA CONTROLLER
  // =====================================================

  if (
    screen === "camera"
  ) {
    return (
      <div className="camera-page">

        {cameraSource !==
          "remote" && (
          <video
            ref={
              localCameraVideoRef
            }
            autoPlay
            playsInline
            muted
            className="camera-video"
          />
        )}

        <div
          style={{
            position:
              "absolute",
            top:
              "20px",
            left:
              "20px",
            right:
              "20px",
            zIndex:
              10,
            display:
              "flex",
            justifyContent:
              "space-between",
            color:
              "white",
            fontWeight:
              "bold",
            fontSize:
              "18px",
          }}
        >
          <div>
            SANDIWA
          </div>

          <div>
            {cameraSource ===
            "remote"
              ? cameraReady
                ? "📱 IPAD CONNECTED"
                : "🔴 WAITING FOR IPAD"
              : cameraReady
              ? "🎥 LOCAL CAMERA CONNECTED"
              : "🔴 WAITING FOR LOCAL CAMERA"}
          </div>
        </div>

        <div
          className="camera-overlay"
          style={{
            background:
              "transparent",
          }}
        >

          <div className="camera-counter">

            {retakingIndex !==
            null
              ? `RETAKING PHOTO ${
                  retakingIndex + 1
                }`
              : `PHOTO ${
                  Math.min(
                    photos.length + 1,
                    captureMode
                  )
                } / ${captureMode}`}

          </div>

          {!cameraReady && (
            <div
              className="loading"
              style={{
                textAlign:
                  "center",
                maxWidth:
                  "500px",
              }}
            >
              <h2>
                {cameraSource ===
                "remote"
                  ? "📱 Waiting for iPad..."
                  : "📷 Starting camera..."}
              </h2>

              <p>
                {cameraSource ===
                "remote"
                  ? "Open the SANDIWA camera link on your iPad."
                  : "Please allow camera access."}
              </p>
            </div>
          )}

          {waitingForRemotePhoto && (
            <div className="loading">
              📸 Receiving photo...
            </div>
          )}

          {countdown !==
            null && (
            <div className="countdown">
              {countdown}
            </div>
          )}

          <div className="captured-strip">

            {photos.map(
              (
                photo,
                index
              ) => (
                <img
                  key={index}
                  src={photo}
                  alt=""
                />
              )
            )}

          </div>

        </div>
      </div>
    );
  }

  // =====================================================
  // PHOTO SELECTION
  // =====================================================

  if (
    screen === "select"
  ) {
    return (
      <div className="app centered">

        <div className="selection-page">

          <h2>
            Choose Your Photos
          </h2>

          <p>
            Select 1–4 photos.
          </p>

          <div className="selection-grid">

            {photos.map(
              (
                photo,
                index
              ) => {
                const selected =
                  selectedPhotos.includes(
                    index
                  );

                return (
                  <div
                    key={index}
                    className={
                      selected
                        ? "selection-photo selected"
                        : "selection-photo"
                    }
                  >

                    <img
                      src={photo}
                      alt=""
                      onClick={() =>
                        togglePhoto(
                          index
                        )
                      }
                    />

                    <span>
                      {selected
                        ? "✓ SELECTED"
                        : `PHOTO ${
                            index + 1
                          }`}
                    </span>

                    <button
                      className="retake-button"
                      onClick={(
                        event
                      ) => {
                        event.stopPropagation();

                        retakePhoto(
                          index
                        );
                      }}
                    >
                      🔄 RETAKE THIS PHOTO
                    </button>

                  </div>
                );
              }
            )}

          </div>

          <p>
            {
              selectedPhotos.length
            }{" "}
            selected
          </p>

          <div className="button-row">

            <button
              className="secondary"
              onClick={
                newSession
              }
            >
              HOME
            </button>

            <button
              className="primary"
              disabled={
                selectedPhotos.length ===
                0
              }
              onClick={() =>
                setScreen(
                  "template"
                )
              }
            >
              CONTINUE
            </button>

          </div>

        </div>

      </div>
    );
  }

  // =====================================================
  // TEMPLATE
  // =====================================================

  if (
    screen === "template"
  ) {
    return (
      <div className="app centered">

        <div className="template-page">

          <h2>
            SANDIWA TEMPLATE
          </h2>

          <p>
            Upload your 2 × 6
            template or your
            4R two-copy template.
          </p>

          {template ? (
            <div className="template-preview">
              <img
                src={template}
                alt="Template"
              />
            </div>
          ) : (
            <div className="template-empty">

              <span>
                🎨
              </span>

              <strong>
                No template uploaded
              </strong>

              <small>
                JPG or PNG
              </small>

            </div>
          )}

          <label className="upload-button">

            🎨 UPLOAD TEMPLATE

            <input
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={
                uploadTemplate
              }
            />

          </label>

          {template && (
            <div className="slot-info">

              <strong>
                Automatically detected
              </strong>

              <p>
                {
                  templateSlots.length
                }{" "}
                photo slots found.
              </p>

            </div>
          )}

          <div className="template-size-info">

            <strong>
              Recommended sizes
            </strong>

            <p>
              2 × 6 strip:
              <b>
                {" "}
                600 × 1800 px
              </b>
            </p>

            <p>
              4R two-copy:
              <b>
                {" "}
                1200 × 1800 px
              </b>
            </p>

            <p>
              300 DPI
            </p>

          </div>

          <div className="button-row">

            <button
              className="secondary"
              onClick={
                newSession
              }
            >
              HOME
            </button>

            {template &&
              photos.length >
                0 && (
                <button
                  className="primary"
                  disabled={
                    isUploading
                  }
                  onClick={
                    createStrip
                  }
                >
                  {isUploading
                    ? "CREATING..."
                    : "CREATE PHOTO"}
                </button>
              )}

          </div>

        </div>

      </div>
    );
  }

  // =====================================================
  // RESULT
  // =====================================================

  if (
    screen === "result"
  ) {
    return (
      <div className="app centered">

        <div className="result-page">

          <h2>
            PHOTO READY! 🎉
          </h2>

          <p>
            Your 2 × 6 strip has
            automatically been
            duplicated onto 4R.
          </p>

          <div className="result-preview">

            {finalStrip && (
              <img
                src={finalStrip}
                alt="Final strip"
              />
            )}

          </div>

          <div className="result-buttons">

            <button
              className="primary"
              disabled={!finalStrip}
              onClick={() =>
                saveImage(
                  finalStrip,
                  `SANDIWA-2x6-${Date.now()}.jpg`
                )
              }
            >
              💾 SAVE 2 × 6
            </button>

            <button
              className="primary"
              disabled={!finalPrint}
              onClick={() =>
                saveImage(
                  finalPrint,
                  `SANDIWA-4R-${Date.now()}.jpg`
                )
              }
            >
              💾 SAVE 4R
            </button>

            <button
              className="print-button"
              disabled={!finalPrint}
              onClick={
                printTwoUp
              }
            >
              🖨️ PRINT 4R — 2 COPIES
            </button>

            <button
              className="secondary"
              onClick={
                newSession
              }
            >
              📷 NEW SESSION
            </button>

          </div>

        </div>

      </div>
    );
  }

  // =====================================================
  // GALLERY
  // =====================================================

  if (
    screen === "gallery"
  ) {
    return (
      <div className="app">

        <div className="gallery-page">

          <h2>
            SANDIWA GALLERY
          </h2>

          {gallery.length ===
          0 ? (
            <div className="empty">
              No photos yet.
            </div>
          ) : (
            <div className="gallery-grid">

              {gallery.map(
                (item) => (
                  <div
                    className="gallery-item"
                    key={item.id}
                  >

                    <img
                      src={item.image}
                      alt=""
                    />

                    <small>
                      {item.date}
                    </small>

                    <button
                      onClick={async () => {
                        setFinalStrip(
                          item.image
                        );

                        const print =
                          await createTwoUpPrint(
                            item.image
                          );

                        if (!print) {
                          alert(
                            "Could not create the 4R image."
                          );

                          return;
                        }

                        setFinalPrint(
                          print
                        );

                        setScreen(
                          "result"
                        );
                      }}
                    >
                      REPRINT
                    </button>

                  </div>
                )
              )}

            </div>
          )}

          <button
            className="secondary"
            onClick={
              newSession
            }
          >
            HOME
          </button>

        </div>

      </div>
    );
  }

  return null;
}

export default App;