/* eslint-disable @next/next/no-img-element */
"use client";

import { X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type ProfileProps = {
  onClose: () => void;
};

export default function Profile({ onClose }: ProfileProps) {
  const { data: session } = useSession();
  console.log("Avatar URL:", session?.user?.image);

  // 🔥 REAL DATA (from API)
  const [userPlan, setUserPlan] = useState("FREE");
  const [usage, setUsage] = useState(0);
  const [limit, setLimit] = useState(15);

  // fetch usage from backend
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch("/api/user/usage");
        if (!res.ok) return;

        const data = await res.json();
        setUserPlan(data.plan || "FREE");
        setUsage(data.usage || 0);
        setLimit(data.limit || 15);
      } catch (err) {
        console.error("Failed to load usage", err);
      }
    };

    fetchUsage();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className="
  bg-white
  w-[90%] sm:w-95
  max-h-[90vh]
  rounded-3xl
  shadow-2xl
  p-5 sm:p-6
  relative
  overflow-y-auto
"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-full hover:bg-gray-100 transition"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <h2 className="text-lg sm:text-xl font-semibold mb-5">Profile</h2>

        {/* Avatar + Info */}
        <div className="flex items-center gap-4 mb-6">
          {session?.user?.image ? (
  <img
    src={session.user.image}
    alt="avatar"
    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-gray-200 object-cover"
    onError={(e) => {
      (e.currentTarget as HTMLImageElement).style.display = "none";
    }}
  />
) : (
  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
    {session?.user?.name?.charAt(0) || "U"}
  </div>
)}

          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {session?.user?.name || "User"}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {session?.user?.email || "—"}
            </p>
          </div>
        </div>

        {/* Plan Card */}
        <div className="border border-gray-200 rounded-2xl p-4 mb-5 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Current Plan</p>

            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                userPlan === "FREE"
                  ? "bg-white border text-gray-700"
                  : "bg-black text-white"
              }`}
            >
              {userPlan}
            </span>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Usage: {usage} / {limit} messages
          </p>

          {/* Usage bar */}
          <div className="w-full bg-gray-200 h-2 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-black h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${Math.min((usage / limit) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Upgrade button */}
        {userPlan === "FREE" && (
          <button
            className="
              w-full bg-black text-white
              rounded-xl py-2.5 text-sm font-medium
              hover:scale-[1.02] active:scale-[0.99]
              transition
            "
          >
            Upgrade Plan
          </button>
        )}
      </div>
    </div>
  );
}
