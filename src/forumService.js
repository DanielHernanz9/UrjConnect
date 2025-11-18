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
