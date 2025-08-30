import { useState, useRef, useEffect } from 'react'
import './App.css'
import { ChatOllama } from '@langchain/ollama'
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";


// Initialize Ollama with Gemma 3:1b model
const ollama = new ChatOllama({
  baseUrl: "http://localhost:11434", // default Ollama port
  model: "gemma3:1b", // Gemma 3:1b model
  temperature: 0,
})

const memory = new BufferMemory();

// Create a custom prompt template with system instructions
const prompt = PromptTemplate.fromTemplate(`You are a helpful, reliable, and versatile AI assistant. Always give clear, concise, and accurate answers. Use simple language, structured formatting, and examples when needed. Be safe, honest, and friendly while assisting with any type of query.

Current conversation:
{history}
Human: {input}
Assistant:`);

const chain = new ConversationChain({
  llm: ollama,
  memory,
  prompt,
  verbose: false,
});

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
    const currentInput = input.trim();
    setInput("");

    setIsTyping(true);

    try {
      // Use the conversation chain which handles memory automatically
      const response = await chain.call({ input: currentInput });

      const newSystemMessage = {
        id: Date.now(),
        text: response.response,
        sender: "model",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, newSystemMessage]);
    } catch (error) {
      console.error("Error calling Ollama:", error);
      const errorMessage = {
        id: Date.now(),
        text: "Sorry, I encountered an error. Please make sure Ollama is running and the gemma3:1b model is available.",
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

  const clearChat = () => {
    setMessages([])
  }

  return (
    <div className="chat-app">
      <div className="chat-header">
        <h1>AI Chat - Ollama (Gemma 3:1b)</h1>
        <button onClick={clearChat} className="clear-button">
          Clear Chat
        </button>
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
