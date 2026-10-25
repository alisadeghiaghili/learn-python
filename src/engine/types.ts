/**
 * Shared types for the simulated Python runtime, memory model, and level catalog.
 */

/* —— Runtime values —— */

/**
 * A value held by a name. Primitives are stored directly; mutable containers,
 * strings, and functions live on the heap and are referenced by an `obj_` id
 * string. So `string` here means *either* a heap id or a raw string literal.
 */
export type RtValue = number | bigint | string | boolean | null;

/** The code payload of a heap function object. */
export interface FunctionCode {
  name: string;
  params: string[];
  paramDefaults?: Record<string, RtValue>;
  closure?: Record<string, { value: RtValue }>;
  body: AstNode[];
  /** True for an `async def`; calling it returns a coroutine instead of running. */
  async?: boolean;
}

/** The memory segment an object lives in (for the RAM view). */
export type MemorySegment = 'stack' | 'heap' | 'buffer';

/**
 * A heap object. `value` is heterogeneous by `type`.
 *
 * The `addr` / `byteSize` / `refCount` / `seg` fields feed the **RAM view** — a
 * simplified CPython memory layout (object header + payload, stable monotonic
 * addresses, reference counts). They are ignored by the abstract Memory view,
 * `snapshot()`, and goal-checking, which stay layout-free and id-based.
 */
export interface HeapObject {
  id: string;
  type: string;
  value: unknown;
  repr: string;
  /** Stable byte address (monotonic, models malloc — never freed). */
  addr: number;
  /** Approximate in-memory size in bytes (CPython approximation). */
  byteSize: number;
  /** Number of live references pointing at this object (RAM/GC teaching). */
  refCount: number;
  /** Which memory segment it belongs to. */
  seg: MemorySegment;
}

/* —— Memory state —— */

export interface Frame {
  name: string;
  locals: Record<string, RtValue>;
}

/** A simple static plot spec (rendered on the Plot board tab). */
export interface PlotSpec {
  kind: 'scatter' | 'line' | 'bar';
  title?: string;
  xlabel?: string;
  ylabel?: string;
  points: Array<[number, number]>;
}

export interface MemoryState {
  frames: Frame[];
  heap: Record<string, HeapObject>;
  stdout: string[];
  errors: string[];
  plots: PlotSpec[];
  /**
   * Total event-loop ticks executed (`a.run(...)` advances the loop one task per
   * tick). The abstract model stays layout-free; this is a small scalar the
   * asyncio goals read to prove the loop actually interleaved.
   */
  ticks: number;
  /**
   * Optional recorded execution steps (the "watch it run" replay). Present and
   * non-empty only while the trace hook is enabled for the current run; each
   * entry is a deep clone of the memory state after one statement or one loop
   * iteration. Ignored by snapshot()/goals — a pure replay aid for the canvas.
   */
  trace?: MemoryState[];
  /** 1-based source line currently executing, for editor replay highlighting. */
  currentLine?: number;
}

/* —— Tokens —— */

