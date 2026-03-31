import { Scene } from 'phaser';
import { Data } from '../tmp_backend/Data';
import { SpinData } from '../backend/SpinData';
import { gameEventManager, GameEventType } from '../event/EventManager';
import { gameStateManager } from './GameStateManager';
import { TurboConfig } from '../config/TurboConfig';
import { toRowMajor } from '../utils/GridTransform';
import { SymbolDetector } from '../tmp_backend/SymbolDetector';

export interface ScatterAnimationConfig {
  scatterRevealDelay: number;
  slideInDuration: number;
  spinDelay: number;
  slideDistance: number;
  dialogDelay: number;
}

export interface ScatterFlowOptions {
  type: 'trigger' | 'retrigger' | 'buyFeature' | 'symbol0';
  scatterGrids?: Array<{ x: number; y: number }>;
  area?: number[][];
  freeSpinItem?: any;
  spinData?: any;
  retriggerSpins?: number;
}

export class ScatterAnimationManager {
  private static instance: ScatterAnimationManager;
  private scene: Scene | null = null;
  private symbolsContainer: Phaser.GameObjects.Container | null = null;
  private dialogsComponent: any = null; // Reference to the Dialogs component
  private isAnimating: boolean = false;
  public delayedScatterData: any = null;
  private scatterSymbols: any[] = []; // Store references to scatter symbols
  
  // Event listener references for cleanup
  private wheelSpinStartListener: ((data?: any) => void) | null = null; // deprecated
  private wheelSpinDoneListener: ((data?: any) => void) | null = null; // deprecated
  
  private config: ScatterAnimationConfig = {
    scatterRevealDelay: 2500,
    slideInDuration: 3500,
    spinDelay: 500,
    slideDistance: 200,
    dialogDelay: 300
  };

  // Apply turbo mode to delays for consistent timing
  // Note: Scatter animations always use normal speed for better visual experience
  private getTurboAdjustedDelay(baseDelay: number): number {
    // Always use normal speed for scatter animations, regardless of turbo mode
    return baseDelay;
  }

  private constructor() {}

  public static getInstance(): ScatterAnimationManager {
    if (!ScatterAnimationManager.instance) {
      ScatterAnimationManager.instance = new ScatterAnimationManager();
    }
    return ScatterAnimationManager.instance;
  }

  public initialize(scene: Scene, symbolsContainer: Phaser.GameObjects.Container, dialogsComponent?: any): void {
    this.scene = scene;
    this.symbolsContainer = symbolsContainer;
    this.dialogsComponent = dialogsComponent;
    
    console.log('[ScatterAnimationManager] Initialized with containers and dialogs component (spinner removed)');
  }

