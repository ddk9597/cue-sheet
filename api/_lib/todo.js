const MAX_TODO_HTML_LENGTH = 100000;

function normalizeTodoHtml(value) {
  return String(value || "").slice(0, MAX_TODO_HTML_LENGTH);
}

module.exports = {
  normalizeTodoHtml,
};
