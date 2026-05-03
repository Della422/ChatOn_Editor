/** 기본 샘플 그래프 (새 설치·첫 프로젝트 시드용) */
export const initialNodes = [
  {
    id: 'dialogue-1',
    type: 'dialogue',
    position: { x: 220, y: 120 },
    data: {
      id: 'dialogue-1',
      kind: 'dialogue',
      title: '대사 노드',
      character: 'Guide',
      text: '여긴 어떤 게임에도 붙일 수 있는 범용 내러티브 에디터야.',
      customProperties: [],
    },
  },
  {
    id: 'logic-1',
    type: 'logic',
    position: { x: 560, y: 120 },
    data: {
      id: 'logic-1',
      kind: 'logic',
      title: '로직 노드',
      operations: [
        { id: 'op-1', variable: 'Trust', operator: '+=', value: '1' },
        { id: 'op-2', variable: 'HasKey', operator: '=', value: 'True' },
      ],
    },
  },
  {
    id: 'branch-1',
    type: 'branch',
    position: { x: 900, y: 120 },
    data: {
      id: 'branch-1',
      kind: 'branch',
      title: '분기 노드',
      condition: { variable: 'Trust', operator: '>=', value: '3' },
    },
  },
  {
    id: 'dialogue-2',
    type: 'dialogue',
    position: { x: 1260, y: 40 },
    data: {
      id: 'dialogue-2',
      kind: 'dialogue',
      title: '대사 노드',
      character: 'Companion',
      text: '우리를 믿어도 좋아. 정문으로 들어가자.',
      customProperties: [{ id: 'prop-1', key: 'Emotion', value: 'Calm' }],
    },
  },
  {
    id: 'dialogue-3',
    type: 'dialogue',
    position: { x: 1260, y: 260 },
    data: {
      id: 'dialogue-3',
      kind: 'dialogue',
      title: '대사 노드',
      character: 'Narrator',
      text: '문은 닫혀 있었다. 다른 경로를 찾아야 한다.',
      customProperties: [{ id: 'prop-2', key: 'SFX', value: 'LockedDoor' }],
    },
  },
]

export const initialEdges = [
  { id: 'e1', source: 'dialogue-1', target: 'logic-1', animated: true },
  { id: 'e2', source: 'logic-1', target: 'branch-1', animated: true },
  {
    id: 'e3',
    source: 'branch-1',
    sourceHandle: 'true',
    target: 'dialogue-2',
    label: 'True',
    style: { stroke: '#7b61ff', strokeWidth: 2 },
    animated: true,
  },
  {
    id: 'e4',
    source: 'branch-1',
    sourceHandle: 'false',
    target: 'dialogue-3',
    label: 'False',
    style: { stroke: '#ff6b8a', strokeWidth: 2 },
    animated: true,
  },
]