  public setConfig(config: Partial<ScatterAnimationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Wheel event listeners removed (spinner removed)

  public async playScatterAnimation(data: Data): Promise<void> {
    if (this.isAnimating || !this.scene || !this.symbolsContainer) {
      console.warn('[ScatterAnimationManager] Cannot play animation - not ready or already animating');
      return;
    }

    this.isAnimating = true;
    console.log('[ScatterAnimationManager] Starting scatter animation sequence - player will see scatter symbols for 1 second');

    // While the scatter animation / free-spin intro is playing, make sure the
    // SlotController's "spins left" display is completely hidden so it doesn't
    // pop in early underneath the animations or dialogs.
    try {
      const gameSceneAny = this.scene as any;
      const slotController = gameSceneAny?.slotController;
      if (slotController && typeof slotController.suppressFreeSpinDisplay === 'function') {
        slotController.suppressFreeSpinDisplay();
        console.log('[ScatterAnimationManager] Suppressed SlotController free spin display for scatter animation');
      }
    } catch (e) {
      console.warn('[ScatterAnimationManager] Failed to suppress SlotController free spin display at scatter start:', e);
    }

    // Switch BG music to Free Spin track when scatter animation starts
    // Only switch music for initial scatter triggers, not retriggers (when already in bonus mode)
    if (!gameStateManager.isBonus) {
      try {
        const audioMgr = (window as any).audioManager;
        if (audioMgr && typeof audioMgr.switchToFreeSpinMusic === 'function') {
          audioMgr.switchToFreeSpinMusic();
          console.log('[ScatterAnimationManager] Requested switch to free spin background music');
        }
      } catch (e) {
        console.warn('[ScatterAnimationManager] Failed to switch to free spin music', e);
      }
    } else {
      console.log('[ScatterAnimationManager] Skipping free spin music switch - already in bonus mode (retrigger)');
    }

    const isBuyFeature = gameStateManager.isBuyFeatureSpin;

    try {
      // Step 1: Wait for player to see scatter symbols
      console.log('[ScatterAnimationManager] Waiting for player to see scatter symbols...');
      await this.delay(this.getTurboAdjustedDelay(this.config.scatterRevealDelay));
      
      // Step 2: Skip all spinner animations; directly determine free spins and show dialog
      this.determineFreeSpins(data);

      // Align normal scatter with buy-feature flow: ensure symbols are reset/visible
      // before the free-spin dialog transition completes.
      try {
        const gameScene: any = this.scene as any;
        await gameScene?.symbols?.forceScatterResetImmediate?.();
        gameScene?.symbols?.ensureScatterSymbolsVisible?.();
        gameScene?.symbols?.container?.setVisible?.(true);
        gameScene?.symbols?.container?.setAlpha?.(1);
      } catch { }

      // Wait for Symbols transition (merge + explosion + overlay) before showing dialog - same for normal and buy feature
      await this.waitForBuyFeatureTransitions();

      // Directly show free spins dialog without wheel
      this.showFreeSpinsDialog(data);

      if (isBuyFeature) {
        try {
          if (typeof this.dialogsComponent?.hideRadialDimmerTransition === 'function') {
            this.dialogsComponent.hideRadialDimmerTransition();
          }
        } catch {}
        gameStateManager.isBuyFeatureSpin = false;
      }
      
      // Note: Symbol reset will happen after dialog animations complete
      console.log('[ScatterAnimationManager] Scatter bonus sequence completed, waiting for dialog animations to finish');
      
    } catch (error) {
      console.error('[ScatterAnimationManager] Error during scatter animation:', error);
    } finally {
      if (isBuyFeature && gameStateManager.isBuyFeatureSpin) {
        gameStateManager.isBuyFeatureSpin = false;
      }
      this.isAnimating = false;
    }
  }

  private getScatterGridPositions(options: ScatterFlowOptions): Array<{ x: number; y: number }> {
    if (Array.isArray(options.scatterGrids) && options.scatterGrids.length > 0) {
      return options.scatterGrids;
    }

    const area = options.area || (options.freeSpinItem?.area as number[][]) || [];
    if (!Array.isArray(area) || area.length === 0) {
      return [];
    }

    const rowMajor = toRowMajor(area);
    const detector = new SymbolDetector();
    const data = new Data();
    data.symbols = rowMajor;

    return detector.getScatterGrids(data).map((grid) => ({ x: grid.x, y: grid.y }));
  }

  private getScatterHoldDuration(): number {
    const defaultDuration = 1400;
    try {
      const gameSceneAny = this.scene as any;
      const symbols = gameSceneAny?.symbols;
      if (symbols?.grid?.findScatterSymbols) {
        const scatterPositions = symbols.grid.findScatterSymbols();
        if (scatterPositions.length) {
          const symbol = symbols.grid.getSymbol(scatterPositions[0].x, scatterPositions[0].y);
          const anim = symbol?.skeleton?.data?.findAnimation?.('Symbol0_BZ_win') || symbol?.skeleton?.data?.findAnimation?.('Symbol0_PC_win');
          if (anim && typeof anim.duration === 'number') {
            return Math.max(300, Math.round(anim.duration * 1000 * 0.7));
          }
        }
      }
    } catch { }
    return defaultDuration;
  }

  private scheduleIdleOnDialogDisplayed(expectedDialogType: string): void {
    if (!this.scene) return;

    this.scene.events.once('dialogFullyDisplayed', (dialogType: string) => {
      if (dialogType !== expectedDialogType) return;

      const symbolsComponent = (this.scene as any)?.symbols;
      if (symbolsComponent && typeof symbolsComponent.setScatterSymbolsToIdle === 'function') {
        symbolsComponent.setScatterSymbolsToIdle();
      }
    });
  }

  public async runScatterFlow(options: ScatterFlowOptions): Promise<void> {
    if (this.isAnimating || !this.scene) {
      console.warn('[ScatterAnimationManager] runScatterFlow blocked: animation in progress or scene missing');
      return;
    }
    this.isAnimating = true;

    const sceneAny = this.scene as any;
    const symbolsComponent = sceneAny?.symbols;
    const scatterGrids = this.getScatterGridPositions(options);

    if (!scatterGrids.length) {
      console.warn('[ScatterAnimationManager] No scatter grids found for runScatterFlow');
      this.isAnimating = false;
      return;
    }

    try {
      try {
        const slotController = sceneAny?.slotController;
        if (slotController && typeof slotController.suppressFreeSpinDisplay === 'function') {
          slotController.suppressFreeSpinDisplay();
        }
      } catch (e) {
        console.warn('[ScatterAnimationManager] Failed to suppress SlotController free spin display:', e);
      }

      if (options.type === 'retrigger' || options.type === 'symbol0') {
        gameStateManager.isBonus = true;
      } else if (!gameStateManager.isBonus) {
        try {
          const audioMgr = (window as any).audioManager;
          if (audioMgr?.switchToFreeSpinMusic) audioMgr.switchToFreeSpinMusic();
        } catch (e) {
          console.warn('[ScatterAnimationManager] Failed to switch to free spin music', e);
        }
      }

      const data = new Data();
      data.symbols = options.area ?? [];

      if (symbolsComponent?.mergeScatterSymbols && symbolsComponent?.playScatterWinAnimation) {
        await symbolsComponent.mergeScatterSymbols(scatterGrids);
        const winDurationMs: number = await symbolsComponent.playScatterWinAnimation(scatterGrids);

        let holdMs = this.getScatterHoldDuration();
        if (winDurationMs && winDurationMs > 0) {
          holdMs = Math.max(600, winDurationMs * 0.7);
        }
        await this.delay(holdMs);
      } else if (typeof symbolsComponent?.animateScatterSymbols === 'function') {
        await symbolsComponent.animateScatterSymbols(data, scatterGrids);
      } else {
        console.warn('[ScatterAnimationManager] Symbols or scatter methods not available');
        return;
      }

      data.scatterIndex = Math.max(0, scatterGrids.length - 4);
      data.freeSpins = Math.max(0, this.getFreeSpinsFromSpinData());
      gameStateManager.isScatter = true;
      gameStateManager.scatterIndex = data.scatterIndex || 0;

      if (options.type === 'retrigger') {
        this.showRetriggerFreeSpinsDialog(options.retriggerSpins ?? 0);
      } else {
        this.showFreeSpinsDialog(data, { suppressBlackOverlay: false });
      }
    } catch (e) {
      console.error('[ScatterAnimationManager] runScatterFlow error:', e);
    } finally {
      this.isAnimating = false;
    }
  }

  private getFreeSpinsFromSpinData(): number {
    if (!this.scene) return 0;

    const gameScene = this.scene as any;
    const currentSpinData: SpinData | undefined = gameScene?.symbols?.currentSpinData;
    const fsData = currentSpinData?.slot?.freeSpin || currentSpinData?.slot?.freespin;
    const items = Array.isArray(fsData?.items) ? fsData.items : [];
    const positiveItem = items.find((it: any) => typeof it?.spinsLeft === 'number' && it.spinsLeft > 0);
    const firstItemSpinsLeft = items.length > 0 && typeof items[0]?.spinsLeft === 'number' ? items[0].spinsLeft : 0;
    const countValue = typeof (fsData as any)?.count === 'number' ? (fsData as any).count : 0;
    const derived = Number(positiveItem?.spinsLeft ?? firstItemSpinsLeft ?? 0) || 0;
    return derived > 0 ? derived : countValue > 0 ? countValue : 0;
  }

  // Spinner wait removed; dialogs shown immediately

  private showFreeSpinsDialog(data: Data, options: { suppressBlackOverlay?: boolean; noAutoReset?: boolean } = {}): void {
    if (!this.dialogsComponent) {
      console.warn('[ScatterAnimationManager] Dialogs component not available');
      return;
    }

    let freeSpins = this.getFreeSpinsFromSpinData();

    // Fallback to backend-provided Data.freeSpins if spinData is missing or zero
    if (freeSpins <= 0 && typeof data?.freeSpins === 'number' && data.freeSpins > 0) {
      freeSpins = data.freeSpins;
    }
    
    // If we couldn't get freeSpins from spinData, log error and use 0
    if (freeSpins === 0) {
      console.error(`[ScatterAnimationManager] Could not get freeSpins from current spinData - dialog will show 0`);
    }

    // Update game state to reflect bonus mode
    gameStateManager.isBonus = true;

    this.scheduleIdleOnDialogDisplayed('FreeSpin_BZ');

    // Show the FreeSpin_BZ with all effects - this will trigger bonus mode when clicked
    try {
      this.dialogsComponent.showDialog(this.scene, {
        type: 'FreeSpin_BZ',
        freeSpins: freeSpins,
        suppressBlackOverlay: options.suppressBlackOverlay
      });
      
      // Emit IS_BONUS event through the EventManager
      gameEventManager.emit(GameEventType.IS_BONUS, {
        scatterCount: data.scatterIndex,
        bonusType: 'freeSpins'
      });
      
      // Emit scatter bonus activated event with scatter index and actual free spins for UI updates
      if (this.scene) {
        const eventData = {
          scatterIndex: data.scatterIndex,
          actualFreeSpins: freeSpins
        };
        this.scene.events.emit('scatterBonusActivated', eventData);
      }
      
      // Set up listener for when dialog animations complete (default flow)
      if (!options.noAutoReset) {
        this.setupDialogCompletionListener();
      }
      
    } catch (error) {
      console.error('[ScatterAnimationManager] Error showing dialog effects:', error);
    }
  }

  /**
   * Show a retrigger dialog during an active bonus with an explicit number of new spins.
   * This bypasses SpinData parsing and uses the provided newSpins value.
   */
  public showRetriggerFreeSpinsDialog(newSpins: number, options: { noAutoReset?: boolean } = {}): void {
    if (!this.scene) return;
    console.log('[ScatterAnimationManager] ===== SHOW RETRIGGER FREE SPINS DIALOG =====');
    console.log('[ScatterAnimationManager] Dialogs component available:', !!this.dialogsComponent);
    
    if (!this.dialogsComponent) {
      console.warn('[ScatterAnimationManager] Dialogs component not available');
      return;
    }
    
    const spins = Math.max(0, Number(newSpins) || 0);
    console.log(`[ScatterAnimationManager] Showing retrigger dialog for +${spins} free spins`);
    
    // Keep bonus mode active; do not toggle music here
    gameStateManager.isBonus = true;
    // A retrigger explicitly means the bonus is continuing, so make sure any
    // tentative "bonus finished" state set earlier in the spin (e.g. from
    // REELS_STOP heuristics) is cleared before congrats logic can react to it.
    try {
      if (gameStateManager.isBonusFinished) {
        console.log('[ScatterAnimationManager] Retrigger detected - clearing isBonusFinished to prevent premature congrats');
      }
      gameStateManager.isBonusFinished = false;
    } catch {}
    
    try {
      this.dialogsComponent.showDialog(this.scene, {
        type: 'FreeSpinRetri_BZ',
        freeSpins: spins,
        isRetrigger: true
      });

      this.scheduleIdleOnDialogDisplayed('FreeSpinRetri_BZ');
      
      // Emit scatter bonus activated event with explicit spin count for UI syncing
      const eventData = {
        scatterIndex: 0, // not used for retrigger visuals
        actualFreeSpins: spins,
        isRetrigger: true
      };
      console.log(`[ScatterAnimationManager] Emitting retrigger scatterBonusActivated with ${spins} spins (isRetrigger=true)`);
      this.scene.events.emit('scatterBonusActivated', eventData);
      
      // Ensure we reset symbols/animations when the dialog finishes
      if (!options.noAutoReset) {
        this.setupDialogCompletionListener();
      }
    } catch (error) {
      console.error('[ScatterAnimationManager] Error showing retrigger dialog:', error);
    }
  }

  public isAnimationInProgress(): boolean {
    return this.isAnimating;
  }

  /**
   * Set delayed scatter animation data (called when win dialogs need to show first)
   */
  public setDelayedScatterAnimation(data: any): void {
    console.log('[ScatterAnimationManager] Setting delayed scatter animation data');
    this.delayedScatterData = data;
  }



  public resetSymbolsVisibility(): void {
    if (this.symbolsContainer) {
      console.log('[ScatterAnimationManager] WARNING: resetSymbolsVisibility called - this should not happen during scatter bonus!');
      console.log('[ScatterAnimationManager] Stack trace:', new Error().stack);
      this.symbolsContainer.setAlpha(1);
    }
  }

  /**
   * Set up listener for when dialog animations complete
   */
  private setupDialogCompletionListener(): void {
    if (!this.scene) return;

    let completionHandled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (completionHandled) return;
      completionHandled = true;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      this.resetAllSymbolsAndAnimations();
    };

    this.scene.events.once('dialogAnimationsComplete', finish);

    const pollUntilDialogClosed = () => {
      fallbackTimer = setTimeout(() => {
        if (completionHandled) return;
        const dialogsAny = this.dialogsComponent as any;
        const dialogShowing = typeof dialogsAny?.isDialogShowing === 'function' && dialogsAny.isDialogShowing();
        const radialLightRunning = typeof dialogsAny?.isRadialLightTransitionInProgress === 'function'
          && dialogsAny.isRadialLightTransitionInProgress();
        if (dialogShowing || radialLightRunning) {
          pollUntilDialogClosed();
          return;
        }
        finish();
      }, 1000);
    };
    pollUntilDialogClosed();
  }

