import { useState, useRef, useEffect } from 'react'
import './App.css'

const GEMINI_API_KEY ='xxx-xxx';

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const systemPrompt = `You are a helpful, reliable, and versatile AI assistant. \
Always give clear, concise, and accurate answers. \
Use simple language, structured formatting, and examples when needed. \
Be safe, honest, and friendly while assisting with any type of query.;`

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  
const sendMessage = async () => {
    if (input.trim() === "") return;

    const newMessage = {
      id: Date.now(),
      text: input.trim(),
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((oldMessages) => [...oldMessages, newMessage]);
    setInput("");

    setIsTyping(true);

    const getContent = ({ text, role }) => {
      return {
        role: role,
        parts: [
          {
            text: text,
          },
        ],
      };
    };

    const contents = [
      ...messages.map((item) =>
        getContent({ text: item.text, role: item.sender })
      ),
      getContent({ text: input.trim(), role: "user" }),
    ];

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          role: "system",
          parts: [{ text: systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature: 1,
          maxOutputTokens: 512,
        },
      }),
    });

    const data = await res.json();

    const {
      candidates: [canidate],
    } = data;

    const newSystemMessage = {
      id: Date.now(),
      text: canidate?.content?.parts[0].text,
      sender: "model",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newSystemMessage]);
    setIsTyping(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage()
    }
  }

  return (
    <div className="chat-app">
      <div className="chat-header">
        <h1>AI Chat</h1>
      </div>
      
      <div className="chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.sender === 'user' ? 'user-message' : 'assistant-message'}`}
          >
            <div className="message-bubble">
              {message.text}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="message assistant-message">
            <div className="message-bubble typing-indicator">
              Assistant is typing...
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type your message..."
          className="message-input"
        />
        <button onClick={sendMessage} className="send-button">
          Send
        </button>
      </div>
    </div>
  )
}

export default App
