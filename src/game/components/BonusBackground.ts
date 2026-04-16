import { Scene } from "phaser";
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { gameStateManager } from "../../managers/GameStateManager";
import { ensureSpineFactory } from "../../utils/SpineGuard";

export class BonusBackground {
	private bonusContainer!: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private bonusBg: Phaser.GameObjects.Image | null = null; // Static bonus background (BonusGame_BG.webp)
	private bonusBgCover: Phaser.GameObjects.Image | null = null;
	private bonusAmbers: SpineGameObject | null = null;
	private scene: Scene | null = null;

	/** Skeleton design size from Bonus_Ambers_MT.json (used for cover scaling). */
	private static readonly BONUS_AMBERS_DESIGN_W = 428;
	private static readonly BONUS_AMBERS_DESIGN_H = 926;
	
	// ============================================
	// ADJUST HERE: Vertical offset for bonus background image
	// ============================================
	// Controls the vertical position of the bonus background image
	// 0 = centered vertically on screen
	// Positive values = move DOWN (e.g., 50 moves image 50px down)
	// Negative values = move UP (e.g., -50 moves image 50px up)
	private bonusBackgroundYOffset: number = 0;
	
	// ============================================
	// ADJUST HERE: Vertical offset for bonus-bg-cover overlay
	// ============================================
	// Controls the vertical position of the bonus-bg-cover overlay.
	// The bottom edge is aligned to the bottom of the scene by default.
	// 0 = bottom edge exactly on the bottom of the game scene.
	// Positive values = move DOWN (cover bottom below screen).
	// Negative values = move UP (cover pulled up into the scene).
	private bonusBgCoverYOffset: number = 0;

	// Percentage-style scale multipliers for bonus-bg-cover (applied on top of base width fit).
	// 1 = 100% / no change. X/Y can differ to stretch vertically if needed.
	private readonly BONUS_BG_COVER_SCALE_MULTIPLIER_X: number = 1;
	private readonly BONUS_BG_COVER_SCALE_MULTIPLIER_Y: number = .9;

	// Time-scale multiplier for Bonus_Ambers_MT animation speed.
	// 1 = normal speed, 0.5 = half speed, 2 = double speed.
	private readonly BONUS_AMBERS_TIME_SCALE_MULTIPLIER: number = 1;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	preload(scene: Scene): void {
		// Assets are loaded centrally through AssetConfig in Preloader
		console.log(`[BonusBackground] Assets loaded centrally through AssetConfig`);
	}

	create(scene: Scene): void {
		console.log("[BonusBackground] Creating bonus background elements");
		
		// Store scene reference
		this.scene = scene;
		
		// Create main container for all bonus background elements
	// Set depth to -1 so it's behind symbols (0-600) and all other game elements
	this.bonusContainer = scene.add.container(0, 0);
	this.bonusContainer.setDepth(-1);
		const assetScale = this.networkManager.getAssetScale();
		
		console.log(`[BonusBackground] Creating bonus background with scale: ${assetScale}x`);

		// Add bonus background elements
		this.createBonusElements(scene, assetScale);
		this.layout(scene);
		
		// Setup bonus mode listener to toggle cover visibility
		this.setupBonusModeListener(scene);
	}

	private createBonusElements(scene: Scene, assetScale: number): void {
		const screenConfig = this.screenModeManager.getScreenConfig();
		
		if (screenConfig.isPortrait) {
			this.createPortraitBonusBackground(scene, assetScale);
		} else {
			this.createLandscapeBonusBackground(scene, assetScale);
		}
		this.createBonusAmbersVfx(scene);
	}

