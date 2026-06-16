const { clampFontSizeValue, getFontSizeFromSlider } = require('../js/ui-handlers.js');

describe('clampFontSizeValue', () => {
  test('returns clamped value within range', () => {
    expect(clampFontSizeValue(50)).toBe(50);
    expect(clampFontSizeValue(200)).toBe(200);
    expect(clampFontSizeValue(5)).toBe(8); // assuming min 8
    expect(clampFontSizeValue(300)).toBe(200); // assuming max 200
  });

  test('returns null for invalid input', () => {
    expect(clampFontSizeValue('abc')).toBe(null);
    expect(clampFontSizeValue(null)).toBe(null);
  });
});

describe('getFontSizeFromSlider', () => {
  test('returns default value', () => {
    expect(getFontSizeFromSlider()).toBe(64);
    expect(getFontSizeFromSlider(50)).toBe(50);
  });
});