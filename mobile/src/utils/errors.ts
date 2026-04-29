/**
 * Maps raw Firebase auth error codes to user-friendly messages.
 * 
 * @param error - The error object caught from a Firebase operation.
 * @returns A friendly error message string.
 */
export function formatFirebaseError(error: any): string {
  if (typeof error === 'string') return error;
  
  const code = error?.code || error?.message || '';
  
  // Specific Firebase Auth error codes
  if (code.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (code.includes('auth/user-disabled')) {
    return 'This account has been disabled. Please contact support.';
  }
  if (code.includes('auth/user-not-found') || code.includes('auth/wrong-password') || code.includes('auth/invalid-credential')) {
    return 'Invalid email or password. Please try again.';
  }
  if (code.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Try signing in.';
  }
  if (code.includes('auth/weak-password')) {
    return 'Password should be at least 6 characters.';
  }
  if (code.includes('auth/network-request-failed')) {
    return 'Network error. Please check your internet connection.';
  }
  if (code.includes('auth/too-many-requests')) {
    return 'Too many failed attempts. Please try again later.';
  }
  if (code.includes('auth/operation-not-allowed')) {
    return 'Sign-in method not enabled. Please contact support.';
  }

  // Fallback to a generic message if we don't recognize the code
  // but strip the "Firebase: " prefix if it exists to keep it clean
  let message = error?.message || 'Authentication failed. Please try again.';
  if (message.startsWith('Firebase: ')) {
    message = message.replace('Firebase: ', '');
  }
  
  return message;
}
