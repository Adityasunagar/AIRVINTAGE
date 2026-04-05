import { useEffect, useCallback, useRef } from 'react';

/**
 * Weather condition mapper with fallback strategies
 * Maps various weather API outputs to background classes
 */
const WEATHER_MAPPING = {
	clear: ['clear', 'sunny', 'sunny day', 'partly clear'],
	cloudy: ['cloud', 'cloudy', 'overcast', 'partly cloudy', 'scattered clouds'],
	rainy: ['rain', 'rainy', 'drizzle', 'light rain', 'moderate rain', 'heavy rain', 'showers'],
	storm: ['storm', 'thunderstorm', 'tornado', 'severe', 'extreme'],
	fog: ['fog', 'mist', 'foggy', 'haze', 'visibility']
};

/**
 * Custom hook to manage weather-based background changes
 * Optimized for production with memoization and error handling
 */
export function useWeatherBackground(weatherData) {
	const skyBackgroundRef = useRef(null);
	const previousConditionRef = useRef(null);
	const updateTimeoutRef = useRef(null);

	/**
	 * Normalize weather condition to a standard format
	 * Uses fuzzy matching for robustness
	 */
	const normalizeCondition = useCallback((condition) => {
		if (!condition || typeof condition !== 'string') {
			console.warn('Invalid condition provided:', condition);
			return 'clear'; // Safe default
		}

		const normalizedInput = condition.toLowerCase().trim();

		// Check each weather type
		for (const [weatherType, keywords] of Object.entries(WEATHER_MAPPING)) {
			if (keywords.some(keyword => normalizedInput.includes(keyword))) {
				return weatherType;
			}
		}

		// Fallback to clear if no match
		console.warn(`Unknown weather condition: "${condition}", defaulting to clear`);
		return 'clear';
	}, []);

	/**
	 * Apply weather class to background element
	 * Uses requestAnimationFrame for optimal performance
	 */
	const applyWeatherClass = useCallback((normalizedCondition) => {
		// Prevent unnecessary DOM updates
		if (previousConditionRef.current === normalizedCondition) {
			return;
		}

		// Clear previous timeout to prevent race conditions
		if (updateTimeoutRef.current) {
			clearTimeout(updateTimeoutRef.current);
		}

		// Use requestAnimationFrame for smooth transitions
		updateTimeoutRef.current = requestAnimationFrame(() => {
			const skyBg = document.querySelector('.sky-background');
			
			if (!skyBg) {
				console.warn('Sky background element not found');
				return;
			}

			try {
				// Remove all weather classes
				const weatherClasses = Array.from(skyBg.classList).filter(
					cls => cls.startsWith('weather-')
				);
				weatherClasses.forEach(cls => skyBg.classList.remove(cls));

				// Add new weather class with proper naming
				const className = `weather-${normalizedCondition}`;
				skyBg.classList.add(className);

				// Update reference to prevent redundant updates
				previousConditionRef.current = normalizedCondition;

				// Log for debugging (can be disabled in production)
				if (process.env.NODE_ENV === 'development') {
					console.debug(`Weather background updated: ${className}`);
				}
			} catch (error) {
				console.error('Failed to update weather background:', error);
			}
		});
	}, []);

	/**
	 * Main effect hook - manages weather condition updates
	 */
	useEffect(() => {
		if (!weatherData?.condition) {
			return;
		}

		const normalizedCondition = normalizeCondition(weatherData.condition);
		applyWeatherClass(normalizedCondition);

		// Cleanup function
		return () => {
			if (updateTimeoutRef.current) {
				cancelAnimationFrame(updateTimeoutRef.current);
			}
		};
	}, [weatherData?.condition, normalizeCondition, applyWeatherClass]);

	/**
	 * Initialize sky background element reference
	 */
	useEffect(() => {
		skyBackgroundRef.current = document.querySelector('.sky-background');
		
		if (!skyBackgroundRef.current) {
			console.warn('Sky background element not initialized on mount');
		}
	}, []);
}
