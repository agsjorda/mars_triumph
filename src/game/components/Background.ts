import { Scene } from "phaser";
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { gameStateManager } from "../../managers/GameStateManager";

export class Background {
	private bgContainer!: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private normalBgCover: Phaser.GameObjects.Image | null = null;
	private bgDefault: SpineGameObject | null = null;
	// ADJUST HERE (BG-Default): scale multiplier for the BG_Overlay_Light_Rays spine animation.
	private bgDefaultScaleMultiplier: number = 1;
	// normal-bg-cover (ControllerNormal): size is (height fraction fit) × (scale multipliers).
	// - coverHeightPercentOfScene: target height as a fraction of scene height (e.g. 0.5 = half screen).
	// - NORMAL_BG_COVER_SCALE_MULTIPLIER_*: extra multiply on that fit (1 = no change); X/Y can differ (stretch).
	private coverHeightPercentOfScene: number = 0.5;
	private readonly NORMAL_BG_COVER_SCALE_MULTIPLIER_X: number = 1;
	private readonly NORMAL_BG_COVER_SCALE_MULTIPLIER_Y: number = .6;
	// Vertical nudge for the image bottom edge (positive = down past screen bottom, negative = up).
	private readonly NORMAL_BG_COVER_OFFSET_Y_PX: number = 0;
	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	preload(scene: Scene): void {
		// Assets are now loaded centrally through AssetConfig in Preloader
		console.log(`[Background] Assets loaded centrally through AssetConfig`);
	}

	create(scene: Scene): void {
		console.log("[Background] Creating background elements");

		// Create main container for all background elements
		this.bgContainer = scene.add.container(0, 0);

		const assetScale = this.networkManager.getAssetScale();

		console.log(`[Background] Creating background with scale: ${assetScale}x`);

		this.createBackgroundLayers(scene);
		this.layout(scene);

		// Add decorative elements
		//this.createDecorativeElements(scene, assetScale);

		// Add UI elements
		//this.createUIElements(scene, assetScale);

		// Setup bonus mode listener to toggle cover visibility
		this.setupBonusModeListener(scene);
	}

	private createBackgroundLayers(scene: Scene): void {
		// BG-Default: full-scene background spine animation
		try {
			this.bgDefault = (scene.add as any).spine(
				scene.scale.width * 0.5,
				scene.scale.height * 0.5,
				'BG_Overlay_Light_Rays',
				'BG_Overlay_Light_Rays-atlas'
			) as SpineGameObject;
			this.bgDefault.setOrigin(0.5, 0.5);
			this.bgDefault.animationState.setAnimation(0, 'animation', true);
			this.bgContainer.add(this.bgDefault);
		} catch (e) {
			console.warn('[Background] Failed to create BG_Overlay_Light_Rays spine:', e);
			this.bgDefault = null;
		}

		// normal-bg-cover: foreground overlay (controller area). Keep it out of the container
		// so its depth can reliably sit above symbols/winlines if needed.
		// Origin bottom-center: y is the bottom edge of the image (aligns to scene bottom in layout).
		this.normalBgCover = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height,
			'normal-bg-cover'
		).setOrigin(0.5, 1).setDepth(850);
	}

	// adjustments for the background layout
	private layout(scene: Scene): void {
		const width = scene.scale.width;
		const height = scene.scale.height;

		if (this.bgDefault) {
			this.bgDefault.setPosition(width * 0.5, height * 0.5);
			// ADJUST HERE (BG-Default): scale multiplier for the BG_Overlay_Light_Rays spine.
			const multiplier = Phaser.Math.Clamp(this.bgDefaultScaleMultiplier, 0.1, 5);
			this.bgDefault.setScale(multiplier);
		}

		if (this.normalBgCover) {
			// Height adjuster (percentage): change `coverHeightPercentOfScene` above.
			// this.coverHeightPercentOfScene = 0.45; //adjust normal bg cover height
			const pct = Phaser.Math.Clamp(this.coverHeightPercentOfScene, 0, 1);
			const baseScaleX = this.normalBgCover.width ? width / this.normalBgCover.width : 1;
			const baseScaleY = this.normalBgCover.height ? (height * pct) / this.normalBgCover.height : 1;
			const scaleX = baseScaleX * this.NORMAL_BG_COVER_SCALE_MULTIPLIER_X;
			const scaleY = baseScaleY * this.NORMAL_BG_COVER_SCALE_MULTIPLIER_Y;
			this.normalBgCover.setScale(scaleX, scaleY);

			// Bottom-center origin: y is the image bottom — default matches scene bottom (height).
			const y = height + this.NORMAL_BG_COVER_OFFSET_Y_PX;
			this.normalBgCover.setPosition(width * 0.5, y);
		}

	}

	resize(scene: Scene): void {
		if (this.bgContainer) {
			this.bgContainer.setSize(scene.scale.width, scene.scale.height);
		}
		this.layout(scene);
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bgContainer;
	}

	/**
	 * Setup listener for bonus mode changes to toggle cover visibility
	 */
	private setupBonusModeListener(scene: Scene): void {
		// Listen for bonus mode events
		scene.events.on('setBonusMode', (isBonus: boolean) => {
			if (this.bgDefault) {
				this.bgDefault.setVisible(!isBonus);
				console.log(`[Background] BG-Default (BG_Overlay_Light_Rays) visibility set to: ${!isBonus} (isBonus: ${isBonus})`);
			}

			if (this.normalBgCover) {
				// Show normal cover only when NOT in bonus mode (fallback if Spine not used)
				this.normalBgCover.setVisible(!isBonus);
				console.log(`[Background] Normal bg cover visibility set to: ${!isBonus} (isBonus: ${isBonus})`);
			}
			// Cloud middle visibility logic removed
		});

		// Set initial visibility based on current bonus state
		const isBonus = gameStateManager.isBonus;
		if (this.bgDefault) {
			this.bgDefault.setVisible(!isBonus);
			console.log(`[Background] Initial BG_Overlay_Light_Rays visibility: ${!isBonus} (isBonus: ${isBonus})`);
		}
		if (this.normalBgCover) {
			this.normalBgCover.setVisible(!isBonus);
			console.log(`[Background] Initial normal bg cover visibility: ${!isBonus} (isBonus: ${isBonus})`);
		}
		// Initial cloud middle visibility logic removed
	}
}
