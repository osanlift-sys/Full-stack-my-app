import multer from "multer";
import { ApiError } from "../utils/apiError.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/octet-stream"];
    if (!allowedTypes.includes(file.mimetype)) {
      callback(new ApiError(400, "UNSUPPORTED_PROFILE_PHOTO", "Only JPG, JPEG, PNG, and WebP images are accepted."));
      return;
    }
    callback(null, true);
  },
});

export function uploadProfilePhoto(req, res, next) {
  upload.single("photo")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new ApiError(413, "PROFILE_PHOTO_TOO_LARGE", "Profile photo must be 3 MB or smaller."));
      return;
    }
    if (error instanceof multer.MulterError) {
      next(new ApiError(400, "INVALID_PROFILE_PHOTO", "The profile photo upload is invalid."));
      return;
    }
    next(error);
  });
}
