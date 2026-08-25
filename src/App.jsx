import { useEffect, useRef, useState } from "react";
import "./App.css";

import {
  sendPhoto,
  sendCameraReady,
  listenToSession,
  clearRemotePhoto,
  sendCaptureCommand,
} from "./remoteCamera";

import { generateQR } from "./utils/qrCode";
import { uploadPhoto } from "./utils/uploadPhoto";

const STRIP_WIDTH = 600;
const STRIP_HEIGHT = 1800;

const PRINT_WIDTH = 1200;
const PRINT_HEIGHT = 1800;

function App() {
  // =====================================================
  // DEVICE
  // =====================================================

  const [deviceMode, setDeviceMode] = useState("controller");

  // =====================================================
  // CAMERA
  // =====================================================

  const [cameraSource, setCameraSource] = useState(null);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");

  const [cameraReady, setCameraReady] = useState(false);
  const [waitingForRemotePhoto, setWaitingForRemotePhoto] =
    useState(false);

  // =====================================================
  // REMOTE CAMERA
  // =====================================================

  const [cameraLink, setCameraLink] = useState("");
  const [cameraLinkQR, setCameraLinkQR] = useState(null);

  const [remoteConnected, setRemoteConnected] =
    useState(false);

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
  // COUNTDOWN
  // =====================================================

  const [countdown, setCountdown] = useState(null);
  const [isCounting, setIsCounting] = useState(false);

  // =====================================================
  // TEMPLATE
  // =====================================================

  const [template, setTemplate] = useState(null);
  const [templateSlots, setTemplateSlots] = useState([]);

  // =====================================================
  // FINAL
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
  // DETECT DEVICE MODE
  // =====================================================

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    if (params.get("camera") === "1") {
      setDeviceMode("camera");
    } else {
      setDeviceMode("controller");
    }
  }, []);

  // =====================================================
  // GENERATE REMOTE CAMERA LINK
  // =====================================================

  useEffect(() => {
    if (deviceMode !== "controller") {
      return;
    }

    /*
     * IMPORTANT:
     *
     * Do NOT use:
     *
     * http://localhost:5173/?camera=1
     *
     * because localhost on the phone means
     * the PHONE itself.
     *
     * We use the current browser hostname instead.
     */

    const hostname = window.location.hostname;
    const port = window.location.port;

    let link;

    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1"
    ) {
      /*
       * During Vite development, this will still be
       * localhost. The user should open the app using
       * the laptop's LAN IP instead.
       */
      link = `${window.location.protocol}//${hostname}${
        port ? `:${port}` : ""
      }/?camera=1`;
    } else {
      link = `${window.location.origin}/?camera=1`;
    }

    setCameraLink(link);

    generateQR(link)
      .then((qr) => {
        setCameraLinkQR(qr);
      })
      .catch((error) => {
        console.error(
          "Camera link QR error:",
          error
        );
      });
  }, [deviceMode]);

  // =====================================================
  // LOAD GALLERY
  // =====================================================

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(
          "sandiwa-gallery"
        ) || "[]"
      );

      setGallery(saved);
    } catch (error) {
      console.error(
        "Gallery loading error:",
        error
      );

      setGallery([]);
    }
  }, []);

  // =====================================================
  // SAVE GALLERY
  // =====================================================

  function saveGallery(image) {
    try {
      const item = {
        id: Date.now(),
        image,
        date: new Date().toLocaleString(),
      };

      const updated = [
        item,
        ...gallery,
      ].slice(0, 30);

      setGallery(updated);

      localStorage.setItem(
        "sandiwa-gallery",
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error(
        "Gallery save error:",
        error
      );
    }
  }

  // =====================================================
  // REMOTE CAMERA
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
            "Camera API is not supported."
          );
        }

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
          stream
            .getTracks()
            .forEach((track) =>
              track.stop()
            );

          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject =
            stream;

          await videoRef.current.play();
        }

        setCameraReady(true);

        await sendCameraReady();

        console.log(
          "REMOTE CAMERA READY"
        );
      } catch (error) {
        console.error(
          "Remote camera error:",
          error
        );

        setCameraReady(false);

        alert(
          "Camera access was blocked. Please allow camera permission, then reload the page."
        );
      }
    }

    startRemoteCamera();

    return () => {
      active = false;

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        streamRef.current = null;
      }

      setCameraReady(false);
    };
  }, [deviceMode]);

  // =====================================================
  // REMOTE CAMERA LISTENER
  // =====================================================

  useEffect(() => {
    if (deviceMode !== "camera") {
      return;
    }

    const unsubscribe =
      listenToSession(async (data) => {
        if (!data) {
          return;
        }

        if (
          data.command !== "capture"
        ) {
          return;
        }

        if (
          data.commandId ===
          lastCommandRef.current
        ) {
          return;
        }

        lastCommandRef.current =
          data.commandId;

        console.log(
          "CAPTURE COMMAND RECEIVED",
          data.commandId
        );

        await captureRemotePhoto();
      });

    return () => {
      unsubscribe();
    };
  }, [deviceMode]);

  // =====================================================
  // CAPTURE REMOTE PHOTO
  // =====================================================

  async function captureRemotePhoto() {
    const video = videoRef.current;

    if (!video) {
      console.error(
        "Remote video element missing."
      );

      return;
    }

    if (
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      console.error(
        "Remote camera is not ready."
      );

      return;
    }

    try {
      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        video.videoWidth;

      canvas.height =
        video.videoHeight;

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      /*
       * Mirror front camera.
       */
      ctx.translate(
        canvas.width,
        0
      );

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

      await sendPhoto(photo);

      console.log(
        "REMOTE PHOTO SENT"
      );
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

      /*
       * Request permission first so camera labels
       * become available.
       */
      try {
        const temporaryStream =
          await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });

        temporaryStream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      } catch (error) {
        console.error(
          "Camera permission:",
          error
        );
      }

      const devices =
        await navigator.mediaDevices.enumerateDevices();

      const cameras =
        devices.filter(
          (device) =>
            device.kind ===
            "videoinput"
        );

      setCameraDevices(cameras);

      if (
        cameras.length > 0 &&
        !cameras.some(
          (camera) =>
            camera.deviceId ===
            selectedCameraId
        )
      ) {
        setSelectedCameraId(
          cameras[0].deviceId
        );
      }

      console.log(
        "AVAILABLE CAMERAS:",
        cameras
      );
    } catch (error) {
      console.error(
        "Camera detection error:",
        error
      );

      setCameraDevices([]);
    }
  }

  // =====================================================
  // START LOCAL CAMERA
  // =====================================================

  async function startLocalCamera() {
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

      const constraints = {
        video: selectedCameraId
          ? {
              deviceId: {
                exact:
                  selectedCameraId,
              },
              width: {
                ideal: 1920,
              },
              height: {
                ideal: 1080,
              },
            }
          : {
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
      };

      const stream =
        await navigator.mediaDevices.getUserMedia(
          constraints
        );

      localCameraStreamRef.current =
        stream;

      if (
        localCameraVideoRef.current
      ) {
        localCameraVideoRef.current.srcObject =
          stream;

        await localCameraVideoRef.current.play();
      }

      setCameraReady(true);

      console.log(
        "LOCAL CAMERA READY"
      );

      return true;
    } catch (error) {
      console.error(
        "Local camera error:",
        error
      );

      setCameraReady(false);

      alert(
        "Unable to start this camera. Make sure it is connected and camera permission is allowed."
      );

      return false;
    }
  }

  // =====================================================
  // STOP LOCAL CAMERA
  // =====================================================

  function stopLocalCamera() {
    if (
      localCameraStreamRef.current
    ) {
      localCameraStreamRef.current
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      localCameraStreamRef.current =
        null;
    }

    if (
      localCameraVideoRef.current
    ) {
      localCameraVideoRef.current.srcObject =
        null;
    }
  }

  // =====================================================
  // LAPTOP LISTENS FOR REMOTE PHOTO
  // =====================================================

  useEffect(() => {
    if (deviceMode !== "controller") {
      return;
    }

    const unsubscribe =
      listenToSession((data) => {
        if (!data) {
          return;
        }

        /*
         * CAMERA READY
         */
        if (
          data.cameraStatus ===
          "ready"
        ) {
          setRemoteConnected(true);

          if (
            cameraSource ===
            "remote"
          ) {
            setCameraReady(true);
          }

          console.log(
            "REMOTE CAMERA CONNECTED"
          );
        }

        /*
         * PHOTO RECEIVED
         */
        if (
          data.status ===
            "photo-ready" &&
          data.photo &&
          data.photoId !==
            remotePhotoIdRef.current
        ) {
          remotePhotoIdRef.current =
            data.photoId;

          console.log(
            "REMOTE PHOTO RECEIVED"
          );

          if (
            retakingIndexRef.current !==
            null
          ) {
            const index =
              retakingIndexRef.current;

            setPhotos(
              (previous) => {
                const updated = [
                  ...previous,
                ];

                updated[index] =
                  data.photo;

                return updated;
              }
            );

            setSelectedPhotos(
              (previous) => {
                if (
                  previous.includes(
                    index
                  )
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
            setPhotos(
              (previous) => [
                ...previous,
                data.photo,
              ]
            );
          }

          setWaitingForRemotePhoto(
            false
          );

          setCameraReady(true);

          clearRemotePhoto();
        }
      });

    return () => {
      unsubscribe();
    };
  }, [
    deviceMode,
    cameraSource,
  ]);

  // =====================================================
  // REQUEST REMOTE PHOTO
  // =====================================================

  async function requestRemotePhoto() {
    if (!remoteConnected) {
      alert(
        "The iPhone/iPad camera is not connected yet."
      );

      setWaitingForRemotePhoto(false);

      return;
    }

    try {
      setWaitingForRemotePhoto(true);

      await sendCaptureCommand();

      console.log(
        "CAPTURE COMMAND SENT"
      );
    } catch (error) {
      console.error(
        "Remote capture error:",
        error
      );

      setWaitingForRemotePhoto(false);

      alert(
        "Could not communicate with the iPhone/iPad camera."
      );
    }
  }

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
      video.videoWidth === 0
    ) {
      return;
    }

    try {
      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        video.videoWidth;

      canvas.height =
        video.videoHeight;

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      ctx.translate(
        canvas.width,
        0
      );

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

      /*
       * RETAKE
       */
      if (
        retakingIndexRef.current !==
        null
      ) {
        const index =
          retakingIndexRef.current;

        setPhotos(
          (previous) => {
            const updated = [
              ...previous,
            ];

            updated[index] =
              photo;

            return updated;
          }
        );

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

        setScreen(
          captureMode === 4
            ? "select"
            : "template"
        );

        return;
      }

      setPhotos(
        (previous) => [
          ...previous,
          photo,
        ]
      );
    } catch (error) {
      console.error(
        "Local capture error:",
        error
      );
    }
  }

  // =====================================================
  // STOP CAMERA
  // =====================================================

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      streamRef.current = null;
    }

    stopLocalCamera();

    setCameraReady(false);
  }

  // =====================================================
  // CHOOSE CAPTURE MODE
  // =====================================================

  function chooseCaptureMode(mode) {
    setCaptureMode(mode);

    setPhotos([]);
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

    setScreen("camera-source");
  }

  // =====================================================
  // COUNTDOWN
  // =====================================================

  function startCountdown() {
    if (
      isCounting ||
      !cameraReady ||
      waitingForRemotePhoto
    ) {
      return;
    }

    if (
      retakingIndexRef.current ===
        null &&
      photos.length >= captureMode
    ) {
      return;
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

        clearInterval(
          timerRef.current
        );

        timerRef.current = null;

        setCountdown("📸");

        setTimeout(
          async () => {
            if (
              cameraSource ===
              "remote"
            ) {
              await requestRemotePhoto();
            } else {
              await captureLocalPhoto();
            }

            setCountdown(null);
            setIsCounting(false);
          },
          600
        );
      }, 1000);
  }

  // =====================================================
  // AUTOMATIC CAPTURE SEQUENCE
  // =====================================================

  useEffect(() => {
    if (
      deviceMode !== "controller"
    ) {
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

    /*
     * RETAKE
     */
    if (
      retakingIndexRef.current !==
      null
    ) {
      const delay =
        setTimeout(() => {
          startCountdown();
        }, 1200);

      return () =>
        clearTimeout(delay);
    }

    /*
     * FINISHED
     */
    if (
      photos.length >= captureMode
    ) {
      setSelectedPhotos(
        photos.map(
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

    const delay =
      setTimeout(() => {
        startCountdown();
      }, 1200);

    return () =>
      clearTimeout(delay);
  }, [
    deviceMode,
    screen,
    cameraReady,
    isCounting,
    waitingForRemotePhoto,
    photos,
    captureMode,
    cameraSource,
  ]);

  // =====================================================
  // SELECT PHOTO
  // =====================================================

  function togglePhoto(index) {
    setSelectedPhotos(
      (previous) => {
        if (
          previous.includes(index)
        ) {
          return previous.filter(
            (item) =>
              item !== index
          );
        }

        if (
          previous.length >= 4
        ) {
          return previous;
        }

        return [
          ...previous,
          index,
        ];
      }
    );
  }

  // =====================================================
  // RETAKE
  // =====================================================

  async function retakePhoto(index) {
    retakingIndexRef.current =
      index;

    setRetakingIndex(index);

    setCountdown(null);
    setIsCounting(false);

    setWaitingForRemotePhoto(false);

    if (
      cameraSource === "remote"
    ) {
      /*
       * DO NOT disconnect the remote camera.
       *
       * The iPad stays on the camera page.
       */
      setCameraReady(remoteConnected);

      setScreen("camera");

      return;
    }

    setCameraReady(false);

    setScreen("camera");

    const started =
      await startLocalCamera();

    if (!started) {
      retakingIndexRef.current =
        null;

      setRetakingIndex(null);

      setScreen("select");
    }
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

      return;
    }

    const reader =
      new FileReader();

    reader.onload = () => {
      setTemplate(reader.result);

      detectTemplateSlots(
        reader.result
      );
    };

    reader.readAsDataURL(file);
  }

  // =====================================================
  // TEMPLATE SLOT DETECTION
  // =====================================================

  async function detectTemplateSlots(
    imageSrc
  ) {
    try {
      const image =
        await loadImage(imageSrc);

      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        image.width;

      canvas.height =
        image.height;

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      ctx.drawImage(
        image,
        0,
        0
      );

      const data =
        ctx.getImageData(
          0,
          0,
          image.width,
          image.height
        ).data;

      const width =
        image.width;

      const height =
        image.height;

      const mask =
        new Uint8Array(
          width * height
        );

      /*
       * GREEN PLACEHOLDER DETECTION
       */
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

          const r =
            data[i];

          const g =
            data[i + 1];

          const b =
            data[i + 2];

          if (
            g > 120 &&
            g > r * 1.5 &&
            g > b * 1.3
          ) {
            mask[
              y * width + x
            ] = 1;
          }
        }
      }

      const visited =
        new Uint8Array(
          width * height
        );

      const slots = [];

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

          const queue = [
            [x, y],
          ];

          visited[index] = 1;

          let minX = x;
          let minY = y;
          let maxX = x;
          let maxY = y;
          let area = 0;

          while (
            queue.length
          ) {
            const [cx, cy] =
              queue.pop();

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
              height:
                boxHeight,
              area,
            });
          }
        }
      }

      slots.sort(
        (a, b) => {
          if (
            Math.abs(
              a.y - b.y
            ) < 50
          ) {
            return a.x - b.x;
          }

          return a.y - b.y;
        }
      );

      /*
       * IMPORTANT FIX:
       *
       * A 4R template is 1200 × 1800.
       *
       * The final strip is 600 × 1800.
       *
       * Therefore X coordinates must be
       * scaled by 0.5.
       */
      let usableSlots = slots;

      if (
        image.width ===
          PRINT_WIDTH &&
        image.height ===
          PRINT_HEIGHT
      ) {
        usableSlots = slots
          .filter(
            (slot) =>
              slot.x <
              image.width / 2
          )
          .map((slot) => ({
            ...slot,
            x: slot.x * 0.5,
            width:
              slot.width * 0.5,
          }));
      }

      /*
       * If the uploaded template itself is
       * 600 × 1800, coordinates are already correct.
       */
      setTemplateSlots(
        usableSlots
      );

      console.log(
        "FINAL TEMPLATE SLOTS:",
        usableSlots
      );
    } catch (error) {
      console.error(
        "Template detection error:",
        error
      );

      setTemplateSlots([]);
    }
  }

  // =====================================================
  // LOAD IMAGE
  // =====================================================

  function loadImage(src) {
    return new Promise(
      (resolve, reject) => {
        const image =
          new Image();

        image.onload = () =>
          resolve(image);

        image.onerror =
          reject;

        image.src = src;
      }
    );
  }

  // =====================================================
  // COVER IMAGE
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
        (image.width -
          sw) /
        2;
    } else {
      sh =
        image.width /
        boxRatio;

      sy =
        (image.height -
          sh) /
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

      return;
    }

    if (
      selectedPhotos.length === 0
    ) {
      alert(
        "Please select at least one photo."
      );

      return;
    }

    if (
      templateSlots.length <
      selectedPhotos.length
    ) {
      alert(
        `Only ${templateSlots.length} photo slots were detected. Please make sure your template has enough green photo boxes.`
      );

      return;
    }

    try {
      const templateImage =
        await loadImage(
          template
        );

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
        return;
      }

      /*
       * Draw template at final 2×6 size.
       */
      ctx.drawImage(
        templateImage,
        0,
        0,
        STRIP_WIDTH,
        STRIP_HEIGHT
      );

      const templateData =
        ctx.getImageData(
          0,
          0,
          STRIP_WIDTH,
          STRIP_HEIGHT
        );

      /*
       * INSERT PHOTOS
       */
      const slots =
        templateSlots.slice(
          0,
          selectedPhotos.length
        );

      for (
        let i = 0;
        i < slots.length;
        i++
      ) {
        const slot =
          slots[i];

        const photo =
          await loadImage(
            photos[
              selectedPhotos[i]
            ]
          );

        const photoCanvas =
          document.createElement(
            "canvas"
          );

        photoCanvas.width =
          Math.round(
            slot.width
          );

        photoCanvas.height =
          Math.round(
            slot.height
          );

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
          photoCanvas.width,
          photoCanvas.height
        );

        const photoData =
          photoCtx.getImageData(
            0,
            0,
            photoCanvas.width,
            photoCanvas.height
          );

        for (
          let sy = 0;
          sy <
          photoCanvas.height;
          sy++
        ) {
          for (
            let sx = 0;
            sx <
            photoCanvas.width;
            sx++
          ) {
            const templateX =
              Math.round(
                slot.x + sx
              );

            const templateY =
              Math.round(
                slot.y + sy
              );

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
                  photoCanvas.width +
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

            /*
             * Replace only green pixels.
             */
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

      try {
        const baseStrip =
          canvas.toDataURL(
            "image/jpeg",
            0.96
          );

        const response =
          await fetch(
            baseStrip
          );

        const blob =
          await response.blob();

        const photoUrl =
          await uploadPhoto(
            blob
          );

        console.log(
          "CLOUDINARY URL:",
          photoUrl
        );

        const qr =
          await generateQR(
            photoUrl
          );

        const qrImage =
          await loadImage(qr);

        const qrSize = 105;
        const qrMargin = 20;

        /*
         * QR background
         */
        ctx.fillStyle =
          "white";

        ctx.fillRect(
          qrMargin - 5,
          STRIP_HEIGHT -
            qrSize -
            qrMargin -
            5,
          qrSize + 10,
          qrSize + 10
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

        const finalResult =
          canvas.toDataURL(
            "image/jpeg",
            0.96
          );

        setFinalStrip(
          finalResult
        );

        setQrCode(qr);

        saveGallery(
          finalResult
        );

        await createTwoUpPrint(
          finalResult
        );
      } catch (error) {
        console.error(
          "Cloudinary / QR error:",
          error
        );

        alert(
          "The photo was created, but the online QR code could not be generated."
        );

        const fallback =
          canvas.toDataURL(
            "image/jpeg",
            0.96
          );

        setFinalStrip(
          fallback
        );

        saveGallery(
          fallback
        );

        await createTwoUpPrint(
          fallback
        );
      } finally {
        setIsUploading(false);
      }

      setScreen("result");
    } catch (error) {
      console.error(
        "Create strip error:",
        error
      );

      alert(
        "Something went wrong while creating the photo."
      );

      setIsUploading(false);
    }
  }

  // =====================================================
  // CREATE 4R TWO-UP
  // =====================================================

  async function createTwoUpPrint(
    stripImage
  ) {
    if (!stripImage) {
      return null;
    }

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
      canvas.getContext("2d");

    if (!ctx) {
      return null;
    }

    ctx.fillStyle =
      "white";

    ctx.fillRect(
      0,
      0,
      PRINT_WIDTH,
      PRINT_HEIGHT
    );

    /*
     * LEFT COPY
     */
    ctx.drawImage(
      strip,
      0,
      0,
      STRIP_WIDTH,
      STRIP_HEIGHT
    );

    /*
     * RIGHT COPY
     */
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
        "Image is not ready."
      );

      return;
    }

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

        <title>
          SANDIWA Photobooth
        </title>

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

        <img src="${finalPrint}" />

        <script>
          window.onload = function () {
            setTimeout(function () {
              window.print();
            }, 500);
          };
        </script>

      </body>
      </html>
    `);

    printWindow.document.close();
  }

  // =====================================================
  // NEW SESSION
  // =====================================================

  function newSession() {
    stopCamera();

    if (timerRef.current) {
      clearInterval(
        timerRef.current
      );

      timerRef.current = null;
    }

    setPhotos([]);
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

    retakingIndexRef.current =
      null;

    lastCommandRef.current =
      null;

    remotePhotoIdRef.current =
      null;

    if (
      deviceMode === "controller"
    ) {
      setScreen("home");
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

      if (
        localCameraStreamRef.current
      ) {
        localCameraStreamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }

      if (timerRef.current) {
        clearInterval(
          timerRef.current
        );
      }
    };
  }, []);

  // =====================================================
  // REMOTE CAMERA PAGE
  // =====================================================

  if (deviceMode === "camera") {
    return (
      <div className="remote-camera">

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="remote-camera-video"
        />

        <div className="remote-camera-overlay">

          <h1>
            SANDIWA
          </h1>

          {cameraReady ? (
            <>
              <div className="camera-status">
                🟢 CAMERA CONNECTED
              </div>

              <p>
                This device is connected
                to the photobooth.
              </p>

              <p>
                Keep this page open.
              </p>
            </>
          ) : (
            <>
              <div className="camera-status">
                📷 STARTING CAMERA...
              </div>

              <p>
                Please allow camera
                permission.
              </p>
            </>
          )}

        </div>

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

            {/* REMOTE */}

            <button
              className="camera-source-card"
              onClick={() => {
                setCameraSource(
                  "remote"
                );

                setCameraReady(
                  remoteConnected
                );

                setScreen(
                  "camera"
                );
              }}
            >
              <span>
                📱
              </span>

              <strong>
                PHONE / IPAD
              </strong>

              <small>
                Use iPhone or iPad
                as camera
              </small>
            </button>

            {/* WEBCAM */}

            <button
              className="camera-source-card"
              onClick={async () => {
                setCameraSource(
                  "webcam"
                );

                setCameraReady(
                  false
                );

                await detectCameras();

                setScreen(
                  "camera-device"
                );
              }}
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

            {/* INTEGRATED */}

            <button
              className="camera-source-card"
              onClick={async () => {
                setCameraSource(
                  "integrated"
                );

                setCameraReady(
                  false
                );

                await detectCameras();

                setScreen(
                  "camera-device"
                );
              }}
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

            {/* DSLR */}

            <button
              className="camera-source-card"
              onClick={async () => {
                setCameraSource(
                  "dslr"
                );

                setCameraReady(
                  false
                );

                await detectCameras();

                setScreen(
                  "camera-device"
                );
              }}
            >
              <span>
                📷
              </span>

              <strong>
                DSLR / CAMERA
              </strong>

              <small>
                Camera recognized by
                Windows
              </small>
            </button>

          </div>

          {/* REMOTE CAMERA CONNECTION */}

          <div
            style={{
              marginTop: "25px",
              padding: "20px",
              borderRadius: "16px",
              background:
                "rgba(255,255,255,0.06)",
              textAlign: "center",
            }}
          >

            <h3>
              📱 CONNECT IPHONE / IPAD
            </h3>

            {remoteConnected ? (
              <div
                style={{
                  marginBottom:
                    "15px",
                  fontWeight: "bold",
                }}
              >
                🟢 IPHONE / IPAD
                CONNECTED
              </div>
            ) : (
              <div
                style={{
                  marginBottom:
                    "15px",
                }}
              >
                🔴 WAITING FOR
                IPHONE / IPAD
              </div>
            )}

            {cameraLinkQR && (
              <img
                src={cameraLinkQR}
                alt="Camera connection QR"
                style={{
                  width: "180px",
                  height: "180px",
                  background:
                    "white",
                  padding: "10px",
                  borderRadius:
                    "12px",
                }}
              />
            )}

            <p
              style={{
                fontSize:
                  "13px",
                marginTop:
                  "12px",
                wordBreak:
                  "break-all",
              }}
            >
              Scan this QR code
              with your iPhone/iPad.
            </p>

            <div
              style={{
                padding:
                  "10px",
                background:
                  "rgba(0,0,0,0.25)",
                borderRadius:
                  "8px",
                fontSize:
                  "12px",
                wordBreak:
                  "break-all",
              }}
            >
              {cameraLink}
            </div>

            {(cameraLink.includes(
              "localhost"
            ) ||
              cameraLink.includes(
                "127.0.0.1"
              )) && (
              <p
                style={{
                  color:
                    "#ffcc00",
                  fontSize:
                    "13px",
                  marginTop:
                    "12px",
                }}
              >
                ⚠️ This is currently
                localhost. Open your
                app using the laptop's
                network IP address
                before scanning.
              </p>
            )}

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
            Choose the camera
            connected to this
            computer.
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
              onClick={() =>
                setScreen(
                  "camera-source"
                )
              }
            >
              BACK
            </button>

            {cameraDevices.length >
              0 && (
              <button
                className="primary"
                onClick={async () => {
                  const started =
                    await startLocalCamera();

                  if (started) {
                    setScreen(
                      "camera"
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
                setScreen(
                  "template"
                )
              }
            >
              🎨 TEMPLATE
            </button>

            <button
              className="outline-button"
              onClick={() =>
                setScreen(
                  "gallery"
                )
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
            Camera:
            {cameraReady
              ? " 🟢 CONNECTED"
              : " 🔴 NOT CONNECTED"}
          </div>

        </main>

      </div>
    );
  }

  // =====================================================
  // CAMERA
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
            top: "20px",
            left: "20px",
            right: "20px",
            zIndex: 10,
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
              ? remoteConnected
                ? "🟢 IPHONE/IPAD CONNECTED"
                : "🔴 WAITING FOR IPHONE/IPAD"
              : cameraReady
              ? "🟢 CAMERA CONNECTED"
              : "🔴 STARTING CAMERA"}
          </div>

        </div>

        <div
          className="camera-overlay"
          style={{
            background:
              "rgba(0,0,0,0.75)",
          }}
        >

          <div className="camera-counter">

            {retakingIndex !==
            null
              ? `RETAKING PHOTO ${
                  retakingIndex +
                  1
                }`
              : `PHOTO ${
                  Math.min(
                    photos.length +
                      1,
                    captureMode
                  )
                } / ${
                  captureMode
                }`}

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
                  ? "📱 Waiting for iPhone/iPad..."
                  : "📷 Starting camera..."}
              </h2>

              <p>
                {cameraSource ===
                "remote"
                  ? "Scan the camera QR code and keep the camera page open."
                  : "Please allow camera access."}
              </p>

            </div>
          )}

          {waitingForRemotePhoto && (
            <div className="loading">
              📸 RECEIVING PHOTO...
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
            Select 1–4 photos for
            your final strip.
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
                            index +
                            1
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