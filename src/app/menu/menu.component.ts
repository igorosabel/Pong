import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GameStateService } from '../state/game-state.service';
import { Difficulty, PlayersMode, Side } from '../types';

@Component({
  selector: 'app-menu',
  standalone: true,
  template: `
    <div class="menu">
      <h1>PONG</h1>
      <div class="row">
        <label>Jugadores</label>
        <div class="btn-group">
          <button [class.active]="mode() === 1" (click)="mode.set(1)">1 jugador</button>
          <button [class.active]="mode() === 2" (click)="mode.set(2)">2 jugadores</button>
        </div>
      </div>

      @if (mode() === 1) {
      <div class="row">
        <label>Lado (jugador)</label>
        <div class="btn-group">
          <button [class.active]="humanSide() === 'left'" (click)="humanSide.set('left')">
            Izquierda
          </button>
          <button [class.active]="humanSide() === 'right'" (click)="humanSide.set('right')">
            Derecha
          </button>
        </div>
      </div>
      <div class="row">
        <label>Dificultad IA</label>
        <div class="btn-group">
          <button [class.active]="difficulty() === 'easy'" (click)="difficulty.set('easy')">
            Fácil
          </button>
          <button [class.active]="difficulty() === 'medium'" (click)="difficulty.set('medium')">
            Media
          </button>
          <button [class.active]="difficulty() === 'hard'" (click)="difficulty.set('hard')">
            Difícil
          </button>
        </div>
      </div>
      }

      <div class="actions">
        <button class="start" (click)="start()">Empezar</button>
      </div>
    </div>
  `,
  styles: [
    `
      .menu {
        min-height: 100dvh;
        display: grid;
        place-items: center;
        background: #000;
        color: #fff;
        font-family: system-ui, sans-serif;
      }
      .menu > div {
        background: #111;
        border: 1px solid #333;
        padding: 2rem;
        border-radius: 1rem;
        width: min(480px, 92vw);
      }
      h1 {
        text-align: center;
        letter-spacing: 0.2em;
        margin: 0 0 1rem;
      }
      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 0.75rem 0;
      }
      label {
        opacity: 0.9;
      }
      .btn-group {
        display: flex;
        gap: 0.5rem;
      }
      button {
        background: #000;
        color: #fff;
        border: 1px solid #666;
        padding: 0.5rem 0.9rem;
        border-radius: 0.6rem;
        cursor: pointer;
      }
      button.active {
        border-color: #fff;
        box-shadow: 0 0 0 1px #fff inset;
      }
      .actions {
        display: flex;
        justify-content: center;
        margin-top: 1rem;
      }
      .start {
        font-weight: 700;
        border-color: #fff;
      }
    `,
  ],
})
export class MenuComponent {
  private readonly router = inject(Router);
  private readonly state = inject(GameStateService);

  readonly mode = signal<PlayersMode>(1);
  readonly humanSide = signal<Side>('left');
  readonly difficulty = signal<Difficulty>('medium');

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
