import { useEffect, useRef, useState, useCallback } from 'react';

export default function useWebSocket(url) {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    function connect() {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => setConnected(true);
      ws.current.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000); // Auto-reconnect
      };
      ws.current.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          setMessages([data]);
        } catch {
          // Ignore malformed messages
        }
      };
    }

    connect();
    return () => ws.current?.close();
  }, [url]);

  const send = useCallback((action, payload = {}) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action, payload }));
    }
  }, []);

  return { connected, messages, send };
}
