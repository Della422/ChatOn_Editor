import {
  BezierEdge,
  SimpleBezierEdge,
  SmoothStepEdge,
  StepEdge,
  StraightEdge,
} from 'reactflow'
import BranchNode from './components/BranchNode'
import ChoiceNode from './components/ChoiceNode'
import DialogueNode from './components/DialogueNode'
import EventNode from './components/EventNode'
import GroupNode from './components/GroupNode'
import LogicNode from './components/LogicNode'

/**
 * React Flow #002: 모듈 최상단 단일 객체 — 렌더마다 새 참조를 만들지 않음.
 * node.type 문자열과 키가 일치해야 해당 컴포넌트가 그려짐.
 */
export const EDITOR_NODE_TYPES = {
  dialogue: DialogueNode,
  logic: LogicNode,
  branch: BranchNode,
  group: GroupNode,
  event: EventNode,
  choice: ChoiceNode,
}

export const EDITOR_EDGE_TYPES = {
  default: BezierEdge,
  straight: StraightEdge,
  step: StepEdge,
  smoothstep: SmoothStepEdge,
  simplebezier: SimpleBezierEdge,
}
