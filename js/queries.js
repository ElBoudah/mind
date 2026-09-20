// Lectures pures sur un document. Aucune mutation, aucun DOM.

export function subjectById(doc, id) {
  return doc.subjects.find(s => s.id === id);
}

function byOrder(a, b) {
  return a.order - b.order || a.createdAt.localeCompare(b.createdAt);
}

export function children(doc, parentId, { includeRested = false } = {}) {
  return doc.subjects
    .filter(s => s.parentId === parentId && (includeRested || s.restedAt === null))
    .sort(byOrder);
}

export function roots(doc) {
  return children(doc, null);
}

export function ancestors(doc, id) {
  const out = [];
  let cur = subjectById(doc, id);
  while (cur && cur.parentId !== null) {
    cur = subjectById(doc, cur.parentId);
    if (!cur) break;
    out.unshift(cur);
  }
  return out;
}

export function descendantIds(doc, id) {
  const out = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    for (const s of doc.subjects) {
      if (s.parentId === cur) { out.push(s.id); stack.push(s.id); }
    }
  }
  return out;
}

export function isActive(doc, id) {
  const s = subjectById(doc, id);
  if (!s || s.restedAt !== null) return false;
  return ancestors(doc, id).every(a => a.restedAt === null);
}
