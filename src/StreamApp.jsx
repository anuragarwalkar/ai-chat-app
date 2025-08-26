
import { useState, useRef, useEffect } from "react";
import "./App.css";

const GEMINI_API_KEY = "xxx";

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}&alt=sse`;

const systemPrompt = `You are a helpful, reliable, and versatile AI assistant. \
Always give clear, concise, and accurate answers. \
Use simple language, structured formatting, and examples when needed. \
Be safe, honest, and friendly while assisting with any type of query.;`;

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

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

    // Create a placeholder message for streaming response
    const streamingMessageId = Date.now();
    const streamingMessage = {
      id: streamingMessageId,
      text: "",
      sender: "model",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, streamingMessage]);

    // ============ HANDLE STREAMING RESPONSE ============
    // Server-Sent Events (SSE) streaming allows us to receive data in chunks
    // instead of waiting for the complete response. This creates a real-time typing effect.
    
    // Step 1: Get a reader to read the response stream chunk by chunk
    // res.body is a ReadableStream, and getReader() gives us access to read it
    const reader = res.body.getReader();
    
    // Step 2: Create a text decoder to convert binary data (Uint8Array) to strings
    // The streaming response comes as binary data, so we need to decode it
    const decoder = new TextDecoder();
    
    // Step 3: Initialize variable to accumulate the complete text as it streams in
    let fullText = "";

    try {
      // Step 4: Start an infinite loop to continuously read chunks
      while (true) {
        // Read one chunk from the stream
        // 'done' tells us if the stream is finished
        // 'value' contains the actual data chunk (as Uint8Array)
        const { done, value } = await reader.read();
        
        // If stream is finished, exit the loop
        if (done) break;

        // Step 5: Convert the binary chunk to a readable string
        // { stream: true } handles partial characters correctly across chunk boundaries
        const chunk = decoder.decode(value, { stream: true });
        
        // Step 6: Split the chunk into individual lines
        // SSE format sends data line by line, separated by \n
        const lines = chunk.split('\n');

        // Step 7: Process each line in the chunk
        for (const line of lines) {
          // Step 8: Check if line contains actual data (SSE format: "data: {json}")
          if (line.startsWith('data: ')) {
            try {
              // Step 9: Extract JSON from the SSE line
              // Remove the "data: " prefix to get pure JSON
              const jsonStr = line.slice(6); // slice(6) removes first 6 characters: "data: "
              
              // Step 10: Skip the end-of-stream marker
              if (jsonStr.trim() === '[DONE]') continue;
              
              // Step 11: Parse the JSON to extract the AI's response text
              const data = JSON.parse(jsonStr);
              
              // Step 12: Navigate through the response structure to get the text
              // Gemini API structure: data.candidates[0].content.parts[0].text
              const candidate = data.candidates?.[0];
              const newText = candidate?.content?.parts?.[0]?.text || "";
              
              // Step 13: If we got new text, add it to our accumulated text
              if (newText) {
                fullText += newText;
                
                // Step 14: Update the UI immediately with the new accumulated text
                // This creates the real-time typing effect - user sees text appearing gradually
                setMessages((prev) => 
                  prev.map((msg) => 
                    // Find our streaming message by ID and update its text
                    msg.id === streamingMessageId 
                      ? { ...msg, text: fullText }  // Update with accumulated text
                      : msg  // Leave other messages unchanged
                  )
                );
              }
            } catch (e) {
              // Step 15: Handle JSON parsing errors gracefully
              // Some lines might not be valid JSON, so we skip them
              console.warn('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      // Update message with error
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === streamingMessageId 
            ? { ...msg, text: "Sorry, there was an error processing your request." }
            : msg
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <div className="chat-app">
      <div className="chat-header">
        <h1>AI Chat</h1>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${
              message.sender === "user" ? "user-message" : "assistant-message"
            }`}
          >
            <div className="message-bubble">{message.text}</div>
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
  );
}

export default App;