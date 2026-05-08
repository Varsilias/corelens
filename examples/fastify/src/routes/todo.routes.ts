import type { FastifyInstance } from 'fastify';

import {
  completeTodo,
  createTodo,
  deleteTodo,
  getTodo,
  listTodos,
} from '../services/todo.service';

type TodoParams = {
  id: string;
};

type CreateTodoBody = {
  title?: string;
};

export async function registerTodoRoutes(app: FastifyInstance) {
  app.get('/api/todos', async () => {
    return { todos: listTodos() };
  });

  app.get<{ Params: TodoParams }>('/api/todos/:id', async (request, reply) => {
    const todo = getTodo(request.params.id);
    if (!todo) {
      return reply.status(404).send({ error: 'Todo not found' });
    }

    return { todo };
  });

  app.post<{ Body: CreateTodoBody }>('/api/todos', async (request, reply) => {
    const title = request.body?.title?.trim();
    if (!title) {
      return reply.status(400).send({ error: 'title is required' });
    }

    const todo = createTodo(title);
    return reply.status(201).send({ todo });
  });

  app.patch<{ Params: TodoParams }>(
    '/api/todos/:id/complete',
    async (request, reply) => {
      const todo = completeTodo(request.params.id);
      if (!todo) {
        return reply.status(404).send({ error: 'Todo not found' });
      }

      return { todo };
    },
  );

  app.delete<{ Params: TodoParams }>(
    '/api/todos/:id',
    async (request, reply) => {
      const deleted = deleteTodo(request.params.id);
      if (!deleted) {
        return reply.status(404).send({ error: 'Todo not found' });
      }

      return reply.status(204).send();
    },
  );
}
