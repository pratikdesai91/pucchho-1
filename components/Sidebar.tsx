"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import type { Message } from "@/app/page";
import Account from "./account";
import Image from "next/image";
import {
  MoreHorizontal,
  MessageSquarePlus,
  MessageCircle,
  PanelLeft,
} from "lucide-react";

type Chat = {
  id: string;
  title: string;
  messages: Message[];
};

type SidebarProps = {
  chats: Chat[];
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  setCurrentChatId: React.Dispatch<React.SetStateAction<string | null>>;
  currentChatId: string | null;
  onOpenProfile: () => void;
};

export default function Sidebar({
  chats,
  setChats,
  setCurrentChatId,
  currentChatId,
  onOpenProfile,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const deleteMenuRef = useRef<HTMLDivElement | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const { data: session } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const updateChatTitle = async (chatId: string, title: string) => {
    await fetch("/api/chat/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, title }),
    });
  };

  const deleteChatFromDB = async (chatId: string) => {
    await fetch("/api/chat/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId }),
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        userMenuOpen &&
        userMenuRef.current &&
        !userMenuRef.current.contains(target)
      ) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // close 3-dot menu
      if (menuOpenId && menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpenId(null);
      }

      // close delete confirm
      if (
        deleteConfirmId &&
        deleteMenuRef.current &&
        !deleteMenuRef.current.contains(target)
      ) {
        setDeleteConfirmId(null);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpenId(null);
        setDeleteConfirmId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [menuOpenId, deleteConfirmId]);

  return (
    <div
      className={`h-full bg-gray-50 border-r border-gray-200 
      transition-all duration-300 flex flex-col
      ${isOpen ? "w-56" : "w-14"}`}
    >
      {/* Top Toggle */}
      <div className="p-3">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg hover:bg-gray-200 transition"
        >
          <PanelLeft size={20} />
        </button>
      </div>

      {/* New Chat */}
      <div className="px-3">
        <button
          onClick={() => {
            setCurrentChatId(null);
          }}
          className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-gray-200 transition"
        >
          <MessageSquarePlus size={20} />
          {isOpen && <span className="text-sm">New Chat</span>}
        </button>
      </div>

      {/* Divider */}
      {/* Divider with label */}
      <div className="px-3 mt-4 mb-2">
        {isOpen && (
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            History
          </p>
        )}
        <div className="h-px bg-gray-200" />
      </div>

      {/* Chat History */}
      <div className="flex-1 px-2 mt-3 space-y-1 overflow-y-auto scroll-smooth">
        {[...chats].reverse().map((chat) => (
          <div
            key={chat.id}
            onClick={() => setCurrentChatId(chat.id)}
            className={`
    relative group flex items-center gap-2 px-2 py-1.5 rounded-md transition
    ${currentChatId === chat.id ? "bg-gray-100" : "hover:bg-gray-200"}
  `}
          >
            <MessageCircle size={14} />

            {/* 🔹 TITLE OR RENAME INPUT */}
            {isOpen && (
              <div className="flex-1 min-w-0">
                {renamingId === chat.id ? (
                  <input
                    autoFocus
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    onBlur={() => {
                      updateChatTitle(chat.id, renameText);
                      setChats((prev) =>
                        prev.map((c) =>
                          c.id === chat.id ? { ...c, title: renameText } : c,
                        ),
                      );
                      setRenamingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setChats((prev) =>
                          prev.map((c) =>
                            c.id === chat.id ? { ...c, title: renameText } : c,
                          ),
                        );
                        setRenamingId(null);
                      }
                    }}
                    className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <span className="text-xs line-clamp-1">{chat.title}</span>
                  </div>
                )}
              </div>
            )}

            {/* 🔹 3 DOT MENU BUTTON */}
            {isOpen && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === chat.id ? null : chat.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-gray-300 shrink-0"
              >
                <MoreHorizontal size={16} />
              </button>
            )}

            {/* 🔹 MENU */}
            {menuOpenId === chat.id && (
              <div
                ref={menuRef}
                className="absolute right-0 top-full mt-1 bg-white border border-gray-200 shadow-lg rounded-lg w-32 z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    setRenamingId(chat.id);
                    setRenameText(chat.title);
                    setMenuOpenId(null);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                >
                  Rename
                </button>

                <button
                  onClick={() => {
                    setDeleteConfirmId(chat.id);
                    setMenuOpenId(null);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 text-sm"
                >
                  Delete
                </button>
              </div>
            )}

            {/* 🔹 DELETE CONFIRM */}
            {deleteConfirmId === chat.id && (
              <div
                ref={deleteMenuRef}
                className="absolute right-2 top-10 bg-white border border-gray-200 shadow-lg rounded-lg w-36 z-50 p-2"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-xs text-gray-600 mb-2">Delete chat?</p>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      deleteChatFromDB(chat.id);
                      setChats((prev) => prev.filter((c) => c.id !== chat.id));
                      setDeleteConfirmId(null);
                    }}
                    className="flex-1 text-xs bg-red-500 text-white rounded px-2 py-1"
                  >
                    Delete
                  </button>

                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 text-xs bg-gray-200 rounded px-2 py-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-gray-200 relative" ref={userMenuRef}>
        {session?.user && (
          <>
            {/* Avatar Row */}
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`
    flex items-center gap-2 w-full px-2 py-1.5 rounded-md
    transition-all duration-200
    ${
      userMenuOpen ? "bg-gray-100 border-l-2 border-black" : "hover:bg-gray-200"
    }
  `}
            >
              <Image
                src={session.user.image || ""}
                alt="avatar"
                width={40}
                height={40}
                className="rounded-full custom-border border-transparent bg-linear-to-r from-red-500 via-[#53d3fd] to-green-500 p-0.5"
              />

              {isOpen && (
                <span className="text-xs font-medium truncate">
                  {session.user.name}
                </span>
              )}
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute bottom-14 left-3 right-3 bg-white border border-gray-200 shadow-lg rounded-xl z-50 overflow-hidden">
                <button
                  onClick={() => {
                    onOpenProfile();
                    setUserMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                >
                  Profile
                </button>

                <button className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm">
                  Plans
                </button>

                <button className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm">
                  Languages
                </button>

                <button
                  onClick={() => {
                    localStorage.removeItem("guest_chats");
                    localStorage.removeItem("current_chat");
                    signOut();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 text-sm"
                >
                  Logout
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {showAccount && <Account onClose={() => setShowAccount(false)} />}
    </div>
  );
}
