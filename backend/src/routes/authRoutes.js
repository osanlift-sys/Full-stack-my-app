import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  changePasswordController,
  completeEmailVerificationController,
  completePasswordResetController,
  getCsrfToken,
  getProfileController,
  googleLoginController,
  loginController,
  logoutController,
  refreshController,
  registerClientController,
  registerEmployeeController,
  requestPasswordResetController,
  requestEmailVerificationController,
  updateProfileController,
  uploadProfilePhotoController,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/authenticate.js";
import { uploadProfilePhoto } from "../middleware/profileUpload.js";
import { validateBody } from "../middleware/validate.js";
import {
  changePasswordSchema,
  clientRegistrationSchema,
  emailVerificationCompleteSchema,
  emailVerificationRequestSchema,
  employeeRegistrationSchema,
  googleLoginSchema,
  loginSchema,
  passwordResetCompleteSchema,
  passwordResetRequestSchema,
  profileUpdateSchema,
} from "../validators/authValidators.js";

const router = Router();
const authAttemptLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: "RATE_LIMITED", message: "Too many authentication attempts. Try again later." },
    });
  },
});

router.get("/csrf", getCsrfToken);
router.post("/register/employee", authAttemptLimit, validateBody(employeeRegistrationSchema), registerEmployeeController);
router.post("/register/client", authAttemptLimit, validateBody(clientRegistrationSchema), registerClientController);
router.post("/login", authAttemptLimit, validateBody(loginSchema), loginController);
router.post("/google", authAttemptLimit, validateBody(googleLoginSchema), googleLoginController);
router.post("/refresh", refreshController);
router.post("/logout", logoutController);
router.post("/password-reset/request", authAttemptLimit, validateBody(passwordResetRequestSchema), requestPasswordResetController);
router.post("/password-reset/complete", authAttemptLimit, validateBody(passwordResetCompleteSchema), completePasswordResetController);
router.post("/email-verification/request", authAttemptLimit, validateBody(emailVerificationRequestSchema), requestEmailVerificationController);
router.post("/email-verification/complete", authAttemptLimit, validateBody(emailVerificationCompleteSchema), completeEmailVerificationController);
router.get("/me", authenticate, getProfileController);
router.patch("/me", authenticate, validateBody(profileUpdateSchema), updateProfileController);
router.post("/me/photo", authenticate, uploadProfilePhoto, uploadProfilePhotoController);
router.post("/change-password", authenticate, validateBody(changePasswordSchema), changePasswordController);

export default router;
