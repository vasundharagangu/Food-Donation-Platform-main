import { io } from 'socket.io-client';

let socket = null;

// Prefer direct connection to backend to avoid proxying issues in development
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

export function initSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
  }
  return socket;
}

export function getSocket() {
  return socket;
}
