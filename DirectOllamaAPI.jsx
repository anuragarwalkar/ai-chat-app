import { useState, useRef, useEffect } from 'react'
import './App.css'

// Direct HTTP implementation using /api/chat endpoint
function DirectOllamaAPI() {
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

  // Method 1: Direct HTTP call to /api/chat (non-streaming)
  const sendMessageDirectHTTP = async (userInput) => {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemma3:1b',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant.'
          },
          ...messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          })),
          {
            role: 'user',
            content: userInput
          }
        ],
        stream: false // Non-streaming
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.message.content;
  }

  // Method 2: Direct HTTP call to /api/chat with streaming
  const sendMessageDirectHTTPStreaming = async (userInput) => {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemma3:1b',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant.'
          },
          ...messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          })),
          {
            role: 'user',
            content: userInput
          }
        ],
        stream: true // Enable streaming
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    
    const streamingMessageId = Date.now();
    
    // Add placeholder message
    setMessages(prev => [...prev, {
      id: streamingMessageId,
      text: "",
      sender: "model",
      timestamp: new Date(),
    }]);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.message && data.message.content) {
                fullText += data.message.content;
                
                // Update message in real-time
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === streamingMessageId 
                      ? { ...msg, text: fullText }
                      : msg
                  )
                );
              }
            } catch (e) {
              // Skip invalid JSON lines
              console.warn('Failed to parse JSON:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }

  // Method 3: Using the ollama package (which internally uses /api/chat)
  const _sendMessageOllamaPackage = async (userInput) => {
    // Note: This requires importing ollama package
    // import ollama from 'ollama'
    
    /* 
    const response = await ollama.chat({
      model: 'gemma3:1b',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant.'
        },
        ...messages.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        })),
        {
          role: 'user',
          content: userInput
        }
      ],
    });
    
    return response.message.content;
    */
    
    // For demo purposes, we'll use the direct HTTP method
    return await sendMessageDirectHTTP(userInput);
  }

  const sendMessage = async () => {
    if (input.trim() === "") return;

    const newMessage = {
      id: Date.now(),
      text: input.trim(),
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((oldMessages) => [...oldMessages, newMessage]);
    const currentInput = input.trim();
    setInput("");
    setIsTyping(true);

    try {
      // Using direct HTTP streaming for better UX
      await sendMessageDirectHTTPStreaming(currentInput);
    } catch (error) {
      console.error("Error calling Ollama:", error);
      const errorMessage = {
        id: Date.now(),
        text: `Error: ${error.message}`,
        sender: "model",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage()
    }
  }

  const testEndpoint = async () => {
    try {
      // Test if Ollama is running and /api/chat is accessible
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemma3:1b',
          messages: [{ role: 'user', content: 'Hello, are you working?' }],
          stream: false
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ /api/chat endpoint is working!\nResponse: ${data.message.content}`);
      } else {
        alert(`❌ Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  }

  return (
    <div className="chat-app">
      <div className="chat-header">
        <h1>Direct /api/chat Endpoint Usage</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            onClick={testEndpoint}
            style={{ 
              padding: '5px 10px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              background: '#f0f0f0',
              cursor: 'pointer'
            }}
          >
            Test /api/chat
          </button>
          <button 
            onClick={() => setMessages([])} 
            className="clear-button"
          >
            Clear
          </button>
        </div>
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
              Assistant is typing via direct /api/chat...
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
          placeholder="Type your message (direct /api/chat)..."
          className="message-input"
        />
        <button onClick={sendMessage} className="send-button">
          Send
        </button>
      </div>
      
      <div style={{ padding: '10px', fontSize: '12px', color: '#666', borderTop: '1px solid #eee' }}>
        <strong>Direct HTTP calls to:</strong> http://localhost:11434/api/chat
      </div>
    </div>
  )
}

export default DirectOllamaAPI
