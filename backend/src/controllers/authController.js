import {
  changePassword,
  completeEmailVerification,
  completePasswordReset,
  getProfile,
  login,
  loginWithGoogle,
  logout,
  refreshSession,
  registerClient,
  registerEmployee,
  requestPasswordReset,
  requestEmailVerification,
  updateProfile,
  updateProfilePhoto,
} from "../services/authService.js";
import { setCsrfCookie } from "../utils/authTokens.js";

export function getCsrfToken(_req, res) {
  res.status(200).json({ csrfToken: setCsrfCookie(res) });
}

export async function registerEmployeeController(req, res) {
  const result = await registerEmployee(req.validatedBody, res);
  res.status(result.directLogin ? 200 : 202).json(result);
}

export async function registerClientController(req, res) {
  res.status(202).json(await registerClient(req.validatedBody));
}

export async function loginController(req, res) {
  res.status(200).json(await login(req.validatedBody, res));
}

export async function googleLoginController(req, res) {
  res.status(200).json(await loginWithGoogle(req.validatedBody.idToken, res));
}

export async function refreshController(req, res) {
  res.status(200).json(await refreshSession(req, res));
}

export async function logoutController(req, res) {
  await logout(req, res);
  res.status(204).end();
}

export async function requestPasswordResetController(req, res) {
  res.status(202).json(await requestPasswordReset(req.validatedBody.email));
}

export async function requestEmailVerificationController(req, res) {
  res.status(202).json(await requestEmailVerification(req.validatedBody.email));
}

export async function completeEmailVerificationController(req, res) {
  await completeEmailVerification(req.validatedBody.token);
  res.status(204).end();
}

export async function completePasswordResetController(req, res) {
  await completePasswordReset(req.validatedBody);
  res.status(204).end();
}

export async function changePasswordController(req, res) {
  await changePassword(req.user.id, req.validatedBody, res);
  res.status(204).end();
}

export async function getProfileController(req, res) {
  res.status(200).json({ user: await getProfile(req.user.id) });
}

export async function updateProfileController(req, res) {
  res.status(200).json({ user: await updateProfile(req.user.id, req.validatedBody) });
}

export async function uploadProfilePhotoController(req, res) {
  res.status(200).json({
    user: await updateProfilePhoto(req.user.id, req.file),
  });
}
