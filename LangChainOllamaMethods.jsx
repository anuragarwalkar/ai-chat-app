import { useState, useRef, useEffect } from 'react'
import './App.css'
import { ChatOllama } from '@langchain/ollama'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";

// Initialize Ollama with different configurations
const ollamaModel = new ChatOllama({
  baseUrl: "http://localhost:11434", // This internally uses /api/chat endpoint
  model: "gemma3:1b",
  temperature: 0,
  streaming: false
})

function LangChainOllamaMethods() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [method, setMethod] = useState('invoke') // invoke, stream, batch, chain
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  // Method 1: Using invoke() - Direct call to /api/chat
  const sendMessageWithInvoke = async (userInput) => {
    const langchainMessages = [
      new SystemMessage("You are a helpful AI assistant."),
      ...messages.map((msg) => 
        msg.sender === "user" 
          ? new HumanMessage(msg.text)
          : new AIMessage(msg.text)
      ),
      new HumanMessage(userInput)
    ];

    // This uses /api/chat endpoint internally
    const response = await ollamaModel.invoke(langchainMessages);
    return response.content;
  }

  // Method 2: Using stream() - Streaming with /api/chat
  const sendMessageWithStream = async (userInput) => {
    const langchainMessages = [
      new SystemMessage("You are a helpful AI assistant."),
      ...messages.map((msg) => 
        msg.sender === "user" 
          ? new HumanMessage(msg.text)
          : new AIMessage(msg.text)
      ),
      new HumanMessage(userInput)
    ];

    // This uses /api/chat endpoint with streaming
    const stream = await ollamaModel.stream(langchainMessages);
    
    let fullResponse = "";
    const streamingMessageId = Date.now();
    
    // Add placeholder message
    setMessages(prev => [...prev, {
      id: streamingMessageId,
      text: "",
      sender: "model",
      timestamp: new Date(),
    }]);

    for await (const chunk of stream) {
      fullResponse += chunk.content;
      // Update message in real-time
      setMessages(prev => 
        prev.map(msg => 
          msg.id === streamingMessageId 
            ? { ...msg, text: fullResponse }
            : msg
        )
      );
    }
    
    return fullResponse;
  }

  // Method 3: Using batch() - Multiple requests to /api/chat
  const sendMessageWithBatch = async (userInput) => {
    const langchainMessages = [
      new SystemMessage("You are a helpful AI assistant."),
      new HumanMessage(userInput)
    ];

    // This can send multiple requests to /api/chat at once
    const responses = await ollamaModel.batch([langchainMessages]);
    return responses[0].content;
  }

  // Method 4: Using ConversationChain - Uses /api/chat with memory
  const sendMessageWithChain = async (userInput) => {
    const memory = new BufferMemory();
    const prompt = PromptTemplate.fromTemplate(`
Current conversation:
{history}
Human: {input}
Assistant:`);

    const chain = new ConversationChain({
      llm: ollamaModel, // This uses /api/chat endpoint
      memory,
      prompt,
    });

    const response = await chain.call({ input: userInput });
    return response.response;
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
      let responseText;
      
      switch (method) {
        case 'invoke':
          responseText = await sendMessageWithInvoke(currentInput);
          break;
        case 'stream':
          responseText = await sendMessageWithStream(currentInput);
          setIsTyping(false);
          return; // Stream handles message addition
        case 'batch':
          responseText = await sendMessageWithBatch(currentInput);
          break;
        case 'chain':
          responseText = await sendMessageWithChain(currentInput);
          break;
        default:
          responseText = await sendMessageWithInvoke(currentInput);
      }

      const newSystemMessage = {
        id: Date.now(),
        text: responseText,
        sender: "model",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, newSystemMessage]);
    } catch (error) {
      console.error("Error calling Ollama:", error);
      const errorMessage = {
        id: Date.now(),
        text: `Error with ${method}: ${error.message}`,
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

  return (
    <div className="chat-app">
      <div className="chat-header">
        <h1>LangChain Ollama Methods (All use /api/chat)</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select 
            value={method} 
            onChange={(e) => setMethod(e.target.value)}
            style={{ padding: '5px', borderRadius: '4px' }}
          >
            <option value="invoke">invoke() - Direct call</option>
            <option value="stream">stream() - Streaming</option>
            <option value="batch">batch() - Batch processing</option>
            <option value="chain">chain() - With memory</option>
          </select>
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
              Assistant is typing using {method}...
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
          placeholder={`Type your message (using ${method})...`}
          className="message-input"
        />
        <button onClick={sendMessage} className="send-button">
          Send
        </button>
      </div>
    </div>
  )
}

export default LangChainOllamaMethods
