import {
  logger,
  todoMutationsTotal,
  todoOperationDuration,
  todoRequestsTotal,
  tracer,
} from '../config/corelens';

export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
};

const todos = new Map<string, Todo>();
let nextId = 1;

function observe<T>(operation: string, fn: () => T): T {
  const start = performance.now();
  try {
    return tracer.withSpan(`todo.${operation}`, fn);
  } finally {
    const durationSeconds = (performance.now() - start) / 1000;
    todoOperationDuration.observe(durationSeconds, { operation });
  }
}

export function listTodos() {
  return observe('list', () => {
    todoRequestsTotal.inc(1, { route: 'GET /api/todos' });
    return [...todos.values()];
  });
}

export function getTodo(id: string) {
  return observe('get', () => {
    todoRequestsTotal.inc(1, { route: 'GET /api/todos/:id' });
    return todos.get(id);
  });
}

export function createTodo(title: string) {
  return observe('create', () => {
    const id = String(nextId++);
    const todo: Todo = {
      id,
      title,
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    todos.set(id, todo);
    todoMutationsTotal.inc(1, { operation: 'create' });
    logger.info('Todo created', { id, title });

    return todo;
  });
}

export function completeTodo(id: string) {
  return observe('complete', () => {
    const todo = todos.get(id);
    if (!todo) return undefined;

    const updated = {
      ...todo,
      completed: true,
      completedAt: new Date().toISOString(),
    };

    todos.set(id, updated);
    todoMutationsTotal.inc(1, { operation: 'complete' });
    logger.info('Todo completed', { id });

    return updated;
  });
}

export function deleteTodo(id: string) {
  return observe('delete', () => {
    const deleted = todos.delete(id);
    if (deleted) {
      todoMutationsTotal.inc(1, { operation: 'delete' });
      logger.info('Todo deleted', { id });
    }

    return deleted;
  });
}

createTodo('Wire Corelens into Fastify');
createTodo('Check /metrics after a few requests');
