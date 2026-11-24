import multer from "multer";
import { ApiError } from "../utils/apiError.js";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
    fields: 12,
    fieldSize: 12 * 1024,
  },
  fileFilter(_req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new ApiError(400, "UNSUPPORTED_FILE_TYPE", "Only JPEG, PNG, WebP, and PDF attachments are accepted."));
      return;
    }
    callback(null, true);
  },
});

export function uploadSupportAttachments(req, res, next) {
  upload.array("attachments", 5)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new ApiError(413, "FILE_TOO_LARGE", "Each attachment must be 5 MB or smaller."));
      return;
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT") {
      next(new ApiError(400, "TOO_MANY_FILES", "No more than five attachments may be submitted."));
      return;
    }
    if (error instanceof multer.MulterError) {
      next(new ApiError(400, "INVALID_UPLOAD", "The attachment upload is invalid."));
      return;
    }
    next(error);
  });
}
