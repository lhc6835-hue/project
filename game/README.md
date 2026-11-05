# AETHER HEART (에테르 하트)

정령 육성 + 로그라이트 던전 웹 게임. 빌드 없이 정적 파일로 실행돼요.

- 로컬 실행: `cd game && python3 -m http.server 8123` 후 http://localhost:8123
- 테스트 진입: `?scene=run&el=fire&stage=3` (속성 fire/water/wind/earth, 단계 1~3, `&floor=5` 보스)
- 배포: `node tools/build-worker.mjs <정적 폴더> worker.js`로 Worker 하나에 묶어 Cloudflare Workers에 올림
- 조작: WASD 이동 · J 평타 · Q/E 스킬 · R 궁극기 · Space 회피 · P 일시정지 (모바일은 화면 조이스틱/버튼)

이펙트: `src/vendor/pixelfx` (patch-gg/pixelfx, MIT). 폰트: 갈무리 (OFL).
