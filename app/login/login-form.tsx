'use client';

import { FormEvent, useState } from 'react';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'The sign-in email could not be sent.');
      setMessage('Check your email and click the secure sign-in link.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The sign-in email could not be sent.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="email">Administrator email</label>
      <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
      <button type="submit" disabled={sending}>{sending ? 'Sending…' : 'Email me a sign-in link'}</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
