import { useEffect, useRef, useState } from "react";
import "./App.css";

import { ref, update } from "firebase/database";
import { database } from "./firebase";

import {
  sendPhoto,
  sendCameraReady,
  listenToSession,
  clearRemotePhoto,
} from "./remoteCamera";

import { generateQR } from "./utils/qrCode";
import { uploadPhoto } from "./utils/uploadPhoto";

const STRIP_WIDTH = 600;
const STRIP_HEIGHT = 1800;

const PRINT_WIDTH = 1200;
const PRINT_HEIGHT = 1800;

const SESSION_ID = "sandiwa-booth";

function App() {
  // =====================================================
  // DEVICE MODE
  // =====================================================

  const [deviceMode, setDeviceMode] = useState("controller");

  // =====================================================
  // REFS
  // =====================================================

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const lastCommandRef = useRef(null);
  const remotePhotoIdRef = useRef(null);

  // =====================================================
  // SCREEN
  // =====================================================

  const [screen, setScreen] = useState("home");

  // =====================================================
  // PHOTO SESSION
  // =====================================================

  const [captureMode, setCaptureMode] = useState(4);

  const [photos, setPhotos] = useState([]);

  const [selectedPhotos, setSelectedPhotos] =
    useState([]);

  // =====================================================
  // CAMERA / COUNTDOWN
  // =====================================================

  const [countdown, setCountdown] = useState(null);

  const [isCounting, setIsCounting] =
    useState(false);

  const [cameraReady, setCameraReady] =
    useState(false);

  const [
    waitingForRemotePhoto,
    setWaitingForRemotePhoto,
  ] = useState(false);

  // =====================================================
  // TEMPLATE
  // =====================================================

  const [template, setTemplate] =
    useState(null);

  const [templateSlots, setTemplateSlots] =
    useState([]);

  // =====================================================
  // FINAL IMAGES
  // =====================================================

  const [finalStrip, setFinalStrip] =
    useState(null);

  const [finalPrint, setFinalPrint] =
    useState(null);

  // =====================================================
  // QR / UPLOAD
  // =====================================================

  const [qrCode, setQrCode] =
    useState(null);

  const [isUploading, setIsUploading] =
    useState(false);

  // =====================================================
  // GALLERY
  // =====================================================

  const [gallery, setGallery] =
    useState([]);

  // =====================================================
  // DETECT DEVICE MODE
  // =====================================================

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    if (
      params.get("camera") === "1"
    ) {
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
      const saved =
        JSON.parse(
          localStorage.getItem(
            "sandiwa-gallery"
          ) || "[]"
        );

      setGallery(saved);
    } catch {
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
        date:
          new Date().toLocaleString(),
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
  // START IPAD / IPHONE CAMERA
  // =====================================================

  useEffect(() => {
    if (
      deviceMode !== "camera"
    ) {
      return;
    }

    let active = true;

    async function startRemoteCamera() {
      try {
        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
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
            }
          );

        if (!active) {
          stream
            .getTracks()
            .forEach((track) =>
              track.stop()
            );

          return;
        }

        streamRef.current =
          stream;

        if (videoRef.current) {
          videoRef.current.srcObject =
            stream;

          await videoRef.current.play();
        }

        setCameraReady(true);

        await sendCameraReady();

        console.log(
          "Remote camera ready"
        );
      } catch (error) {
        console.error(
          "Remote camera error:",
          error
        );

        setCameraReady(false);

        alert(
          "Camera permission was not granted. Please allow camera access and reload the page."
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

        streamRef.current =
          null;
      }

      setCameraReady(false);
    };
  }, [deviceMode]);

  // =====================================================
  // IPAD LISTENS FOR CAPTURE COMMAND
  // =====================================================

  useEffect(() => {
    if (
      deviceMode !== "camera"
    ) {
      return;
    }

    const unsubscribe =
      listenToSession(
        async (data) => {
          if (
            !data ||
            !data.command
          ) {
            return;
          }

          if (
            data.command !==
            "capture"
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
            "Capture command received:",
            data.commandId
          );

          await captureRemotePhoto();
        }
      );

    return () => {
      unsubscribe();
    };
  }, [deviceMode]);

  // =====================================================
  // IPAD CAPTURE PHOTO
  // =====================================================

  async function captureRemotePhoto() {
    const video =
      videoRef.current;

    if (!video) {
      console.log(
        "Video element unavailable"
      );

      return;
    }

    if (
      video.readyState < 2 ||
      video.videoWidth === 0
    ) {
      console.log(
        "Camera is not ready"
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
        canvas.getContext(
          "2d"
        );

      if (!ctx) {
        return;
      }

      // Mirror front camera
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

      console.log(
        "Sending photo to laptop..."
      );

      await sendPhoto(photo);

      console.log(
        "Photo sent successfully"
      );
    } catch (error) {
      console.error(
        "Remote photo error:",
        error
      );
    }
  }

  // =====================================================
  // LAPTOP LISTENS FOR IPAD PHOTO
  // =====================================================

  useEffect(() => {
    if (
      deviceMode !==
      "controller"
    ) {
      return;
    }

    const unsubscribe =
      listenToSession(
        (data) => {
          if (!data) {
            return;
          }

          // Camera status
          if (
            data.cameraStatus ===
            "ready"
          ) {
            setCameraReady(true);
          }

          // Photo received
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
              "Photo received from iPad"
            );

            setPhotos(
              (previous) => [
                ...previous,
                data.photo,
              ]
            );

            setWaitingForRemotePhoto(
              false
            );

            clearRemotePhoto();
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, [deviceMode]);

  // =====================================================
  // REQUEST PHOTO FROM IPAD
  // =====================================================

  async function requestRemotePhoto() {
    try {
      setWaitingForRemotePhoto(
        true
      );

      const commandId =
        Date.now();

      await update(
        ref(
          database,
          `photobooth/${SESSION_ID}`
        ),
        {
          command: "capture",
          commandId,
          status: "waiting",
        }
      );

      console.log(
        "Capture command sent:",
        commandId
      );
    } catch (error) {
      console.error(
        "Failed to request photo:",
        error
      );

      setWaitingForRemotePhoto(
        false
      );

      alert(
        "Could not communicate with the iPad camera. Make sure the iPad is connected."
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

      streamRef.current =
        null;
    }

    setCameraReady(false);
  }

  // =====================================================
  // CHOOSE CAPTURE MODE
  // =====================================================

  function chooseCaptureMode(
    mode
  ) {
    setCaptureMode(mode);

    setPhotos([]);

    setSelectedPhotos([]);

    setFinalStrip(null);

    setFinalPrint(null);

    setCountdown(null);

    setIsCounting(false);

    setWaitingForRemotePhoto(
      false
    );

    setScreen("camera");
  }

  // =====================================================
  // BEGIN SESSION
  // =====================================================

  function beginSession() {
    setPhotos([]);

    setSelectedPhotos([]);

    setCountdown(null);

    setIsCounting(false);

    setWaitingForRemotePhoto(
      false
    );

    setScreen("camera");
  }

  // =====================================================
  // COUNTDOWN
  // =====================================================

  function startCountdown() {
    if (
      isCounting ||
      !cameraReady ||
      waitingForRemotePhoto ||
      photos.length >=
        captureMode
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
          setCountdown(
            seconds
          );

          return;
        }

        clearInterval(
          timerRef.current
        );

        timerRef.current =
          null;

        setCountdown("📸");

        setTimeout(
          async () => {
            await requestRemotePhoto();

            setCountdown(null);

            setIsCounting(false);
          },
          600
        );
      }, 1000);
  }

  // =====================================================
  // AUTOMATIC PHOTO SEQUENCE
  // =====================================================

  useEffect(() => {
    if (
      deviceMode !==
      "controller"
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

    if (
      photos.length >=
      captureMode
    ) {
      if (
        captureMode === 4
      ) {
        setSelectedPhotos(
          photos.map(
            (_, index) =>
              index
          )
        );

        setScreen("select");
      } else {
        setSelectedPhotos(
          photos.map(
            (_, index) =>
              index
          )
        );

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
  ]);

  // =====================================================
  // PHOTO SELECTION
  // =====================================================

  function togglePhoto(
    index
  ) {
    setSelectedPhotos(
      (previous) => {
        if (
          previous.includes(
            index
          )
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
  // UPLOAD TEMPLATE
  // =====================================================

  function uploadTemplate(
    event
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      alert(
        "Please upload a JPG or PNG."
      );

      return;
    }

    const reader =
      new FileReader();

    reader.onload = () => {
      setTemplate(
        reader.result
      );

      detectTemplateSlots(
        reader.result
      );
    };

    reader.readAsDataURL(
      file
    );
  }

  // =====================================================
  // DETECT TEMPLATE SLOTS
  // =====================================================

  async function detectTemplateSlots(
    imageSrc
  ) {
    const image =
      new Image();

    image.src = imageSrc;

    await new Promise(
      (resolve) => {
        image.onload =
          resolve;
      }
    );

    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width =
      image.width;

    canvas.height =
      image.height;

    const ctx =
      canvas.getContext(
        "2d"
      );

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

    const width =
      image.width;

    const height =
      image.height;

    const mask =
      new Uint8Array(
        width * height
      );

    // Detect green placeholder
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
          (y * width + x) *
          4;

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

    // Connected components
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

        visited[index] =
          1;

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
          ] =
            queue.pop();

          area++;

          minX =
            Math.min(
              minX,
              cx
            );

          minY =
            Math.min(
              minY,
              cy
            );

          maxX =
            Math.max(
              maxX,
              cx
            );

          maxY =
            Math.max(
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
              visited[ni] =
                1;

              queue.push([
                nx,
                ny,
              ]);
            }
          }
        }

        const boxWidth =
          maxX -
          minX +
          1;

        const boxHeight =
          maxY -
          minY +
          1;

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

    slots.sort(
      (a, b) => {
        if (
          Math.abs(
            a.y - b.y
          ) < 50
        ) {
          return (
            a.x - b.x
          );
        }

        return (
          a.y - b.y
        );
      }
    );

    // If template is 4R 1200x1800,
    // use only left 600px as master strip.
    //
    // If template is already 600x1800,
    // use all detected slots.

    let usableSlots;

    if (
      image.width ===
        PRINT_WIDTH &&
      image.height ===
        PRINT_HEIGHT
    ) {
      usableSlots =
        slots.filter(
          (slot) =>
            slot.x <
            image.width / 2
        );
    } else {
      usableSlots =
        slots;
    }

    setTemplateSlots(
      usableSlots
    );

    console.log(
      "Detected template slots:",
      usableSlots
    );
  }

  // =====================================================
  // LOAD IMAGE
  // =====================================================

  function loadImage(
    src
  ) {
    return new Promise(
      (resolve, reject) => {
        const image =
          new Image();

        image.onload =
          () => resolve(image);

        image.onerror =
          reject;

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

    let sw =
      image.width;

    let sh =
      image.height;

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
  // CREATE SINGLE STRIP
  // =====================================================

  async function createStrip() {
    if (!template) {
      alert(
        "Please upload your template first."
      );

      return;
    }

    if (
      selectedPhotos.length ===
      0
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
      canvas.getContext(
        "2d"
      );

    if (!ctx) {
      return;
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
      // 4R two-copy template
      // Take left half

      ctx.drawImage(
        templateImage,
        0,
        0,
        600,
        1800,
        0,
        0,
        600,
        1800
      );
    } else {
      // 2x6 template

      ctx.drawImage(
        templateImage,
        0,
        0,
        STRIP_WIDTH,
        STRIP_HEIGHT
      );
    }

    // =================================================
    // TEMPLATE PIXELS
    // =================================================

    const templateData =
      ctx.getImageData(
        0,
        0,
        STRIP_WIDTH,
        STRIP_HEIGHT
      );

    // =================================================
    // INSERT PHOTOS
    // =================================================

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
        slot.width;

      photoCanvas.height =
        slot.height;

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
        slot.width,
        slot.height
      );

      const photoData =
        photoCtx.getImageData(
          0,
          0,
          slot.width,
          slot.height
        );

      // Replace only green pixels
      for (
        let sy = 0;
        sy < slot.height;
        sy++
      ) {
        for (
          let sx = 0;
          sx < slot.width;
          sx++
        ) {
          const templateX =
            slot.x + sx;

          const templateY =
            slot.y + sy;

          // Ignore anything outside
          // the 600x1800 strip
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
                slot.width +
              sx
            ) * 4;

          const r =
            templateData
              .data[
                sourceIndex
              ];

          const g =
            templateData
              .data[
                sourceIndex + 1
              ];

          const b =
            templateData
              .data[
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
        "Cloudinary photo URL:",
        photoUrl
      );

      const qr =
        await generateQR(
          photoUrl
        );

      const qrImage =
        await loadImage(qr);

      // =================================================
      // QR POSITION
      // =================================================

      const qrSize = 105;

      const qrMargin = 20;

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

      // =================================================
      // FINAL STRIP
      // =================================================

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

      // Automatically create
      // two copies on 4R

      await createTwoUpPrint(
        finalResult
      );
    } catch (error) {
      console.error(
        "Cloudinary / QR error:",
        error
      );

      alert(
        "The photo was created, but the QR code could not be generated."
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
  }

  // =====================================================
  // CREATE TWO COPIES ON 4R
  // =====================================================

  async function createTwoUpPrint(
    stripImage
  ) {
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

    // White paper

    ctx.fillStyle =
      "white";

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

    setFinalPrint(
      result
    );

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
  // PRINT 4R TWO-UP
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

            object-fit: contain;
          }

        </style>

      </head>

      <body>

        <img
          src="${finalPrint}"
        />

        <script>

          window.onload = function () {

            setTimeout(
              function () {
                window.print();
              },
              500
            );

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

      timerRef.current =
        null;
    }

    setPhotos([]);

    setSelectedPhotos([]);

    setFinalStrip(null);

    setFinalPrint(null);

    setQrCode(null);

    setIsUploading(false);

    setCountdown(null);

    setIsCounting(false);

    setWaitingForRemotePhoto(
      false
    );

    if (
      deviceMode ===
      "controller"
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

      if (timerRef.current) {
        clearInterval(
          timerRef.current
        );
      }
    };
  }, []);

  // =====================================================
  // IPAD CAMERA SCREEN
  // =====================================================

  if (
    deviceMode ===
    "camera"
  ) {
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
                📱 CAMERA READY
              </div>

              <p>
                Connected to the
                photobooth controller.
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
                chooseCaptureMode(
                  1
                )
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
                chooseCaptureMode(
                  2
                )
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
                chooseCaptureMode(
                  3
                )
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
                chooseCaptureMode(
                  4
                )
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
              marginTop: "20px",
              textAlign: "center",
              fontSize: "14px",
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
  // CAMERA CONTROLLER SCREEN
  // =====================================================

  if (
    screen === "camera"
  ) {
    return (
      <div className="camera-page">

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
            color: "white",
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
            {cameraReady
              ? "📱 CAMERA CONNECTED"
              : "🔴 WAITING FOR IPAD"}
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

            PHOTO{" "}
            {Math.min(
              photos.length + 1,
              captureMode
            )}{" "}
            /{" "}
            {captureMode}

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
                📱 Waiting for
                camera...
              </h2>

              <p>
                Open the SANDIWA
                camera link on
                your iPad or iPhone.
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
                    onClick={() =>
                      togglePhoto(
                        index
                      )
                    }
                  >

                    <img
                      src={photo}
                      alt=""
                    />

                    <span>
                      {selected
                        ? "✓ SELECTED"
                        : `PHOTO ${
                            index +
                            1
                          }`}
                    </span>

                  </div>
                );
              }
            )}

          </div>

          <p>
            {selectedPhotos.length}{" "}
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
                {templateSlots.length}{" "}
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

                        await createTwoUpPrint(
                          item.image
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