# Mobile Swipe Navigation

## Overview

Mobile users can now swipe left or right to navigate between sessions in the viewport, just like clicking the next/previous buttons on the status bar.

## Implementation Details

### Gesture Detection

- **Swipe threshold**: 75px minimum horizontal movement
- **Vertical tolerance**: 50px maximum vertical movement
- **Swipe anywhere**: The entire session viewport is swipeable
- **Smart detection**: Distinguishes between scrolling and swiping

### User Experience

- **Left swipe**: Navigate to next session
- **Right swipe**: Navigate to previous session
- **No visual clutter**: No visible swipe zones or indicators
- **Simple animation**: Clean horizontal slide transition (250ms)
- **Non-intrusive**: Doesn't interfere with:
  - Vertical scrolling in Claude chat
  - Terminal scrolling
  - Text selection
  - Copy/paste operations

### Technical Implementation

#### Touch Event Handling

```javascript
// Simplified swipe detection
function handleSwipeGesture() {
	const swipeThreshold = 75; // Minimum distance
	const verticalThreshold = 50; // Max vertical movement

	if (deltaX < -swipeThreshold) {
		nextMobileSession(); // Left swipe
	}
	if (deltaX > swipeThreshold) {
		prevMobileSession(); // Right swipe
	}
}
```

#### Animation

- Mobile: Horizontal slide (x: ±50px)
- Desktop: Vertical slide (y: ±20px)
- Duration: 250ms in, 200ms out
- Easing: cubic-out for smooth deceleration

## Testing

### Manual Testing Steps

1. **Setup**
   - Open the application on a mobile device or mobile emulator
   - Create multiple sessions (at least 2-3)

2. **Basic Swipe Navigation**
   - Swipe left to go to next session
   - Swipe right to go to previous session
   - Verify session counter updates (e.g., "2 / 3")

3. **Edge Cases**
   - At first session: Right swipe should do nothing
   - At last session: Left swipe should do nothing
   - With single session: Swipes should do nothing

4. **Non-interference Tests**
   - In Claude pane: Vertical scrolling should work normally
   - In Terminal: Scrolling should work normally
   - Text selection should work without triggering swipes
   - Diagonal swipes (more vertical than horizontal) should be ignored

5. **Animation Quality**
   - Sessions should slide smoothly horizontally
   - No janky or stuttering animations
   - Clean transitions between sessions

### Browser Compatibility

- iOS Safari: ✓ Tested
- Chrome Mobile: ✓ Tested
- Firefox Mobile: ✓ Tested
- Desktop browsers: Swipe disabled (use buttons/keyboard)

## Configuration

No configuration needed - swipe navigation is automatically enabled on mobile devices based on viewport detection.

## Known Limitations

1. **Touch-only**: Only works with touch input, not mouse dragging on desktop
2. **Mobile-only**: Automatically disabled on desktop viewports
3. **Session count**: Performance optimal with < 10 sessions

## Future Enhancements

Potential improvements for future iterations:

- Velocity-based swipe detection for quicker gestures
- Partial swipe preview (peek at adjacent session)
- Haptic feedback on successful swipe (if supported)
- Keyboard shortcuts for desktop (already exists with arrow keys)

## Troubleshooting

**Issue**: Swipes not working

- Ensure you're on a mobile device or mobile viewport
- Check that multiple sessions exist
- Try swiping with more horizontal movement

**Issue**: Accidentally triggering swipes while scrolling

- The system requires predominantly horizontal movement
- Try scrolling more vertically

**Issue**: Swipe feels unresponsive

- Increase swipe distance (current threshold: 75px)
- Ensure finger stays relatively horizontal during swipe
