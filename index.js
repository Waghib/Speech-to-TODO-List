import db from './db/index.js';
import { todosTable } from './db/schema.js';
import { ilike, eq } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import readlineSync from 'readline-sync';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.gemini_api_key);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// get all todos
async function getAllTodos() {
  const todos = await db.select().from(todosTable);
  return todos;
}

// create todo
async function createTodo(todo) {
  const [result] = await db
  .insert(todosTable)
  .values({
    todo,
  }).returning({
    id: todosTable.id,
  });
  return result.id;
}

// search todo
async function searchTodo(search) {
  const todos = await db.select().from(todosTable).where(ilike(todosTable.todo, `%${search}%`));
  return todos;
}

// delete todo
async function deleteTodoById(id) {
  const deletedTodo = await db.delete(todosTable).where(eq(todosTable.id, id));
  return deletedTodo;
}

const tools = {
  getAllTodos,
  createTodo,
  searchTodo,
  deleteTodoById,
}

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

IMPORTANT: When the user wants to add a task, you MUST first send an action of type "action" with function "createTodo".
After receiving the observation with the task ID, then respond with an output message.

Example interaction for adding a task:
User: "Add buy groceries to my list"
Assistant: { "type": "action", "function": "createTodo", "input": "Buy groceries" }
System: { "observation": 1 }
Assistant: { "type": "output", "output": "I've added 'Buy groceries' to your todo list" }

Example interaction for listing tasks:
User: "Show my tasks"
Assistant: { "type": "action", "function": "getAllTodos", "input": "" }
System: { "observation": [{"id": 1, "todo": "Buy groceries"}] }
Assistant: { "type": "output", "output": "Here are your tasks:\\n1. Buy groceries" }

Example interaction for deleting a task:
User: "Remove the groceries task"
Assistant: { "type": "action", "function": "getAllTodos", "input": "" }
System: { "observation": [{"id": 1, "todo": "Buy groceries"}] }
Assistant: { "type": "action", "function": "deleteTodoById", "input": 1 }
System: { "observation": null }
Assistant: { "type": "output", "output": "I've removed 'Buy groceries' from your todo list" }
`;

let chat = model.startChat({
  history: [
    {
      role: "user",
      parts: [{ text: SYSTEM_PROMPT }],
    },
  ],
});

while (true) {
    const query = readlineSync.question(">> ");
    
    try {
        const result = await chat.sendMessage([{ text: query }]);
        const response = await result.response;
        const text = response.text();
        
        try {
            const action = JSON.parse(text);
            
            if (action.type === "output") {
                console.log(action.output);
            } else if (action.type === "action") {
                const fn = tools[action.function];
                if (!fn) throw new Error('Invalid Tool Call');
                const observation = await fn(action.input);
                
                // Send the observation back to the model
                const observationMsg = JSON.stringify({ observation: observation });
                const followUp = await chat.sendMessage([{ text: observationMsg }]);
                const followUpResponse = await followUp.response;
                const followUpAction = JSON.parse(followUpResponse.text());
                
                if (followUpAction.type === "output") {
                    console.log(followUpAction.output);
                }
            }
        } catch (parseError) {
            console.log("Received invalid response from AI. Please try again.");
        }
    } catch (error) {
        console.error("An error occurred:", error.message);
    }
}
