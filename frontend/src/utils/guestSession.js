const TOKEN_KEY = 'guestToken';
const EMAIL_KEY = 'guestEmail';

export const getGuestSession = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  const email = localStorage.getItem(EMAIL_KEY);
  return token && email ? { token, email } : null;
};

export const saveGuestSession = ({ token, email }) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);
};

export const clearGuestSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
};

export const guestAuthHeader = () => {
  const session = getGuestSession();
  return session ? { Authorization: `Bearer ${session.token}` } : {};
};
