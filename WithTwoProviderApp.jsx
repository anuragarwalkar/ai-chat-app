import { useState, useRef, useEffect } from 'react'
import './App.css'
// Option 1: Using LangChain (uses /api/chat internally)
import { ChatOllama } from '@langchain/ollama'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'


// Initialize Ollama with Gemma 3:1b model
const ollamaModel = new ChatOllama({
  baseUrl: "http://localhost:11434", // This internally calls /api/chat endpoint
  model: "gemma3:1b", // Gemma 3:1b model
  temperature: 0,
  streaming: false
})

const memory = new BufferMemory();

// Create a custom prompt template with system instructions
const prompt = PromptTemplate.fromTemplate(`You are a helpful, reliable, and versatile AI assistant. Always give clear, concise, and accurate answers. Use simple language, structured formatting, and examples when needed. Be safe, honest, and friendly while assisting with any type of query.

Current conversation:
{history}
Human: {input}
Assistant:`);

const chain = new ConversationChain({
  llm: ollamaModel, // This uses /api/chat endpoint through ChatOllama
  memory,
  prompt,
});

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [method, setMethod] = useState('proper-memory') // chain, proper-memory, invoke, stream, direct-http
  const [provider, setProvider] = useState('ollama') // ollama or gemini
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const messagesEndRef = useRef(null)

  // Dynamic model creation based on provider
  const getCurrentModel = () => {
    if (provider === 'gemini') {
      if (!apiKey) {
        throw new Error('Google API key is required for Gemini');
      }
      return new ChatGoogleGenerativeAI({
        apiKey: apiKey,
        model: "gemini-1.5-flash",
        temperature: 0,
      });
    } else {
      return new ChatOllama({
        baseUrl: "http://localhost:11434",
        model: "gemma3:1b",
        temperature: 0,
        streaming: false
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  // Method 1: Using ConversationChain (PROBLEM: concatenates history into single message)
  const sendMessageWithChain = async (currentInput) => {
    console.log('⚠️  ConversationChain concatenates history into single message object');
    const response = await chain.call({ input: currentInput });
    return response.response;
  }

  // Method 1b: Better memory management with ChatMessageHistory
  const sendMessageWithProperMemory = async (currentInput) => {
    // Manual memory management with proper message separation
    const conversationMessages = [
      new SystemMessage("You are a helpful, reliable, and versatile AI assistant."),
      ...messages.map((msg) => 
        msg.sender === "user" 
          ? new HumanMessage(msg.text)
          : new AIMessage(msg.text)
      ),
      new HumanMessage(currentInput)
    ];

    console.log('✅ Proper memory: Each message is separate object');
    console.log('Messages sent to API:', conversationMessages.map(m => ({ role: m._getType(), content: m.content })));
    
    const currentModel = getCurrentModel();
    const response = await currentModel.invoke(conversationMessages);
    return response.content;
  }

  // Method 2: Using ChatOllama.invoke() (direct /api/chat call)
  const sendMessageWithInvoke = async (currentInput) => {
    const langchainMessages = [
      new SystemMessage("You are a helpful, reliable, and versatile AI assistant."),
      ...messages.map((msg) => 
        msg.sender === "user" 
          ? new HumanMessage(msg.text)
          : new AIMessage(msg.text)
      ),
      new HumanMessage(currentInput)
    ];

    const currentModel = getCurrentModel();
    const response = await currentModel.invoke(langchainMessages);
    return response.content;
  }

  // Method 3: Using ChatOllama.stream() (streaming /api/chat)
  const sendMessageWithStream = async (currentInput) => {
    const langchainMessages = [
      new SystemMessage("You are a helpful, reliable, and versatile AI assistant."),
      ...messages.map((msg) => 
        msg.sender === "user" 
          ? new HumanMessage(msg.text)
          : new AIMessage(msg.text)
      ),
      new HumanMessage(currentInput)
    ];

    const currentModel = getCurrentModel();
    const stream = await currentModel.stream(langchainMessages);
    
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

  // Method 4: Direct HTTP to /api/chat (bypassing LangChain)
  const sendMessageDirectHTTP = async (currentInput) => {
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
            content: 'You are a helpful, reliable, and versatile AI assistant.'
          },
          ...messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          })),
          {
            role: 'user',
            content: currentInput
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.message.content;
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
        case 'chain':
          console.log('🔗 Using ConversationChain (LangChain -> /api/chat)');
          responseText = await sendMessageWithChain(currentInput);
          break;
        case 'proper-memory':
          console.log('✅ Using Proper Memory Management (LangChain -> /api/chat)');
          responseText = await sendMessageWithProperMemory(currentInput);
          break;
        case 'invoke':
          console.log('⚡ Using ChatOllama.invoke() (LangChain -> /api/chat)');
          responseText = await sendMessageWithInvoke(currentInput);
          break;
        case 'stream':
          console.log('🌊 Using ChatOllama.stream() (LangChain -> /api/chat)');
          responseText = await sendMessageWithStream(currentInput);
          setIsTyping(false);
          return; // Stream handles message addition
        case 'direct-http':
          console.log('🌐 Using Direct HTTP to /api/chat');
          responseText = await sendMessageDirectHTTP(currentInput);
          break;
        default:
          responseText = await sendMessageWithProperMemory(currentInput);
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
        text: `Sorry, I encountered an error using ${method}. Please make sure Ollama is running and the gemma3:1b model is available.`,
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
    // Clear memory when using chain method
    if (method === 'chain') {
      memory.clear();
    }
  }

  const getMethodDescription = () => {
    switch (method) {
      case 'chain':
        return 'ConversationChain (⚠️ Concatenated History)';
      case 'proper-memory':
        return 'Proper Memory (✅ Separate Messages)';
      case 'invoke':
        return 'ChatOllama.invoke() (LangChain + /api/chat)';
      case 'stream':
        return 'ChatOllama.stream() (LangChain + Streaming + /api/chat)';
      case 'direct-http':
        return 'Direct HTTP (fetch + /api/chat)';
      default:
        return 'Proper Memory Management';
    }
  }

  return (
    <div className="chat-app">
      <div className="chat-header">
        <div>
          <h1>AI Chat - Ollama & Gemini</h1>
          <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '4px' }}>
            Current: {getMethodDescription()} | Provider: {provider === 'ollama' ? 'Ollama (gemma3:1b)' : 'Google Gemini (gemini-1.5-flash)'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            value={provider} 
            onChange={(e) => setProvider(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '4px', 
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '0.9rem'
            }}
          >
            <option value="ollama" style={{ color: 'black' }}>🦙 Ollama (Local)</option>
            <option value="gemini" style={{ color: 'black' }}>🤖 Google Gemini</option>
          </select>
          <select 
            value={method} 
            onChange={(e) => setMethod(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '4px', 
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '0.9rem'
            }}
          >
            <option value="chain" style={{ color: 'black' }}>⚠️ ConversationChain (Bad)</option>
            <option value="proper-memory" style={{ color: 'black' }}>✅ Proper Memory (Good)</option>
            <option value="invoke" style={{ color: 'black' }}>⚡ ChatOllama.invoke()</option>
            <option value="stream" style={{ color: 'black' }}>🌊 ChatOllama.stream()</option>
            <option value="direct-http" style={{ color: 'black' }}>🌐 Direct HTTP</option>
          </select>
          {provider === 'gemini' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter Google API Key"
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  fontSize: '0.9rem',
                  width: '200px'
                }}
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                {showApiKey ? '🙈' : '👁️'}
              </button>
            </div>
          )}
          <button onClick={clearChat} className="clear-button">
            Clear Chat
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
              Assistant is typing using {getMethodDescription()}...
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
          placeholder={`Type your message (${getMethodDescription()})...`}
          className="message-input"
        />
        <button onClick={sendMessage} className="send-button">
          Send
        </button>
      </div>
      
      <div style={{ 
        padding: '10px 20px', 
        fontSize: '11px', 
        color: '#666', 
        borderTop: '1px solid #eee',
        background: '#f9f9f9'
      }}>
        <strong>LangChain abstracts API calls:</strong>
        <br />
        • Ollama: Uses http://localhost:11434/api/chat internally
        <br />
        • Gemini: Uses Google's Generative AI API internally
        <br />
        • Direct HTTP shows explicit fetch() calls to Ollama's endpoint
      </div>
    </div>
  )
}

export default App
