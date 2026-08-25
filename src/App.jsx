import { useEffect, useRef, useState } from "react";
import "./App.css";

import { generateQR } from "./utils/qrCode";
import { uploadPhoto } from "./utils/uploadPhoto";

const STRIP_WIDTH = 600;
const STRIP_HEIGHT = 1800;

const PRINT_WIDTH = 1200;
const PRINT_HEIGHT = 1800;

function App() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const [screen, setScreen] = useState("home");

  const [captureMode, setCaptureMode] = useState(4);
  const [photos, setPhotos] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState([]);

  const [countdown, setCountdown] = useState(null);
  const [isCounting, setIsCounting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");

  const [template, setTemplate] = useState(null);

  const [finalStrip, setFinalStrip] = useState(null);
const [finalPrint, setFinalPrint] = useState(null);

const [qrCode, setQrCode] = useState(null);
const [isUploading, setIsUploading] = useState(false);

const [gallery, setGallery] = useState([]);

  const [templateSlots, setTemplateSlots] = useState([]);

  // =====================================================
  // LOAD GALLERY
  // =====================================================

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("sandiwa-gallery") || "[]"
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
        date: new Date().toLocaleString(),
      };

      const updated = [item, ...gallery].slice(0, 30);

      setGallery(updated);

      localStorage.setItem(
        "sandiwa-gallery",
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error(error);
    }
  }

  // =====================================================
  // FIND CAMERAS
  // =====================================================

  async function findCameras() {
    try {
      const permission =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

      permission.getTracks().forEach((track) => {
        track.stop();
      });

      const devices =
        await navigator.mediaDevices.enumerateDevices();

      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );

      setCameras(videoDevices);

      if (
        videoDevices.length > 0 &&
        !selectedCamera
      ) {
        setSelectedCamera(
          videoDevices[0].deviceId
        );
      }
    } catch (error) {
      console.error(error);

      alert(
        "Camera permission was not granted."
      );
    }
  }

  // =====================================================
  // START CAMERA
  // =====================================================

  async function startCamera() {
    try {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());
      }

      const constraints = {
        video: selectedCamera
          ? {
              deviceId: {
                exact: selectedCamera,
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

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        await videoRef.current.play();
      }

      setCameraReady(true);
    } catch (error) {
      console.error(error);

      setCameraReady(false);

      alert(
        "Unable to start the camera."
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
        .forEach((track) => track.stop());

      streamRef.current = null;
    }

    setCameraReady(false);
  }

  // =====================================================
  // START MODE
  // =====================================================

  function chooseCaptureMode(mode) {
    setCaptureMode(mode);
    setPhotos([]);
    setSelectedPhotos([]);
    setFinalStrip(null);
    setFinalPrint(null);

    findCameras();

    setScreen("camera-select");
  }

  // =====================================================
  // BEGIN SESSION
  // =====================================================

  function beginSession() {
    if (!selectedCamera) {
      alert("Please select a camera first.");
      return;
    }

    setPhotos([]);
    setSelectedPhotos([]);
    setCountdown(null);
    setIsCounting(false);

    setScreen("camera");

    setTimeout(() => {
      startCamera();
    }, 300);
  }

  // =====================================================
  // CAPTURE PHOTO
  // =====================================================

  function capturePhoto() {
    const video = videoRef.current;

    if (!video) return null;

    if (
      video.readyState < 2 ||
      video.videoWidth === 0
    ) {
      return null;
    }

    const canvas =
      document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    if (!ctx) return null;

    // Mirror image
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return canvas.toDataURL(
      "image/jpeg",
      0.95
    );
  }

  // =====================================================
  // COUNTDOWN
  // =====================================================

  function startCountdown() {
    if (
      isCounting ||
      !cameraReady ||
      photos.length >= captureMode
    ) {
      return;
    }

    setIsCounting(true);

    let seconds = 5;

    setCountdown(seconds);

    timerRef.current = setInterval(() => {
      seconds--;

      if (seconds > 0) {
        setCountdown(seconds);
        return;
      }

      clearInterval(timerRef.current);

      setCountdown("📸");

      setTimeout(() => {
        const photo = capturePhoto();

        if (photo) {
          setPhotos((previous) => [
            ...previous,
            photo,
          ]);
        }

        setCountdown(null);
        setIsCounting(false);
      }, 600);
    }, 1000);
  }

  // =====================================================
  // AUTOMATIC PHOTO SEQUENCE
  // =====================================================

  useEffect(() => {
    if (
      screen !== "camera" ||
      !cameraReady ||
      isCounting
    ) {
      return;
    }

    if (photos.length >= captureMode) {
      stopCamera();

      if (captureMode === 4) {
        setSelectedPhotos(
          photos.map((_, index) => index)
        );

        setScreen("select");
      } else {
        setSelectedPhotos(
          photos.map((_, index) => index)
        );

        setScreen("template");
      }

      return;
    }

    const delay = setTimeout(() => {
      startCountdown();
    }, 1200);

    return () => clearTimeout(delay);
  }, [
    screen,
    cameraReady,
    isCounting,
    photos,
    captureMode,
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
  // UPLOAD TEMPLATE
  // =====================================================

  function uploadTemplate(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a JPG or PNG.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setTemplate(reader.result);

      // Detect slots after loading
      detectTemplateSlots(reader.result);
    };

    reader.readAsDataURL(file);
  }

  // =====================================================
  // DETECT GREEN PHOTO BOXES
  // =====================================================

  async function detectTemplateSlots(imageSrc) {
    const image = new Image();

    image.src = imageSrc;

    await new Promise((resolve) => {
      image.onload = resolve;
    });

    const canvas =
      document.createElement("canvas");

    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(
      image,
      0,
      0,
      image.width,
      image.height
    );

    const data = ctx.getImageData(
      0,
      0,
      image.width,
      image.height
    ).data;

    const width = image.width;
    const height = image.height;

    const mask = new Uint8Array(
      width * height
    );

    // Detect the green placeholder.
    //
    // Your uploaded template uses approximately:
    // RGB(0,191,99)

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
          mask[
            y * width + x
          ] = 1;
        }
      }
    }

    // Connected component detection
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

        const queue = [[x, y]];

        visited[index] = 1;

        let minX = x;
        let minY = y;
        let maxX = x;
        let maxY = y;

        let area = 0;

        while (queue.length > 0) {
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
            const [nx, ny] of neighbors
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

        // Ignore tiny green objects.
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

    // Sort top-to-bottom then left-to-right.
    slots.sort((a, b) => {
      if (
        Math.abs(a.y - b.y) < 50
      ) {
        return a.x - b.x;
      }

      return a.y - b.y;
    });

    // If the uploaded image is your 4R
    // two-copy template, use only the
    // left half as the master strip.
    const singleStripSlots =
      slots
        .filter(
          (slot) =>
            slot.x <
            image.width / 2
        )
        .map((slot) => ({
          ...slot,
        }));

    setTemplateSlots(
      singleStripSlots
    );

    console.log(
      "Detected template slots:",
      singleStripSlots
    );
  }

  // =====================================================
  // LOAD IMAGE
  // =====================================================

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = reject;

      image.src = src;
    });
  }

  // =====================================================
  // DRAW CROPPED PHOTO
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

    if (imageRatio > boxRatio) {
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
      selectedPhotos.length === 0
    ) {
      alert(
        "Please select at least one photo."
      );
      return;
    }

    const templateImage =
      await loadImage(template);

    const canvas =
      document.createElement("canvas");

    canvas.width =
      STRIP_WIDTH;

    canvas.height =
      STRIP_HEIGHT;

    const ctx =
      canvas.getContext("2d");

    // =================================================
    // DRAW TEMPLATE
    // =================================================

    if (
      templateImage.width ===
        PRINT_WIDTH &&
      templateImage.height ===
        PRINT_HEIGHT
    ) {
      // Uploaded image is a 4R
      // two-copy template.
      //
      // Take the LEFT 600x1800.
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
      ctx.drawImage(
        templateImage,
        0,
        0,
        STRIP_WIDTH,
        STRIP_HEIGHT
      );
    }

    // =================================================
    // DRAW PHOTOS INTO GREEN SLOTS
    // =================================================

    const slots =
      templateSlots.slice(
        0,
        selectedPhotos.length
      );

    if (
      slots.length <
      selectedPhotos.length
    ) {
      alert(
        `Only ${slots.length} photo slots were detected. Please make sure your template has green photo boxes.`
      );

      return;
    }

    // We need the template pixel data
    // so only the GREEN placeholder
    // is replaced.
    const templateData =
      ctx.getImageData(
        0,
        0,
        STRIP_WIDTH,
        STRIP_HEIGHT
      );

    for (
      let i = 0;
      i < slots.length;
      i++
    ) {
      const slot = slots[i];

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

      // Replace green pixels only.
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
// UPLOAD PHOTO TO CLOUDINARY
// =================================================

setIsUploading(true);

try {
  // Convert current strip to a Blob
  const baseStrip = canvas.toDataURL(
    "image/jpeg",
    0.96
  );

  const response = await fetch(baseStrip);
  const blob = await response.blob();

  // Upload to Cloudinary
  const photoUrl = await uploadPhoto(blob);

  console.log(
    "Cloudinary photo URL:",
    photoUrl
  );

  // Generate QR from Cloudinary URL
  const qr = await generateQR(photoUrl);

  // Load QR image
  const qrImage =
    await loadImage(qr);

  // =================================================
  // PUT QR ON BOTTOM-LEFT OF STRIP
  // =================================================

  const qrSize = 105;

  const qrMargin = 20;

  // White background
  ctx.fillStyle = "white";

  ctx.fillRect(
    qrMargin - 5,
    STRIP_HEIGHT -
      qrSize -
      qrMargin -
      5,
    qrSize + 10,
    qrSize + 10
  );

  // QR code
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
  // FINAL STRIP WITH QR
  // =================================================

  const finalResult =
    canvas.toDataURL(
      "image/jpeg",
      0.96
    );

  setFinalStrip(finalResult);

  setQrCode(qr);

  saveGallery(finalResult);

  // Automatically make 2 copies
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

  // Keep the original strip if QR fails
  const fallback =
    canvas.toDataURL(
      "image/jpeg",
      0.96
    );

  setFinalStrip(fallback);

  saveGallery(fallback);

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
      canvas.getContext("2d");

    // White paper
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
  }

  // =====================================================
  // SAVE IMAGE
  // =====================================================

  function saveImage(image, name) {
    if (!image) return;

    const link =
      document.createElement("a");

    link.href = image;

    link.download =
      name ||
      `SANDIWA-${Date.now()}.jpg`;

    link.click();
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
    clearInterval(timerRef.current);
  }

  setPhotos([]);
  setSelectedPhotos([]);
  setFinalStrip(null);
  setFinalPrint(null);
  setQrCode(null);
  setIsUploading(false);
  setCountdown(null);
  setIsCounting(false);

  setScreen("home");
}

  // =====================================================
  // CLEANUP
  // =====================================================

  useEffect(() => {
    return () => {
      stopCamera();

      if (timerRef.current) {
        clearInterval(
          timerRef.current
        );
      }
    };
  }, []);

  // =====================================================
  // HOME
  // =====================================================

  if (screen === "home") {
    return (
      <div className="app">

        <header className="brand-header">

          <h1>SANDIWA</h1>

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
              <span>📷</span>
              <strong>SINGLE</strong>
              <small>
                1 PHOTO
              </small>
            </button>

            <button
              onClick={() =>
                chooseCaptureMode(2)
              }
            >
              <span>📷📷</span>
              <strong>DOUBLE</strong>
              <small>
                2 PHOTOS
              </small>
            </button>

            <button
              onClick={() =>
                chooseCaptureMode(3)
              }
            >
              <span>📷📷📷</span>
              <strong>TRIPLE</strong>
              <small>
                3 PHOTOS
              </small>
            </button>

            <button
              onClick={() =>
                chooseCaptureMode(4)
              }
            >
              <span>📷📷📷📷</span>
              <strong>QUADRUPLE</strong>
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

        </main>

      </div>
    );
  }

  // =====================================================
  // CAMERA SELECT
  // =====================================================

  if (
    screen ===
    "camera-select"
  ) {
    return (
      <div className="app centered">

        <div className="setup-card">

          <h2>
            Select Camera
          </h2>

          <p>
            Choose the camera you
            want to use.
          </p>

          <select
            value={
              selectedCamera
            }
            onChange={(e) =>
              setSelectedCamera(
                e.target.value
              )
            }
          >

            <option value="">
              Select camera
            </option>

            {cameras.map(
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

          <div className="button-row">

            <button
              className="secondary"
              onClick={
                newSession
              }
            >
              BACK
            </button>

            <button
              className="primary"
              disabled={
                !selectedCamera
              }
              onClick={
                beginSession
              }
            >
              START
            </button>

          </div>

        </div>

      </div>
    );
  }

  // =====================================================
  // CAMERA
  // =====================================================

  if (screen === "camera") {
    return (
      <div className="camera-page">

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
        />

        <div className="camera-overlay">

          <div className="camera-counter">

            PHOTO{" "}
            {Math.min(
              photos.length + 1,
              captureMode
            )}{" "}
            / {captureMode}

          </div>

          {countdown !== null && (
            <div className="countdown">

              {countdown}

            </div>
          )}

          {!cameraReady &&
            countdown === null && (
              <div className="loading">
                Starting camera...
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

  if (screen === "select") {
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
                            index + 1
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

  if (screen === "template") {
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
              <b> 600 × 1800 px</b>
            </p>

            <p>
              4R two-copy:
              <b> 1200 × 1800 px</b>
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
                  onClick={
                    createStrip
                  }
                >
                  CREATE PHOTO
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

  if (screen === "result") {
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

  if (screen === "gallery") {
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
                      onClick={() => {
                        setFinalStrip(
                          item.image
                        );

                        createTwoUpPrint(
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