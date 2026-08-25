export async function uploadPhoto(blob) {
  const formData = new FormData();

  formData.append("file", blob);
  formData.append(
    "upload_preset",
    "sandiwa_photobooth"
  );

  const response = await fetch(
    "https://api.cloudinary.com/v1_1/qq5yegfx/image/upload",
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Photo upload failed");
  }

  const data = await response.json();

  return data.secure_url;
}