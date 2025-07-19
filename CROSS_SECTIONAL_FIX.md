# Cross-Sectional Mode Interruption Fix

## Problem
Cross-sectional mode was exiting prematurely during image switches because the `interruptAllDirectionModes()` function was too aggressive. It would call `exitAutoDirectionMode()` which completely clears the auto direction state, causing the cross-sectional processing to be interrupted.

## Root Cause
The function `interruptAllDirectionModes()` is called in three locations:

1. **Line 309** (loadImage): `this.interruptAllDirectionModes('image_switch')`
2. **Line 463** (clearImage): `this.interruptAllDirectionModes('plant_switch')`  
3. **Line 4790** (handleCustomAnnotationMode): `this.interruptAllDirectionModes('custom_annotation_mode')`

The original implementation would always call `this.exitAutoDirectionMode()` which destroys the cross-sectional state, even when the interruption was just for an image switch.

## Solution
Modified the `interruptAllDirectionModes()` method (lines 5296-5332) to be more selective:

### Before (problematic code):
```javascript
// 中断自动化方向模式
if (this.state.isAutoDirectionMode) {
  this.exitAutoDirectionMode();
}
```

### After (fixed code):
```javascript
// 🔧 FIX: Don't exit auto direction mode during image switch if in cross-sectional mode
// Cross-sectional mode needs to persist across image switches
if (this.state.isAutoDirectionMode) {
  if (this.autoDirectionMode === 'cross-sectional' && reason === 'image_switch') {
    // For cross-sectional mode during image switch, only clear current selection
    // but preserve the overall cross-sectional state and progress
    console.log('[Cross-Sectional] Preserving cross-sectional mode during image switch');
    this.state.selectedKeypoint = null;
    this.state.isDirectionSelectionMode = false;
    this.state.directionSelectionPoint = null;
  } else if (this.autoDirectionMode === 'cross-sectional' && reason === 'custom_annotation_mode') {
    // For cross-sectional mode when entering custom annotation, only pause
    console.log('[Cross-Sectional] Pausing cross-sectional mode for custom annotation');
    this.state.selectedKeypoint = null;
    this.state.isDirectionSelectionMode = false;
    this.state.directionSelectionPoint = null;
  } else {
    // For other cases or longitudinal mode, exit completely
    // This includes plant_switch which should exit cross-sectional mode
    this.exitAutoDirectionMode();
  }
}
```

## Fix Details

### Cross-Sectional Mode + Image Switch:
- **Before**: Complete exit (❌ wrong)
- **After**: Only clear current selection, preserve overall state (✅ correct)

### Cross-Sectional Mode + Custom Annotation:
- **Before**: Complete exit (❌ wrong)  
- **After**: Only pause current selection, preserve overall state (✅ correct)

### Cross-Sectional Mode + Plant Switch:
- **Before**: Complete exit (✅ correct)
- **After**: Complete exit (✅ still correct)

### Longitudinal Mode + Any Switch:
- **Before**: Complete exit (✅ correct)
- **After**: Complete exit (✅ still correct)

## Benefits
1. **Cross-sectional mode persistence**: Users can now switch between images during cross-sectional annotation without losing their progress
2. **Maintains safety**: Plant switches and other scenarios still properly exit modes when appropriate
3. **Backward compatibility**: Longitudinal mode behavior is unchanged
4. **Clear logging**: Added console logs to help debug mode transitions

## Test Verification
Created `test-cross-sectional-fix.js` to verify the fix works correctly for all scenarios.

## Files Modified
- `/src/core/AnnotationTool.js` - Lines 5312-5331: Enhanced `interruptAllDirectionModes()` method