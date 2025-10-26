import { Routes } from '@angular/router';
import { GameComponent } from './game/game.component';
import { MenuComponent } from './menu/menu.component';

const routes: Routes = [
  { path: '', component: MenuComponent },
  { path: 'game', component: GameComponent },
  { path: '**', redirectTo: '' },
];

export default routes;
