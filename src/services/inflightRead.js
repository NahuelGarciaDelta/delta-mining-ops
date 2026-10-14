// Share only overlapping reads. Never retain settled data across navigation or writes.
export function createInflightRead() {
  const pending = new Map();
  return (key, read) => {
    if (pending.has(key)) return pending.get(key);
    const task = Promise.resolve().then(read).finally(() => {
      if (pending.get(key) === task) pending.delete(key);
    });
    pending.set(key, task);
    return task;
  };
}
