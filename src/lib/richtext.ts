interface LexicalNode {
  type?: string
  text?: string
  children?: LexicalNode[]
}

export function richTextToPlainText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  const root = (value as { root?: LexicalNode }).root
  const walk = (node?: LexicalNode): string => {
    if (!node) return ''
    if (typeof node.text === 'string') return node.text
    return (node.children ?? []).map(walk).join(node.type === 'paragraph' ? '\n' : '')
  }
  return walk(root).trim()
}
