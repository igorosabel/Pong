import { Component, output, OutputEmitterRef } from '@angular/core';

@Component({
  selector: 'app-touch-controls',
  standalone: true,
  templateUrl: './touch-controls.component.html',
  styleUrls: ['./touch-controls.component.scss'],
})
export class TouchControlsComponent {
  readonly up: OutputEmitterRef<void> = output<void>();
  readonly down: OutputEmitterRef<void> = output<void>();
}
