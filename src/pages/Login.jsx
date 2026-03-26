import React from 'react';
import './AddPage.css';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, signInWithGoogle, signOutUser } = useAuth();

  return (
    <div className="add-page">
      <div className="card">
        <h2>Sign in</h2>
        {user ? (
          <div>
            <p>Signed in as {user.displayName || user.email}</p>
            <button onClick={signOutUser}>Sign out</button>
          </div>
        ) : (
          <div>
            <p>Sign in with your Google account to sync your data.</p>
            <button onClick={signInWithGoogle}>Sign in with Google</button>
          </div>
        )}
      </div>
    </div>
  );
}
