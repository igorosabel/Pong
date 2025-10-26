import { Component, output } from '@angular/core';

@Component({
  selector: 'app-touch-controls',
  standalone: true,
  template: `
    <div class="touch">
      <button class="btn" (touchstart)="up.emit()" (mousedown)="up.emit()">▲</button>
      <button class="btn" (touchstart)="down.emit()" (mousedown)="down.emit()">▼</button>
    </div>
  `,
  styles: [
    `
      .touch {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .btn {
        width: 3rem;
        height: 3rem;
        border-radius: 0.5rem;
        background: #000;
        color: #fff;
        border: 1px solid #777;
        font-size: 1.25rem;
      }
    `,
  ],
})
export class TouchControlsComponent {
  readonly up = output<void>();
  readonly down = output<void>();
}
