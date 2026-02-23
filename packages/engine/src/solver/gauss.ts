/**
 * Gaussian elimination with partial pivoting.
 * Solves A·x = b in-place on a dense matrix.
 *
 * Returns null if the matrix is (near-)singular (floating node, etc.).
 */
export function gaussianElim(
  A: number[][],
  b: number[]
): number[] | null {
  const n = b.length;

  // Build augmented matrix [A | b]
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(M[row][col]);
      if (v > maxVal) { maxVal = v; maxRow = row; }
    }
    if (maxVal < 1e-12) return null; // singular

    if (maxRow !== col) {
      [M[col], M[maxRow]] = [M[maxRow], M[col]];
    }

    const pivot = M[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / pivot;
      if (factor === 0) continue;
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  // Back-substitution
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
    x[i] = sum / M[i][i];
  }
  return x;
}

/** Allocate an n×n zero matrix */
export const zeroMatrix = (n: number): number[][] =>
  Array.from({ length: n }, () => new Array<number>(n).fill(0));

/** Allocate an n-vector of zeros */
export const zeroVec = (n: number): number[] =>
  new Array<number>(n).fill(0);
