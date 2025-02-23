import type { MarkdownNode } from './ast';
import { ApiMessageEntityTypes } from '../../api/types';

export function convertMarkdownToHtml(nodes: MarkdownNode[]): string {
  return nodes.map(nodeToHtml).join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function nodeToHtml(node: MarkdownNode): string {
  const content = node.content;
  
  switch (node.type) {
    case 'text':
      return content;
      
    case 'bold':
      return `<b>${content}</b>`;
      
    case 'italic':
      return `<i>${content}</i>`;
      
    case 'strike':
      return `<s>${content}</s>`;
      
    case 'code':
      return `<code>${content}</code>`;
      
    case 'pre':
      return node.meta?.language
        ? `<pre data-language="${escapeHtml(node.meta.language)}">${content}</pre>`
        : `<pre>${content}</pre>`;
      
    case 'link':
      if (!node.meta?.url) return content;
      const url = node.meta.url.includes('://')
        ? node.meta.url
        : node.meta.url.includes('@')
          ? `mailto:${node.meta.url}`
          : `https://${node.meta.url}`;
      return `<a href="${escapeHtml(url)}">${content}</a>`;
      
    case 'spoiler':
      return `<span data-entity-type="${ApiMessageEntityTypes.Spoiler}">${content}</span>`;
      
    case 'customEmoji':
      if (!node.meta?.documentId) return content;
      return `<img alt="${content}" data-document-id="${escapeHtml(node.meta.documentId)}">`;
      
    default:
      return content;
  }
}
