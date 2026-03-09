/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Volume2,
  Square,
  ArrowUp,
  Pencil,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Share2,
  Copy,
  Check,
  Paperclip,
  FileText,
  FileImage,
  File,
  X,
  Binoculars,
  Mic,
  MoreHorizontal,
} from "lucide-react";
import { motion } from "framer-motion";
import type { Message } from "@/app/page";
import { useSession } from "next-auth/react";
import Account from "./account";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import type { Element, Text } from "hast";
import Image from "next/image";

type Chat = {
  id: string;
  title: string;
  messages: Message[];
};

type ChatWindowProps = {
  chats: Chat[];
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  currentChat?: Chat;
  currentChatId: string | null;
  setCurrentChatId: React.Dispatch<React.SetStateAction<string | null>>;
  openSidebar: () => void;
};

export default function ChatWindow({
  chats,
  setChats,
  currentChat,
  currentChatId,
  setCurrentChatId,
  openSidebar,
}: ChatWindowProps) {
  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setSpeakingIndex(null);
  };
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [viewer, setViewer] = useState<{
    images: { link: string; title: string }[];
    index: number;
  } | null>(null);
  const toggleDictation = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [editingText, setEditingText] = useState("");
  const { data: session } = useSession();
  const [imageIndexes, setImageIndexes] = useState<{ [key: number]: number }>(
    {},
  );
  const [moreMenuIndex, setMoreMenuIndex] = useState<number | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<{
    [key: number]: boolean;
  }>({});
  const [viewMode, setViewMode] = useState<"code" | "preview">("code");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const firstName = session?.user?.name?.split(" ")[0] || "";
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [webMode, setWebMode] = useState<"auto" | "on" | "off">("auto");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [aiIntent, setAiIntent] = useState<string>("general");
  const [retryMenuIndex, setRetryMenuIndex] = useState<number | null>(null);
  const [webSources, setWebSources] = useState<any[]>([]);
  const autoScrollRef = useRef(true);
  const [popupMessage, setPopupMessage] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showAllSources, setShowAllSources] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const lastUserRef = useRef<HTMLDivElement | null>(null);
  const getFileIcon = (type: string) => {
    if (type.includes("sheet") || type.includes("csv")) return "📊";
    if (type.includes("pdf")) return "📕";
    if (type.includes("image")) return "🖼️";
    if (type.includes("word")) return "📄";
    return "📁";
  };

  type FilePreview = {
    file: File;
    preview?: string;
  };

  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [reactions, setReactions] = useState<{
    [key: number]: "like" | "dislike" | null;
  }>({});
  const [permissions, setPermissions] = useState({
    canReact: false,
    canRetry: false,
    canShare: false,
  });
  const handleCopyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleReaction = (index: number, type: "like" | "dislike") => {
    setReactions((prev) => {
      const current = prev[index];

      return {
        ...prev,
        [index]: current === type ? null : type,
      };
    });
  };

  const handleTryAgain = async (assistantIndex: number) => {
    if (!currentChatId || !currentChat) return;
    setWebSources([]);

    // 🔹 Find previous user message index
    const prevUserIndex = currentChat.messages
      .slice(0, assistantIndex)
      .map((m, i) => (m.role === "user" ? i : -1))
      .filter((i) => i !== -1)
      .pop();

    if (prevUserIndex === undefined) return;

    // 🔹 Keep messages up to that user message
    const trimmedMessages = currentChat.messages.slice(0, prevUserIndex + 1);

    // 🔹 Update UI immediately (remove old assistant)
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === currentChatId
          ? { ...chat, messages: trimmedMessages }
          : chat,
      ),
    );

    let aiText = "";

    // 🔹 Regenerate assistant response
    const { sources, images } = await getAIResponse(
      currentChatId,
      trimmedMessages,
      (chunk) => {
        aiText += chunk;

        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== currentChatId) return chat;

            return {
              ...chat,
              messages: [
                ...trimmedMessages,
                {
                  role: "assistant",
                  content: aiText,
                },
              ],
            };
          }),
        );
      },
    );

    if (sources.length > 0 || images.length > 0) {
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== currentChatId) return chat;

          const messages = [...chat.messages];

          const lastAssistantIndex = messages
            .map((m, i) => (m.role === "assistant" ? i : -1))
            .filter((i) => i !== -1)
            .pop();

          if (lastAssistantIndex !== undefined) {
            messages[lastAssistantIndex] = {
              ...messages[lastAssistantIndex],
              sources: sources,
              images: images,
            };
          }

          return { ...chat, messages };
        }),
      );
    }
  };

  function formatSpeech(text: string) {
    if (!text) return text;

    // capitalize first letter
    text = text.charAt(0).toUpperCase() + text.slice(1);

    // add period if missing
    if (!/[.!?]$/.test(text)) {
      text += ".";
    }

    return text;
  }

  const handleWebSearchRetry = async (assistantIndex: number) => {
    if (!currentChatId || !currentChat) return;
    setWebSources([]);

    const prevUserIndex = currentChat.messages
      .slice(0, assistantIndex)
      .map((m, i) => (m.role === "user" ? i : -1))
      .filter((i) => i !== -1)
      .pop();

    if (prevUserIndex === undefined) return;

    const trimmedMessages = currentChat.messages.slice(0, prevUserIndex + 1);

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === currentChatId
          ? { ...chat, messages: trimmedMessages }
          : chat,
      ),
    );

    let aiText = "";

    const { sources, images } = await getAIResponse(
      currentChatId,
      trimmedMessages,
      (chunk) => {
        aiText += chunk;

        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== currentChatId) return chat;

            return {
              ...chat,
              messages: [
                ...trimmedMessages,
                {
                  role: "assistant",
                  content: aiText,
                },
              ],
            };
          }),
        );
      },
      true, // 👈 FORCE WEB MODE
    );

    if (sources.length > 0 || images.length > 0) {
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== currentChatId) return chat;

          const messages = [...chat.messages];

          const lastAssistantIndex = messages
            .map((m, i) => (m.role === "assistant" ? i : -1))
            .filter((i) => i !== -1)
            .pop();

          if (lastAssistantIndex !== undefined) {
            messages[lastAssistantIndex] = {
              ...messages[lastAssistantIndex],
              sources: sources,
              images: images,
            };
          }

          return { ...chat, messages };
        }),
      );
    }
  };

  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  const speakText = (text: string, index: number) => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech not supported in this browser.");
      return;
    }

    // stop if same message is speaking
    if (speakingIndex === index) {
      stopSpeaking();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setSpeakingIndex(index);
    };

    utterance.onend = () => {
      setSpeakingIndex(null);
    };

    speechSynthesis.speak(utterance);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };
  const [showAccountPopup, setShowAccountPopup] = useState(false);
  const aiPrompts = [
    firstName ? `What’s on your mind, ${firstName}?` : "What’s on your mind?",

    firstName
      ? `How can I help you today, ${firstName}?`
      : "How can I help today?",

    firstName ? `Share your idea, ${firstName}...` : "Share your idea...",

    firstName ? `Ask me anything, ${firstName}.` : "Ask me anything...",

    firstName
      ? `Need help with something, ${firstName}?`
      : "Need help with something?",

    firstName
      ? `Let’s build something amazing, ${firstName}.`
      : "Let’s build something amazing.",

    firstName
      ? `What would you like to explore, ${firstName}?`
      : "What would you like to explore?",
  ];
  const [dynamicPlaceholder, setDynamicPlaceholder] = useState("");
  useEffect(() => {
    function handleClickOutside() {
      setShowAllSources(false);
    }

    if (showAllSources) {
      window.addEventListener("click", handleClickOutside);
    }

    return () => {
      window.removeEventListener("click", handleClickOutside);
    };
  }, [showAllSources]);

  const [interimText, setInterimText] = useState("");

  useEffect(() => {
    const closeMenu = () => setMoreMenuIndex(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.log("SpeechRecognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("Mic started");
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        const formatted = formatSpeech(finalTranscript);
        setInput((prev) => (prev + " " + formatted).trim());
      }

      setInterimText(interimTranscript);
    };

    recognition.onerror = (event: any) => {
      console.log("Speech error:", event.error);
    };

    recognition.onend = () => {
      console.log("Mic stopped");
      setIsListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      setRetryMenuIndex(null);
    };

    if (retryMenuIndex !== null) {
      window.addEventListener("click", handleClickOutside);
    }

    return () => {
      window.removeEventListener("click", handleClickOutside);
    };
  }, [retryMenuIndex]);

  useEffect(() => {
    if (session) {
      setPermissions({
        canReact: true,
        canRetry: true,
        canShare: true,
      });
    } else {
      setPermissions({
        canReact: false,
        canRetry: false,
        canShare: false,
      });
    }
  }, [session]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;

      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      const isNearBottom = distanceFromBottom < 80;

      autoScrollRef.current = isNearBottom;
      setAutoScrollEnabled(isNearBottom);
    };

    container.addEventListener("scroll", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const random = aiPrompts[Math.floor(Math.random() * aiPrompts.length)];
    setDynamicPlaceholder(random);
  }, [session]);
  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  };

  const saveChatToDB = async (
    chatId: string,
    title: string,
    messages: Message[],
  ) => {
    if (!session?.user?.email) return;

    await fetch("/api/chat/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userEmail: session.user.email,
        chatId,
        title,
        messages,
      }),
    });
  };

  useEffect(() => {
    const syncGuestChats = async () => {
      if (!session?.user?.email) return;

      const stored = localStorage.getItem("guest_chats");
      if (!stored) return;

      const guestChats = JSON.parse(stored);

      for (const chat of guestChats) {
        await fetch("/api/chat/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userEmail: session.user.email,
            chatId: chat.id,
            title: chat.title,
            messages: chat.messages,
          }),
        });
      }

      // clear local after sync
      localStorage.removeItem("guest_chats");
    };

    syncGuestChats();
  }, [session]);

  const getAIResponse = async (
    chatId: string,
    messages: Message[],
    onChunk: (chunk: string) => void,
    forceWeb: boolean = false,
  ): Promise<{ sources: any[]; images: any[] }> => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        userEmail: session?.user?.email,
        messages,
        webMode,
        forceWeb,
      }),
      signal: controller.signal,
    });

    const sourcesHeader = res.headers.get("x-sources");

    let responseSources: any[] = [];
    let responseImages: any[] = [];

    if (sourcesHeader) {
      try {
        responseSources = JSON.parse(sourcesHeader);
      } catch {
        responseSources = [];
      }
    }

    // 🔥 SERVER LIMIT HANDLER
    if (res.status === 403) {
      const data = await res.json();

      setPopupMessage(data.message);
      setShowUpgradePopup(true);

      if (data.error === "LOGIN_REQUIRED") {
        setShowAccountPopup(true);
      }

      return { sources: [], images: [] }; // ✅ ALWAYS return array
    }

    const modelUsed = res.headers.get("x-model-used");
    const canReact = res.headers.get("x-can-react") === "true";
    const canRetry = res.headers.get("x-can-retry") === "true";
    const canShare = res.headers.get("x-can-share") === "true";
    setPermissions({ canReact, canRetry, canShare });
    const intentUsed = res.headers.get("x-intent");

    if (intentUsed) {
      setAiIntent(intentUsed);
    }
    const showUpgrade = res.headers.get("x-show-upgrade") === "true";

    // sync dropdown with backend model
    if (modelUsed) {
      setSelectedModel(modelUsed);
    }

    // server asks to show upgrade
    if (showUpgrade) {
      setPopupMessage(
        "You’ve reached the usage limit for our fast AI model. You can continue with our standard model, or upgrade to access faster responses and advanced features.",
      );
      setShowUpgradePopup(true);
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return { sources: [], images: [] };

    try {
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        buffer += chunk;

        // Parse sources
        const sourceMatch = buffer.match(/__SOURCES__(.*?)__END_SOURCES__/);

        if (sourceMatch) {
          try {
            responseSources = JSON.parse(sourceMatch[1]);
          } catch {
            responseSources = [];
          }

          buffer = buffer.replace(sourceMatch[0], "");
        }

        // Parse images
        const imageMatch = buffer.match(/__IMAGES__(.*?)__END_IMAGES__/);

        if (imageMatch) {
          try {
            responseImages = JSON.parse(imageMatch[1]);
          } catch {
            responseImages = [];
          }

          buffer = buffer.replace(imageMatch[0], "");

          // 🔥 immediately show images while streaming
          setChats((prev) =>
            prev.map((chat) => {
              if (chat.id !== chatId) return chat;

              const messages = [...chat.messages];
              const lastAssistantIndex = messages
                .map((m, i) => (m.role === "assistant" ? i : -1))
                .filter((i) => i !== -1)
                .pop();

              if (lastAssistantIndex !== undefined) {
                messages[lastAssistantIndex] = {
                  ...messages[lastAssistantIndex],
                  images: responseImages,
                };
              }

              return { ...chat, messages };
            }),
          );
        }

        // Send remaining text to UI
        if (buffer.length > 0) {
          onChunk(buffer);
          buffer = "";
        }

        // auto scroll
        if (autoScrollRef.current && scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }
    } catch (err) {
      if ((err as any).name === "AbortError") {
        console.log("Stream aborted");
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
    return {
      sources: responseSources,
      images: responseImages,
    };
  };
  //new msg handler
  const handleSend = async () => {
    if (!input.trim()) return;
    setWebSources([]);

    let isNewChat = false;

    const userMessage: Message = {
      role: "user",
      content: input,
      attachments: filePreviews.map((item) => ({
        name: item.file.name,
        type: item.file.type,
        url: item.preview || undefined, // for images
        fileObject: item.file,
      })),
    };

    let chatId = currentChatId;

    // Create chat if none exists
    if (!chatId) {
      const newChat: Chat = {
        id: crypto.randomUUID(),
        title: "New Chat",
        messages: [userMessage],
      };

      setChats((prev) => [...prev, newChat]);
      setCurrentChatId(newChat.id);
      chatId = newChat.id;
      isNewChat = true;
    } else {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? { ...chat, messages: [...chat.messages, userMessage] }
            : chat,
        ),
      );
    }

    setAutoScrollEnabled(true);

    setTimeout(() => {
      lastUserRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);

    setInput("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    if (files.length > 0 && session?.user?.email && chatId) {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("chatId", chatId);
        formData.append("userEmail", session.user.email);

        await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
      }
    }

    // Now clear files
    setFiles([]);
    setFilePreviews([]);

    setFiles([]);

    const baseMessages = [...(currentChat?.messages || []), userMessage];

    let aiText = "";

    let finalMessages: Message[] = [];

    const { sources, images } = await getAIResponse(
      chatId!,
      baseMessages,
      (chunk) => {
        aiText += chunk;

        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== chatId) return chat;

            const messages = [...chat.messages];

            const lastUserIndex = messages.findLastIndex(
              (m) => m.role === "user",
            );

            if (lastUserIndex !== -1) {
              if (
                messages[lastUserIndex + 1] &&
                messages[lastUserIndex + 1].role === "assistant"
              ) {
                messages[lastUserIndex + 1] = {
                  role: "assistant",
                  content: aiText,
                };
              } else {
                messages.push({
                  role: "assistant",
                  content: aiText,
                });
              }
            }

            finalMessages = messages; // ✅ capture final version safely

            return { ...chat, messages };
          }),
        );
      },
    );

    if (sources.length > 0 || images.length > 0) {
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== chatId) return chat;

          const messages = [...chat.messages];

          const lastAssistantIndex = messages
            .map((m, i) => (m.role === "assistant" ? i : -1))
            .filter((i) => i !== -1)
            .pop();

          if (lastAssistantIndex !== undefined) {
            messages[lastAssistantIndex] = {
              ...messages[lastAssistantIndex],
              sources: sources,
              images: images,
            };
          }

          return { ...chat, messages };
        }),
      );
    }

    // ✅ SAVE USING finalMessages
    if (finalMessages.length > 0) {
      await saveChatToDB(
        chatId!,
        chats.find((c) => c.id === chatId)?.title || "",
        finalMessages,
      );
    }

    // Generate title only if this was a brand new chat
    if (isNewChat) {
      try {
        const res = await fetch("/api/chat/title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage.content }),
        });

        const data = await res.json();

        setChats((prev) =>
          prev.map((chat) =>
            chat.id === chatId ? { ...chat, title: data.title } : chat,
          ),
        );

        await fetch("/api/chat/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId,
            title: data.title,
          }),
        });
      } catch (err) {
        console.error("Title generation failed", err);
      }
    }
    // Generate title only for brand new chats
    if (currentChat?.messages.length === 0) {
      try {
        const res = await fetch("/api/chat/title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: input }),
        });

        const data = await res.json();

        setChats((prev) =>
          prev.map((chat) =>
            chat.id === chatId ? { ...chat, title: data.title } : chat,
          ),
        );

        await fetch("/api/chat/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId,
            title: data.title,
          }),
        });
      } catch (err) {
        console.error("Title generation failed", err);
      }
    }
  };

  //edit msg handler
  const handleSaveEdit = async () => {
    if (editingIndex === null || !currentChatId) return;
    setWebSources([]);

    let updatedMessages: Message[] = [];

    // 1️⃣ Replace message and remove everything after it
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== currentChatId) return chat;

        const newMessages = chat.messages
          .slice(0, editingIndex + 1)
          .map((msg, i) =>
            i === editingIndex && msg.role === "user"
              ? { ...msg, content: editingText }
              : msg,
          );

        updatedMessages = newMessages;

        return { ...chat, messages: newMessages };
      }),
    );

    setEditingIndex(null);
    setEditingText("");

    let aiText = "";

    const { sources, images } = await getAIResponse(
      currentChatId,
      updatedMessages,
      (chunk) => {
        aiText += chunk;

        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== currentChatId) return chat;

            const messages = [...chat.messages];

            if (
              messages[editingIndex + 1] &&
              messages[editingIndex + 1].role === "assistant"
            ) {
              messages[editingIndex + 1] = {
                role: "assistant",
                content: aiText,
              };
            } else {
              messages.push({
                role: "assistant",
                content: aiText,
              });
            }

            return { ...chat, messages };
          }),
        );
      },
    );
    if (sources.length > 0 || images.length > 0) {
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== currentChatId) return chat;

          const messages = [...chat.messages];

          const lastAssistantIndex = messages
            .map((m, i) => (m.role === "assistant" ? i : -1))
            .filter((i) => i !== -1)
            .pop();

          if (lastAssistantIndex !== undefined) {
            messages[lastAssistantIndex] = {
              ...messages[lastAssistantIndex],
              sources: sources,
              images: images,
            };
          }

          return { ...chat, messages };
        }),
      );
    }
  };

  useEffect(() => {
    if (!currentChatId) return;

    const exists = chats.some((c) => c.id === currentChatId);

    if (!exists) {
      setCurrentChatId(null);
    }
  }, [chats, currentChatId, setCurrentChatId]);

  // Auto expand textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  };

  // Enter to send
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderedMessages = currentChat?.messages || [];

  return (
    <div className="flex flex-col h-dvh bg-white text-black">
      <div className="md:hidden flex items-center p-3 border-gray-200 border-b">
        <button onClick={openSidebar} className="p-2">
          ☰
        </button>
      </div>
      {!currentChat || currentChat.messages.length === 0 ? (
        // 🔹 EMPTY STATE (Perfect Center)
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Big AI Sentence */}
          {!currentChat ||
          currentChat.messages.filter((m) => m.role === "assistant").length ===
            0 ? (
            <h1 className="text-xl sm:text-2xl md:text-3xl font-normal tracking-tight text-gray-900 text-center mb-6">
              {dynamicPlaceholder}
            </h1>
          ) : null}

          {/* Input */}
          <div className="w-full max-w-2xl px-3 sm:px-6 relative pb-[env(safe-area-inset-bottom)">
            {filePreviews.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3">
                {filePreviews.map((item, i) => {
                  const file = item.file;
                  const isImage = file.type.startsWith("image/");
                  const isPDF = file.type === "application/pdf";
                  const isDoc =
                    file.type.includes("word") || file.name.endsWith(".docx");

                  return (
                    <div
                      key={i}
                      className="relative w-20 h-20 sm:w-24 sm:h-24 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center"
                    >
                      {isImage && item.preview ? (
                        <Image
                          src={item.preview!}
                          alt={file.name}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-gray-500">
                          {isPDF ? (
                            <FileText size={28} />
                          ) : isDoc ? (
                            <FileText size={28} />
                          ) : (
                            <File size={28} />
                          )}
                          <span className="text-[10px] text-center px-1 truncate w-20">
                            {file.name}
                          </span>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setFilePreviews((prev) =>
                            prev.filter((_, index) => index !== i),
                          );
                          setFiles((prev) =>
                            prev.filter((_, index) => index !== i),
                          );
                        }}
                        className="absolute top-1 right-1 bg-white rounded-full p-1 shadow"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();

                const droppedFiles = e.dataTransfer.files;
                const validFiles: FilePreview[] = [];

                Array.from(droppedFiles).forEach((file) => {
                  if (file.size > MAX_FILE_SIZE) {
                    alert(`${file.name} exceeds 5MB limit`);
                    return;
                  }

                  if (file.type.startsWith("image/")) {
                    const previewUrl = URL.createObjectURL(file);
                    validFiles.push({ file, preview: previewUrl });
                  } else {
                    validFiles.push({ file });
                  }
                });

                setFilePreviews((prev) => [...prev, ...validFiles]);
                setFiles((prev) => [...prev, ...validFiles.map((f) => f.file)]);
              }}
              className="flex items-end bg-white border border-gray-300 rounded-xl px-4 py-2 shadow-sm hover:border-black transition"
            >
              {/* Hidden file input */}
              <input
                type="file"
                multiple
                hidden
                id="fileUpload"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const selectedFiles = e.currentTarget.files;
                  if (!selectedFiles) return;

                  const validFiles: FilePreview[] = [];

                  Array.from(selectedFiles).forEach((file) => {
                    if (file.size > MAX_FILE_SIZE) {
                      alert(`${file.name} exceeds 5MB limit`);
                      return;
                    }

                    if (file.type.startsWith("image/")) {
                      const previewUrl = URL.createObjectURL(file);
                      validFiles.push({ file, preview: previewUrl });
                    } else {
                      validFiles.push({ file });
                    }
                  });

                  setFilePreviews((prev) => [...prev, ...validFiles]);
                  setFiles((prev) => [
                    ...prev,
                    ...validFiles.map((f) => f.file),
                  ]);
                }}
              />

              {/* Upload Button */}
              <label
                htmlFor="fileUpload"
                className="ml-0 py-3 cursor-pointer text-gray-500 hover:text-black flex items-center"
              >
                <Paperclip size={20} />
              </label>
              <textarea
                ref={textareaRef}
                rows={1}
                value={input + (interimText ? " " + interimText : "")}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything"
                className="flex-1 ml-4 py-1 resize-none outline-none bg-transparent max-h-40 overflow-y-auto text-base"
              />
              <button
                onClick={toggleDictation}
                className={`ml-2 p-3 rounded-lg transition ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "text-black"
                }`}
                title="Dictate message"
              >
                <Mic size={19} />
              </button>

              {isStreaming ? (
                <button
                  onClick={handleStop}
                  className="ml-3 p-3 rounded-full bg-Red text-white hover:scale-105 transition flex items-center justify-center"
                >
                  {/* Stop icon */}
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={`ml-2 px-4 py-4 rounded-lg transition flex items-center justify-center ${
                    input.trim()
                      ? "bg-black text-white hover:scale-105"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <ArrowUp size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        // 🔹 CHAT STATE
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-3xl mx-auto w-full relative">
              {renderedMessages.map((msg, index) => {
                const isLastUser =
                  msg.role === "user" && index === renderedMessages.length - 1;

                return (
                  <div
                    key={index}
                    ref={isLastUser ? lastUserRef : null}
                    className={`group flex flex-col ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    {/* 🔥 AI MODE BADGE */}
                    {msg.role === "assistant" && (
                      <div className="text-xs text-gray-400 mb-1 px-1">
                        {aiIntent === "web" ||
                        (msg.sources && msg.sources.length > 0) ? (
                          <div className="flex items-center gap-2">
                            <Binoculars size={14} />
                            <span>Web Search</span>
                          </div>
                        ) : aiIntent === "coding" ? (
                          "💻 Coding Mode"
                        ) : aiIntent === "article" ? (
                          "📝 Article Mode"
                        ) : aiIntent === "story" ? (
                          "📖 Story Mode"
                        ) : aiIntent === "explanation" ? (
                          "🧠 Explanation Mode"
                        ) : (
                          "💬 Chat Mode"
                        )}
                      </div>
                    )}
                    {/* MESSAGE BUBBLE */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`p-3 sm:p-4 rounded-2xl max-w-[99%] wrap-break-word overflow-hidden ${
                        msg.role === "user"
                          ? "bg-gray-100 text-black"
                          : "text-black"
                      }`}
                    >
                      {editingIndex === index ? (
                        <div className="w-[min(700px,90vw)]">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="w-full resize-none outline-none bg-transparent border border-gray-200 rounded-lg p-2"
                            rows={3}
                            autoFocus
                          />

                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={handleSaveEdit}
                              className="px-3 py-1 text-sm bg-black text-white rounded-md"
                            >
                              Send
                            </button>

                            <button
                              onClick={() => {
                                setEditingIndex(null);
                                setEditingText("");
                              }}
                              className="px-3 py-1 text-sm bg-gray-200 text-black rounded-md"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : msg.role === "assistant" ? (
                        <div className="w-[min(700px,90vw)] text-[15px] leading-7 space-y-2">
                          {msg.images &&
                            msg.images.length > 0 &&
                            (() => {
                              const images = msg.images!;
                              const currentIndex = imageIndexes[index] ?? 0;
                              const currentImage = images[currentIndex];

                              const prev = () => {
                                setImageIndexes((prev) => ({
                                  ...prev,
                                  [index]:
                                    currentIndex === 0
                                      ? images.length - 1
                                      : currentIndex - 1,
                                }));
                              };

                              const next = () => {
                                setImageIndexes((prev) => ({
                                  ...prev,
                                  [index]:
                                    currentIndex === images.length - 1
                                      ? 0
                                      : currentIndex + 1,
                                }));
                              };

                              return (
                                <div className="flex gap-2 overflow-x-auto mb-4">
                                  {images.map((img, i) => (
                                    <img
                                      key={i}
                                      src={img.link}
                                      alt={img.title}
                                      onClick={() =>
                                        setViewer({
                                          images,
                                          index: i,
                                        })
                                      }
                                      className="h-60 w-60 max-w-40 sm:max-w-[200px]; object-cover rounded-lg cursor-zoom-in hover:opacity-90 transition"
                                    />
                                  ))}
                                </div>
                              );
                            })()}
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                              h1: ({ children }) => (
                                <h1 className="text-2xl font-extrabold mt-6 mb-3">
                                  {children}
                                </h1>
                              ),

                              h2: ({ children }) => {
                                const text = Array.isArray(children)
                                  ? children
                                      .map((child) =>
                                        typeof child === "string" ? child : "",
                                      )
                                      .join("")
                                  : String(children);

                                const match = text
                                  .trim()
                                  .match(/^(\d+)\.\s*(.*)/);

                                // STEP STYLE (1. Step Title)
                                if (match) {
                                  const stepNumber = match[1];
                                  const title = match[2];

                                  return (
                                    <h2 className="flex items-center text-xl font-bold mt-6 mb-3">
                                      <span
                                        className="inline-flex items-center justify-center
          w-7 h-7 text-sm font-semibold
          bg-yellow-700 text-white
          rounded-md mr-2 border border-black"
                                      >
                                        {stepNumber}
                                      </span>
                                      {title}
                                    </h2>
                                  );
                                }

                                return (
                                  <h2 className="text-xl sm:text-2xl font-bold mt-6 mb-3 text-gray-900">
                                    {children}
                                  </h2>
                                );
                              },

                              h3: ({ children }) => (
                                <h3 className="text-lg sm:text-xl font-bold mt-5 mb-2 text-gray-900">
                                  {children}
                                </h3>
                              ),

                              p: ({ children }) => {
                                const extractText = (node: any): string => {
                                  if (typeof node === "string") return node;

                                  if (Array.isArray(node))
                                    return node.map(extractText).join("");

                                  if (node?.props?.children)
                                    return extractText(node.props.children);

                                  return "";
                                };

                                const text = extractText(children).trim();

                                // Detect section titles
                                const sectionPattern =
                                  /^(💡|⚠️|📝|🚀|🔥|📌)?\s*(Tip|Warning|Important|Note|Problem|Solution|Steps?|Example|Summary|Conclusion|Benefits|Key Points)\:?/i;

                                if (sectionPattern.test(text)) {
                                  return (
                                    <h3 className="text-xl sm:text-2xl font-bold mt-6 mb-3 text-gray-900">
                                      {children}
                                    </h3>
                                  );
                                }

                                return <p className="leading-7">{children}</p>;
                              },

                              ul: ({ children }) => (
                                <ul className="list-disc pl-6 space-y-1 my-2">
                                  {children}
                                </ul>
                              ),

                              a: ({ href, children }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 underline underline-offset-2 decoration-1 hover:text-blue-800 transition italic"
                                >
                                  {children}
                                </a>
                              ),

                              ol: ({ children }) => (
                                <ol className="list-decimal pl-6 space-y-1 my-2">
                                  {children}
                                </ol>
                              ),

                              li: ({ children }) => <li>{children}</li>,

                              hr: () => (
                                <div className="my-4 border-t border-gray-300" />
                              ),

                              table: ({ children }) => (
                                <div className="overflow-x-auto my-4 rounded-xl border border-gray-200 shadow-sm">
                                  <table className="min-w-125 sm:min-w-full text-xs sm:text-sm">
                                    {children}
                                  </table>
                                </div>
                              ),

                              th: ({ children }) => (
                                <th className="px-3 sm:px-5 py-2 sm:py-3 text-left text-[11px] sm:text-xs uppercase tracking-wider bg-gray-50 text-gray-600 font-semibold whitespace-nowrap">
                                  {children}
                                </th>
                              ),

                              td: ({ children }) => (
                                <td className="px-3 sm:px-5 py-2 sm:py-3 text-gray-800 text-xs sm:text-sm wrap-break-word">
                                  {children}
                                </td>
                              ),

                              code({ className, children, ...props }) {
                                const [mode, setMode] = useState<
                                  "code" | "preview"
                                >("code");
                                const isBlock =
                                  className?.includes("language-");
                                const languageMatch =
                                  className?.match(/language-(\w+)/);
                                const language = languageMatch
                                  ? languageMatch[1]
                                  : "";
                                const preRef = useRef<HTMLPreElement>(null);

                                if (!isBlock) {
                                  return (
                                    <code className="bg-gray-200 px-1.5 py-0.5 rounded text-sm">
                                      {children}
                                    </code>
                                  );
                                }

                                const handleCopy = () => {
                                  const text = preRef.current?.innerText || "";
                                  navigator.clipboard.writeText(text);
                                  setCopiedIndex(index);
                                  setTimeout(() => setCopiedIndex(null), 2000);
                                };

                                return (
                                  <div className="my-3 rounded-lg overflow-hidden border border-gray-700">
                                    {/* Sticky Header */}
                                    <div className="sticky top-0 z-10 flex justify-between items-center bg-gray-900 px-3 py-2">
                                      <span className="text-xs text-gray-400 uppercase tracking-wide">
                                        {language}
                                      </span>

                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={handleCopy}
                                          className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
                                          title="Copy"
                                        >
                                          {copiedIndex === index ? (
                                            <Check size={16} />
                                          ) : (
                                            <Copy size={16} />
                                          )}
                                        </button>

                                        <button
                                          onClick={() => setMode("code")}
                                          className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
                                          title="Code view"
                                        >
                                          Code
                                        </button>

                                        <button
                                          onClick={() => setMode("preview")}
                                          className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
                                          title="Preview"
                                        >
                                          Preview
                                        </button>
                                      </div>
                                    </div>

                                    {/* Scrollable Code */}
                                    {mode === "preview" ? (
                                      <div className="bg-white text-black p-4">
                                        {language === "html" &&
                                          (() => {
                                            const extractText = (
                                              node: any,
                                            ): string => {
                                              if (typeof node === "string")
                                                return node;

                                              if (node?.props?.children) {
                                                if (
                                                  Array.isArray(
                                                    node.props.children,
                                                  )
                                                ) {
                                                  return node.props.children
                                                    .map(extractText)
                                                    .join("");
                                                }
                                                return extractText(
                                                  node.props.children,
                                                );
                                              }

                                              return "";
                                            };

                                            const codeString = Array.isArray(
                                              children,
                                            )
                                              ? children
                                                  .map(extractText)
                                                  .join("")
                                              : extractText(children);

                                            return (
                                              <iframe
                                                srcDoc={codeString}
                                                sandbox="allow-scripts allow-same-origin"
                                                className="w-full h-96 border rounded"
                                              />
                                            );
                                          })()}

                                        {language === "javascript" && (
                                          <div>
                                            <button
                                              onClick={() => {
                                                try {
                                                  new Function(
                                                    String(children),
                                                  )();
                                                } catch (e) {
                                                  alert(e);
                                                }
                                              }}
                                              className="bg-black text-white px-3 py-1 rounded"
                                            >
                                              Run Script
                                            </button>
                                          </div>
                                        )}

                                        {language === "json" && (
                                          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                                            {JSON.stringify(
                                              JSON.parse(String(children)),
                                              null,
                                              2,
                                            )}
                                          </pre>
                                        )}

                                        {language === "markdown" && (
                                          <ReactMarkdown>
                                            {String(children)}
                                          </ReactMarkdown>
                                        )}

                                        {![
                                          "html",
                                          "javascript",
                                          "json",
                                          "markdown",
                                        ].includes(language) && (
                                          <div className="text-sm text-gray-500">
                                            Preview not available for {language}
                                            .
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <pre
                                        ref={preRef}
                                        className="bg-gray-900 text-green-400 p-4 overflow-x-auto text-sm max-h-100"
                                      >
                                        <code className={className} {...props}>
                                          {children}
                                        </code>
                                      </pre>
                                    )}
                                  </div>
                                );
                              },
                            }}
                          >
                            {msg.content.trim()}
                          </ReactMarkdown>

                          {/* 🔥 AI Action Buttons */}
                          <div className="flex items-center gap-2 mt-3 text-gray-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                            {/* Copy - Always visible */}
                            <button
                              title="Copy"
                              onClick={() =>
                                handleCopyMessage(msg.content, index)
                              }
                              className="hover:text-black hover:bg-gray-200 transition flex items-center gap-1 p-1 rounded"
                            >
                              {copiedIndex === index ? (
                                <>
                                  <Check size={18} />
                                  <span className="text-xs">Copied</span>
                                </>
                              ) : (
                                <Copy size={18} />
                              )}
                            </button>

                            {/* Logged-in Only Actions */}
                            {permissions.canReact && (
                              <>
                                {/* Like */}
                                <button
                                  title="Like"
                                  onClick={() => handleReaction(index, "like")}
                                  className={`transition p-1 rounded text-gray-500 hover:text-black hover:bg-gray-200`}
                                >
                                  <ThumbsUp
                                    size={18}
                                    fill={
                                      reactions[index] === "like"
                                        ? "currentColor"
                                        : "none"
                                    }
                                  />
                                </button>

                                {/* Dislike */}
                                <button
                                  title="Dislike"
                                  onClick={() =>
                                    handleReaction(index, "dislike")
                                  }
                                  className={`transition p-1 rounded text-gray-500 hover:text-black hover:bg-gray-200`}
                                >
                                  <ThumbsDown
                                    size={18}
                                    fill={
                                      reactions[index] === "dislike"
                                        ? "currentColor"
                                        : "none"
                                    }
                                  />
                                </button>

                                {/* Try Again */}
                                {permissions.canRetry && !isStreaming && (
                                  <div className="relative">
                                    <button
                                      title="Retry options"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRetryMenuIndex(
                                          retryMenuIndex === index
                                            ? null
                                            : index,
                                        );
                                      }}
                                      className="hover:text-black hover:bg-gray-200 transition p-1 rounded"
                                    >
                                      <RefreshCw size={18} />
                                    </button>

                                    {retryMenuIndex === index && (
                                      <div
                                        className="absolute bottom-full left-0 mb-2 w-40 
              bg-white border border-gray-200 
              rounded-xl shadow-xl z-50"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          onClick={() => {
                                            setRetryMenuIndex(null);
                                            handleTryAgain(index);
                                          }}
                                          className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition"
                                        >
                                          <RefreshCw size={18} />
                                          <span>Try Again</span>
                                        </button>

                                        <button
                                          onClick={() => {
                                            setRetryMenuIndex(null);
                                            handleWebSearchRetry(index);
                                          }}
                                          className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition"
                                        >
                                          <Binoculars size={18} />
                                          <span>Web Search</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* More menu */}
                                <div className="relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMoreMenuIndex(
                                        moreMenuIndex === index ? null : index,
                                      );
                                    }}
                                    className="hover:text-black hover:bg-gray-200 transition p-1 rounded"
                                    title="More options"
                                  >
                                    <MoreHorizontal size={18} />
                                  </button>

                                  {moreMenuIndex === index && (
                                    <div
                                      className="absolute bottom-full left-0 mb-2 w-44 bg-white border border-gray-200 rounded-xl shadow-xl z-50"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {/* Share */}
                                      {permissions.canShare && (
                                        <button
                                          onClick={() => {
                                            setMoreMenuIndex(null);
                                            navigator.share?.({
                                              title: "AI Response",
                                              text: msg.content,
                                            });
                                          }}
                                          className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition"
                                        >
                                          <Share2 size={18} />
                                          Share
                                        </button>
                                      )}

                                      {/* Listen / Stop */}
                                      {speakingIndex === index ? (
                                        <button
                                          onClick={() => {
                                            setMoreMenuIndex(null);
                                            stopSpeaking();
                                          }}
                                          className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition text-blue-600"
                                        >
                                          <Square size={18} />
                                          Stop voice
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setMoreMenuIndex(null);
                                            speakText(msg.content, index);
                                          }}
                                          className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition"
                                        >
                                          <Volume2 size={18} />
                                          Listen
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {msg.attachments?.map((file, i) => (
                            <div
                              key={i}
                              className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden max-w-105"
                            >
                              {/* Header */}
                              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <span>{getFileIcon(file.type)}</span>
                                  <span className="truncate max-w-50">
                                    {file.name}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Download Button */}
                                  <button
                                    onClick={() => {
                                      const link = document.createElement("a");
                                      link.href = file.url || "";
                                      link.download = file.name;
                                      link.click();
                                    }}
                                    className="text-gray-500 hover:text-black"
                                  >
                                    ⬇
                                  </button>

                                  {/* Open in new tab */}
                                  <button
                                    onClick={() =>
                                      window.open(file.url, "_blank")
                                    }
                                    className="text-gray-500 hover:text-black"
                                  >
                                    ↗
                                  </button>
                                </div>
                              </div>

                              {/* Preview Area */}
                              <div className="p-3 text-sm text-gray-600 max-h-48 overflow-auto">
                                {file.type.startsWith("image/") && file.url ? (
                                  <Image
                                    src={file.url}
                                    alt={file.name}
                                    width={400}
                                    height={300}
                                    className="rounded-md"
                                  />
                                ) : (
                                  <div>Click ↗ to preview file</div>
                                )}
                              </div>
                            </div>
                          ))}

                          <div className="max-w-full sm:max-w-175 text-[15px] leading-7">
                            <div
                              className={`whitespace-pre-wrap wrap-break-word ${
                                expandedMessages[index] ? "" : "line-clamp-4"
                              }`}
                            >
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeHighlight]}
                              >
                                {msg.content.trim()}
                              </ReactMarkdown>
                            </div>

                            {msg.content.length > 200 && (
                              <button
                                onClick={() =>
                                  setExpandedMessages((prev) => ({
                                    ...prev,
                                    [index]: !prev[index],
                                  }))
                                }
                                className="mt-1 text-xs font-semibold bg-black text-white px-2 py-1 rounded hover:bg-gray-800"
                              >
                                {expandedMessages[index]
                                  ? "Show less"
                                  : "Show more"}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>

                    {/* 🔥 BUTTONS OUTSIDE BUBBLE */}
                    {msg.role === "user" && editingIndex !== index && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 pr-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleCopyMessage(msg.content, index)}
                          className="p-1 rounded hover:bg-gray-200 hover:text-black"
                          title="Copy"
                        >
                          {copiedIndex === index ? (
                            <Check size={14} />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setEditingIndex(index);
                            setEditingText(msg.content);
                          }}
                          className="p-1 rounded hover:bg-gray-200 hover:text-black"
                        >
                          <Pencil size={14} />
                        </button>

                        {msg.versions && msg.versions.length > 1 && (
                          <>
                            <span>
                              {(msg.currentVersion ?? 0) + 1}/
                              {msg.versions.length}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {isStreaming && (
                <div className="flex items-start mt-4">
                  <div className="w-[min(700px,90vw)]">
                    <div
                      className="w-6 h-6 rounded-full border-[3px] border-gray-200 border-t-black"
                      style={{
                        animation: "spinSmooth 1.8s linear infinite",
                      }}
                    />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="py-2 sm:py-1 flex justify-center bg-white sticky bottom-0">
            <div className="w-full max-w-2xl px-3 sm:px-6 relative pb-[env(safe-area-inset-bottom)]">
              {/* FILE PREVIEWS */}
              {filePreviews.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-3">
                  {filePreviews.map((item, i) => {
                    const file = item.file;
                    const isImage = file.type.startsWith("image/");
                    const isPDF = file.type === "application/pdf";
                    const isDoc =
                      file.type.includes("word") || file.name.endsWith(".docx");

                    return (
                      <div
                        key={i}
                        className="relative w-20 h-20 sm:w-24 sm:h-24 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center"
                      >
                        {isImage && item.preview ? (
                          <Image
                            src={item.preview}
                            alt={file.name}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="flex flex-col items-center text-gray-500">
                            <FileText size={28} />
                            <span className="text-[10px] text-center px-1 truncate w-20">
                              {file.name}
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => {
                            setFilePreviews((prev) =>
                              prev.filter((_, index) => index !== i),
                            );
                            setFiles((prev) =>
                              prev.filter((_, index) => index !== i),
                            );
                          }}
                          className="absolute top-1 right-1 bg-white rounded-full p-1 shadow"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* UPGRADE POPUP */}
              {showUpgradePopup && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-full max-w-md bg-white border border-gray-200 shadow-lg rounded-xl px-4 py-3 z-50">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-gray-700 flex-1">
                      {popupMessage}
                    </p>

                    <div className="flex items-center gap-2">
                      <button className="bg-black text-white text-xs px-3 py-1.5 rounded-md hover:opacity-90 transition">
                        Upgrade
                      </button>

                      <button
                        onClick={() => setShowUpgradePopup(false)}
                        className="text-gray-400 hover:text-black text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {popupMessage.includes("Smart AI limit") && (
                    <span className="mt-2 inline-block text-xs bg-gray-100 px-2 py-1 rounded">
                      Auto switched to GPT-5 Nano
                    </span>
                  )}
                </div>
              )}

              {/* INPUT BAR */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedFiles = e.dataTransfer.files;
                  const validFiles: FilePreview[] = [];

                  Array.from(droppedFiles).forEach((file) => {
                    if (file.size > MAX_FILE_SIZE) {
                      alert(`${file.name} exceeds 5MB limit`);
                      return;
                    }

                    if (file.type.startsWith("image/")) {
                      const previewUrl = URL.createObjectURL(file);
                      validFiles.push({ file, preview: previewUrl });
                    } else {
                      validFiles.push({ file });
                    }
                  });

                  setFilePreviews((prev) => [...prev, ...validFiles]);
                  setFiles((prev) => [
                    ...prev,
                    ...validFiles.map((f) => f.file),
                  ]);
                }}
                className="flex items-end bg-white border border-gray-300 rounded-xl px-4 py-2 shadow-sm hover:border-black transition"
              >
                {/* Hidden file input */}
                <input
                  type="file"
                  multiple
                  hidden
                  id="fileUpload"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const selectedFiles = e.currentTarget.files;
                    if (!selectedFiles) return;

                    const validFiles: FilePreview[] = [];

                    Array.from(selectedFiles).forEach((file) => {
                      if (file.size > MAX_FILE_SIZE) {
                        alert(`${file.name} exceeds 5MB limit`);
                        return;
                      }

                      if (file.type.startsWith("image/")) {
                        const previewUrl = URL.createObjectURL(file);
                        validFiles.push({ file, preview: previewUrl });
                      } else {
                        validFiles.push({ file });
                      }
                    });

                    setFilePreviews((prev) => [...prev, ...validFiles]);
                    setFiles((prev) => [
                      ...prev,
                      ...validFiles.map((f) => f.file),
                    ]);
                  }}
                />

                {/* Upload Button */}
                <label
                  htmlFor="fileUpload"
                  className="mr-2 py-3 cursor-pointer text-gray-500 hover:text-black flex items-center"
                >
                  <Paperclip size={18} />
                </label>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask something..."
                  className="flex-1 ml-2 py-2 resize-none outline-none bg-transparent max-h-32 sm:max-h-40 overflow-y-auto text-sm sm:text-base"
                />

                <button
                  onClick={toggleDictation}
                  className={`ml-2 p-3 rounded-lg transition ${
                    isListening
                      ? "bg-red-500 text-white animate-pulse"
                      : "text-black"
                  }`}
                  title="Dictate message"
                >
                  <Mic size={19} />
                </button>

                {/* Send / Stop Button */}
                {isStreaming ? (
                  <button
                    onClick={handleStop}
                    className="ml-2 p-2 rounded-lg bg-red-500 text-white hover:scale-105 transition"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className={`ml-2 px-4 py-4 rounded-lg transition flex items-center justify-center ${
                      input.trim()
                        ? "bg-black text-white hover:scale-105"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <ArrowUp size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      {showAccountPopup && (
        <Account onClose={() => setShowAccountPopup(false)} />
      )}
    </div>
  );
}
