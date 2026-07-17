import {
  CompactTypeBytes,
  CompactTypeField,
  CompactTypeJubjubPoint,
  CompactTypeVector,
  degradeToTransient,
  persistentHash,
  transientHash,
  type CompactType,
  type JubjubPoint,
  type MerkleTreeDigest,
  type MerkleTreePath,
} from "@midnight-ntwrk/compact-runtime";

export const MERKLE_TREE_DEPTH = 5;
export const MERKLE_TREE_CAPACITY = 1 << MERKLE_TREE_DEPTH;

const bytes6 = new CompactTypeBytes(6);
const bytes32 = new CompactTypeBytes(32);
const fieldPair = new CompactTypeVector(2, CompactTypeField);
const encoder = new TextEncoder();
const MIDNIGHT_LEAF_DOMAIN = encoder.encode("mdn:lh");

type LeafPreimage<A> = [Uint8Array, A];

export type FixedMerkleTree<A> = Readonly<{
  root: MerkleTreeDigest;
  leaves: readonly A[];
  deriveMembershipPath(leaf: A): MerkleTreePath<A>;
}>;

function leafPreimageType<A>(
  leafType: CompactType<A>,
): CompactType<LeafPreimage<A>> {
  return {
    alignment: () => bytes6.alignment().concat(leafType.alignment()),
    fromValue: (value) => [bytes6.fromValue(value), leafType.fromValue(value)],
    toValue: ([domain, leaf]) =>
      bytes6.toValue(domain).concat(leafType.toValue(leaf)),
  };
}

function merkleLeafDigest<A>(leafType: CompactType<A>, leaf: A): bigint {
  return degradeToTransient(
    persistentHash(leafPreimageType(leafType), [MIDNIGHT_LEAF_DOMAIN, leaf]),
  );
}

function merkleParentDigest(left: bigint, right: bigint): bigint {
  return transientHash(fieldPair, [left, right]);
}

function buildFixedMerkleTree<A>(
  leaves: readonly A[],
  leafType: CompactType<A>,
  equals: (left: A, right: A) => boolean,
  clone: (leaf: A) => A,
): FixedMerkleTree<A> {
  if (leaves.length === 0) {
    throw new RangeError("Merkle tree requires at least one leaf");
  }
  if (leaves.length > MERKLE_TREE_CAPACITY) {
    throw new RangeError(
      `Merkle tree supports at most ${MERKLE_TREE_CAPACITY} leaves`,
    );
  }

  const canonicalLeaves = leaves.map(clone);
  const paddedLeaves = canonicalLeaves.map(clone);
  while (paddedLeaves.length < MERKLE_TREE_CAPACITY) {
    paddedLeaves.push(clone(canonicalLeaves[canonicalLeaves.length - 1]));
  }

  const levels: bigint[][] = [
    paddedLeaves.map((leaf) => merkleLeafDigest(leafType, leaf)),
  ];
  for (let depth = 0; depth < MERKLE_TREE_DEPTH; depth += 1) {
    const current = levels[depth];
    const parent: bigint[] = [];
    for (let index = 0; index < current.length; index += 2) {
      parent.push(merkleParentDigest(current[index], current[index + 1]));
    }
    levels.push(parent);
  }

  return {
    root: { field: levels[MERKLE_TREE_DEPTH][0] },
    leaves: canonicalLeaves,
    deriveMembershipPath: (leaf: A): MerkleTreePath<A> => {
      let index = canonicalLeaves.findIndex((candidate) =>
        equals(candidate, leaf),
      );
      if (index < 0) {
        throw new RangeError("Merkle tree does not contain the requested leaf");
      }

      const path = levels.slice(0, MERKLE_TREE_DEPTH).map((level) => {
        const siblingIndex = index ^ 1;
        const entry = {
          sibling: { field: level[siblingIndex] },
          goes_left: index % 2 === 0,
        };
        index = Math.floor(index / 2);
        return entry;
      });

      return { leaf: clone(leaf), path };
    },
  };
}

function compareBytes(left: Uint8Array, right: Uint8Array): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return compareBytes(left, right) === 0;
}

function comparePoints(left: JubjubPoint, right: JubjubPoint): number {
  if (left.x < right.x) return -1;
  if (left.x > right.x) return 1;
  if (left.y < right.y) return -1;
  if (left.y > right.y) return 1;
  return 0;
}

function equalPoints(left: JubjubPoint, right: JubjubPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

function cloneBytes(value: Uint8Array): Uint8Array {
  return new Uint8Array(value);
}

function clonePoint(value: JubjubPoint): JubjubPoint {
  return { x: value.x, y: value.y };
}

export function buildBytes32MerkleTree(
  leaves: readonly Uint8Array[],
): FixedMerkleTree<Uint8Array> {
  const unique = leaves
    .map((leaf) => {
      if (!(leaf instanceof Uint8Array) || leaf.length !== 32) {
        throw new RangeError("Merkle Bytes<32> leaf must be exactly 32 bytes");
      }
      return cloneBytes(leaf);
    })
    .sort(compareBytes)
    .filter((leaf, index, sorted) =>
      index === 0 ? true : !equalBytes(leaf, sorted[index - 1]),
    );

  return buildFixedMerkleTree(unique, bytes32, equalBytes, cloneBytes);
}

export function buildJubjubPointMerkleTree(
  leaves: readonly JubjubPoint[],
): FixedMerkleTree<JubjubPoint> {
  const unique = leaves
    .map(clonePoint)
    .sort(comparePoints)
    .filter((leaf, index, sorted) =>
      index === 0 ? true : !equalPoints(leaf, sorted[index - 1]),
    );

  return buildFixedMerkleTree(
    unique,
    CompactTypeJubjubPoint,
    equalPoints,
    clonePoint,
  );
}
