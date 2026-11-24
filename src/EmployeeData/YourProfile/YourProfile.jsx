import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { apiClient } from "../../api/apiClient";
import { syncAuthenticatedUser } from "../../Fetures/Inventory/authSlice";
import UserAttendanceRecord from "../Component/UserAttendanceRecord";
import styles from "./YourProfile.module.css";

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='%23ccc'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";

function YourProfile() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth || {});
  const currentUserEmail = user?.email || "";

  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [profileNotice, setProfileNotice] = useState("");

  const resolvePhotoUrl = (photoUrl) => {
    if (!photoUrl) return "";
    if (!photoUrl.startsWith("/uploads/")) return photoUrl;
    const apiBaseUrl = import.meta.env?.VITE_API_BASE_URL;
    if (apiBaseUrl && /^https?:\/\//i.test(apiBaseUrl)) {
      return `${new URL(apiBaseUrl).origin}${photoUrl}`;
    }
    return photoUrl;
  };

  useEffect(() => {
    const fetchProfileAndPermissions = async () => {
      if (!currentUserEmail) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data } = await apiClient.get("/auth/me");
        const currentProfile = data.user;
        if (currentProfile.permissions?.canAccessProfile === false) {
          setHasAccess(false);
          return;
        }
        setProfileData({
          ...currentProfile,
          avatar: resolvePhotoUrl(currentProfile.photoUrl),
          designation: currentProfile.designation || "",
          phone: currentProfile.phone || "",
          address: currentProfile.address || "",
        });
        if (currentProfile.employeeId && !currentProfile.designation && !currentProfile.phone && !currentProfile.address) {
          setProfileNotice("The profile API does not return existing employee contact fields; enter them to update your profile.");
        }
      } catch (err) {
        console.error("Profile Fetch Error:", err);
        setErrorMsg("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndPermissions();
  }, [currentUserEmail]);

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const acceptedExtensions = /\.(jpe?g|png|webp)$/i;
    const acceptedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/octet-stream"];
    if (!acceptedMimeTypes.includes(file.type) && !acceptedExtensions.test(file.name)) {
      setErrorMsg("Please select a JPG, JPEG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg("Profile photo must be 3 MB or smaller.");
      event.target.value = "";
      return;
    }

    try {
      setIsUploadingPhoto(true);
      setErrorMsg("");
      setPhotoPreview(URL.createObjectURL(file));
      const formData = new FormData();
      formData.append("photo", file);
      const { data } = await apiClient.post("/auth/me/photo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const updatedPayload = {
        ...profileData,
        ...data.user,
        avatar: resolvePhotoUrl(data.user.photoUrl),
        designation: data.user.designation || data.user.employee?.designation || profileData?.designation || "",
        phone: data.user.phone || data.user.employee?.phone || profileData?.phone || "",
        address: data.user.address || data.user.employee?.address || profileData?.address || "",
      };
      dispatch(syncAuthenticatedUser(data.user));
      setProfileData(updatedPayload);
    } catch (err) {
      console.error("Profile Photo Upload Error:", err);
      setErrorMsg(err?.response?.data?.error?.message || err.message || "Failed to upload profile photo.");
      setPhotoPreview("");
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setIsUploadingPhoto(true);
      setErrorMsg("");
      const { data } = await apiClient.patch("/auth/me", { photoUrl: null });
      dispatch(syncAuthenticatedUser(data.user));
      setProfileData((current) => ({
        ...current,
        ...data.user,
        avatar: "",
      }));
      setPhotoPreview("");
    } catch (err) {
      console.error("Remove Photo Error:", err);
      setErrorMsg(err?.response?.data?.error?.message || err.message || "Failed to remove profile photo.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !designation || !phone) {
      setErrorMsg("Please fill in required fields.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg("");

      const { data } = await apiClient.patch("/auth/me", {
        name,
        designation,
        phone,
        address,
      });
      const updatedPayload = {
        ...profileData,
        ...data.user,
        avatar: resolvePhotoUrl(data.user.photoUrl),
        designation,
        phone,
        address,
      };
      dispatch(syncAuthenticatedUser(data.user));
      setProfileData(updatedPayload);
      setIsEditing(false);
    } catch (err) {
      console.error("Save Error:", err);
      setErrorMsg(err?.response?.data?.error?.message || err.message || "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className={styles.profileContainer}><p className={styles.loader}>Loading Profile...</p></div>;

  if (!hasAccess) {
    return (
      <div className={styles.pageLayout} style={{ textAlign: "center", padding: "40px", color: "red" }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to access the Profile page. Contact your Administrator.</p>
      </div>
    );
  }

  return (
    <div className={styles.pageLayout}>
      {profileNotice && <p className={styles.errorMessage} role="status">{profileNotice}</p>}
      <div className={styles.compactCard}>
        {profileData && !isEditing ? (
          <div className={styles.profileRow}>
            <img src={profileData.avatar || DEFAULT_AVATAR} alt="Avatar" className={styles.smallAvatar} />
            
            <div className={styles.profileMeta}>
              <h3>{profileData.name}</h3>
              <p className={styles.badge}>{profileData.designation}</p>
              <div className={styles.metaInfo}>
                <span>📧 {profileData.email}</span>
                <span>📞 {profileData.phone || "N/A"}</span>
                {profileData.address && <span>📍 {profileData.address}</span>}
              </div>
            </div>

            <button
              className={styles.compactEditBtn}
              onClick={() => {
                setName(profileData.name || "");
                setDesignation(profileData.designation || "");
                setPhone(profileData.phone || "");
                setAddress(profileData.address || "");
                setPhotoPreview("");
                setIsEditing(true);
              }}
            >
              Edit Profile
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <h3>{profileData ? "Edit Profile" : "Create Profile"}</h3>
            {errorMsg && <p className={styles.errorMessage}>{errorMsg}</p>}

            {profileData && (
              <div className={styles.photoSection}>
                <img
                  src={photoPreview || profileData.avatar || DEFAULT_AVATAR}
                  alt="Profile"
                  className={styles.editAvatar}
                />
                <div className={styles.photoActions}>
                  <label className={styles.photoUploadBtn}>
                    {isUploadingPhoto ? "Uploading..." : "Upload Profile Picture"}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handlePhotoChange}
                      disabled={isUploadingPhoto}
                    />
                  </label>
                  {(profileData.avatar || photoPreview) && (
                    <button type="button" onClick={handleRemovePhoto} disabled={isUploadingPhoto}>
                      Remove
                    </button>
                  )}
                  <small>JPG, JPEG, PNG or WebP; maximum 3 MB</small>
                </div>
              </div>
            )}
            
            <div className={styles.formGrid}>
              <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <input type="text" placeholder="Designation" value={designation} onChange={(e) => setDesignation(e.target.value)} required />
              <input type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              <input type="text" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>

            <div className={styles.formActions}>
              <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</button>
              {profileData && <button type="button" onClick={() => setIsEditing(false)}>Cancel</button>}
            </div>
          </form>
        )}
      </div>

      {profileData?.name && (
        <UserAttendanceRecord 
          employeeName={profileData.name} 
          employeeEmail={currentUserEmail} 
          employeeId={profileData.employeeId}
        />
      )}
    </div>
  );
}

export default YourProfile;