	/** Looping additive ambers; visible only while bonus mode is active. */
	private createBonusAmbersVfx(scene: Scene): void {
		if (!ensureSpineFactory(scene, '[BonusBackground] Bonus_Ambers_MT')) {
			return;
		}
		try {
			const cx = scene.scale.width * 0.5;
			const cy = scene.scale.height * 0.5 + this.bonusBackgroundYOffset;
			this.bonusAmbers = (scene.add as any).spine(
				cx,
				cy,
				'Bonus_Ambers_MT',
				'Bonus_Ambers_MT-atlas'
			) as SpineGameObject;
			this.bonusAmbers.setOrigin(0.5, 0.5);
			this.applyBonusAmbersLayout(scene);
			try {
				this.bonusAmbers.animationState.timeScale = this.BONUS_AMBERS_TIME_SCALE_MULTIPLIER;
				this.bonusAmbers.animationState.setAnimation(0, 'animation', true);
			} catch {
				console.warn('[BonusBackground] Bonus_Ambers_MT: failed to start animation');
			}
			this.bonusAmbers.setVisible(false);
			this.bonusContainer.add(this.bonusAmbers);
		} catch (e) {
			console.warn('[BonusBackground] Failed to create Bonus_Ambers_MT spine:', e);
			this.bonusAmbers = null;
		}
	}

	private applyBonusAmbersLayout(scene: Scene): void {
		if (!this.bonusAmbers) return;
		const w = scene.scale.width;
		const h = scene.scale.height;
		const cx = w * 0.5;
		const cy = h * 0.5 + this.bonusBackgroundYOffset;
		this.bonusAmbers.setPosition(cx, cy);
		const sw = BonusBackground.BONUS_AMBERS_DESIGN_W;
		const sh = BonusBackground.BONUS_AMBERS_DESIGN_H;
		const cover = Math.max(w / sw, h / sh);
		this.bonusAmbers.setScale(cover);
	}

