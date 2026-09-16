const registry = new Map();

export function registerRefreshTask(id, handler, { views = [], priority = 50 } = {}) {
  if (!id || typeof handler !== "function") return () => {};
  const record = { id, handler, views: new Set(views || []), priority: Number(priority) || 50 };
  registry.set(id, record);
  return () => {
    if (registry.get(id) === record) registry.delete(id);
  };
}

export function listRefreshTasks(view) {
  return [...registry.values()]
    .filter((task) => task.views.size === 0 || task.views.has(view) || task.views.has("*"))
    .sort((a, b) => a.priority - b.priority);
}

export async function runRefreshTasks(view, context = {}) {
  const tasks = listRefreshTasks(view);
  if (!tasks.length) return [];

  // La prioridad sigue respetándose entre grupos, pero tareas independientes con la
  // misma prioridad corren en paralelo. Antes cada refresco esperaba al anterior y
  // una sola fuente lenta hacía sentir bloqueada toda la aplicación.
  const grouped = new Map();
  tasks.forEach((task) => {
    const priority = Number(task.priority) || 50;
    if (!grouped.has(priority)) grouped.set(priority, []);
    grouped.get(priority).push(task);
  });

  const results = [];
  for (const priority of [...grouped.keys()].sort((a, b) => a - b)) {
    const batch = grouped.get(priority) || [];
    const settled = await Promise.all(
      batch.map(async (task) => {
        try {
          const value = await task.handler({ view, ...context });
          return { id: task.id, ok: true, value };
        } catch (error) {
          return { id: task.id, ok: false, error };
        }
      }),
    );
    results.push(...settled);
  }
  return results;
}
