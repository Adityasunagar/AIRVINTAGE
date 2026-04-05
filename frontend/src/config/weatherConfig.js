/**
 * Weather Configuration - Centralized settings for weather system
 * This separates concerns and makes the system easily configurable
 */

export const WEATHER_CONFIG = {
	// Default condition used as fallback
	DEFAULT_CONDITION: 'clear',

	// Transition duration (ms) for background changes
	TRANSITION_DURATION: 800,

	// Enable debug logging in development
	DEBUG_MODE: process.env.NODE_ENV === 'development',

	// Weather condition keywords mapping
	CONDITIONS: {
		CLEAR: 'clear',
		CLOUDY: 'cloudy',
		RAINY: 'rainy',
		STORM: 'storm',
		FOG: 'fog'
	},

	// CSS class prefix
	CLASS_PREFIX: 'weather-',

	// Animation settings
	ANIMATIONS: {
		RAIN_DURATION: 3000,
		STORM_DURATION: 4000,
		FOG_DURATION: 2000
	},

	// Performance settings
	PERFORMANCE: {
		USE_RAF: true, // Use requestAnimationFrame for updates
		DEBOUNCE_UPDATE: 300, // ms - prevent rapid updates
		CACHE_CONDITION: true // Cache previous condition to prevent redundant updates
	}
};

/**
 * Get CSS class name for weather condition
 */
export const getWeatherClass = (condition) => {
	return `${WEATHER_CONFIG.CLASS_PREFIX}${condition}`;
};

/**
 * Validate weather condition
 */
export const isValidCondition = (condition) => {
	return Object.values(WEATHER_CONFIG.CONDITIONS).includes(condition);
};
