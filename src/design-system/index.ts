/**
 * PLATE デザインシステム。
 * 色・文字・余白のトークンと、画面から使う共通コンポーネントの入口。
 * 画面側は `@/design-system` だけから import する（トークンの直書きはここ以外でしない）。
 * 別パッケージに切り出すときは、tsconfig の paths の向き先を変えるだけにする。
 */
export * from './tokens';
export { T, N, SectionLabel } from './components/Text';
export type { TProps, NProps } from './components/Text';
export { Badge } from './components/Badge';
export { PrimaryButton, OutlineButton, StepButton } from './components/Button';
export { Bar, Hairline } from './components/Bar';
export { Sheet } from './components/Sheet';
