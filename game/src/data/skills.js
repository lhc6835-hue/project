// Every element's moves, per growth stage. Each move is a small timeline around its release (t = 0):
//   fx:    effects to spawn { t, id, dx, dy, follow, dur, opts, ramp: "main"|"ice"|"storm"|"stone", light, at }
//   hits:  instant hit areas { t, box: [x0, x1, depth] | circ: [r, dx], dmg (× attack), kb, up, stop, st }
//   ticks: repeating areas { t0, t1, every, box|circ, dmg, st, pull, at }
//   proj:  projectiles { t, fx, speed, range, r, dmg, pierce, spread, z, hitFx, pull, tick, life }
//   dash:  { t0, t1, dist }   cam: [{ t, shake, flash, dim }]   special: named behaviours
// dx/box distances are in the facing direction. dmg is a multiple of the hero's attack.
// st: statuses { burn, slow, freeze, stun, root } in seconds.

export const SKILLS = {

  light: {
    1: {
      basic: {
        name: "빛의 일섬", desc: "빛으로 된 칼날로 앞을 빠르게 벤다.", pose: "slash", windup: 0.1, recover: 0.26,
        fx: [{ t: -0.1, id: "melee/sword-slash", opts: { radius: 42 } }],
        hits: [{ t: 0.04, box: [0, 50, 17], dmg: 1.0, stop: 0.05, kb: 60 }],
      },
      skills: [{
        name: "심판", desc: "가장 가까운 적에게 빛의 망치를 내리친다.", pose: "point", windup: 0.15, recover: 0.3, cd: 4,
        fx: [{ t: 0, id: "holy/smite", at: "aim", dx: 70, dur: 1.6 }],
        hits: [{ t: 0.7, circ: [30, 70], at: "aim", dmg: 3.0, stop: 0.08, st: { stun: 0.5 } }],
        cam: [{ t: 0.7, shake: 3, flash: 0.15 }],
      }],
    },
    2: {
      basic: {
        name: "성광 회전", desc: "빛을 두르고 회전하며 주위를 벤다.", pose: "spin", windup: 0.1, recover: 0.34,
        fx: [{ t: 0, id: "melee/spin-slash", opts: { radius: 46 } }],
        hits: [{ t: 0.05, circ: [46, 0], dmg: 0.65, stop: 0.03 }, { t: 0.17, circ: [48, 0], dmg: 0.85, stop: 0.08, kb: 90 }],
      },
      skills: [{
        name: "치유의 고리", desc: "빛의 고리를 퍼뜨려 적을 태우고 체력을 회복한다.", pose: "raise", windup: 0.2, recover: 0.3, cd: 8,
        fx: [{ t: 0, id: "holy/heal-aoe", opts: { reach: 100 } }],
        hits: [{ t: 0.3, circ: [100, 0], dmg: 1.6, kb: 80 }],
        special: { kind: "heal", t: 0.3, k: 0.25 },
      }, {
        name: "신성 방패", desc: "빛의 방패로 2.5초간 모든 피해를 막고, 주변을 밀쳐낸다.", pose: "cast", windup: 0.1, recover: 0.25, cd: 11,
        fx: [{ t: 0, id: "holy/divine-shield", follow: true, dur: 2.5 }],
        hits: [{ t: 0.05, circ: [44, 0], dmg: 1.0, kb: 200 }],
        special: { kind: "guard", t: 0, dur: 2.5 },
      }],
    },
    3: {
      basic: {
        name: "천상의 검", desc: "두 팔로 빛의 대검을 내려찍고 깃털을 흩뿌린다.", pose: "cleave", windup: 0.28, recover: 0.42,
        fx: [{ t: -0.28, id: "melee/heavy-cleave", dur: 0.9 }, { t: 0.02, id: "holy/feather-burst", dx: 40, dy: -16, dur: 1.4 }],
        hits: [{ t: 0.0, box: [0, 74, 24], dmg: 1.45, stop: 0.1, kb: 130 }, { t: 0.06, circ: [34, 40], dmg: 0.8 }],
        cam: [{ t: 0, shake: 2 }],
      },
      skills: [{
        name: "빛의 기둥", desc: "하늘에서 거대한 빛의 기둥이 떨어진다.", pose: "raise", windup: 0.2, recover: 0.4, cd: 6,
        fx: [{ t: 0, id: "holy/holy-pillar", at: "aim", dx: 70 }],
        ticks: [{ t0: 0.35, t1: 2.2, every: 0.2, circ: [30, 70], at: "aim", dmg: 0.8, st: { stun: 0.2 } }],
        cam: [{ t: 0.4, shake: 3, flash: 0.2 }],
      }, {
        name: "연속 심판", desc: "가까운 적 넷에게 차례로 빛의 망치를 떨어뜨린다.", pose: "point", windup: 0.15, recover: 0.35, cd: 8,
        special: { kind: "strikes", n: 4, gap: 0.16, delay: 0.7, fx: "holy/smite", r: 28, dmg: 3.2, st: { stun: 0.6 } },
      }],
      ult: {
        name: "천상 강림", desc: "하늘이 열리며 별빛이 전장에 쏟아진다.", pose: "ult", windup: 0.5, recover: 0.5, cd: 26,
        fx: [{ t: -0.3, id: "holy/sunburst", dur: 1.6, dy: -30, follow: true }],
        hits: [{ t: 0.05, circ: [90, 0], dmg: 3, kb: 160, stop: 0.1 }],
        special: { kind: "storm", t: 0.2, life: 4, every: 0.28, fx: "arcane/star-fall", cloud: "holy/halo", r: 40, dmg: 2.6, st: { stun: 0.3 } },
        cam: [{ t: -0.5, dim: 1 }, { t: 0.05, shake: 5, flash: 0.8 }],
      },
    },
  },

  dark: {
    1: {
      basic: {
        name: "그림자 할퀴기", desc: "그림자 발톱으로 앞을 세 번 할퀸다.", pose: "claw", windup: 0.12, recover: 0.3,
        fx: [{ t: 0, id: "melee/claw-swipe" }],
        hits: [{ t: 0.04, box: [2, 46, 16], dmg: 0.42, stop: 0.03 }, { t: 0.08, box: [2, 46, 16], dmg: 0.42, stop: 0.03 }, { t: 0.12, box: [2, 48, 18], dmg: 0.6, stop: 0.07, kb: 60 }],
      },
      skills: [{
        name: "흡혈", desc: "앞의 적에게서 생명력을 빨아들인다.", pose: "cast", windup: 0.15, recover: 0.4, cd: 5,
        fx: [{ t: -0.15, id: "shadow/life-steal" }],
        hits: [{ t: 0.02, box: [10, 110, 18], dmg: 2.4, stop: 0.06 }],
        special: { kind: "heal", t: 1.5, k: 0.12 },
      }],
    },
    2: {
      basic: {
        name: "망령의 낫", desc: "그림자 낫을 크게 휘둘러 앞을 쓸어버린다.", pose: "slash", windup: 0.2, recover: 0.4,
        fx: [{ t: -0.2, id: "melee/scythe-reap", dur: 1.2 }],
        hits: [{ t: 0.14, box: [0, 70, 22], dmg: 1.4, stop: 0.1, kb: 100 }],
      },
      skills: [{
        name: "속박의 손", desc: "땅에서 그림자 손이 솟아 적을 붙잡는다.", pose: "point", windup: 0.15, recover: 0.3, cd: 7,
        fx: [{ t: 0, id: "shadow/grasping-hands", at: "aim", dx: 70, dur: 2.2 }],
        hits: [{ t: 0.4, circ: [44, 70], at: "aim", dmg: 2.0, st: { root: 2.2 } }, { t: 1.2, circ: [44, 70], at: "aim", dmg: 1.2 }],
      }, {
        name: "공허구", desc: "모든 것을 끌어당기는 공허의 구체를 보낸다.", pose: "cast", windup: 0.2, recover: 0.3, cd: 9,
        proj: [{ t: 0, fx: "shadow/void-orb", speed: 60, range: 220, r: 26, dmg: 0, pierce: true, z: 0, tick: 0.2, tickDmg: 0.5, pull: 80, life: 3.6 }],
      }],
    },
    3: {
      basic: {
        name: "그림자 난무", desc: "보이지 않을 만큼 빠르게 그림자를 휘두른다.", pose: "flurry", windup: 0.1, recover: 0.42,
        fx: [{ t: -0.1, id: "melee/dagger-flurry" }, { t: 0.05, id: "shadow/shadow-flames", dur: 0.7, follow: true }],
        hits: [0.05, 0.105, 0.16, 0.215, 0.27, 0.325].map((t) => ({ t, box: [0, 50, 17], dmg: 0.27, stop: 0.012 })).concat([{ t: 0.42, box: [0, 54, 18], dmg: 0.6, stop: 0.08, kb: 90 }]),
      },
      skills: [{
        name: "저주의 인장", desc: "인장을 새겨 그 안의 적을 계속 갉아먹고 느리게 한다.", pose: "raise", windup: 0.2, recover: 0.35, cd: 7,
        fx: [{ t: 0, id: "shadow/hex-sigil", at: "aim", dx: 70 }],
        ticks: [{ t0: 0.6, t1: 3.8, every: 0.3, circ: [40, 70], at: "aim", dmg: 0.7, st: { slow: 1 } }],
      }, {
        name: "해골 군단", desc: "주위를 도는 해골들이 닿는 적을 물어뜯는다.", pose: "cast", windup: 0.15, recover: 0.25, cd: 10,
        special: { kind: "orbit", n: 1, fx: "shadow/necro-skulls", radius: 4, life: 5, tick: 0.25, r: 42, dmg: 0.55 },
      }],
      ult: {
        name: "일식", desc: "태양을 가리고, 어둠 속에서 모든 적을 집어삼킨다.", pose: "ult", windup: 0.5, recover: 0.6, cd: 26,
        fx: [{ t: -0.4, id: "shadow/eclipse", dy: -40, follow: true, dur: 2.4 }, { t: 0.1, id: "shadow/black-hole", at: "aim", dx: 90, dur: 2.6 }, { t: 2.7, id: "shadow/dark-explosion", at: "aim", dx: 90 }],
        ticks: [{ t0: 0.2, t1: 2.6, every: 0.25, circ: [70, 90], at: "aim", dmg: 0.9, pull: 110 }],
        hits: [{ t: 2.7, circ: [90, 90], at: "aim", dmg: 9, kb: 200, stop: 0.15 }],
        cam: [{ t: -0.5, dim: 2.6 }, { t: 2.7, shake: 8, flash: 0.8 }],
      },
    },
  },

  // the developer's spirit: one god-tier kit at every stage
  code: (() => {
    const kit = {
      basic: {
        name: "Ctrl+X 잘라내기", desc: "주변의 모든 것을 글리치와 함께 잘라낸다.", pose: "spin", windup: 0.08, recover: 0.26,
        fx: [{ t: 0, id: "melee/spin-slash", opts: { radius: 60 } }, { t: 0.04, id: "scifi/glitch", dur: 0.5 }],
        hits: [{ t: 0.04, circ: [66, 0], dmg: 1.6, stop: 0.03 }, { t: 0.17, circ: [70, 0], dmg: 2.2, stop: 0.06, kb: 120, st: { stun: 0.3 } }],
      },
      skills: [{
        name: "rm -rf /", desc: "레이저 격자로 앞을 지우고, 체력이 35% 아래인 적은 즉시 삭제한다.", pose: "point", windup: 0.15, recover: 0.3, cd: 5,
        fx: [{ t: 0, id: "scifi/laser-grid", dx: 80, at: "aim", dur: 2.4 }, { t: 0, id: "scifi/scanner", dur: 0.9 }],
        ticks: [{ t0: 0.1, t1: 2.4, every: 0.2, circ: [56, 80], at: "aim", dmg: 2.4, st: { slow: 1 } }],
        special: { kind: "execute", t: 0.6, r: 140, below: 0.35 },
      }, {
        name: "Ctrl+Z 되돌리기", desc: "체력을 전부 되돌리고 3초간 무적, 스킬1을 바로 다시 쓸 수 있게 한다.", pose: "raise", windup: 0.1, recover: 0.3, cd: 9,
        fx: [{ t: 0, id: "scifi/warp-in" }, { t: 0.1, id: "scifi/hologram", dur: 2.5, follow: true }],
        special: { kind: "undo", t: 0.05 },
      }],
      ult: {
        name: "sudo kill -9 *", desc: "시간을 멈추고, 화면 안의 모든 프로세스를 강제 종료한다.", pose: "ult", windup: 0.45, recover: 0.5, cd: 14,
        fx: [{ t: -0.4, id: "arcane/time-stop" }],
        special: { kind: "sudo", t: 0.1, freeze: 1.4, dmg: 45 },
        cam: [{ t: -0.45, dim: 1.6 }],
      },
    };
    return { 1: kit, 2: kit, 3: kit };
  })(),
  fire: {
    1: {
      basic: {
        name: "불꽃 할퀴기", desc: "앞쪽을 불꽃 발톱으로 세 번 할퀸다.", pose: "claw", windup: 0.13, recover: 0.3,
        fx: [{ t: 0, id: "melee/claw-swipe", dx: 0 }],
        hits: [{ t: 0.04, box: [2, 46, 16], dmg: 0.4, stop: 0.03 }, { t: 0.08, box: [2, 46, 16], dmg: 0.4, stop: 0.03 }, { t: 0.12, box: [2, 48, 18], dmg: 0.55, stop: 0.07, kb: 60, st: { burn: 1.5 } }],
      },
      skills: [{
        name: "불씨탄", desc: "짧은 사거리의 불덩이를 던져 작게 폭발시킨다.", pose: "throw", windup: 0.18, recover: 0.25, cd: 3.5,
        proj: [{ t: 0, fx: "fire/fireball", opts: { radius: 4 }, speed: 230, range: 150, r: 9, dmg: 2.4, z: 18, hitFx: "explosions/small-explosion", hitR: 26, hitDmg: 1.2, st: { burn: 2 } }],
      }],
    },
    2: {
      basic: {
        name: "화염 회전베기", desc: "몸을 돌려 주위를 둥글게 불로 벤다.", pose: "spin", windup: 0.12, recover: 0.36,
        fx: [{ t: 0, id: "melee/spin-slash", opts: { radius: 44 } }],
        hits: [{ t: 0.05, circ: [44, 0], dmg: 0.6, stop: 0.03 }, { t: 0.17, circ: [46, 0], dmg: 0.8, stop: 0.09, kb: 90, st: { burn: 2 } }],
      },
      skills: [{
        name: "화염 고리", desc: "발밑에서 불길이 고리처럼 퍼져 나간다.", pose: "slam", windup: 0.3, recover: 0.4, cd: 6,
        fx: [{ t: 0, id: "fire/fire-ring", opts: { reach: 92 } }],
        hits: [{ t: 0.1, circ: [36, 0], dmg: 1.4, kb: 80 }, { t: 0.32, circ: [70, 0], dmg: 1.4, kb: 120, stop: 0.08, st: { burn: 3 } }, { t: 0.6, circ: [96, 0], dmg: 1.0, st: { burn: 3 } }],
        cam: [{ t: 0.32, shake: 3 }],
      }, {
        name: "화염 숨결", desc: "손에서 불길을 뿜어 앞을 태운다.", pose: "channel", windup: 0.15, recover: 1.25, cd: 7, root: 1.25,
        fx: [{ t: 0, id: "fire/fire-breath", dy: -17, dx: 9, dur: 1.2, follow: true }],
        ticks: [{ t0: 0.05, t1: 1.2, every: 0.12, box: [8, 150, 20], dmg: 0.32, st: { burn: 2 } }],
      }],
    },
    3: {
      basic: {
        name: "업화 강타", desc: "두 팔로 내려찍어 앞을 불바다로 만든다.", pose: "cleave", windup: 0.32, recover: 0.5,
        fx: [{ t: -0.32, id: "melee/heavy-cleave", dur: 0.9 }, { t: 0.02, id: "explosions/small-explosion", dx: 44, opts: { size: 0.8 }, dur: 0.7 }],
        hits: [{ t: 0.0, box: [0, 72, 24], dmg: 1.4, stop: 0.12, kb: 140, st: { burn: 3 } }, { t: 0.08, circ: [30, 44], dmg: 0.8 }],
        cam: [{ t: 0, shake: 3 }],
      },
      skills: [{
        name: "불기둥", desc: "앞쪽 땅이 갈라지며 거대한 불기둥이 솟는다.", pose: "raise", windup: 0.2, recover: 0.4, cd: 6,
        fx: [{ t: 0, id: "fire/flame-pillar", dx: 64, at: "aim" }],
        ticks: [{ t0: 0.65, t1: 3.0, every: 0.2, circ: [24, 64], at: "aim", dmg: 0.7, st: { burn: 3 }, up: 40 }],
        cam: [{ t: 0.7, shake: 4 }],
      }, {
        name: "화염 회오리", desc: "적을 빨아들이며 나아가는 불의 회오리.", pose: "cast", windup: 0.2, recover: 0.3, cd: 9,
        proj: [{ t: 0, fx: "fire/fire-tornado", speed: 55, range: 200, r: 26, dmg: 0, pierce: true, z: 0, tick: 0.18, tickDmg: 0.45, pull: 70, life: 3.6, st: { burn: 2 } }],
      }],
      ult: {
        name: "운석 낙하", desc: "불타는 운석을 떨어뜨려 모든 것을 태운다.", pose: "ult", windup: 0.6, recover: 0.6, cd: 26,
        fx: [{ t: -0.1, id: "fire/meteor", dx: 100, at: "aim" }, { t: 0.55, id: "fire/fire-ring", dx: 100, at: "aim", opts: { reach: 110 } }],
        hits: [{ t: 0.52, circ: [90, 100], at: "aim", dmg: 11, kb: 220, stop: 0.18, st: { burn: 5 } }],
        cam: [{ t: -0.6, dim: 1.2 }, { t: 0.52, shake: 8, flash: 0.9 }],
      },
    },
  },

  water: {
    1: {
      basic: {
        name: "물의 활", desc: "물로 빚은 활을 당겨 물살 화살을 쏜다. 맞은 적은 느려진다.", pose: "bow", windup: 0.26, recover: 0.3,
        proj: [{ t: 0, style: "waterArrow", tier: 1, speed: 360, range: 200, r: 6, dmg: 1.0, z: 18, hitFx: "water/splash", kb: 50, st: { slow: 1 } }],
        cam: [{ t: 0, shake: 1.2 }],
      },
            skills: [{
        name: "물보라", desc: "발밑에서 물을 터뜨려 주변 적을 밀쳐내고 느리게 한다.", pose: "stomp", windup: 0.18, recover: 0.3, cd: 4,
        fx: [{ t: 0, id: "water/splash" }, { t: 0.05, id: "water/ripples", dur: 1 }],
        hits: [{ t: 0.05, circ: [50, 0], dmg: 1.6, kb: 170, stop: 0.06, st: { slow: 2.5 } }],
      }],
    },
    2: {
      basic: {
        name: "쌍류 화살", desc: "수류궁으로 물살 화살 두 발을 연달아 쏜다. 화살은 적을 꿰뚫는다.", pose: "bow2", windup: 0.22, recover: 0.36,
        proj: [{ t: 0, style: "waterArrow", tier: 2, speed: 380, range: 230, r: 6, dmg: 0.68, z: 18, pierce: true, hitFx: "water/splash", kb: 40, st: { slow: 1.5 } },
          { t: 0.11, style: "waterArrow", tier: 2, speed: 420, range: 240, r: 6, dmg: 0.68, z: 18, pierce: true, hitFx: "water/splash", kb: 40, st: { slow: 1.5 } }],
        cam: [{ t: 0, shake: 1.2 }, { t: 0.11, shake: 2 }],
      },
            skills: [{
        name: "물줄기", desc: "앞쪽으로 꿰뚫는 물줄기를 쏜다.", pose: "channel", windup: 0.15, recover: 1.0, cd: 6, root: 1.0,
        fx: [{ t: 0, id: "water/water-jet", dy: -17, dx: 8, dur: 0.95, follow: true }],
        ticks: [{ t0: 0.05, t1: 0.95, every: 0.1, box: [8, 130, 14], dmg: 0.35, kb: 25, st: { slow: 1.5 } }],
      }, {
        name: "소용돌이", desc: "적을 한곳으로 빨아들이는 물 소용돌이.", pose: "point", windup: 0.2, recover: 0.3, cd: 9,
        fx: [{ t: 0, id: "water/whirlpool", dx: 70, at: "aim", dur: 3 }],
        ticks: [{ t0: 0.1, t1: 3, every: 0.3, circ: [48, 70], at: "aim", dmg: 0.3, pull: 90, st: { slow: 1 } }],
      }],
    },
    3: {
      basic: {
        name: "격류의 화살", desc: "해신궁을 끝까지 당겨 물살을 휘감은 큰 화살과 곁화살 두 발을 쏜다. 큰 화살은 꿰뚫고, 맞는 곳마다 물보라가 터진다.", pose: "bow3", windup: 0.36, recover: 0.4,
        proj: [{ t: 0, style: "waterArrow", tier: 3, big: true, speed: 400, range: 260, r: 8, dmg: 1.45, z: 18, pierce: true, hitFx: "water/splash", hitR: 22, hitDmg: 0.45, burst: false, kb: 90, st: { slow: 2 } },
          { t: 0.02, style: "waterArrow", tier: 3, speed: 360, range: 200, r: 5, dmg: 0.5, z: 18, spread: -0.14, hitFx: "impacts/hit-spark", st: { slow: 1 } },
          { t: 0.02, style: "waterArrow", tier: 3, speed: 360, range: 200, r: 5, dmg: 0.5, z: 18, spread: 0.14, hitFx: "impacts/hit-spark", st: { slow: 1 } }],
        cam: [{ t: 0, shake: 3.5, flash: 0.12 }],
      },
            skills: [{
        name: "해일", desc: "거대한 파도를 일으켜 앞의 적을 쓸어버린다.", pose: "raise", windup: 0.2, recover: 0.5, cd: 7,
        fx: [{ t: 0, id: "water/wave-crash", dx: 30 }],
        ticks: [{ t0: 0.5, t1: 1.9, every: 0.25, box: [-30, 130, 26], dmg: 0.9, kb: 120, st: { slow: 2 } }],
        cam: [{ t: 1.4, shake: 4 }],
      }, {
        name: "얼음창", desc: "적을 꿰뚫고 얼려 버리는 얼음 창을 던진다.", pose: "throw", windup: 0.2, recover: 0.3, cd: 6,
        proj: [{ t: 0, fx: "ice/ice-lance", ramp: "ice", speed: 320, range: 260, r: 8, dmg: 3.2, pierce: true, z: 18, hitFx: "ice/ice-shatter", st: { freeze: 1.6 } }],
      }],
      ult: {
        name: "절대영도", desc: "주위의 모든 것을 얼려 버리는 냉기의 폭발.", pose: "ult", windup: 0.5, recover: 0.6, cd: 26,
        fx: [{ t: -0.34, id: "ice/frost-nova", ramp: "ice", opts: { reach: 110 } }, { t: 0.2, id: "ice/blizzard-vortex", ramp: "ice", dx: -70, dur: 2.5 }, { t: 0.2, id: "ice/blizzard-vortex", ramp: "ice", dx: 70, dur: 2.5 }],
        hits: [{ t: 0.08, circ: [60, 0], dmg: 5, stop: 0.12 }, { t: 0.32, circ: [116, 0], dmg: 6, st: { freeze: 3.2 } }],
        ticks: [{ t0: 0.3, t1: 2.6, every: 0.3, circ: [36, -70], dmg: 0.6, pull: 40 }, { t0: 0.3, t1: 2.6, every: 0.3, circ: [36, 70], dmg: 0.6, pull: 40 }],
        cam: [{ t: -0.5, dim: 1 }, { t: 0.08, shake: 6, flash: 0.7 }],
      },
    },
  },

  wind: {
    1: {
      basic: {
        name: "바람 칼날", desc: "날카로운 바람으로 앞을 빠르게 벤다.", pose: "slash", windup: 0.1, recover: 0.22,
        fx: [{ t: -0.1, id: "melee/sword-slash", opts: { radius: 40 } }],
        hits: [{ t: 0.04, box: [0, 50, 17], dmg: 0.95, stop: 0.05, kb: 50 }],
      },
      skills: [{
        name: "질풍 돌진", desc: "바람처럼 앞으로 돌진하며 지나는 적을 벤다.", pose: "dash", windup: 0.1, recover: 0.2, cd: 4,
        dash: { t0: 0, t1: 0.14, dist: 92 }, ghost: true,
        fx: [{ t: 0.15, id: "impacts/hit-flash" }],
        ticks: [{ t0: 0, t1: 0.16, every: 0.05, box: [-10, 22, 18], dmg: 0.8, once: true, stop: 0.05 }],
      }],
    },
    2: {
      basic: {
        name: "난도질", desc: "눈에 보이지 않을 만큼 빠르게 연속으로 벤다.", pose: "flurry", windup: 0.1, recover: 0.42,
        fx: [{ t: -0.1, id: "melee/dagger-flurry" }],
        hits: [0.05, 0.105, 0.16, 0.215, 0.27, 0.325].map((t) => ({ t, box: [0, 48, 16], dmg: 0.24, stop: 0.012 })).concat([{ t: 0.42, box: [0, 52, 18], dmg: 0.5, stop: 0.08, kb: 90 }]),
      },
      skills: [{
        name: "회오리", desc: "적을 휘감아 끌고 가는 회오리바람을 보낸다.", pose: "cast", windup: 0.2, recover: 0.3, cd: 7,
        proj: [{ t: 0, fx: "nature/tornado", opts: { height: 80 }, speed: 75, range: 240, r: 24, dmg: 0, pierce: true, z: 0, tick: 0.18, tickDmg: 0.38, pull: 80, life: 3.2 }],
      }, {
        name: "연쇄 번개", desc: "가까운 적부터 차례로 튀어 가는 번개.", pose: "point", windup: 0.15, recover: 0.3, cd: 6,
        special: { kind: "chain", n: 5, range: 120, hop: 90, dmg: 1.7, ramp: "storm", st: { stun: 0.35 } },
      }],
    },
    3: {
      basic: {
        name: "폭풍 회전", desc: "번개를 두르고 돌며 주위를 벤다.", pose: "spin", windup: 0.1, recover: 0.36,
        fx: [{ t: 0, id: "melee/spin-slash", opts: { radius: 46 } }, { t: 0.05, id: "lightning/zap-hit", ramp: "storm" }],
        hits: [{ t: 0.05, circ: [46, 0], dmg: 0.75, stop: 0.03 }, { t: 0.17, circ: [48, 0], dmg: 0.95, stop: 0.08, kb: 90, st: { stun: 0.2 } }],
      },
      skills: [{
        name: "낙뢰", desc: "가까운 적 셋에게 벼락을 떨어뜨린다.", pose: "raise", windup: 0.2, recover: 0.4, cd: 6,
        special: { kind: "strikes", n: 3, gap: 0.18, delay: 0.78, fx: "lightning/lightning-strike", ramp: "storm", r: 22, dmg: 3.6, st: { stun: 0.8 } },
      }, {
        name: "구전", desc: "몸 주위를 도는 번개 구체를 부른다.", pose: "cast", windup: 0.15, recover: 0.25, cd: 10,
        special: { kind: "orbit", n: 2, fx: "lightning/ball-lightning", ramp: "storm", radius: 34, life: 5, tick: 0.2, r: 18, dmg: 0.5, st: { stun: 0.1 } },
      }],
      ult: {
        name: "뇌우", desc: "폭풍 구름을 불러 전장 전체에 번개를 내리친다.", pose: "ult", windup: 0.5, recover: 0.5, cd: 26,
        fx: [{ t: -0.46, id: "lightning/thunderclap", ramp: "storm", opts: { reach: 104 } }],
        hits: [{ t: 0.12, circ: [104, 0], dmg: 4, kb: 160, stop: 0.12, st: { stun: 1 } }],
        special: { kind: "storm", t: 0.3, life: 4.5, every: 0.32, fx: "lightning/lightning-strike", cloud: "lightning/storm-cloud", ramp: "storm", r: 24, dmg: 3, st: { stun: 0.5 } },
        cam: [{ t: -0.5, dim: 1 }, { t: 0.12, shake: 6, flash: 0.6 }],
      },
    },
  },

  earth: {
    1: {
      basic: {
        name: "바위 주먹", desc: "돌처럼 단단한 주먹으로 올려친다.", pose: "uppercut", windup: 0.16, recover: 0.36,
        fx: [{ t: -0.16, id: "melee/uppercut" }, { t: 0.08, id: "impacts/blunt-hit", dx: 30, dy: -4, dur: 0.5 }],
        hits: [{ t: 0.076, box: [0, 44, 18], dmg: 1.25, stop: 0.1, kb: 110, up: 60 }],
        cam: [{ t: 0.08, shake: 2 }],
      },
      skills: [{
        name: "돌 던지기", desc: "커다란 돌을 던져 떨어진 곳을 부순다.", pose: "throw", windup: 0.22, recover: 0.3, cd: 4,
        fx: [{ t: 0, id: "nature/boulder", ramp: "main", dy: -6 }],
        hits: [{ t: 0.6, circ: [30, 150], dmg: 2.8, kb: 140, stop: 0.08, st: { stun: 0.5 } }],
        cam: [{ t: 0.6, shake: 3 }],
      }],
    },
    2: {
      basic: {
        name: "대지 망치", desc: "두 팔을 모아 땅을 내려찍는다.", pose: "cleave", windup: 0.26, recover: 0.44,
        fx: [{ t: -0.26, id: "melee/hammer-smash", ramp: "stone", dur: 0.9 }],
        hits: [{ t: 0.15, box: [6, 66, 22], dmg: 1.7, stop: 0.12, kb: 120, st: { stun: 0.3 } }],
        cam: [{ t: 0.15, shake: 3 }],
      },
      skills: [{
        name: "가시 솟음", desc: "앞쪽 땅에서 돌가시가 솟아 적을 띄운다.", pose: "stomp", windup: 0.2, recover: 0.3, cd: 5,
        fx: [{ t: 0, id: "nature/earth-spike", dx: 60, at: "aim" }],
        hits: [{ t: 0.42, circ: [32, 60], at: "aim", dmg: 3.1, up: 120, stop: 0.1, st: { stun: 0.6 } }],
        cam: [{ t: 0.42, shake: 3 }],
      }, {
        name: "뿌리 속박", desc: "가까운 적을 뿌리로 묶어 움직이지 못하게 한다.", pose: "point", windup: 0.15, recover: 0.25, cd: 8,
        fx: [{ t: 0, id: "nature/root-snare", at: "nearest" }],
        hits: [{ t: 0.62, circ: [40, 0], at: "nearest", dmg: 1.2, st: { root: 3 } }, { t: 1.75, circ: [40, 0], at: "nearest", dmg: 1.2 }],
      }],
    },
    3: {
      basic: {
        name: "지진 내려찍기", desc: "땅을 내려쳐 충격파로 주위를 날려버린다.", pose: "slam", windup: 0.3, recover: 0.46,
        fx: [{ t: 0, id: "impacts/ground-slam", opts: { reach: 70 }, dur: 0.55 }],
        hits: [{ t: 0.0, circ: [40, 6], dmg: 1.5, stop: 0.12, kb: 160, up: 40 }, { t: 0.12, circ: [66, 0], dmg: 0.8, kb: 100 }],
        cam: [{ t: 0, shake: 4 }],
      },
      skills: [{
        name: "가시 지대", desc: "앞으로 가시덤불이 줄지어 솟는다.", pose: "stomp", windup: 0.2, recover: 0.35, cd: 6,
        fx: [{ t: 0, id: "nature/thorns", ramp: "main", dx: -10, opts: { count: 7 } }],
        ticks: [{ t0: 0.3, t1: 1.6, every: 0.3, box: [4, 186, 18], dmg: 0.9, st: { root: 0.5 } }],
      }, {
        name: "지진", desc: "대지를 뒤흔들어 넓은 범위의 적을 쓰러뜨린다.", pose: "slam", windup: 0.35, recover: 0.5, cd: 9,
        fx: [{ t: 0, id: "nature/quake", opts: { reach: 120 }, dur: 1.3 }],
        hits: [{ t: 0.05, circ: [50, 0], dmg: 2.4, up: 50 }, { t: 0.3, circ: [124, 0], dmg: 2.4, stop: 0.1, st: { stun: 1.2 } }],
        cam: [{ t: 0.05, shake: 6 }, { t: 0.35, shake: 5 }],
      }],
      ult: {
        name: "대지 붕괴", desc: "대지가 무너지며 전장을 연달아 폭발시킨다.", pose: "ult", windup: 0.5, recover: 0.6, cd: 26,
        fx: [{ t: 0, id: "impacts/ground-slam", opts: { reach: 110 } }, { t: 0.2, id: "explosions/dirt-explosion", dx: 70 }, { t: 0.35, id: "explosions/dirt-explosion", dx: -60 }, { t: 0.5, id: "explosions/dirt-explosion", dx: 140 }],
        hits: [{ t: 0.02, circ: [80, 0], dmg: 4, kb: 200, up: 80, stop: 0.15 }, { t: 0.22, circ: [50, 70], dmg: 3 }, { t: 0.37, circ: [50, -60], dmg: 3 }, { t: 0.52, circ: [50, 140], dmg: 3, st: { stun: 1.5 } }],
        cam: [{ t: -0.5, dim: 1 }, { t: 0.02, shake: 7, flash: 0.6 }, { t: 0.22, shake: 4 }, { t: 0.37, shake: 4 }, { t: 0.52, shake: 6 }],
      },
    },
  },
};

/** The moves available at a stage: basic, up to 2 skills, and the ultimate at stage 3. */
export function moveset(el, stage) {
  const s = SKILLS[el]?.[stage] ?? SKILLS.fire[1];
  return { basic: s.basic, s1: s.skills[0], s2: s.skills[1] ?? null, ult: s.ult ?? null };
}

/** Every effect id the moves use (to preload). */
export function skillFxIds() {
  const ids = new Set();
  const walk = (m) => {
    if (!m) return;
    m.fx?.forEach((f) => ids.add(f.id));
    m.proj?.forEach((p) => { if (p.fx) ids.add(p.fx); if (p.hitFx) ids.add(p.hitFx); });
    if (m.special?.fx) ids.add(m.special.fx);
    if (m.special?.cloud) ids.add(m.special.cloud);
  };
  for (const el of Object.values(SKILLS)) for (const st of Object.values(el)) { walk(st.basic); st.skills.forEach(walk); walk(st.ult); }
  ["lightning/zap-hit", "lightning/spark-arc", "impacts/hit-spark", "ice/ice-shatter", "scifi/emp-blast", "scifi/glitch", "spawn/disintegrate", "holy/smite", "holy/blessing"].forEach((i) => ids.add(i));
  return [...ids];
}
