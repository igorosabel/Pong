import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  Signal,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import { GameStateService } from '../state/game-state.service';
import {
  Ball,
  Difficulty,
  DifficultyEnum,
  Dimensions,
  Paddle,
  Score,
  Side,
  SideEnum,
} from '../types';
import { TouchControlsComponent } from './touch-controls.component';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [TouchControlsComponent],
  templateUrl: './game.component.html',
  styles: [``],
})
export class GameComponent implements OnInit, OnDestroy {
  private readonly router: Router = inject(Router);
  private readonly state: GameStateService = inject(GameStateService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  readonly canvas: Signal<ElementRef<HTMLCanvasElement>> =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly stage: Signal<ElementRef<HTMLDivElement>> =
    viewChild.required<ElementRef<HTMLDivElement>>('stage');

  // Estado HUD
  readonly score: WritableSignal<Score> = this.state.score;
  readonly countdown: WritableSignal<number> = signal<number>(3);

  // Flags
  readonly running: WritableSignal<boolean> = signal<boolean>(false);
  readonly isPortrait: WritableSignal<boolean> = signal<boolean>(false);
  readonly showTouch: WritableSignal<boolean> = signal<boolean>(false);

  // Dimensiones dinámicas
  private readonly dims: WritableSignal<Dimensions> = signal<Dimensions>({ width: 0, height: 0 });

  // Entidades
  private left!: Paddle;
  private right!: Paddle;
  private ball!: Ball;

  // Configuración base
  private readonly baseBallSpeed: number = 300; // px/s
  private readonly basePaddleSpeed: number = 500; // px/s

  // IA
  private aiSide: Side = SideEnum.RIGHT;
  private aiSpeed: number = 500; // se ajusta por dificultad
  private aiError: number = 0; // error en px
  SideEnum = SideEnum; // para usar en template

  // Input continuo (desktop)
  private keyUpLeft: boolean = false;
  private keyDownLeft: boolean = false;
  private keyUpRight: boolean = false;
  private keyDownRight: boolean = false;

  // RAF
  private rafId: number = 0;
  private lastTs: number = 0;

  ngOnInit(): void {
    // Determinar si es 1P y en qué lado va el humano
    if (this.state.mode() === 1) {
      this.aiSide = this.state.humanSide() === SideEnum.LEFT ? SideEnum.RIGHT : SideEnum.LEFT;
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
    if (document.hidden) {
      this.running.set(false);
    }
  };

  private applyDifficulty(d: Difficulty): void {
    // Ajuste de IA: velocidad y error
    if (d === DifficultyEnum.EASY) {
      this.aiSpeed = 420;
      this.aiError = 24;
    } else if (d === DifficultyEnum.MEDIUM) {
      this.aiSpeed = 520;
      this.aiError = 12;
    } else {
      this.aiSpeed = 650;
      this.aiError = 6;
    }
  }

  private initEntities(): void {
    const { width, height } = this.dims();
    const paddleH: number = Math.round(height * 0.2);

    this.left = { y: (height - paddleH) / 2, height: paddleH, speed: this.basePaddleSpeed };
    this.right = { y: (height - paddleH) / 2, height: paddleH, speed: this.basePaddleSpeed };

    const radius: number = Math.max(3, Math.round(Math.hypot(width, height) * 0.01));
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
    const tick = (): void => {
      const c: number = this.countdown();
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
    const dir: number = Math.random() < 0.5 ? -1 : 1;
    const angle: number = Math.random() * 0.6 - 0.3; // ~±17º aleatorio
    const { width, height } = this.dims();

    this.ball.pos.x = width / 2;
    this.ball.pos.y = height / 2;
    const vx: number = Math.cos(angle) * this.ball.speed * dir;
    const vy: number = Math.sin(angle) * this.ball.speed;
    this.ball.vel.x = vx;
    this.ball.vel.y = vy;

    this.running.set(true);
    this.lastTs = performance.now();
    this.loop(this.lastTs);
  }

  private loop = (ts: number): void => {
    if (!this.running()) {
      return;
    }
    const dt: number = Math.min(0.033, (ts - this.lastTs) / 1000); // clamp 33ms
    this.lastTs = ts;

    this.update(dt);
    this.drawFrame(dt);

    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    const { width, height } = this.dims();

    // Input: palas (desktop)
    if (this.keyUpLeft) {
      this.left.y -= this.left.speed * dt;
    }
    if (this.keyDownLeft) {
      this.left.y += this.left.speed * dt;
    }
    if (this.keyUpRight) {
      this.right.y -= this.right.speed * dt;
    }
    if (this.keyDownRight) {
      this.right.y += this.right.speed * dt;
    }

    // Input: IA si 1P
    if (this.state.mode() === 1) {
      this.updateAI(dt);
    }

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
        this.bounceOnPaddle(SideEnum.LEFT);
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
        this.bounceOnPaddle(SideEnum.RIGHT);
      }
    }

    // Punto
    if (this.ball.pos.x + this.ball.radius < 0) {
      this.pointTo(SideEnum.RIGHT);
    } else if (this.ball.pos.x - this.ball.radius > width) {
      this.pointTo(SideEnum.LEFT);
    }
  }

  private bounceOnPaddle(side: Side): void {
    const paddleY: number = side === 'left' ? this.left.y : this.right.y;
    const paddleH: number = side === 'left' ? this.left.height : this.right.height;
    const rel: number = (this.ball.pos.y - paddleY) / paddleH - 0.5; // -0.5..0.5
    const maxAngle: number = Math.PI / 4; // 45º
    const angle: number = rel * 2 * maxAngle;

    const dir: number = side === 'left' ? 1 : -1;
    // Aumentar velocidad ligeramente en cada rebote contra pala
    this.ball.speed *= 1.03;
    const speed: number = this.ball.speed;
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
    const target: number = this.ball.pos.y + (Math.random() * this.aiError - this.aiError / 2);
    const paddle = this.aiSide === 'left' ? this.left : this.right;

    const center: number = paddle.y + paddle.height / 2;
    const diff: number = target - center;

    const step: number = this.aiSpeed * dt;
    if (Math.abs(diff) > step) {
      paddle.y += Math.sign(diff) * step;
    } else {
      paddle.y += diff;
    }
  }

  private drawFrame(_dt: number): void {
    const canvas: HTMLCanvasElement = this.canvas().nativeElement;
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const { width, height } = this.dims();
    // Ajustar tamaño real del canvas a CSS
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Fondo
    ctx.fillStyle = 'var(--color-black)';
    ctx.fillRect(0, 0, width, height);

    // Línea central punteada
    ctx.strokeStyle = 'var(--color-white)';
    ctx.setLineDash([12, 16]);
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Palas
    ctx.fillStyle = 'var(--color-white)';
    const paddleW = 8;
    ctx.fillRect(0, Math.round(this.left.y), paddleW, Math.round(this.left.height));
    ctx.fillRect(width - paddleW, Math.round(this.right.y), paddleW, Math.round(this.right.height));

    // Bola
    ctx.beginPath();
    ctx.arc(this.ball.pos.x, this.ball.pos.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  private updateTouchVisibility(): void {
    const isFine: boolean = matchMedia('(hover:hover) and (pointer:fine)').matches;
    this.showTouch.set(!isFine); // si no es puntero fino (móvil/tablet), muestra controles
  }

  // Eventos
  @HostListener('window:resize') onResize(): void {
    const el: HTMLDivElement = this.stage().nativeElement;
    const rect: DOMRect = el.getBoundingClientRect();
    const width: number = Math.floor(rect.width);
    const height: number = Math.floor(rect.height);
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
        if (!this.running() && this.countdown() === 0) {
          this.running.set(true);
        }
        break;
    }
  }

  touchMove(side: Side, dir: -1 | 1): void {
    const amount = 42; // píxeles por toque
    const p: Paddle = side === SideEnum.LEFT ? this.left : this.right;
    p.y += dir * amount;
  }
}
