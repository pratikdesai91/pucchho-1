"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { X } from "lucide-react";

type AccountProps = {
  onClose: () => void;
  floating?: boolean;
};

export default function Account({ onClose, floating = false }: AccountProps) {

const [email, setEmail] = useState("");

const handleEmailLogin = async () => {
  await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
};

  return (
    <>
      {/* Dark background ONLY for modal mode */}
      {!floating && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      )}

      <div
        className={`${
          floating
            ? "fixed bottom-4 right-4 z-50"
            : "fixed inset-0 flex items-center justify-center z-50"
        }`}
      >
        <div className="bg-white w-90 rounded-2xl shadow-xl p-6 relative">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 p-1 rounded hover:bg-gray-100"
          >
            <X size={18} />
          </button>

          <h2 className="text-lg font-semibold mb-4">Login</h2>

          {/* Google */}
          <button
            onClick={() => signIn("google", {redirect: true,callbackUrl: window.location.pathname,})}
            className="w-full border border-gray-300 rounded-lg py-2 hover:bg-gray-50 transition flex items-center justify-center gap-3"
          >
            {/* Google Icon */}
            <svg viewBox="0 0 48 48" className="w-5 h-5">
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.6 16 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.1 0 9.8-1.9 13.3-5.1l-6.1-5c-2 1.5-4.5 2.1-7.2 2.1-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.5 16.3 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.3 5.7-6.1 7.3l6.1 5C38.9 36.8 44 31 44 24c0-1.3-.1-2.3-.4-3.5z"
              />
            </svg>

            <span>Continue with Google</span>
          </button>

          <div className="my-4 border-t border-gray-200" />

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email id"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 outline-none focus:border-black"
          />

          <button 
          onClick={handleEmailLogin}
          className="w-full bg-black text-white rounded-lg py-2 hover:opacity-90 transition">Continue with Email</button>
        </div>
      </div>
    </>
  );
}