	private createPortraitBonusBackground(scene: Scene, assetScale: number): void {
		console.log("[BonusBackground] Creating portrait bonus background layout");
		this.createBonusStaticBackground(scene);

		// Bonus cover overlay (bottom-aligned, like normal-bg-cover)
		// Add directly to scene with depth 850 (above symbols 0-600, winlines 800, but below controller 900)
		this.bonusBgCover = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height,
			'bonus-bg-cover'
		).setOrigin(0.5, 1).setDepth(850);
		// Initially hidden, will be shown when bonus mode is active
		this.bonusBgCover.setVisible(false);
		// Don't add to container - add directly to scene so depth works correctly
		// Visibility will be controlled by bonus mode listener
		console.log('[BonusBackground] Created bonus-bg-cover at depth 850, initially hidden');


	}

	private createLandscapeBonusBackground(scene: Scene, assetScale: number): void {
		console.log("[BonusBackground] Creating landscape bonus background layout");
		this.createBonusStaticBackground(scene);

		// Bonus cover overlay (bottom-aligned, like normal-bg-cover)
		// Add directly to scene with depth 850 (above symbols 0-600, winlines 800, but below controller 900)
		this.bonusBgCover = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height,
			'bonus-bg-cover'
		).setOrigin(0.5, 1).setDepth(850);
		// Initially hidden, will be shown when bonus mode is active
		this.bonusBgCover.setVisible(false);
		// Don't add to container - add directly to scene so depth works correctly
		// Visibility will be controlled by bonus mode listener
		console.log('[BonusBackground] Created bonus-bg-cover at depth 850, initially hidden');


	}

	/** Full-screen cover using static BonusGame_BG.webp (`BG-Bonus` texture key). */
	private createBonusStaticBackground(scene: Scene): void {
		this.bonusBg = scene.add
			.image(scene.scale.width * 0.5, scene.scale.height * 0.5, 'BG-Bonus')
			.setOrigin(0.5, 0.5);
		this.bonusBg.setDepth(0);
		this.scaleImageToCover(this.bonusBg, scene.scale.width, scene.scale.height);
		this.bonusContainer.add(this.bonusBg);
	}

	private scaleImageToCover(image: Phaser.GameObjects.Image, targetWidth: number, targetHeight: number): void {
		const frame = image.frame;
		const sourceWidth = frame?.width ?? image.width;
		const sourceHeight = frame?.height ?? image.height;
		if (!sourceWidth || !sourceHeight) return;
		const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
		image.setScale(scale);
	}

	private scaleBonusCoverToWidth(image: Phaser.GameObjects.Image, targetWidth: number): void {
		const frame = image.frame;
		const sourceWidth = frame?.width ?? image.width;
		const sourceHeight = frame?.height ?? image.height;
		if (!sourceWidth || !sourceHeight) return;

		const baseScaleX = targetWidth / sourceWidth;
		const finalScaleX = baseScaleX * this.BONUS_BG_COVER_SCALE_MULTIPLIER_X;
		const finalScaleY = baseScaleX * this.BONUS_BG_COVER_SCALE_MULTIPLIER_Y;
		image.setScale(finalScaleX, finalScaleY);
	}

	private layout(scene: Scene): void {
		const width = scene.scale.width;
		const height = scene.scale.height;

		if (this.bonusBg) {
			const yPosition = (height * 0.5) + this.bonusBackgroundYOffset;
			this.bonusBg.setPosition(width * 0.5, yPosition);
			try {
				this.scaleImageToCover(this.bonusBg, width, height);
			} catch (e) {
				console.warn('[BonusBackground] Failed to scale bonus bg:', e);
			}
		}

		if (this.bonusBgCover) {
			// Match normal-bg-cover behavior: bottom edge aligned with scene bottom, then offset by bonusBgCoverYOffset.
			const yPosition = height + this.bonusBgCoverYOffset;
			this.bonusBgCover.setPosition(width * 0.5, yPosition);
			this.scaleBonusCoverToWidth(this.bonusBgCover, width);
		}

		if (this.scene) {
			this.applyBonusAmbersLayout(this.scene);
		}

	}

	resize(scene: Scene): void {
		if (this.bonusContainer) {
			this.bonusContainer.setSize(scene.scale.width, scene.scale.height);
		}
		this.layout(scene);
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bonusContainer;
	}

	destroy(): void {
		if (this.bonusContainer) {
			this.bonusContainer.destroy();
		}
	}

	/**
	 * Setup listener for bonus mode changes to toggle cover and cloud visibility
	 */
	private setupBonusModeListener(scene: Scene): void {
		// Check if bonus-bg-cover asset loaded successfully
		if (!scene.textures.exists('bonus-bg-cover')) {
			console.error('[BonusBackground] bonus-bg-cover texture not found! Check AssetConfig and file path.');
			console.log('[BonusBackground] Available textures:', scene.textures.getTextureKeys());
		}
		
		// Listen for bonus mode events using scene.events (same as Background.ts)
		scene.events.on('setBonusMode', (isBonus: boolean) => {
			console.log(`[BonusBackground] Bonus mode changed to: ${isBonus}`);
			
			if (this.bonusBgCover) {
				this.bonusBgCover.setVisible(isBonus);
				console.log(`[BonusBackground] Bonus bg cover visibility: ${isBonus}`);
			}
			if (this.bonusAmbers) {
				this.bonusAmbers.setVisible(isBonus);
				if (isBonus) {
					try {
						this.bonusAmbers.animationState.timeScale = this.BONUS_AMBERS_TIME_SCALE_MULTIPLIER;
						this.bonusAmbers.animationState.setAnimation(0, 'animation', true);
					} catch { /* noop */ }
				}
			}
		});

		// Set initial visibility based on current bonus state
		const isBonus = gameStateManager.isBonus;
		
		if (this.bonusBgCover) {
			this.bonusBgCover.setVisible(isBonus);
			console.log(`[BonusBackground] Initial bonus bg cover visibility: ${isBonus} (isBonus: ${isBonus})`);
		}
		if (this.bonusAmbers) {
			this.bonusAmbers.setVisible(isBonus);
			if (isBonus) {
				try {
					this.bonusAmbers.animationState.timeScale = this.BONUS_AMBERS_TIME_SCALE_MULTIPLIER;
					this.bonusAmbers.animationState.setAnimation(0, 'animation', true);
				} catch { /* noop */ }
			}
		}
	}
}
