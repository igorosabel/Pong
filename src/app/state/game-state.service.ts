import { Injectable, signal, WritableSignal } from '@angular/core';
import { Difficulty, GameSetup, PlayersMode, Score, Side } from '../types';

@Injectable({ providedIn: 'root' })
export class GameStateService {
  // Configuración elegida en menú
  readonly mode: WritableSignal<PlayersMode> = signal<PlayersMode>(1);
  readonly humanSide: WritableSignal<Side> = signal<Side>('left');
  readonly difficulty: WritableSignal<Difficulty> = signal<Difficulty>('medium');

  // Marcador
  readonly score: WritableSignal<Score> = signal<Score>({ left: 0, right: 0 });

  setSetup(setup: GameSetup): void {
    this.mode.set(setup.mode);
    this.humanSide.set(setup.humanSide);
    this.difficulty.set(setup.difficulty);
  }

  resetScore(): void {
    this.score.set({ left: 0, right: 0 });
  }

  addPoint(side: Side): void {
    const s: Score = this.score();
    if (side === 'left') {
      this.score.set({ left: s.left + 1, right: s.right });
    } else {
      this.score.set({ left: s.left, right: s.right + 1 });
    }
  }
}
