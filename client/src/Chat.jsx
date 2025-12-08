import { useEffect, useState } from "react";

export default function Chat({ socket, roomId }) {
  const [history, setHistory] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!socket) return;
    socket.on('chat-history', (msgs) => setHistory(msgs));
    socket.on('chat-message', (m) => setHistory(h => [...h, m]));
    return () => {
      socket.off('chat-history');
      socket.off('chat-message');
    };
  }, [socket]);

  const send = () => {
    if (!text) return;
    socket.emit('chat-message', { roomId, text });
    setText('');
  };

  return (
    <div style={{ width: 300, borderLeft: '1px solid #ddd', paddingLeft: 12 }}>
      <h3>Chat</h3>
      <div style={{ height: 300, overflowY: 'auto', border: '1px solid #eee', padding:8 }}>
        {history.map((m,i)=>(
          <div key={i} style={{ marginBottom:8 }}>
            <strong>{m.user?.name || 'Guest'}</strong>: {m.text}
            <div style={{ fontSize:12, color:'#666' }}>{new Date(m.ts).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:8 }}>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key === 'Enter' && send()} />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
