import { io } from "socket.io-client";

export function createSocket() {
  const url = import.meta.env.VITE_SOCKET_URL || window.location.origin;
  return io(url, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
  });
}