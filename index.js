import { db } from './db';
import { todosTable } from './db/schema';
import { ilike, eq } from 'drizzle-orm';
import { OpenAI } from 'openai';

// get all todos
async function getAllTodos() {
  const todos = await db.select().from(todosTable);
  return todos;
}

// create todo
async function createTodo(todo) {
  const newTodo = await db.insert(todosTable).values({ todo });
  return newTodo;
}

// search todo
async function searchTodo(search) {
  const todos = await db.select().from(todosTable).where(ilike(todosTable.todo, search));
  return todos;
}

// delete todo
async function deleteTodo(id) {
  const deletedTodo = await db.delete(todosTable).where(eq(todosTable.id, id));
  return deletedTodo;
}