export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'FSTRING'
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
  isFloat?: boolean;
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
  /** The attribute selector when the target is `obj.attr[index]` (e.g. `df.loc`). */
  attr?: string;
}
export interface SliceNode extends BaseNode {
  kind: 'Slice';
  object: AstNode;
  start: AstNode | null;
  stop: AstNode | null;
  step?: AstNode | null;
  /** The attribute selector when the target is `obj.attr[a:b]` (e.g. `df.loc`). */
  attr?: string;
}
export interface AttributeNode extends BaseNode {
  kind: 'Attribute';
  object: AstNode;
  attr: string;
}
export interface KeywordNode extends BaseNode {
  kind: 'Keyword';
  arg: string;
  value: AstNode;
}
export interface CallNode extends BaseNode {
  kind: 'Call';
  func: AstNode;
  args: AstNode[];
  keywords?: KeywordNode[];
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
  paramDefaults?: Record<string, AstNode>;
  body: AstNode[];
}
/** An `async def` — a coroutine function; calling it returns a coroutine. */
export interface CoroutineDefNode extends BaseNode {
  kind: 'CoroutineDef';
  name: string;
  params: string[];
  paramDefaults?: Record<string, AstNode>;
  body: AstNode[];
}
/** `await x` — a suspension point inside a coroutine (yields the tick to the loop). */
export interface AwaitNode extends BaseNode {
  kind: 'Await';
  value: AstNode;
}
export interface LambdaNode extends BaseNode {
  kind: 'Lambda';
  params: string[];
  body: AstNode;
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
export interface ImportFromNode extends BaseNode {
  kind: 'ImportFrom';
  module: string;
  names: Array<{ name: string; alias: string | null }>;
}
export interface GlobalNode extends BaseNode {
  kind: 'Global';
  names: string[];
}
export interface NonlocalNode extends BaseNode {
  kind: 'Nonlocal';
  names: string[];
}
export interface ExceptHandler {
  type: AstNode | null;
  name: string | null;
  body: AstNode[];
  line: number;
}
export interface TryNode extends BaseNode {
  kind: 'Try';
  body: AstNode[];
  handlers: ExceptHandler[];
  elseBody: AstNode[] | null;
  finallyBody: AstNode[] | null;
}
export interface RaiseNode extends BaseNode {
  kind: 'Raise';
  exc: AstNode | null;
}
/** `if <test>:` with optional `elif` chain and `else`. */
export interface IfNode extends BaseNode {
  kind: 'If';
  test: AstNode;
  body: AstNode[];
  /** Each elif branch: its test and body. */
  elifs: Array<{ test: AstNode; body: AstNode[] }>;
  elseBody: AstNode[] | null;
}
/** `for <target> in <iterable>:` */
export interface ForNode extends BaseNode {
  kind: 'For';
  target: string | AstNode;
  iterable: AstNode;
  body: AstNode[];
  elseBody?: AstNode[] | null;
}
/** `while <test>:` */
export interface WhileNode extends BaseNode {
  kind: 'While';
  test: AstNode;
  body: AstNode[];
  elseBody?: AstNode[] | null;
}
/** `break` — exit the innermost loop. */
export interface BreakNode extends BaseNode {
  kind: 'Break';
}
/** `continue` — skip to the next iteration of the innermost loop. */
export interface ContinueNode extends BaseNode {
  kind: 'Continue';
}
export interface WithItem {
  contextExpr: AstNode;
  optionalVars?: AstNode | null;
}
/** `with <expr> [as <var>]:` */
export interface WithNode extends BaseNode {
  kind: 'With';
  items: WithItem[];
  body: AstNode[];
  isAsync?: boolean;
}


export interface ComprehensionClause {
  target: AstNode;
  iter: AstNode;
  ifs: AstNode[];
}

export interface ListCompNode extends BaseNode {
  kind: 'ListComp';
  elt: AstNode;
  generators: ComprehensionClause[];
}

export interface DictCompNode extends BaseNode {
  kind: 'DictComp';
  key: AstNode;
  value: AstNode;
  generators: ComprehensionClause[];
}

export interface SetCompNode extends BaseNode {
  kind: 'SetComp';
  elt: AstNode;
  generators: ComprehensionClause[];
}

export type FStringPart = { kind: 'literal'; value: string } | { kind: 'expr'; value: AstNode };

export interface FStringNode extends BaseNode {
  kind: 'FString';
  parts: FStringPart[];
}

export interface ClassDefNode extends BaseNode {
  kind: 'ClassDef';
  name: string;
  bases: AstNode[];
  body: AstNode[];
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
  | KeywordNode
  | AssignNode
  | AugAssignNode
  | ExprStatementNode
  | ReturnNode
  | FunctionDefNode
  | CoroutineDefNode
  | LambdaNode
  | AwaitNode
  | PassNode
  | ImportNode
  | ImportFromNode
  | GlobalNode
  | NonlocalNode
  | TryNode
  | RaiseNode
  | IfNode
  | ForNode
  | WhileNode
  | BreakNode
  | ContinueNode
  | WithNode
  | ListCompNode
  | DictCompNode
  | SetCompNode
  | FStringNode
  | ClassDefNode;

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

/**
 * The pedagogical band a level lives on. It is a first-class attribute of the
 * curriculum: the ELI bands are woven through the levels and the lessons, not
 * just reported. The band tracks `difficulty` (1→5 = eli5→eliphd) and the
 * 5-ladder 0→90 (see docs/CURRICULUM.md).
 */
export type EliBand = 'eli5' | 'eli10' | 'eli15' | 'eli20' | 'eliphd';

export interface Level {
  id: string;
  name: string;
  /** The ELI band this level teaches on (first-class curriculum attribute). */
  eli: EliBand;
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
  /**
   * The per-topic deep lesson that ramps Beginner→Master and carries the full
   * professional coverage for the series. Rendered in the lesson panel.
   */
  deepLesson?: string;
}
