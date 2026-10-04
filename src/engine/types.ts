/**
 * Shared types for the simulated Python runtime, memory model, and level catalog.
 */

/* —— Runtime values —— */

/**
 * A value held by a name. Primitives are stored directly; mutable containers,
 * strings, and functions live on the heap and are referenced by an `obj_` id
 * string. So `string` here means *either* a heap id or a raw string literal.
 */
export type RtValue = number | string | boolean | null;

/** The code payload of a heap function object. */
export interface FunctionCode {
  name: string;
  params: string[];
  body: AstNode[];
}

/** A heap object. `value` is heterogeneous by `type`. */
export interface HeapObject {
  id: string;
  type: string;
  value: unknown;
  repr: string;
}

/* —— Memory state —— */

export interface Frame {
  name: string;
  locals: Record<string, RtValue>;
}

/** A simple static plot spec (rendered on the Plot board tab). */
export interface PlotSpec {
  kind: 'scatter' | 'line';
  title: string;
  points: Array<[number, number]>;
}

export interface MemoryState {
  frames: Frame[];
  heap: Record<string, HeapObject>;
  stdout: string[];
  errors: string[];
  plots: PlotSpec[];
}

/* —— Tokens —— */

export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'NAME'
  | 'OP'
  | 'NEWLINE'
  | 'INDENT'
  | 'DEDENT'
  | 'END'
  | 'KEYWORD';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

/* —— AST nodes —— */

export interface BaseNode {
  kind: string;
  line: number;
}

export interface LiteralNode extends BaseNode {
  kind: 'Literal';
  value: RtValue;
}
export interface NameNode extends BaseNode {
  kind: 'Name';
  id: string;
}
export interface ListNode extends BaseNode {
  kind: 'List';
  elts: AstNode[];
}
export interface TupleNode extends BaseNode {
  kind: 'Tuple';
  elts: AstNode[];
}
export interface DictNode extends BaseNode {
  kind: 'Dict';
  keys: AstNode[];
  values: AstNode[];
}
export interface SetNode extends BaseNode {
  kind: 'Set';
  elts: AstNode[];
}
export interface BinOpNode extends BaseNode {
  kind: 'BinOp';
  op: string;
  left: AstNode;
  right: AstNode;
}
export interface UnaryOpNode extends BaseNode {
  kind: 'UnaryOp';
  op: string;
  operand: AstNode;
}
export interface BoolOpNode extends BaseNode {
  kind: 'BoolOp';
  op: 'and' | 'or';
  left: AstNode;
  right: AstNode;
}
export interface CompareNode extends BaseNode {
  kind: 'Compare';
  op: string;
  left: AstNode;
  right: AstNode;
}
export interface SubscriptNode extends BaseNode {
  kind: 'Subscript';
  object: AstNode;
  index: AstNode | null;
}
export interface SliceNode extends BaseNode {
  kind: 'Slice';
  object: AstNode;
  start: AstNode | null;
  stop: AstNode | null;
}
export interface AttributeNode extends BaseNode {
  kind: 'Attribute';
  object: AstNode;
  attr: string;
}
export interface CallNode extends BaseNode {
  kind: 'Call';
  func: AstNode;
  args: AstNode[];
}

/* —— Statements —— */

export interface AssignNode extends BaseNode {
  kind: 'Assign';
  target: AstNode;
  value: AstNode;
}
export interface AugAssignNode extends BaseNode {
  kind: 'AugAssign';
  target: AstNode;
  op: string;
  value: AstNode;
}
export interface ExprStatementNode extends BaseNode {
  kind: 'ExprStatement';
  expr: AstNode;
}
export interface ReturnNode extends BaseNode {
  kind: 'Return';
  value: AstNode | null;
}
export interface FunctionDefNode extends BaseNode {
  kind: 'FunctionDef';
  name: string;
  params: string[];
  body: AstNode[];
}
export interface PassNode extends BaseNode {
  kind: 'Pass';
}
export interface ImportNode extends BaseNode {
  kind: 'Import';
  /** Dotted module path, e.g. 'copy' or 'os.path'. */
  name: string;
  /** Alias from `as`; null if the (first) module name is bound directly. */
  alias: string | null;
}

export type AstNode =
  | LiteralNode
  | NameNode
  | ListNode
  | TupleNode
  | DictNode
  | SetNode
  | BinOpNode
  | UnaryOpNode
  | BoolOpNode
  | CompareNode
  | SubscriptNode
  | SliceNode
  | AttributeNode
  | CallNode
  | AssignNode
  | AugAssignNode
  | ExprStatementNode
  | ReturnNode
  | FunctionDefNode
  | PassNode
  | ImportNode;

/* —— Goals / checks —— */

export interface GoalVarSpec {
  type?: string;
  repr?: string;
  value?: unknown;
}

/** A predicate over a normalized snapshot; `true` passes, a string is a failure message. */
export type Predicate = (snapshot: Snapshot, runtime: MemoryState) => boolean | string;

export type GoalSpec =
  | { type: 'vars'; vars: Record<string, GoalVarSpec> }
  | { type: 'predicates'; predicates: Predicate[] }
  | { type: 'stdout'; lines: string[] }
  | { type: 'plot'; kind?: PlotSpec['kind'] };

export interface GoalPreview {
  vars: Record<string, { type?: string; repr?: string }>;
  aliased?: Array<[string, string]>;
}

export interface GoalResult {
  ok: boolean;
  message: string;
}

/* —— Normalized snapshot (ids mapped to stable `h_obj_N`) —— */

export interface SnapshotHeapObject {
  type: string;
  repr: string;
  value: unknown;
}
export interface SnapshotFrame {
  name: string;
  locals: Record<string, RtValue | string>;
}
export interface Snapshot {
  frames: SnapshotFrame[];
  heap: Record<string, SnapshotHeapObject>;
}

/* —— Level catalog —— */

export interface Level {
  id: string;
  name: string;
  /** One-line objective shown in the dock. */
  brief: string;
  hint: string;
  /** Source run to seed the level (empty for a clean slate). */
  start: string;
  /** Statement-golf par. */
  par: number;
  /** Difficulty 1–5, shown as a dot rating in the catalog. */
  difficulty: number;
  goal: GoalSpec;
  /** Legacy paper-card target preview (optional; the dock uses live checks). */
  goalPreview?: GoalPreview;
  solution: string;
  /** Full markdown lesson (EN base; i18n overlays it). */
  lesson?: string;
  /** "You are learning" bullets. */
  learning?: string[];
  /** "In production" field notes. */
  fieldNotes?: string[];
}

export interface Sequence {
  id: string;
  title: string;
  levels: Level[];
}
