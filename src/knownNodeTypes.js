/**
 * React Flow node.type 및 nodeTypes 맵에 등록된 종류 (sanitize·생성 로직 단일 기준)
 */
export const REGISTERED_NODE_TYPES = [
  'dialogue',
  'logic',
  'branch',
  'group',
  'event',
  'choice',
]

export const REGISTERED_NODE_TYPE_SET = new Set(REGISTERED_NODE_TYPES)
