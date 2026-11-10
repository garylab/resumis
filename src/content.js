import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false });

export const siteName = env => env.SITE_NAME?.trim() || 'Resumis';

export function renderMarkdown(content) {
  return content?.trim() ? markdown.render(content) : '';
}
