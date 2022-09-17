import { Prisma, prisma } from "../prismaClient";

export type AssetMap = Record<string, number>;

export function tokenNameToAsset(tokenName: string): {
  policyId: string;
  assetName: string;
} {
  const [policyId, assetName] = tokenName.split(".", 2);

  // The tokenName can be either of form `policyId.assetName`
  // or just `policyId` if the assetName is empty, in that case
  // instead of returning undefined for assetName return empty string
  return { policyId: policyId || "", assetName: assetName || "" };
}

export const assetToTokenName = ({
  policyId,
  assetName,
}: {
  policyId: string;
  assetName: string;
}) =>
  // If the assetName is empty return just the policyId without the dot
  assetName === "" ? policyId : `${policyId}.${assetName}`;

function assetToDbValue(tokenName: string) {
  const { policyId, assetName } = tokenNameToAsset(tokenName);
  return Prisma.sql`(DECODE(${policyId}, 'hex'), DECODE(${assetName}, 'hex'))`;
}

/**
 * Insert the assets specified by `tokenNames` into DB, ignore duplicate entries.
 * Returns object mapping `tokenName` to its `id` in database
 */
export const insertAssets = async (tokenNames: string[]): Promise<AssetMap> => {
  if (tokenNames.length === 0) {
    return {};
  }

  const values = Prisma.sql`VALUES ${Prisma.join(
    tokenNames.map(assetToDbValue),
    ","
  )}`;

  // policyId and assetName are not returned as Buffers but as base64 strings
  const res = await prisma.$queryRaw<
    { id: number; policyId: string; assetName: string }[]
  >`
WITH new_assets (policyId, assetName) AS (
  ${values}
), ins AS (
  INSERT INTO "Asset" ("policyId", "assetName")
  SELECT policyId, assetName FROM new_assets
  ON CONFLICT ("policyId", "assetName") DO NOTHING
  RETURNING *
)
SELECT id, "policyId", "assetName" FROM ins UNION
SELECT id, "policyId", "assetName" FROM "Asset" INNER JOIN new_assets ON "policyId"=policyId AND "assetName"=assetName`;

  return Object.fromEntries(
    res.map(
      ({ id, policyId, assetName }) =>
        [
          assetToTokenName({
            policyId: Buffer.from(policyId, "base64").toString("hex"),
            assetName: Buffer.from(assetName, "base64").toString("hex"),
          }),
          id,
        ] as const
    )
  );
};