  /**
   * Check if we're currently in an active bonus mode (free spins)
   */
  private isInActiveBonusMode(): boolean {
    // Check if we have free spins remaining or if we're in bonus mode
    // Use SpinData freespin count
    const hasFreeSpins = this.getCurrentFreeSpinsCount() > 0;
    const isBonusMode = gameStateManager.isBonus;
    
    console.log(`[ScatterAnimationManager] Checking bonus mode: hasFreeSpins=${hasFreeSpins}, isBonus=${isBonusMode}`);
    
    return hasFreeSpins || isBonusMode;
  }

  /**
   * Get the current free spins count from SpinData
   */
  private getCurrentFreeSpinsCount(): number {
    // Try to get free spins count from the current spin data
    if (this.scene) {
      const gameScene = this.scene as any; // Cast to access symbols property
      if (gameScene.symbols) {
        const currentSpinData = gameScene.symbols.currentSpinData;
        if (currentSpinData && currentSpinData.slot && currentSpinData.slot.freespin) {
          return currentSpinData.slot.freespin.count || 0;
        }
      }
    }
    
    // No SpinData available - return 0
    return 0;
  }

  /**
   * Consume one free spin (decrement count)
   * Note: freespin.count should remain the original total count from API response
   */
  public consumeFreeSpin(): void {
    const currentCount = this.getCurrentFreeSpinsCount();
    if (currentCount > 0) {
      const newCount = currentCount - 1;
      console.log(`[ScatterAnimationManager] Consuming free spin: ${currentCount} -> ${newCount}`);
      
      // Note: We should NOT modify freespin.count as it represents the original total won
      // The remaining spins should be tracked separately for display purposes
      
      // Free spins count updated in SpinData
      
      // If no more free spins, end bonus mode
      if (newCount === 0) {
        this.endBonusMode();
      }
    }
  }

