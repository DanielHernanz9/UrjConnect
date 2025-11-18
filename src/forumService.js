import fs from 'fs';
import path from 'path';

const FORUM_DIR = 'data/forums';

function ensureDir() {
  if (!fs.existsSync(FORUM_DIR)) {
    fs.mkdirSync(FORUM_DIR, { recursive: true });
  }
}

function fileFor(subjectId) {
  ensureDir();
  const safe = String(subjectId).replace(/[^a-zA-Z0-9._-]+/g, '-');
  return path.join(FORUM_DIR, `${safe}.json`);
}

export function getPosts(subjectId) {
  const file = fileFor(subjectId);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addPost(subjectId, post) {
  const file = fileFor(subjectId);
  const list = getPosts(subjectId);
  list.push(post);
  fs.writeFileSync(file, JSON.stringify(list, null, 2));
  return post;
}

export function clearPosts(subjectId) {
  const file = fileFor(subjectId);
  fs.writeFileSync(file, JSON.stringify([], null, 2));
}

export function updatePostsForUser(email, updates = {}, oldName = null) {
  ensureDir();
  let total = 0;
  const files = fs.readdirSync(FORUM_DIR).filter((f) => f.endsWith('.json'));
  files.forEach((f) => {
    const file = path.join(FORUM_DIR, f);
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const posts = JSON.parse(raw);
      if (!Array.isArray(posts)) return;
      let changed = false;
      const updated = posts.map((p) => {
        // Match by explicit userEmail if present
        if (p && p.userEmail && String(p.userEmail).toLowerCase() === String(email).toLowerCase()) {
          changed = true;
          total++;
          return Object.assign({}, p, {
            userName: updates.userName !== undefined ? updates.userName : p.userName,
            userColor: updates.userColor !== undefined ? updates.userColor : p.userColor,
            userEmail: p.userEmail || email,
          });
        }
        // Fallback: if post has no userEmail but matches oldName, update as well
        if (!p.userEmail && oldName && p.userName && String(p.userName) === String(oldName)) {
          changed = true;
          total++;
          return Object.assign({}, p, {
            userName: updates.userName !== undefined ? updates.userName : p.userName,
            userColor: updates.userColor !== undefined ? updates.userColor : p.userColor,
            userEmail: email,
          });
        }
        return p;
      });
      if (changed) {
        fs.writeFileSync(file, JSON.stringify(updated, null, 2));
      }
    } catch (e) {
      // Ignore malformed forum files
    }
  });
  return total;
}

// === Nuevas funciones (copiadas de UrjConnect-6) ===

/**
 * Buscar un mensaje por su id en todos los ficheros de FORUM_DIR.
 * Devuelve { post, file, index, posts } o null si no se encuentra.
 */
export function findMessageById(messageId) {
  ensureDir();
  const files = fs.readdirSync(FORUM_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const full = path.join(FORUM_DIR, f);
    try {
      const raw = fs.readFileSync(full, 'utf8');
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      const idx = arr.findIndex(p => p && String(p.id) === String(messageId));
      if (idx !== -1) {
        return { post: arr[idx], file: full, index: idx, posts: arr };
      }
    } catch (e) {
      // ignorar ficheros inválidos
      continue;
    }
  }
  return null;
}

/**
 * Elimina un mensaje por id. Devuelve el mensaje eliminado o null.
 */
export function deleteMessage(messageId) {
  ensureDir();
  const files = fs.readdirSync(FORUM_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const full = path.join(FORUM_DIR, f);
    try {
      const raw = fs.readFileSync(full, 'utf8');
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      const idx = arr.findIndex(p => p && String(p.id) === String(messageId));
      if (idx !== -1) {
        const [deleted] = arr.splice(idx, 1);
        fs.writeFileSync(full, JSON.stringify(arr, null, 2), 'utf8');
        return deleted;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}
