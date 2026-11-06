// Little pixel glyphs for the in-run upgrade cards, drawn once into data URLs.
const G = {
  sword:  ["......##", ".....###", "....###.", "#..###..", ".####...", "..##....", ".#.##...", "#...#..."],
  heart:  [".##..##.", "########", "########", "########", ".######.", "..####..", "...##...", "........"],
  target: ["..####..", ".#....#.", "#..##..#", "#.#..#.#", "#.#..#.#", "#..##..#", ".#....#.", "..####.."],
  hour:   ["########", ".#....#.", "..#..#..", "...##...", "...##...", "..#..#..", ".#.##.#.", "########"],
  boot:   ["..###...", "..###...", "..###...", "..###...", "..####..", "..#####.", ".#######", ".#######"],
  drop:   ["...#....", "...##...", "..###...", ".#####..", ".######.", "#######.", ".#####..", "..###..."],
  shield: ["########", "#.####.#", "#.####.#", "#.####.#", ".#.##.#.", ".#.##.#.", "..#..#..", "...##..."],
  swirl:  ["..####..", ".#....#.", "#..##..#", "#.#..#.#", "#.#.##.#", "#..#...#", ".#....#.", "..####.."],
  fang:   ["########", "########", "#.#..#.#", "#.#..#.#", "..#..#..", "..#..#..", "........", "........"],
  wind:   ["...###..", "......#.", "#######.", "........", "#####...", "......#.", "..####..", "........"],
  burst:  ["#..#..#.", ".#.#.#..", "..###...", "#######.", "..###...", ".#.#.#..", "#..#..#.", "........"],
  gem:    ["..####..", ".#.##.#.", "########", ".#.##.#.", "..#..#..", "...##...", "........", "........"],
  skull:  [".######.", "########", "#..##..#", "#..##..#", "########", ".##..##.", ".#.##.#.", "........"],
  wing:   ["#.......", "##......", "###.....", "####....", "#####...", "######..", ".######.", "..######"],
};
const ICON = { atk: "sword", atk2: "sword", hp: "heart", heal: "heart", regen: "heart", crit: "target", critd: "target", cdr: "hour", cdr2: "hour", ult: "hour", spd: "boot", leech: "drop", armor: "shield", aff: "swirl", killheal: "fang", dashbuff: "wind", echo: "burst", loot: "gem", fury: "skull", second: "wing" };

const cache = new Map();
/** A 24 px icon for a card id, in the card's grade colour with a light top edge and a dark rim. */
export function cardIcon(id, color) {
  const key = id + color;
  if (cache.has(key)) return cache.get(key);
  const rows = G[ICON[id] ?? "burst"], S = 3, W = 8 * S + 2;
  const c = document.createElement("canvas"); c.width = W; c.height = W;
  const x = c.getContext("2d");
  const at = (i, j) => rows[j]?.[i] === "#";
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    if (!at(i, j)) continue;
    x.fillStyle = "#08070c"; x.fillRect(i * S, j * S + 1, S + 2, S + 2);
  }
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    if (!at(i, j)) continue;
    x.fillStyle = color; x.fillRect(i * S + 1, j * S + 1, S, S);
    if (!at(i, j - 1)) { x.fillStyle = "#ffffffaa"; x.fillRect(i * S + 1, j * S + 1, S, 1); }
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}
