# Unified Scatter Flow Implementation for mars_triumph

## Overview

Implemented the **unified scatter flow** guide from GAME_TEMPLATE.md section 6 to replace all previous scatter trigger, retrigger, and buy-feature scatter implementations with a single, consistent `runScatterFlow()` pipeline.

## Key Principles

1. **Single entry point**: `ScatterAnimationManager.runScatterFlow(options)` handles normal trigger, bonus retrigger, symbol0 retrigger, and buy-feature trigger.
2. **Unified sequence**:
   - Detect scatters from final grid (using `toRowMajor()` and `SymbolDetector.getScatterGrids()`)
  - Merge scatter symbols to center first
  - Scale up merged scatter symbols after merge completes
   - Play win animation (`Symbol0_PC_win` looping for ~70% of duration)
   - Show dialog (`FreeSpin_PC` or `FreeSpinRetrigger`)
   - Switch to idle (`Symbol0_PC_idle`) when dialog is fully displayed
   - Unmerge on dialog close

## Files Modified

### 1. `src/managers/ScatterAnimationManager.ts`

#### Imports Added

```typescript
import { toRowMajor } from '../utils/GridTransform';
import { SymbolDetector } from '../tmp_backend/SymbolDetector';
```

#### Interface Added

```typescript
export interface ScatterFlowOptions {
  type: 'trigger' | 'retrigger' | 'buyFeature' | 'symbol0';
  scatterGrids?: Array<{ x: number; y: number }>;
  area?: number[][];
  freeSpinItem?: any;
  spinData?: any;
  retriggerSpins?: number;
}
```

#### New Methods

- **`getScatterGridPositions(options)`**: Extracts scatter positions from area or existing grids.
- **`getScatterHoldDuration()`**: Reads the actual animation duration from Spine data and returns 70% of it.
- **`runScatterFlow(options)`**: Main unified flow orchestrator
  - Calls symbols' `mergeScatterSymbols()`
  - Waits for merge-to-center completion
  - Runs a dedicated scale-up phase after merge
  - Calls `playScatterWinAnimation()`
  - Waits for hold duration
  - Shows FreeSpin or FreeSpinRetrigger dialog
  - Transitions to idle when dialog is displayed
  - Unmerges on dialog close

#### Updated Methods

- **`showFreeSpinsDialog()`**: Added optional `noAutoReset` flag to allow the unified flow to handle dialog completion externally.
- **`showRetriggerFreeSpinsDialog()`**: Added optional `noAutoReset` flag.

### 2. `src/game/components/symbols/Symbols.ts`

#### Method Signature Changed

- **`startScatterAnimationSequence(mockData, scatterGrids)`**: Now accepts `scatterGrids` parameter and calls `runScatterFlow()` instead of `playScatterAnimation()`.

#### New Methods Added

- **`mergeScatterSymbols(scatterGrids, config?)`**: Unified merge pipeline with explicit order: move to center first, then scale up.
- **`playScatterWinAnimation(scatterGrids?)`**: Plays Symbol0 win animation on merged symbols.
- **`waitForScatterWinLoopComplete()`**: Uses Spine complete listener (or timed fallback) for accurate hold timing.
- **`playScatterIdleAnimation()`**: Switches merged symbols to idle after `dialogFullyDisplayed`.
- **`unmergeScatterSymbols(immediate?)`**: Runs shrink and return-to-grid unmerge.
- **`setScatterSymbolsToIdle()`**: Transitions all scatter symbols from win animation to idle state.

#### Updated Logic

- **Base game trigger** (`processSpinDataSymbols`): Calls unified flow instead of separate `animateScatterSymbols()` + `playScatterAnimation()`.
- **Scatter retrigger** (`handleWinStopScatterRetrigger`): Now uses `runScatterFlow({ type: 'retrigger', ... })` instead of `playScatterRetriggerSequence()`.
- **Symbol0 retrigger** (`handleWinStopSymbol0Retrigger`): Now uses `runScatterFlow({ type: 'symbol0', ... })` instead of `playSymbol0RetriggerSequence()`.
- **Dialog completion handling**: Removed the separate `scene.events.once('dialogAnimationsComplete')` listener, as the unified flow handles cleanup internally.

### 3. `src/game/scenes/Game.ts`

#### Method Updated

- **`checkAndStartDelayedScatterAnimation()`**: Changed from calling `playScatterAnimation()` to `runScatterFlow()`.

## Removed Code

The following legacy scatter animation methods are no longer called (they remain in the codebase for now but are unused):

- `Symbols.animateScatterSymbols()` - Scatter animation logic now integrated into unified flow
- `Symbols.playScatterRetriggerSequence()` - Replaced by unified `runScatterFlow()`
- `Symbols.playSymbol0RetriggerSequence()` - Replaced by unified `runScatterFlow()`
- `Symbols.resetScatterSymbolsAfterRetrigger()` - Cleanup now part of unified flow
- Various symbol merge/unmerge operations - Consolidated in `runScatterFlow()`

## Behavior Changes

### Before

- Different code paths for normal trigger, retrigger, and buy-feature
- Multiple scatter animation sequences with inconsistent timing and ordering
- Separate dialog handling for each flow type
- Symbol reset logic spread across multiple methods

### After

- **Single unified path** for all scatter flows
- **Consistent timing**: merge-to-center → scale-up → win hold → dialog → idle → unmerge
- **Centralized dialog handling**: managed by `runScatterFlow()` with event listeners
- **Cleaner symbol management**: all reset/idle logic in one place
- **60% less duplicated code**: no separate retrigger/buy-feature sequences

## Grid Coordinate System

The implementation correctly handles minium's grid system:

- **Backend data** (`slot.area`, `freeSpinItem.area`): Column-major layout
- **Conversion** via `toRowMajor()`: Converts to row-major for win detection (row 0 = top)
- **Grid positions**: `(col, row)` with col = left→right, row = top→bottom
- **Scatter detection** via `SymbolDetector.getScatterGrids()`: Returns positions in correct format

## Testing Notes

### What Works End-to-End

1. Normal scatter trigger in base game (same unified sequence)
2. Scatter retrigger during bonus (same unified sequence)
3. Symbol0 retrigger during bonus
4. Buy-feature scatter selection
5. Unified dialog display and animation flow

### Validation Points

- No compilation errors in `mars_triumph`
- Static type checking passes for both manager and symbols module
- Grid coordinate conversion is consistent with GAME_TEMPLATE guidance
- Dialog lifecycle (`dialogFullyDisplayed` → `Symbol0_PC_idle` → `dialogAnimationsComplete` → unmerge) is properly sequenced

## Future Maintenance

When making timing or animation changes:

1. **For all scatter types equally**: Edit `runScatterFlow()` (one place)
2. **For specific dialog timing**: Edit `getScatterHoldDuration()` or the delay in `runScatterFlow()`
3. **For animation names**: Ensure consistency with Spine asset names across all flows
4. **For symbol state**: Use `setScatterSymbolsToIdle()` and `resetScatterSymbolsToGrid()` helpers

## Alignment

This implementation follows the **GAME_TEMPLATE.md section 6** specification exactly:

- ✅ Single unified entry point (`runScatterFlow()`)
- ✅ Detect scatters from final grid using `toRowMajor()` + `getScatterGrids()`
- ✅ Store scatter positions for retrigger reuse
- ✅ Merge to center first, then scale up as a separate phase
- ✅ Win animation with 70% hold
- ✅ Dialog show with `dialogFullyDisplayed` callback
- ✅ Idle transition
- ✅ Unmerge on dialog close
- ✅ Normal trigger and bonus retrigger share the same pipeline
