import { NetworkManager } from "../managers/NetworkManager";
import { ScreenModeManager } from "../managers/ScreenModeManager";

export interface AssetGroup {
	images?: { [key: string]: string };
	spine?: { [key: string]: { atlas: string; json: string } };
	audio?: { [key: string]: string };
	fonts?: { [key: string]: string };
}

export class AssetConfig {
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	private getAssetPrefix(): string {
		const screenConfig = this.screenModeManager.getScreenConfig();
		const isHighSpeed = this.networkManager.getNetworkSpeed();

		const orientation = screenConfig.isPortrait ? 'portrait' : 'landscape';
		const quality = isHighSpeed ? 'high' : 'low';

		return `assets/${orientation}/${quality}`;
	}

	getBackgroundAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();

		return {
			images: {
				'normal-bg-cover': `assets/portrait/high/background/ControllerNormal.webp`,
				'dijoker_loading': `${prefix}/dijoker_loading/DI JOKER.png`
			},
			spine: {
				'BG_Overlay_Light_Rays': {
					atlas: `${prefix}/background/BG_Overlay_Light_Rays.atlas`,
					json: `${prefix}/background/BG_Overlay_Light_Rays.json`
				},
				'di_joker': {
					atlas: `${prefix}/dijoker_loading/DI JOKER.atlas`,
					json: `${prefix}/dijoker_loading/DI JOKER.json`
				}
			}
		};
	}

	getBonusBackgroundAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();

		return {
			images: {
				'BG-Bonus': `${prefix}/bonus_background/BonusGame_BG.webp`,
				'bonus-bg-cover': `${prefix}/bonus_background/ControllerBonus.webp`,
			}
		};
	}

	getHeaderAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();

		return {
			images: {
				'header_logo': `${prefix}/header/header_logo.webp`,
				'normal_winbar': `${prefix}/header/normal_winbar.webp`,
			},
			spine: {
				// Removed cat and win-bar assets from header
				// Add more Spine animations here
			}
		};
	}

	getBonusHeaderAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();

		return {
			images: {
				// Reuse the same logo for bonus header.
				'bonus_header_logo': `${prefix}/header/header_logo.webp`,
				'bonus_winbar': `${prefix}/header/bonus_winbar.webp`,
			},
			spine: {}
		};
	}


	getLoadingAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();

		return {
			images: {
				// NOTE: The underlying asset file is currently named LoadingScreen_BZ.png.
				// If art updates introduce LoadingScreen.png, update this path accordingly.
				'loading_background': `${prefix}/background/LoadingScreen.webp`,
				'button_bg': `${prefix}/loading/button_bg.png`,
				'button_spin': `${prefix}/loading/button_spin.png`,
				// Preloader logo (fixed portrait/high path so it always exists regardless of network tier)
				'preloader_logo': `assets/portrait/high/header/preloader_logo.webp`,
				'loading_frame': `${prefix}/loading/loading-frame.png`,
				'loading_frame_2': `${prefix}/loading/loading-frame-2.png`,
				'dijoker_logo': `${prefix}/loading/DiJoker-logo.png`,
			},
			spine: {
				// Studio loading spine (DI JOKER) – only available in portrait/high
				'di_joker': {
					atlas: `assets/portrait/high/dijoker_loading/DI JOKER.atlas`,
					json: `assets/portrait/high/dijoker_loading/DI JOKER.json`
				},
			},
			audio: {
				// Boot-load the transition whistle so it is ready before the Preloader play button is shown.
				'whistle': 'assets/sounds/SFX/whistle_BB.ogg'
			}
		};
	}

	// Add more asset groups as needed
	getSymbolAssets(): AssetGroup {
		const prefix = this.getAssetPrefix(); // This gives us assets/{orientation}/{quality}
		const suffix = 'MT';
		console.log(`[AssetConfig] Loading symbol assets from: ${prefix}/symbols/`);

		// Generate symbol assets for all symbols (0-10)
		const symbolImages: { [key: string]: string } = {};
		const symbolSpine: { [key: string]: { atlas: string; json: string } } = {};

		// Symbol Spine animations for Symbol0–Symbol9 (portrait/high bundle).
		const bzSymbolRoot = 'assets/portrait/high/symbols';
		for (let i = 0; i <= 9; i++) {
			const spineKey = `symbol_${i}_spine`;
			const sugarAliasKey = `symbol_${i}_sugar_spine`;
			const atlas = `${bzSymbolRoot}/Symbol${i}_${suffix}.atlas`;
			const json = `${bzSymbolRoot}/Symbol${i}_${suffix}.json`;
			symbolSpine[spineKey] = { atlas: atlas, json: json };
			symbolSpine[sugarAliasKey] = { atlas: atlas, json: json };
		}

		// Multiplier symbol still uses the existing BZ spine files.
		symbolSpine['symbol_10_spine'] = {
			atlas: `${bzSymbolRoot}/Symbol10_BZ.atlas`,
			json: `${bzSymbolRoot}/Symbol10_BZ.json`
		};
		symbolSpine['symbol_10_sugar_spine'] = {
			atlas: `${bzSymbolRoot}/Symbol10_BZ.atlas`,
			json: `${bzSymbolRoot}/Symbol10_BZ.json`
		};

		// symbols for helper
		for (let i = 0; i <= 9; i++) {
			const spritePath = `${bzSymbolRoot}/statics/symbol${i}.png`;
			const helperKey = `symbol${i}`;
			const fallbackKey = `symbol_${i}`;
			// const atlas = `${bzSymbolRoot}/statics/Symbol${i}_${suffix}.atlas`;
			// const json = `${bzSymbolRoot}/statics/Symbol${i}_${suffix}.json`;
			symbolImages[helperKey] = spritePath;
			symbolImages[fallbackKey] = spritePath;
		}

		// Multiplier overlays (PNG numbers shown in front of the multiplier symbol)
		// Mapping:
		// 10->2, 11->3, 12->4, 13->5, 14->6, 15->8, 16->10,
		// 17->12, 18->15, 19->20, 20->25, 21->50, 22->100
		const overlayMap: { [value: number]: string } = {
			10: '2',
			11: '3',
			12: '4',
			13: '5',
			14: '6',
			15: '8',
			16: '10',
			17: '12',
			18: '15',
			19: '20',
			20: '25',
			21: '50',
			22: '100'
		};
		Object.entries(overlayMap).forEach(([valueStr, label]) => {
			const value = Number(valueStr);
			const key = `multiplier_overlay_${value}`;
			const path = `${bzSymbolRoot}/multiplier_symbols/${label}.webp`;
			symbolImages[key] = path;
			console.log(`[AssetConfig] Multiplier overlay ${value}: ${path}`);
		});
		
		// Symbol removal / tumble VFX (smoke)
		symbolSpine['Smoke_VFX_MT'] = {
			atlas: `${prefix}/vfx/Smoke_VFX_MT.atlas`,
			json: `${prefix}/vfx/Smoke_VFX_MT.json`
		};
		console.log('[AssetConfig] Smoke VFX spine: Smoke_VFX_MT');

		return {
			images: symbolImages,
			spine: symbolSpine
		};
	}

	getButtonAssets(): AssetGroup {
		// Controller buttons now follow portrait/landscape structure
		const screenConfig = this.screenModeManager.getScreenConfig();
		const isHighSpeed = this.networkManager.getNetworkSpeed();
		const quality = isHighSpeed ? 'high' : 'low';
		const screenMode = screenConfig.isPortrait ? 'portrait' : 'landscape';

		console.log(`[AssetConfig] Loading controller buttons with quality: ${quality}, screen mode: ${screenMode}`);

		return {
			images: {
				'autoplay_off': `assets/controller/${screenMode}/${quality}/autoplay_off.png`,
				'autoplay_on': `assets/controller/${screenMode}/${quality}/autoplay_on.png`,
				'decrease_bet': `assets/controller/${screenMode}/${quality}/decrease_bet.png`,
				'increase_bet': `assets/controller/${screenMode}/${quality}/increase_bet.png`,
				'menu': `assets/controller/${screenMode}/${quality}/menu.png`,
				'spin': `assets/controller/${screenMode}/${quality}/spin_bg.png`,
				'spin_icon': `assets/controller/${screenMode}/${quality}/spin_icon.png`,
				'autoplay_stop_icon': `assets/controller/${screenMode}/${quality}/autoplay_stop_icon.png`,
				'turbo_off': `assets/controller/${screenMode}/${quality}/turbo_off.png`,
				'turbo_on': `assets/controller/${screenMode}/${quality}/turbo_on.png`,
				'amplify': `assets/controller/${screenMode}/${quality}/amplify.png`,
				'feature': `assets/controller/${screenMode}/${quality}/buy_feature.png`,
				'long_button': `assets/controller/${screenMode}/${quality}/long_button.png`,
				'maximize': `assets/controller/${screenMode}/${quality}/maximize.png`,
				'minimize': `assets/controller/${screenMode}/${quality}/minimize.png`,
				// Free round button background (currently only available as portrait/high asset)
				// We reference it directly so it can be used in all modes without additional variants.
				'freeround_bg': `assets/controller/portrait/high/freeround_bg.png`,
				// "Spin Now" button for free round reward panel (portrait/high only asset)
				'spin_now_button': `assets/controller/portrait/high/spin_now_button.png`,
			},
			spine: {
				'spin_button_animation': {
					atlas: `assets/controller/${screenMode}/${quality}/spin_button_anim/spin_button_anim.atlas`,
					json: `assets/controller/${screenMode}/${quality}/spin_button_anim/spin_button_anim.json`
				},
				// Free-round specific spin button animation (portrait/high only asset)
				// Used instead of the normal spin_button_animation while in initialization
				// free-round spins mode.
				'fr_spin_button_animation': {
					atlas: `assets/controller/portrait/high/Button_Bonus_Buttom/Button_Bonus_VFX.atlas`,
					json: `assets/controller/portrait/high/Button_Bonus_Buttom/Button_Bonus_VFX.json`
				},
				'button_animation_idle': {
					atlas: `assets/controller/${screenMode}/${quality}/button_animation_idle/button_animation_idle.atlas`,
					json: `assets/controller/${screenMode}/${quality}/button_animation_idle/button_animation_idle.json`
				},
				'amplify_bet': {
					atlas: `assets/portrait/high/amplify_bet/Amplify Bet.atlas`,
					json: `assets/portrait/high/amplify_bet/Amplify Bet.json`
				},
				// Enhance Bet idle loop (available only in portrait/high for now)
				'enhance_bet_idle_on': {
					atlas: `assets/controller/portrait/high/enhanceBet_idle_on/Amplify Bet.atlas`,
					json: `assets/controller/portrait/high/enhanceBet_idle_on/Amplify Bet.json`
				},
				'turbo_animation': {
					atlas: `assets/controller/${screenMode}/${quality}/turbo_animation/Turbo_Spin.atlas`,
					json: `assets/controller/${screenMode}/${quality}/turbo_animation/Turbo_Spin.json`
				}
			}
		};
	}

	getFontAssets(): AssetGroup {
		console.log(`[AssetConfig] Loading font assets`);

		return {
			fonts: {
				'poppins-bold': 'assets/fonts/poppins/Poppins-Bold.ttf',
				'poppins-regular': 'assets/fonts/poppins/Poppins-Regular.ttf'

			}
		};
	}

	getMenuAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		return {
			images: {
				// Menu tab icons
				'menu_info': `${prefix}/menu/Info.png`,
				'menu_history': `${prefix}/menu/History.png`,
				'menu_settings': `${prefix}/menu/Settings.png`,
				// Pagination and loading
				'icon_left': `${prefix}/menu/icon_left.png`,
				'icon_most_left': `${prefix}/menu/icon_most_left.png`,
				'icon_right': `${prefix}/menu/icon_right.png`,
				'icon_most_right': `${prefix}/menu/icon_most_right.png`,
				'loading_icon': `${prefix}/menu/loading.png`,
				// Close icon (portrait/high specific path)
				'menu_close': `assets/controller/portrait/high/close.png`
			}
		};
	}

	getHelpScreenAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		return {
			images: {
				// Payline visuals
				'help_tumbles_win': `${prefix}/help_screen/game_settings_content/help_tumbles_win.webp`,
				'help_tumbles_no-win': `${prefix}/help_screen/game_settings_content/help_tumbles_no-win.webp`,

				// Scatter / Tumble / Multiplier visuals
				'scatterGame': `${prefix}/help_screen/bonus_game_content/scatter_game.webp`,
				'tumbleWin': `${prefix}/help_screen/bonus_game_content/tumble_win.webp`,
				'multiplierGame': `${prefix}/help_screen/bonus_game_content/multiplier_game.webp`,

				// How To Play || Bet controls
				'betControlsMinus': `${prefix}/help_screen/how_to_play_content/betControls_minus.png`,
				'betControlsPlus': `${prefix}/help_screen/how_to_play_content/betControls_plus.png`,

				// How To Play || Game actions
				'spin_button': `${prefix}/help_screen/how_to_play_content/spin_button.png`,
				'enhanced_bet_button': `${prefix}/help_screen/how_to_play_content/enhanced_bet.png`,
				'amplify_bet_button': `${prefix}/help_screen/how_to_play_content/enhanced_bet.png`,
				'autoplay_button': `${prefix}/help_screen/how_to_play_content/autoplay.png`,
				'turbo_button': `${prefix}/help_screen/how_to_play_content/turbo.png`,

				// How To Play || General controls
				'sound_icon_on': `${prefix}/help_screen/how_to_play_content/sound_icon_on.png`,
				'sound_icon_off': `${prefix}/help_screen/how_to_play_content/sound_icon_off.png`,
				'settings_icon': `${prefix}/help_screen/how_to_play_content/settings.png`,
				'info_icon': `${prefix}/help_screen/how_to_play_content/info.png`,

				// Package 1 specific assets
				'help_multiplier_symbol': `${prefix}/help_screen/bonus_game_content/help_multiplier_symbol.webp`,
			}
		};
	}

	getDialogAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();

		console.log(`[AssetConfig] Loading dialog assets with prefix: ${prefix}`);

		return {
			spine: {
				'Congrats_BZ': {
					atlas: `${prefix}/dialogs/Congrats_BZ.atlas`,
					json: `${prefix}/dialogs/Congrats_BZ.json`
				},
				'BigW_MT': {
					atlas: `${prefix}/dialogs/BigW_MT.atlas`,
					json: `${prefix}/dialogs/BigW_MT.json`
				},
				'MegaW_MT': {
					atlas: `${prefix}/dialogs/MegaW_MT.atlas`,
					json: `${prefix}/dialogs/MegaW_MT.json`
				},
				'EpicW_MT': {
					atlas: `${prefix}/dialogs/EpicW_MT.atlas`,
					json: `${prefix}/dialogs/EpicW_MT.json`
				},
				'SuperW_MT': {
					atlas: `${prefix}/dialogs/SuperW_MT.atlas`,
					json: `${prefix}/dialogs/SuperW_MT.json`
				},
				'TotalW_BZ': {
					atlas: `${prefix}/dialogs/TotalW_BZ.atlas`,
					json: `${prefix}/dialogs/TotalW_BZ.json`
				},
				// Total win overlay notes animation (uses TotalW_BZ atlas pages)
				'TotalW_BZ_meow': {
					atlas: `${prefix}/dialogs/TotalW_BZ.atlas`,
					json: `${prefix}/dialogs/cats meow.json`
				},
				'FreeSpin_BZ': {
					atlas: `${prefix}/dialogs/FreeSpin_BZ.atlas`,
					json: `${prefix}/dialogs/FreeSpin_BZ.json`
				},
				'FreeSpinRetri_BZ': {
					atlas: `${prefix}/dialogs/FreeSpinRetri_BZ.atlas`,
					json: `${prefix}/dialogs/FreeSpinRetri_BZ.json`
				}
			}
		};
	}

	getForegroundAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		return {
			spine: {}
		};
	}

	/**
	 * Scatter Anticipation assets – only available in portrait/high for now.
	 * We intentionally do not use getAssetPrefix() to avoid missing assets on low quality.
	 */
	getScatterAnticipationAssets(): AssetGroup {
		console.log('[AssetConfig] Loading Scatter Anticipation assets');
		return {
			spine: {}
		};
	}

	getNumberAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();

		console.log(`[AssetConfig] Loading number assets with prefix: ${prefix}`);

		// Generate number assets for digits 0-9, plus comma and dot
		const numberImages: { [key: string]: string } = {};

		// Add digit images (0-9)
		for (let i = 0; i <= 9; i++) {
			const key = `number_${i}`;
			const path = `${prefix}/numbers/Number${i}.webp`;
			numberImages[key] = path;
			console.log(`[AssetConfig] Number ${key}: ${path}`);
		}

		// Add comma and dot
		numberImages['number_comma'] = `${prefix}/numbers/comma.webp`;
		numberImages['number_dot'] = `${prefix}/numbers/dot.webp`;

		console.log(`[AssetConfig] Number comma: ${prefix}/numbers/comma.webp`);
		console.log(`[AssetConfig] Number dot: ${prefix}/numbers/dot.webp`);

		return {
			images: numberImages
		};
	}

	getBuyFeatureAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();

		console.log(`[AssetConfig] Loading buy feature assets with prefix: ${prefix}`);

		return {
			images: {
				'buy_feature_logo': `${prefix}/buy_feature/buy_feature_logo.webp`,
				'buy_feature_bg': `${prefix}/buy_feature/buy_feature_bg.webp`,
			}
		};
	}

	//-------------------------
	// Audio assets
	//-------------------------

	getAudioAssets(): AssetGroup {
		console.log(`[AssetConfig] Loading audio assets`);

		return {
      audio: {
        // Menu/UI clicks
        click: "assets/sounds/SFX/click_1.ogg",
        //BG sounds
        mainbg: "assets/sounds/BG/normalbg_MT.ogg",
        bonusbg: "assets/sounds/BG/bonusbg_MT.ogg",
        freespinbg: "assets/sounds/BG/freespinbg_MT.ogg",
        spinb: "assets/sounds/SFX/spin_MT.ogg",
        reeldrop: "assets/sounds/SFX/reeldrop_MT.ogg",
        scatterdrop1: "assets/sounds/SFX/symbol_win/scatter_drop_1.ogg",
        scatterdrop2: "assets/sounds/SFX/symbol_win/scatter_drop_2.ogg",
        scatterdrop3: "assets/sounds/SFX/symbol_win/scatter_drop_3.ogg",
        scatterdrop4: "assets/sounds/SFX/symbol_win/scatter_drop_4.ogg",
        turbodrop: "assets/sounds/SFX/turbodrop_MT.ogg",
        // Scatter win SFX (paper_roll) – played when scatter win animation runs
        paper_roll: "assets/sounds/SFX/paper_roll_BB.ogg",
        // Multiplier trigger / bomb SFX (bonus-mode multipliers)
        bomb: "assets/sounds/SFX/tbomb_MT.ogg",
        tbomb: "assets/sounds/SFX/tbomb_MT.ogg",
        // Radial light transition whistle SFX
        whistle: "assets/sounds/SFX/whistle_BB.ogg",
        scatter: "assets/sounds/SFX/scatter_BB.ogg",
        // Tumble symbol-win SFX (play per tumble index)
        hitwin1: "assets/sounds/SFX/symbol_win/hitwin_1_MT.ogg",
        hitwin2: "assets/sounds/SFX/symbol_win/hitwin_2_MT.ogg",
        hitwin3: "assets/sounds/SFX/symbol_win/hitwin_1_MT.ogg",
        hitwin4: "assets/sounds/SFX/symbol_win/hitwin_2_MT.ogg",
        // Win dialog SFX
        bigw: "assets/sounds/Wins/bigw_MT.ogg",
        megaw: "assets/sounds/Wins/megaw_MT.ogg",
        superw: "assets/sounds/Wins/superw_MT.ogg",
        epicw: "assets/sounds/Wins/epicw_MT.ogg",
        congrats: "assets/sounds/Wins/totalw_MT.ogg",
        maxw: "assets/sounds/Wins/maxw_MT.ogg",
      },
    };
	}

	// Helper method to get all assets for a scene
	getAllAssets(): { [key: string]: AssetGroup } {
		return {
			background: this.getBackgroundAssets(),
			bonusBackground: this.getBonusBackgroundAssets(),
			header: this.getHeaderAssets(),
			bonusHeader: this.getBonusHeaderAssets(),
			loading: this.getLoadingAssets(),
			symbols: this.getSymbolAssets(),
			buttons: this.getButtonAssets(),
			fonts: this.getFontAssets(),
			dialogs: this.getDialogAssets(),
			numbers: this.getNumberAssets(),
			buyFeature: this.getBuyFeatureAssets(),
			audio: this.getAudioAssets(),
		};
	}

	// Method to get debug info
	getDebugInfo(): void {
		const prefix = this.getAssetPrefix();
		console.log(`[AssetConfig] Asset prefix: ${prefix}`);
		console.log(`[AssetConfig] Available asset groups:`, Object.keys(this.getAllAssets()));
	}
} 
