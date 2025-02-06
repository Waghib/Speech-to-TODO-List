import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import db from './db/index.js';
import { todosTable } from './db/schema.js';
import { ilike, eq } from 'drizzle-orm';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.gemini_api_key);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const SYSTEM_PROMPT = `
You are an AI To-Do List Assistant. Your role is to help users manage their tasks by adding, viewing, updating, and deleting them.
You MUST ALWAYS respond in JSON format with the following structure:

For actions:
{
  "type": "action",
  "function": "createTodo" | "getAllTodos" | "searchTodo" | "deleteTodoById",
  "input": string | number  // The input for the function
}

For responses to the user:
{
  "type": "output",
  "output": string  // Your message to the user
}

Available Tools:
- getAllTodos(): Get all todos from the database.
- createTodo(todo: string): Create a todo in the database and return the id of created todo.
- searchTodo(search: string): Search for all todos in the database that match the search string.
- deleteTodoById(id: string): Delete a todo from the database by id.

IMPORTANT: 
1. When users mention wanting to do something or asking to remind them of something, interpret it as a request to create a todo.
2. When users ask about tasks or what they need to do, use getAllTodos or searchTodo.
3. When users mention completing or finishing a task, help them delete it.
4. Always respond naturally as if having a conversation.

Example interactions:
User: "I want to play football tomorrow"
Assistant: { "type": "action", "function": "createTodo", "input": "Play football tomorrow" }
System: { "observation": 1 }
Assistant: { "type": "output", "output": "I've added 'Play football tomorrow' to your todo list" }

User: "what do I need to do?"
Assistant: { "type": "action", "function": "getAllTodos", "input": "" }
System: { "observation": [{"id": 1, "todo": "Play football tomorrow"}] }
Assistant: { "type": "output", "output": "Here are your tasks:\\n1. Play football tomorrow" }

User: "any tasks about football?"
Assistant: { "type": "action", "function": "searchTodo", "input": "football" }
System: { "observation": [{"id": 1, "todo": "Play football tomorrow"}] }
Assistant: { "type": "output", "output": "Yes, I found 1 task related to football:\\n1. Play football tomorrow" }
`;

let chat;

// Initialize chat
const initializeChat = () => {
  chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }],
      },
    ],
  });
};

initializeChat();

// Utility function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry configuration
const RETRY_DELAYS = [1000, 2000, 4000]; // Retry after 1s, 2s, then 4s

// Get all todos
app.get('/todos', async (req, res) => {
  try {
    const todos = await db.select().from(todosTable);
    res.json(todos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Handle chat messages with retry logic
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      // If this isn't the first attempt, wait before retrying
      if (attempt > 0) {
        await delay(RETRY_DELAYS[attempt - 1]);
      }

      const result = await chat.sendMessage([{ text: message }]);
      const response = await result.response;
      const text = response.text();
      
      try {
        const action = JSON.parse(text);
        
        if (action.type === "output") {
          return res.json({ reply: action.output });
        }
        
        if (action.type === "action") {
          let observation;
          
          switch (action.function) {
            case "getAllTodos":
              observation = await db.select().from(todosTable);
              break;
            case "createTodo":
              const [newTodo] = await db.insert(todosTable).values({ todo: action.input }).returning();
              observation = newTodo.id;
              break;
            case "searchTodo":
              observation = await db.select().from(todosTable).where(ilike(todosTable.todo, `%${action.input}%`));
              break;
            case "deleteTodoById":
              await db.delete(todosTable).where(eq(todosTable.id, action.input));
              observation = true;
              break;
          }
          
          // Send the observation back to the AI
          const followUpResult = await chat.sendMessage([
            {
              text: JSON.stringify({ observation }),
            },
          ]);
          const followUpResponse = await followUpResult.response;
          const followUpText = followUpResponse.text();
          const followUpAction = JSON.parse(followUpText);
          
          return res.json({ reply: followUpAction.output });
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        return res.status(500).json({ 
          error: 'Invalid response format from AI',
          details: parseError.message 
        });
      }

      // If we get here, something unexpected happened with the response format
      throw new Error('Unexpected response format from AI');

    } catch (error) {
      // If this is a 503 error and we haven't exhausted our retries, continue to the next attempt
      if (error.status === 503 && attempt < RETRY_DELAYS.length) {
        console.log(`AI service unavailable, retrying in ${RETRY_DELAYS[attempt]}ms...`);
        continue;
      }

      // If we've exhausted our retries or it's a different error, log it and return an error response
      console.error('AI error:', error);
      
      // If this was our last attempt, send an error response
      if (attempt === RETRY_DELAYS.length) {
        return res.status(503).json({ 
          error: 'AI service temporarily unavailable',
          message: 'The service is currently experiencing high load. Please try again in a few moments.',
          details: error.message 
        });
      }
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
