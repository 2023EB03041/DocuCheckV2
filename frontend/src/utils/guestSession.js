// The signed-in guest, as the browser remembers them. A session is just a token
// and the address it was issued for; there is no password anywhere in the flow.

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

// Header that identifies the guest on their own endpoints.
export const guestAuthHeader = () => {
  const session = getGuestSession();
  return session ? { Authorization: `Bearer ${session.token}` } : {};
};
