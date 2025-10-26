import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { GameStateService } from '../state/game-state.service';
import { Difficulty, Dimensions, Side, Vec2 } from '../types';
import { TouchControlsComponent } from './touch-controls.component';

interface Paddle {
  y: number;
  height: number;
  speed: number;
}
interface Ball {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  speed: number;
}

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [TouchControlsComponent],
  template: `
    <div class="wrap" [class.portrait]="isPortrait()">
      @if (isPortrait()) {
      <div class="rotate">Gira el dispositivo a horizontal</div>
      }

      <div class="stage" #stage>
        <canvas #canvas></canvas>
        <div class="hud">
          <div class="score">{{ score().left }} — {{ score().right }}</div>
          @if (countdown() > 0) {
          <div class="countdown">{{ countdown() }}</div>
          }
        </div>

        @if (showTouch()) {
        <div class="touch left">
          <app-touch-controls (up)="touchMove('left', -1)" (down)="touchMove('left', 1)" />
        </div>
        <div class="touch right">
          <app-touch-controls (up)="touchMove('right', -1)" (down)="touchMove('right', 1)" />
        </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100dvh;
        background: #000;
        color: #fff;
        font-family: system-ui, sans-serif;
      }
      .wrap {
        position: relative;
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        box-sizing: border-box;
      }
      .wrap.portrait .rotate {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: #000;
        color: #fff;
        z-index: 3;
      }

      .stage {
        position: relative;
        width: 100%;
        height: 100%;
        max-width: 1400px;
        max-height: 900px;
        border: 2px solid #fff;
        box-sizing: border-box;
      }
      canvas {
        width: 100%;
        height: 100%;
        display: block;
        background: #000;
      }

      .hud {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        pointer-events: none;
      }
      .score {
        margin-top: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.1em;
      }
      .countdown {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 8vmin;
        font-weight: 800;
      }

      .touch {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 2;
      }
      .touch.left {
        left: 0.5rem;
      }
      .touch.right {
        right: 0.5rem;
      }
      @media (hover: hover) and (pointer: fine) {
        /* En desktop ocultamos los controles táctiles */
        .touch {
          display: none;
        }
      }
    `,
  ],
})
export class GameComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly state = inject(GameStateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');

  // Estado HUD
  readonly score = this.state.score;
  readonly countdown = signal<number>(3);

  // Flags
  readonly running = signal<boolean>(false);
  readonly isPortrait = signal<boolean>(false);
  readonly showTouch = signal<boolean>(false);

  // Dimensiones dinámicas
  private readonly dims = signal<Dimensions>({ width: 0, height: 0 });

  // Entidades
  private left!: Paddle;
  private right!: Paddle;
  private ball!: Ball;

  // Configuración base
  private readonly baseBallSpeed = 300; // px/s
  private readonly basePaddleSpeed = 500; // px/s

  // IA
  private aiSide: Side = 'right';
  private aiSpeed = 500; // se ajusta por dificultad
  private aiError = 0; // error en px

  // Input continuo (desktop)
  private keyUpLeft = false;
  private keyDownLeft = false;
  private keyUpRight = false;
  private keyDownRight = false;

  // RAF
  private rafId = 0;
  private lastTs = 0;

  ngOnInit(): void {
    // Determinar si es 1P y en qué lado va el humano
    if (this.state.mode() === 1) {
      this.aiSide = this.state.humanSide() === 'left' ? 'right' : 'left';
      this.applyDifficulty(this.state.difficulty());
    }

    this.onResize();
    this.updateTouchVisibility();
    this.initEntities();
    this.startCountdown();

    // Pausar si pierde foco
    document.addEventListener('visibilitychange', this.onVisibility, { passive: true });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    document.removeEventListener('visibilitychange', this.onVisibility as any);
  }

  private onVisibility = () => {
    if (document.hidden) this.running.set(false);
  };

  private applyDifficulty(d: Difficulty): void {
    // Ajuste de IA: velocidad y error
    if (d === 'easy') {
      this.aiSpeed = 420;
      this.aiError = 24;
    } else if (d === 'medium') {
      this.aiSpeed = 520;
      this.aiError = 12;
    } else {
      this.aiSpeed = 650;
      this.aiError = 6;
    }
  }

  private initEntities(): void {
    const { width, height } = this.dims();
    const paddleH = Math.round(height * 0.2);

    this.left = { y: (height - paddleH) / 2, height: paddleH, speed: this.basePaddleSpeed };
    this.right = { y: (height - paddleH) / 2, height: paddleH, speed: this.basePaddleSpeed };

    const radius = Math.max(3, Math.round(Math.hypot(width, height) * 0.01));
    this.ball = {
      pos: { x: width / 2, y: height / 2 },
      vel: { x: 0, y: 0 },
      radius,
      speed: this.baseBallSpeed,
    };
  }

  private startCountdown(): void {
    this.running.set(false);
    this.countdown.set(3);
    const tick = () => {
      const c = this.countdown();
      if (c > 0) {
        this.countdown.set(c - 1);
        setTimeout(tick, 1000);
      } else {
        this.serve();
      }
    };
    setTimeout(tick, 1000);
    this.drawFrame(0); // Pintar estado inicial
  }

  private serve(): void {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const angle = Math.random() * 0.6 - 0.3; // ~±17º aleatorio
    const { width, height } = this.dims();

    this.ball.pos.x = width / 2;
    this.ball.pos.y = height / 2;
    const vx = Math.cos(angle) * this.ball.speed * dir;
    const vy = Math.sin(angle) * this.ball.speed;
    this.ball.vel.x = vx;
    this.ball.vel.y = vy;

    this.running.set(true);
    this.lastTs = performance.now();
    this.loop(this.lastTs);
  }

  private loop = (ts: number): void => {
    if (!this.running()) return;
    const dt = Math.min(0.033, (ts - this.lastTs) / 1000); // clamp 33ms
    this.lastTs = ts;

    this.update(dt);
    this.drawFrame(dt);

    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    const { width, height } = this.dims();

    // Input: palas (desktop)
    if (this.keyUpLeft) this.left.y -= this.left.speed * dt;
    if (this.keyDownLeft) this.left.y += this.left.speed * dt;
    if (this.keyUpRight) this.right.y -= this.right.speed * dt;
    if (this.keyDownRight) this.right.y += this.right.speed * dt;

    // Input: IA si 1P
    if (this.state.mode() === 1) this.updateAI(dt);

    // Limitar palas
    this.left.y = Math.max(0, Math.min(height - this.left.height, this.left.y));
    this.right.y = Math.max(0, Math.min(height - this.right.height, this.right.y));

    // Bola
    this.ball.pos.x += this.ball.vel.x * dt;
    this.ball.pos.y += this.ball.vel.y * dt;

    // Rebote arriba/abajo
    if (this.ball.pos.y - this.ball.radius <= 0 && this.ball.vel.y < 0) {
      this.ball.pos.y = this.ball.radius;
      this.ball.vel.y *= -1;
    }
    if (this.ball.pos.y + this.ball.radius >= height && this.ball.vel.y > 0) {
      this.ball.pos.y = height - this.ball.radius;
      this.ball.vel.y *= -1;
    }

    // Colisiones palas
    const paddleW = 8; // grosor visual
    // Izquierda
    if (this.ball.pos.x - this.ball.radius <= paddleW) {
      if (
        this.ball.pos.y >= this.left.y &&
        this.ball.pos.y <= this.left.y + this.left.height &&
        this.ball.vel.x < 0
      ) {
        this.ball.pos.x = this.ball.radius + paddleW;
        this.bounceOnPaddle('left');
      }
    }
    // Derecha
    if (this.ball.pos.x + this.ball.radius >= width - paddleW) {
      if (
        this.ball.pos.y >= this.right.y &&
        this.ball.pos.y <= this.right.y + this.right.height &&
        this.ball.vel.x > 0
      ) {
        this.ball.pos.x = width - this.ball.radius - paddleW;
        this.bounceOnPaddle('right');
      }
    }

    // Punto
    if (this.ball.pos.x + this.ball.radius < 0) {
      this.pointTo('right');
    } else if (this.ball.pos.x - this.ball.radius > width) {
      this.pointTo('left');
    }
  }

  private bounceOnPaddle(side: Side): void {
    const paddleY = side === 'left' ? this.left.y : this.right.y;
    const paddleH = side === 'left' ? this.left.height : this.right.height;
    const rel = (this.ball.pos.y - paddleY) / paddleH - 0.5; // -0.5..0.5
    const maxAngle = Math.PI / 4; // 45º
    const angle = rel * 2 * maxAngle;

    const dir = side === 'left' ? 1 : -1;
    // Aumentar velocidad ligeramente en cada rebote contra pala
    this.ball.speed *= 1.03;
    const speed = this.ball.speed;
    this.ball.vel.x = Math.cos(angle) * speed * dir;
    this.ball.vel.y = Math.sin(angle) * speed;
  }

  private pointTo(side: Side): void {
    this.running.set(false);
    this.state.addPoint(side);
    this.ball.speed = this.baseBallSpeed; // reset velocidad
    this.countdown.set(3);
    this.initEntities();
    this.startCountdown();
  }

  private updateAI(dt: number): void {
    const target = this.ball.pos.y + (Math.random() * this.aiError - this.aiError / 2);
    const paddle = this.aiSide === 'left' ? this.left : this.right;

    const center = paddle.y + paddle.height / 2;
    const diff = target - center;

    const step = this.aiSpeed * dt;
    if (Math.abs(diff) > step) {
      paddle.y += Math.sign(diff) * step;
    } else {
      paddle.y += diff;
    }
  }

  private drawFrame(_dt: number): void {
    const canvas = this.canvas().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = this.dims();
    // Ajustar tamaño real del canvas a CSS
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Fondo
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // Línea central punteada
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([12, 16]);
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Palas
    ctx.fillStyle = '#fff';
    const paddleW = 8;
    ctx.fillRect(0, Math.round(this.left.y), paddleW, Math.round(this.left.height));
    ctx.fillRect(width - paddleW, Math.round(this.right.y), paddleW, Math.round(this.right.height));

    // Bola
    ctx.beginPath();
    ctx.arc(this.ball.pos.x, this.ball.pos.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  private updateTouchVisibility(): void {
    const isFine = matchMedia('(hover:hover) and (pointer:fine)').matches;
    this.showTouch.set(!isFine); // si no es puntero fino (móvil/tablet), muestra controles
  }

  // Eventos
  @HostListener('window:resize') onResize(): void {
    const el = this.stage().nativeElement;
    const rect = el.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    this.dims.set({ width, height });

    // Orientación: consideramos portrait si alto > ancho
    this.isPortrait.set(height > width);
  }

  @HostListener('window:keydown', ['$event']) onKeyDown(ev: KeyboardEvent): void {
    if (ev.repeat) return;
    switch (ev.key) {
      case 'w':
      case 'W':
        this.keyUpLeft = true;
        break;
      case 's':
      case 'S':
        this.keyDownLeft = true;
        break;
      case 'ArrowUp':
        this.keyUpRight = true;
        break;
      case 'ArrowDown':
        this.keyDownRight = true;
        break;
      case 'Escape':
        this.running.set(false);
        break; // pausa manual opcional
    }
  }

  @HostListener('window:keyup', ['$event']) onKeyUp(ev: KeyboardEvent): void {
    switch (ev.key) {
      case 'w':
      case 'W':
        this.keyUpLeft = false;
        break;
      case 's':
      case 'S':
        this.keyDownLeft = false;
        break;
      case 'ArrowUp':
        this.keyUpRight = false;
        break;
      case 'ArrowDown':
        this.keyDownRight = false;
        break;
      case ' ':
        if (!this.running() && this.countdown() === 0) this.running.set(true);
        break;
    }
  }

  touchMove(side: Side, dir: -1 | 1): void {
    const amount = 42; // píxeles por toque
    const p = side === 'left' ? this.left : this.right;
    p.y += dir * amount;
  }
}
