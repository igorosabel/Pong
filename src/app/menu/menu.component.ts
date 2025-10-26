import { Component, inject, signal, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { GameStateService } from '../state/game-state.service';
import { Difficulty, DifficultyEnum, PlayersMode, Side } from '../types';
import { SideEnum } from './../types';

@Component({
  selector: 'app-menu',
  standalone: true,
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
})
export class MenuComponent {
  private readonly router = inject(Router);
  private readonly state: GameStateService = inject(GameStateService);

  readonly mode: WritableSignal<PlayersMode> = signal<PlayersMode>(1);
  readonly humanSide: WritableSignal<Side> = signal<Side>(SideEnum.LEFT);
  readonly difficulty: WritableSignal<Difficulty> = signal<Difficulty>(DifficultyEnum.MEDIUM);

  SideEnum = SideEnum;
  DifficultyEnum = DifficultyEnum;

  start(): void {
    this.state.setSetup({
      mode: this.mode(),
      humanSide: this.humanSide(),
      difficulty: this.difficulty(),
    });
    this.state.resetScore();
    this.router.navigateByUrl('/game');
  }
}
