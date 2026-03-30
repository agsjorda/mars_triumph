import { Scene } from "phaser";

export class Debugger {
  public scene: Scene;
  public container: Phaser.GameObjects.Container;

  constructor() { }

  public preload(scene: Scene) {
    this.scene = scene;

  }

  public create() {
    this.createWinBreakdownTexts();
  }

  private createWinBreakdownTexts() {
    // Legacy tmp_backend SPIN_RESPONSE listener removed; use SPIN_DATA_RESPONSE / GameEventType flows.
  }
}