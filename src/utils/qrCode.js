import QRCode from "qrcode";

export async function generateQR(photoUrl) {
  return await QRCode.toDataURL(photoUrl, {
    width: 140,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}