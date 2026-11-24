import { ApiError } from "../utils/apiError.js";

export function sniffFileType(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }
  if (buffer.toString("ascii", 0, 5) === "%PDF-") {
    return { mimeType: "application/pdf", extension: "pdf" };
  }
  throw new ApiError(400, "INVALID_FILE_CONTENT", "An attachment's contents do not match an accepted image or PDF type.");
}
