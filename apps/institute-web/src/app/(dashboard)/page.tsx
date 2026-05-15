import { redirect } from 'next/navigation';

// Root: redirect to dashboard (AuthProvider handles /login redirect if unauthenticated)
export default function Home() {
  redirect('/');
}
