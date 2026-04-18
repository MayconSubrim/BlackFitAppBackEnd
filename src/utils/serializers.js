export function serializeUser(user) {
  if (!user) return null;

  const { password, ...safeUser } = user;
  return safeUser;
}

export function serializeUsers(users) {
  return users.map(serializeUser);
}