  /**
   * End bonus mode when free spins are completed
   */
  public endBonusMode(): void {
    console.log('[ScatterAnimationManager] Ending bonus mode');
    gameStateManager.isBonus = false;
    
    // Do not mutate spinData here; other components rely on it for final totals.
    
    // Emit events to switch back to normal mode
    if (this.scene) {
      this.scene.events.emit('hideBonusBackground');
      this.scene.events.emit('hideBonusHeader');
    }
  }

  /**
   * Reset all symbols and animations after scatter bonus completes
   */
  private async resetAllSymbolsAndAnimations(): Promise<void> {
    console.log('[ScatterAnimationManager] Resetting all symbols and animations...');
    
    // Free spin music will be stopped when the dialog closes
    // Bonus music will be triggered when showBonusBackground event is emitted

    try {
      // Reset game state - but don't reset isBonus if we're in an active bonus mode
      gameStateManager.isScatter = false;
      
      // Only reset isBonus if we're not in an active bonus mode (free spins)
      // The bonus mode should persist throughout the free spins
      if (!this.isInActiveBonusMode()) {
        console.log('[ScatterAnimationManager] Not in active bonus mode, resetting isBonus to false');
        gameStateManager.isBonus = false;
      } else {
        console.log('[ScatterAnimationManager] In active bonus mode, keeping isBonus as true');
      }
      
      gameStateManager.scatterIndex = 0;
      
      // Reset symbols container visibility
      if (this.symbolsContainer) {
        this.symbolsContainer.setAlpha(1);
        this.symbolsContainer.setVisible(true);
        console.log('[ScatterAnimationManager] Symbols container reset to visible with alpha 1');
      }
      
      // Re-enable scatter symbols
      this.showScatterSymbols();
      
      // Spinner container cleanup removed
      
      // Do not kill symbol container tweens; keep animations running
      
      // Emit event to notify Symbols component to restore symbol visibility
      if (this.scene) {
        this.scene.events.emit('scatterBonusCompleted');
        console.log('[ScatterAnimationManager] Emitted scatterBonusCompleted event');
      }
      
      console.log('[ScatterAnimationManager] All symbols and animations reset successfully');
      
    } catch (error) {
      console.error('[ScatterAnimationManager] Error resetting symbols and animations:', error);
    }
  }

