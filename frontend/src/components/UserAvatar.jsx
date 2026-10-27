/** Private account avatar. The backend uses the current session, not a user id. */
export default function UserAvatar({ user, revision = 0, small = false }) {
  const initial = user?.username?.slice(0, 1).toUpperCase() || '?';
  const src = user?.avatar_url ? `${user.avatar_url}?v=${revision}` : null;
  return (
    <span className={small ? 'user-avatar user-avatar--small' : 'user-avatar'}>
      {src
        ? <img src={src} alt={`${user.username}'s profile picture`} />
        : <span aria-hidden="true">{initial}</span>}
    </span>
  );
}
