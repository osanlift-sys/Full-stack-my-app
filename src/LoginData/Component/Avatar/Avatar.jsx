import styles from "./Avatar.module.css";

export const Avatar = ({ profile }) => {
  const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

  const userData = profile?.data || profile;

  const avatarSrc =
    userData?.avatar || userData?.photoURL || profile?.photoURL || defaultAvatar;

  const userName = userData?.name || profile?.displayName || profile?.name || "User";

  // Designation Fallback Logic
  const userRole = userData?.designation || profile?.designation || profile?.role;

  return (
    <div className={styles.avatarWrapper}>
      <img
        src={avatarSrc}
        alt={userName}
        className={styles.avatarImg}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = defaultAvatar;
        }}
      />
      <div className={styles.userInfo}>
        <span className={styles.userName}>{userName}</span>
        {userRole && (
          <span className={styles.userRole}>{userRole}</span>
        )}
      </div>
    </div>
  );
};