// One door to the pixelfx library: the core, plus a registry of effect modules loaded up front.
export * from "./vendor/pixelfx/core/index.js";

export const FX = {};

/** Load effect modules by id ("fire/fireball"); resolves when all are in FX. */
export async function loadFx(ids) {
  await Promise.all(
    [...new Set(ids)].filter((id) => !FX[id]).map(async (id) => {
      FX[id] = await import(`./vendor/pixelfx/fx/${id}.js`);
    }),
  );
}
