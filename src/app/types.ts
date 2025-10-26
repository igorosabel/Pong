export enum SideEnum {
  LEFT = 'left',
  RIGHT = 'right',
}

export type Side = SideEnum.LEFT | SideEnum.RIGHT;

export type PlayersMode = 1 | 2;

export enum DifficultyEnum {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

export type Difficulty = DifficultyEnum.EASY | DifficultyEnum.MEDIUM | DifficultyEnum.HARD;

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

export interface Paddle {
  y: number;
  height: number;
  speed: number;
}

export interface Ball {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  speed: number;
}