  // hideSpinner removed (spinner removed)

  private hideScatterSymbols(): void {
    if (!this.scene) return;

    console.log('[ScatterAnimationManager] Hiding scatter symbols...');
    
    // Hide all registered scatter symbols
    this.scatterSymbols.forEach(symbol => {
      if (symbol && !symbol.destroyed) {
        symbol.setVisible(false);
        console.log('[ScatterAnimationManager] Hidden scatter symbol');
      }
    });
    
    console.log(`[ScatterAnimationManager] Hidden ${this.scatterSymbols.length} scatter symbols`);
  }

  private showScatterSymbols(): void {
    if (!this.scene) return;

    console.log('[ScatterAnimationManager] Showing scatter symbols...');
    
    // Show all registered scatter symbols
    this.scatterSymbols.forEach(symbol => {
      if (symbol && !symbol.destroyed) {
        symbol.setVisible(true);
        console.log('[ScatterAnimationManager] Shown scatter symbol');
      }
    });
    
    console.log(`[ScatterAnimationManager] Shown ${this.scatterSymbols.length} scatter symbols`);
  }

  /**
   * Register a scatter symbol for management
   */
  public registerScatterSymbol(symbol: any): void {
    if (symbol && !this.scatterSymbols.includes(symbol)) {
      this.scatterSymbols.push(symbol);
      console.log('[ScatterAnimationManager] Registered scatter symbol');
    }
  }

  /**
   * Unregister a scatter symbol from management
   */
  public unregisterScatterSymbol(symbol: any): void {
    const index = this.scatterSymbols.indexOf(symbol);
    if (index !== -1) {
      this.scatterSymbols.splice(index, 1);
      console.log('[ScatterAnimationManager] Unregistered scatter symbol');
    }
  }

  /**
   * Clear all registered scatter symbols
   */
  public clearScatterSymbols(): void {
    this.scatterSymbols = [];
    console.log('[ScatterAnimationManager] Cleared all scatter symbol references');
  }

  public destroy(): void {
    this.scene = null;
    this.symbolsContainer = null;
    this.isAnimating = false;
    this.wheelSpinStartListener = null;
    this.wheelSpinDoneListener = null;
    console.log('[ScatterAnimationManager] Destroyed');
  }
} 
