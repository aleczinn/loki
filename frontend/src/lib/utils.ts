/**
 * Returns a number whose value is limited to the given range.
 * @param value the value that should be clamped
 * @param min min The lower boundary of the output range
 * @param max max The upper boundary of the output range
 * @return A number in the range [min, max]
 */
export function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}