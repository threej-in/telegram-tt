// AST node types for markdown parsing
export type MarkdownNodeType = 
  | 'text' 
  | 'bold' 
  | 'italic' 
  | 'strike' 
  | 'code' 
  | 'pre' 
  | 'link' 
  | 'spoiler'
  | 'customEmoji';

export interface MarkdownNode {
  type: MarkdownNodeType;
  content: string;
  children?: MarkdownNode[];
  meta?: Record<string, string>;
}

// Token types for lexical analysis
type TokenType = 
  | 'text'
  | 'bold_start'
  | 'bold_end'
  | 'italic_start'
  | 'italic_end'
  | 'strike_start'
  | 'strike_end'
  | 'code_start'
  | 'code_end'
  | 'pre_start'
  | 'pre_end'
  | 'spoiler_start'
  | 'spoiler_end'
  | 'link_start'
  | 'link_text_end'
  | 'link_url_end';

interface Token {
  type: TokenType;
  content: string;
  meta?: Record<string, string>;
}

export class MarkdownParser {
  private text: string;
  private pos: number;
  private tokens: Token[];

  constructor(text: string) {
    this.text = text;
    this.pos = 0;
    this.tokens = [];
  }

  private hasMore(): boolean {
    return this.pos < this.text.length;
  }

  private peek(n: number = 1): string {
    return this.text.substr(this.pos, n);
  }

  private consume(n: number = 1): string {
    const result = this.peek(n);
    this.pos += n;
    return result;
  }

  private tokenize(): Token[] {
    this.tokens = [];
    let textBuffer = '';

    const flushText = () => {
      if (textBuffer) {
        this.tokens.push({ type: 'text', content: textBuffer });
        textBuffer = '';
      }
    };

    while (this.hasMore()) {
      const char = this.peek();
      const twoChars = this.peek(2);

      if (twoChars === '**') {
        flushText();
        this.consume(2);
        this.tokens.push(this.tokens.some(t => t.type === 'bold_start' && !this.tokens.some(t2 => t2.type === 'bold_end'))
          ? { type: 'bold_end', content: '**' }
          : { type: 'bold_start', content: '**' });
      } else if (twoChars === '__') {
        flushText();
        this.consume(2);
        this.tokens.push(this.tokens.some(t => t.type === 'italic_start' && !this.tokens.some(t2 => t2.type === 'italic_end'))
          ? { type: 'italic_end', content: '__' }
          : { type: 'italic_start', content: '__' });
      } else if (twoChars === '~~') {
        flushText();
        this.consume(2);
        this.tokens.push(this.tokens.some(t => t.type === 'strike_start' && !this.tokens.some(t2 => t2.type === 'strike_end'))
          ? { type: 'strike_end', content: '~~' }
          : { type: 'strike_start', content: '~~' });
      } else if (twoChars === '||') {
        flushText();
        this.consume(2);
        this.tokens.push(this.tokens.some(t => t.type === 'spoiler_start' && !this.tokens.some(t2 => t2.type === 'spoiler_end'))
          ? { type: 'spoiler_end', content: '||' }
          : { type: 'spoiler_start', content: '||' });
      } else if (char === '`') {
        flushText();
        if (this.peek(3) === '```') {
          this.consume(3);
          let language = '';
          while (this.hasMore() && this.peek() !== '\n') {
            language += this.consume();
          }
          if (this.hasMore()) this.consume(); // newline
          this.tokens.push({ type: 'pre_start', content: '```', meta: { language } });
        } else {
          this.consume(1);
          this.tokens.push(this.tokens.some(t => t.type === 'code_start' && !this.tokens.some(t2 => t2.type === 'code_end'))
            ? { type: 'code_end', content: '`' }
            : { type: 'code_start', content: '`' });
        }
      } else if (char === '[') {
        flushText();
        this.consume(1);
        this.tokens.push({ type: 'link_start', content: '[' });
      } else if (char === ']' && this.peek(2) === '](') {
        flushText();
        this.consume(2);
        this.tokens.push({ type: 'link_text_end', content: '](' });
      } else if (char === ')' && this.tokens.some(t => t.type === 'link_text_end')) {
        flushText();
        this.consume(1);
        this.tokens.push({ type: 'link_url_end', content: ')' });
      } else {
        textBuffer += this.consume();
      }
    }

    flushText();
    return this.tokens;
  }

  private parseTokens(): MarkdownNode[] {
    const nodes: MarkdownNode[] = [];
    const tokens = this.tokenize();
    let i = 0;

    const parseContent = (endToken: TokenType): { content: string; meta?: Record<string, string> } => {
      let content = '';
      const meta: Record<string, string> = {};
      
      while (i < tokens.length) {
        const token = tokens[i];
        if (token.type === endToken) {
          i++;
          return { content, meta: Object.keys(meta).length ? meta : undefined };
        } else if (token.type === 'text') {
          content += token.content;
        }
        if (token.meta) {
          Object.assign(meta, token.meta);
        }
        i++;
      }
      
      return { content };
    };

    while (i < tokens.length) {
      const token = tokens[i];

      switch (token.type) {
        case 'text':
          nodes.push({ type: 'text', content: token.content });
          i++;
          break;

        case 'bold_start': {
          i++;
          const { content } = parseContent('bold_end');
          nodes.push({ type: 'bold', content });
          break;
        }

        case 'italic_start': {
          i++;
          const { content } = parseContent('italic_end');
          nodes.push({ type: 'italic', content });
          break;
        }

        case 'strike_start': {
          i++;
          const { content } = parseContent('strike_end');
          nodes.push({ type: 'strike', content });
          break;
        }

        case 'code_start': {
          i++;
          const { content } = parseContent('code_end');
          nodes.push({ type: 'code', content });
          break;
        }

        case 'pre_start': {
          i++;
          const { content, meta } = parseContent('pre_end');
          nodes.push({ type: 'pre', content, meta });
          break;
        }

        case 'spoiler_start': {
          i++;
          const { content } = parseContent('spoiler_end');
          nodes.push({ type: 'spoiler', content });
          break;
        }

        case 'link_start': {
          i++;
          const textContent = parseContent('link_text_end');
          const urlContent = parseContent('link_url_end');
          const url = urlContent.content;
          
          if (url.startsWith('customEmoji:')) {
            nodes.push({
              type: 'customEmoji',
              content: textContent.content,
              meta: { documentId: url.substring(11) }
            });
          } else {
            nodes.push({
              type: 'link',
              content: textContent.content,
              meta: { url }
            });
          }
          break;
        }

        default:
          // Skip unmatched end tokens
          i++;
          break;
      }
    }

    return nodes;
  }

  public parse(): MarkdownNode[] {
    this.pos = 0;
    return this.parseTokens();
  }
}
