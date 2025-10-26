export type Side = 'left' | 'right';

export type PlayersMode = 1 | 2;

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface GameSetup {
  mode: PlayersMode;
  humanSide: Side; // si mode = 1
  difficulty: Difficulty; // si mode = 1
}

export interface Score {
  left: number;
  right: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}
