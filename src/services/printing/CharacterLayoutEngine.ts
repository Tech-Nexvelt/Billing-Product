/**
 * CharacterLayoutEngine
 * Pure TypeScript character-based layout engine for fixed-width thermal receipt formatting.
 * Handles exact column wrapping, left/right justification, and line dividers.
 */
export class CharacterLayoutEngine {
  /**
   * Formats a line with left-aligned label and right-aligned value within exact column width.
   * e.g. formatLine("Chicken Pizza", "RS 420.00", 42) => "Chicken Pizza                      RS 420.00"
   */
  static formatLine(left: string, right: string, maxCols: number = 42): string {
    const totalLength = left.length + right.length;
    if (totalLength >= maxCols) {
      const availableForLeft = Math.max(1, maxCols - right.length - 1);
      left = left.substring(0, availableForLeft);
    }
    const spaces = ' '.repeat(Math.max(1, maxCols - left.length - right.length));
    return left + spaces + right;
  }

  /**
   * Formats centered text padded on both sides to fill maxCols.
   */
  static formatCenter(text: string, maxCols: number = 42): string {
    if (text.length >= maxCols) return text.substring(0, maxCols);
    const leftPadding = Math.floor((maxCols - text.length) / 2);
    const rightPadding = maxCols - text.length - leftPadding;
    return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
  }

  /**
   * Generates a repeated character divider line.
   * e.g. formatDivider("-", 42) => "------------------------------------------"
   */
  static formatDivider(char: string = '-', maxCols: number = 42): string {
    return char.repeat(maxCols);
  }

  /**
   * Wraps long text into multiple lines of at most maxCols length with proper indent.
   */
  static wrapText(text: string, maxCols: number = 42, indentSpaces: number = 0): string[] {
    const lines: string[] = [];
    const indent = ' '.repeat(indentSpaces);
    const effectiveWidth = maxCols - indentSpaces;

    if (effectiveWidth <= 5) return [text];

    const words = text.split(' ');
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + (currentLine ? ' ' : '') + word).length <= effectiveWidth) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(indent + currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(indent + currentLine);
    }

    return lines.length > 0 ? lines : [indent + text];
  }
}
