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

// Get all todos
app.get('/todos', async (req, res) => {
  try {
    const todos = await db.select().from(todosTable);
    res.json(todos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Handle chat messages
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  
  try {
    const result = await chat.sendMessage([{ text: message }]);
    const response = await result.response;
    const text = response.text();
    
    try {
      const action = JSON.parse(text);
      
      if (action.type === "output") {
        res.json({ reply: action.output });
      } else if (action.type === "action") {
        let observation;
        
        switch (action.function) {
          case "createTodo":
            const [newTodo] = await db
              .insert(todosTable)
              .values({
                todo: action.input,
              })
              .returning({
                id: todosTable.id,
              });
            observation = newTodo.id;
            break;
            
          case "getAllTodos":
            observation = await db.select().from(todosTable);
            break;
            
          case "searchTodo":
            observation = await db
              .select()
              .from(todosTable)
              .where(ilike(todosTable.todo, `%${action.input}%`));
            break;
            
          case "deleteTodoById":
            await db.delete(todosTable).where(eq(todosTable.id, action.input));
            observation = null;
            break;
            
          default:
            throw new Error('Invalid function call');
        }
        
        const observationMsg = JSON.stringify({ observation });
        const followUp = await chat.sendMessage([{ text: observationMsg }]);
        const followUpResponse = await followUp.response;
        const followUpAction = JSON.parse(followUpResponse.text());
        
        if (followUpAction.type === "output") {
          res.json({ reply: followUpAction.output });
        }
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      res.status(500).json({ error: 'Invalid response from AI' });
    }
  } catch (error) {
    console.error('AI error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
