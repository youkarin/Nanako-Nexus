// ============================================================
//  GridWorldRenderer.js — Shared rendering for Map + Editor
// ============================================================

export const COLS = 48, ROWS = 28, CELL = 48;

export const C = {
    sky: '#1a2a3a', grass: '#7bc67e', grassAlt: '#6db870',
    road: '#546e7a', roadLine: '#ffd54f',
    sidewalk: '#cfd8dc', sidewalkEdge: '#b0bec5',
    // Home
    homeWall: '#5d4037', homeTrim: '#8d6e63',
    bedroomFloor: '#c8a474', bedroomAlt: '#b8915f',
    livingFloor: '#d4aa78', livingAlt: '#c49a65',
    kitchenFloor: '#e8d5b0', kitchenAlt: '#d8c09a',
    corridor: '#c0a070',
    // Bath
    bathWall: '#4a7a8a', bathFloor: '#cce8f0', bathAlt: '#b8d8e8',
    bathTile: '#a8d0e0',
    // Park
    parkGrass: '#5db85d', parkAlt: '#50aa50', parkPath: '#c9b99a',
    // Commercial
    mallWall: '#3f51b5', mallFloor: '#e8eaf6', mallAlt: '#dde2f5',
    cityWall: '#78716c', cityFloor: '#f5f0e8', cityAlt: '#ede8dc',
    cafeWall: '#6f4e37', cafeFloor: '#d4a574', cafeAlt: '#c49060',
    marketWall: '#b45309', marketFloor: '#e8d18a', marketAlt: '#d8c078',
    // Furniture
    desk: '#8d6e63', deskScreen: '#1a3a5c', deskScreenOn: '#2563eb',
    chair: '#6d4c41', chairSeat: '#7c5c44',
    bedFrame: '#a0736a', bedCover: '#f06292', bedCover2: '#e91e63', pillow: '#fff9c4',
    shelf: '#4e342e', book: ['#ef5350', '#42a5f5', '#66bb6a', '#ffa726', '#ab47bc', '#ec407a', '#26c6da'],
    plant: '#388e3c', plantDark: '#2e7d32', pot: '#a1887f', treeLight: '#81c784',
    table: '#9c6b3c', tableTop: '#b17d4c',
    sofa: '#5c6bc0', sofaDark: '#3f51b5', sofaCushion: '#7986cb',
    counter: '#a07850', counterTop: '#b89060',
    bath: '#b3d9f7', bathEdge: '#90c8f0', sink: '#e0f2fe',
    stove: '#607d8b', burner: '#37474f',
    mat: '#ef9a9a', rug: '#7986cb', rug2: '#ef9a9a',
    barrel: '#795548', barrelRing: '#5d4037',
    tree: '#4caf50', treeDark: '#2e7d32', treeTrunk: '#8d6e63',
    flower: ['#f48fb1', '#fff176', '#ce93d8', '#80deea', '#ffab91'],
    bench: '#8d6e63', benchtop: '#a07850',
    fountain: '#90caf9', fountainRing: '#cfd8dc',
    lamp: '#546e7a', lampGlow: '#fff9c4',
    vend: '#1976d2', tv: '#212121', tvScreen: '#1565c0',
    wardrobe: '#4e342e', wardrobeDoor: '#6d4c41',
    couch2: '#7986cb',
};

// ── Walkability ───────────────────────────────────────────────
export function buildWalkGrid() {
    const g = Array.from({ length: ROWS }, () => Array(COLS).fill(true));
    const wall = (x, y, w, h, doors = []) => {
        for (let r = y; r < y + h; r++)
            for (let c = x; c < x + w; c++) {
                const edge = r === y || r === y + h - 1 || c === x || c === x + w - 1;
                if (edge && !doors.some(([dc, dr]) => dc === c && dr === r)) g[r][c] = false;
            }
    };
    wall(2, 3, 14, 11, [[7, 13]]);                             // Home
    wall(17, 3, 18, 11, [[24, 13]]);                            // Bath/Kitchen
    wall(13, 17, 7, 8, [[15, 17]]);                            // Mall
    wall(21, 17, 8, 8, [[24, 17]]);                            // City Hall
    wall(30, 17, 7, 8, [[32, 17]]);                            // Coffee
    wall(38, 17, 9, 8, [[40, 17]]);                            // Market
    return g;
}
export const WALK_GRID = buildWalkGrid();

export function findPath(sc, sr, ec, er) {
    if (sc === ec && sr === er) return [[sc, sr]];
    if (!WALK_GRID[er]?.[ec]) return null;
    const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const prev = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const D = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const q = [[sc, sr]]; visited[sr][sc] = true;
    while (q.length) {
        const [c, r] = q.shift();
        if (c === ec && r === er) { const p = []; let u = [ec, er]; while (u) { p.unshift(u); u = prev[u[1]][u[0]]; } return p; }
        for (const [dc, dr] of D) {
            const nc = c + dc, nr = r + dr;
            if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || visited[nr][nc] || !WALK_GRID[nr][nc]) continue;
            visited[nr][nc] = true; prev[nr][nc] = [c, r]; q.push([nc, nr]);
        }
    }
    return null;
}

// ── Furniture renderer (polished) ───────────────────────────
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
const shad = (ctx, a = 0.32) => { ctx.shadowColor = `rgba(20,10,5,${a})`; ctx.shadowBlur = 7; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3; };
const noShad = ctx => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; };

export function drawFurniture(ctx, type, col, row, cs) {
    const x = col * cs, y = row * cs, s = cs;
    ctx.save();
    switch (type) {
        case 'bed':
            shad(ctx); ctx.fillStyle = C.bedFrame; rr(ctx, x + 2, y + 2, s - 4, s - 4, 5); noShad(ctx);
            ctx.fillStyle = C.bedCover; rr(ctx, x + 4, y + s * .35, s - 8, s * .57, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + 4, y + s * .35, s - 8, s * .12, 4); // sheen
            ctx.fillStyle = C.pillow; rr(ctx, x + 5, y + 5, s - 10, s * .28, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(ctx, x + 5, y + 5, (s - 10) * .5, s * .1, 2);
            break;
        case 'bed2':
            shad(ctx); ctx.fillStyle = C.bedFrame; rr(ctx, x + 2, y + 2, s - 4, s - 4, 5); noShad(ctx);
            ctx.fillStyle = C.bedCover2; rr(ctx, x + 4, y + s * .35, s - 8, s * .57, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + 4, y + s * .35, s - 8, s * .1, 3);
            const pw = (s - 14) / 2;
            ctx.fillStyle = C.pillow; rr(ctx, x + 5, y + 5, pw, s * .28, 3);
            ctx.fillStyle = '#fce4ec'; rr(ctx, x + 8 + pw, y + 5, pw, s * .28, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; rr(ctx, x + 5, y + 5, pw * .6, s * .1, 2);
            break;
        case 'desk':
            shad(ctx); ctx.fillStyle = C.desk; rr(ctx, x + 2, y + s * .32, s - 4, s * .55, 5); noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x + 2, y + s * .32, s - 4, s * .15, 5);
            // screen
            shad(ctx); ctx.fillStyle = C.deskScreen; rr(ctx, x + s * .12, y + 3, s * .76, s * .4, 4); noShad(ctx);
            // screen gradient glow
            const sg = ctx.createLinearGradient(x + s * .12, y + 4, x + s * .12, y + s * .4);
            sg.addColorStop(0, '#1e88e5'); sg.addColorStop(0.5, '#1565c0'); sg.addColorStop(1, '#0d47a1');
            ctx.fillStyle = sg; rr(ctx, x + s * .14, y + 5, s * .72, s * .32, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, x + s * .14, y + 5, s * .72, s * .1, 3);
            // keyboard
            ctx.fillStyle = '#546e7a'; rr(ctx, x + s * .08, y + s * .72, s * .74, s * .16, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, x + s * .1, y + s * .73, s * .3, s * .06, 2);
            break;
        case 'tv':
            ctx.fillStyle = '#263238'; rr(ctx, x + s * .05, y + s * .5, s * .9, s * .1, 3);
            shad(ctx); ctx.fillStyle = '#1a2428'; rr(ctx, x + s * .07, y + s * .06, s * .86, s * .46, 5); noShad(ctx);
            const tv = ctx.createLinearGradient(x + s * .09, y + s * .08, x + s * .09, y + s * .5);
            tv.addColorStop(0, '#1565c0'); tv.addColorStop(0.4, '#1976d2'); tv.addColorStop(1, '#0d47a1');
            ctx.fillStyle = tv; rr(ctx, x + s * .09, y + s * .08, s * .82, s * .4, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + s * .09, y + s * .08, s * .82, s * .12, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, x + s * .09, y + s * .33, s * .82, s * .04, 1);
            ctx.fillStyle = '#37474f'; rr(ctx, x + s * .44, y + s * .48, s * .12, s * .05, 2);
            break;
        case 'wardrobe':
            shad(ctx); ctx.fillStyle = C.wardrobe; rr(ctx, x + 2, y + 2, s - 4, s - 4, 4); noShad(ctx);
            ctx.fillStyle = C.wardrobeDoor; rr(ctx, x + 3, y + 3, s * .44, s - 6, 3);
            ctx.fillStyle = C.wardrobeDoor; rr(ctx, x + s * .52, y + 3, s * .44, s - 6, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, x + 3, y + 3, s * .44, s * .18, 3); rr(ctx, x + s * .52, y + 3, s * .44, s * .18, 3);
            ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, x + s * .43, y + 3, s * .08, s - 6, 0);
            ctx.fillStyle = '#bcaaa4'; ctx.beginPath(); ctx.arc(x + s * .43, y + s * .5, s * .055, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + s * .57, y + s * .5, s * .055, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + s * .41, y + s * .48, s * .02, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + s * .55, y + s * .48, s * .02, 0, Math.PI * 2); ctx.fill();
            break;
        case 'shelf':
            shad(ctx); ctx.fillStyle = C.shelf; rr(ctx, x + 2, y + 2, s - 4, s - 4, 4); noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, x + 2, y + 2, s - 4, s * .12, 4);
            [0.1, 0.38, 0.63].forEach((fy, ri) => {
                const nb = 4 + ri, bw = (s - 10) / nb;
                C.book.slice(0, nb).forEach((bc, i) => {
                    ctx.fillStyle = bc; rr(ctx, x + 5 + i * bw, y + fy * s + 1, bw - 2, s * .22, 2);
                    ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(ctx, x + 5 + i * bw, y + fy * s + 1, bw * .4, s * .08, 2);
                });
                ctx.fillStyle = 'rgba(0,0,0,0.15)'; rr(ctx, x + 3, y + (fy + .24) * s, s - 6, s * .03, 0);
            });
            break;
        case 'plant':
            shad(ctx); ctx.fillStyle = '#8d6e63'; rr(ctx, x + s * .28, y + s * .62, s * .44, s * .33, 4); noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + s * .3, y + s * .63, s * .2, s * .1, 3);
            shad(ctx, .2); ctx.fillStyle = C.plantDark; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .43, s * .35, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            ctx.fillStyle = C.plant; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .4, s * .3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.treeLight; ctx.beginPath(); ctx.arc(x + s * .37, y + s * .33, s * .18, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(x + s * .34, y + s * .3, s * .07, 0, Math.PI * 2); ctx.fill();
            break;
        case 'plant2':
            ctx.fillStyle = '#8d6e63'; rr(ctx, x + s * .36, y + s * .7, s * .28, s * .27, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + s * .38, y + s * .71, s * .12, s * .08, 2);
            ctx.fillStyle = C.plantDark; ctx.fillRect(x + s * .46, y + s * .35, s * .08, s * .38);
            shad(ctx, .2); ctx.fillStyle = C.plant; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .28, s * .26, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            ctx.fillStyle = C.treeLight; ctx.beginPath(); ctx.arc(x + s * .4, y + s * .22, s * .14, 0, Math.PI * 2); ctx.fill();
            break;
        case 'table':
            shad(ctx); ctx.fillStyle = C.table; rr(ctx, x + 4, y + 4, s - 8, s - 8, 5); noShad(ctx);
            ctx.fillStyle = C.tableTop; rr(ctx, x + 4, y + 4, s - 8, s * .36, 5);
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(ctx, x + 5, y + 5, s - 10, s * .12, 4);
            break;
        case 'table_round': {
            const tr = ctx.createRadialGradient(x + s * .4, y + s * .4, 0, x + s * .5, y + s * .5, s * .42);
            tr.addColorStop(0, C.tableTop); tr.addColorStop(1, C.table);
            shad(ctx); ctx.fillStyle = tr; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .4, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(x + s * .42, y + s * .4, s * .15, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'chair':
            shad(ctx);
            ctx.fillStyle = C.chair; rr(ctx, x + s * .2, y + s * .08, s * .6, s * .36, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x + s * .2, y + s * .08, s * .6, s * .12, 4);
            ctx.fillStyle = C.chairSeat; rr(ctx, x + s * .14, y + s * .48, s * .72, s * .36, 4);
            noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + s * .16, y + s * .5, s * .4, s * .1, 3);
            ctx.fillStyle = '#3e2723';[[.18, .84], [.64, .84]].forEach(([fx, fy]) => rr(ctx, x + fx * s, y + fy * s, s * .15, s * .13, 2));
            break;
        case 'sofa':
            shad(ctx); ctx.fillStyle = C.sofaDark; rr(ctx, x + 2, y + s * .1, s - 4, s * .84, 5); noShad(ctx);
            ctx.fillStyle = C.sofa; rr(ctx, x + 4, y + s * .35, s - 8, s * .44, 4);
            ctx.fillStyle = C.sofaCushion;
            rr(ctx, x + 6, y + s * .38, s * .37, s * .36, 4); rr(ctx, x + s * .54, y + s * .38, s * .37, s * .36, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, x + 6, y + s * .38, s * .37, s * .1, 4); rr(ctx, x + s * .54, y + s * .38, s * .37, s * .1, 4);
            ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x + s * .5, y + s * .36, 2, s * .42); // cushion divider
            break;
        case 'sofa_corner':
            shad(ctx); ctx.fillStyle = C.sofaDark; rr(ctx, x + 2, y + 2, s - 4, s - 4, 5); noShad(ctx);
            ctx.fillStyle = C.couch2; rr(ctx, x + 4, y + 4, s - 8, s - 8, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + 4, y + 4, s - 8, s * .18, 4);
            break;
        case 'counter':
            shad(ctx); ctx.fillStyle = C.counter; rr(ctx, x + 2, y + 2, s - 4, s - 4, 4); noShad(ctx);
            ctx.fillStyle = C.counterTop; rr(ctx, x + 2, y + 2, s - 4, s * .3, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(ctx, x + 3, y + 3, s * .5, s * .1, 3);
            ctx.fillStyle = '#7c6040'; rr(ctx, x + s * .08, y + s * .4, s * .28, s * .42, 3); rr(ctx, x + s * .43, y + s * .4, s * .47, s * .42, 3);
            break;
        case 'counter_sink':
            shad(ctx); ctx.fillStyle = C.counter; rr(ctx, x + 2, y + 2, s - 4, s - 4, 4); noShad(ctx);
            ctx.fillStyle = C.counterTop; rr(ctx, x + 2, y + 2, s - 4, s * .3, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(ctx, x + 3, y + 3, s * .5, s * .1, 3);
            ctx.fillStyle = C.sink; rr(ctx, x + s * .14, y + s * .37, s * .72, s * .47, 4);
            ctx.fillStyle = 'rgba(144,202,249,0.5)'; rr(ctx, x + s * .16, y + s * .39, s * .68, s * .2, 3);
            ctx.fillStyle = '#607d8b'; rr(ctx, x + s * .42, y + s * .26, s * .16, s * .18, 3);
            break;
        case 'bath': {
            shad(ctx, .4);
            ctx.fillStyle = '#78909c'; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .5, s * .44, s * .44, 0, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            ctx.fillStyle = C.bath; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .5, s * .38, s * .38, 0, 0, Math.PI * 2); ctx.fill();
            const bg = ctx.createRadialGradient(x + s * .42, y + s * .42, 0, x + s * .5, y + s * .5, s * .38);
            bg.addColorStop(0, 'rgba(255,255,255,0.4)'); bg.addColorStop(1, 'rgba(144,202,249,0)');
            ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .5, s * .38, s * .38, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#5b8fa8'; rr(ctx, x + s * .36, y + s * .1, s * .28, s * .16, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x + s * .44, y + s * .1, s * .08, s * .06);
            break;
        }
        case 'sink':
            shad(ctx); ctx.fillStyle = '#90a4ae'; rr(ctx, x + s * .08, y + s * .13, s * .84, s * .74, 5); noShad(ctx);
            ctx.fillStyle = C.sink; rr(ctx, x + s * .12, y + s * .22, s * .76, s * .54, 4);
            ctx.fillStyle = 'rgba(144,202,249,0.45)'; rr(ctx, x + s * .14, y + s * .28, s * .72, s * .22, 3);
            ctx.fillStyle = '#607d8b'; rr(ctx, x + s * .42, y + s * .08, s * .16, s * .2, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; rr(ctx, x + s * .44, y + s * .09, s * .06, s * .1, 2);
            break;
        case 'stove':
            shad(ctx); ctx.fillStyle = '#546e7a'; rr(ctx, x + 3, y + 3, s - 6, s - 6, 4); noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, x + 3, y + 3, s - 6, s * .15, 4);
            [[.25, .26], [.65, .26], [.25, .65], [.65, .65]].forEach(([fx, fy]) => {
                const bg = ctx.createRadialGradient(x + fx * s, y + fy * s, 0, x + fx * s, y + fy * s, s * .13);
                bg.addColorStop(0, '#455a64'); bg.addColorStop(1, C.burner);
                ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x + fx * s, y + fy * s, s * .13, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#37474f'; ctx.beginPath(); ctx.arc(x + fx * s, y + fy * s, s * .07, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(x + fx * s - s * .04, y + fy * s - s * .04, s * .03, 0, Math.PI * 2); ctx.fill();
            });
            break;
        case 'barrel': {
            shad(ctx, .35); const bg2 = ctx.createLinearGradient(x + s * .15, y, x + s * .85, y);
            bg2.addColorStop(0, '#5d4037'); bg2.addColorStop(0.4, C.barrel); bg2.addColorStop(1, '#4e342e');
            ctx.fillStyle = bg2; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .5, s * .36, s * .43, 0, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            [.22, .5, .78].forEach(fy => {
                ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2; ctx.beginPath();
                ctx.ellipse(x + s * .5, y + fy * s, s * .36, s * .1, 0, 0, Math.PI * 2); ctx.stroke();
            });
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.ellipse(x + s * .38, y + s * .32, s * .12, s * .18, -.4, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'rug':
            shad(ctx, .18); ctx.fillStyle = C.rug; rr(ctx, x + 4, y + 4, s - 8, s - 8, 5); noShad(ctx);
            ctx.strokeStyle = '#5c6bc0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x + 8, y + 8, s - 16, s - 16, 3); ctx.stroke();
            ctx.strokeStyle = 'rgba(121,134,203,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x + 11, y + 11, s - 22, s - 22, 2); ctx.stroke();
            break;
        case 'rug2':
            shad(ctx, .18); ctx.fillStyle = C.rug2; rr(ctx, x + 4, y + 4, s - 8, s - 8, 5); noShad(ctx);
            ctx.strokeStyle = '#e91e63'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x + 8, y + 8, s - 16, s - 16, 3); ctx.stroke();
            ctx.strokeStyle = 'rgba(233,30,99,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x + 11, y + 11, s - 22, s - 22, 2); ctx.stroke();
            break;
        case 'mat':
            shad(ctx, .2); ctx.fillStyle = C.mat; rr(ctx, x + 3, y + s * .3, s - 6, s * .4, 4); noShad(ctx);
            ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.roundRect(x + 5, y + s * .33, s - 10, s * .34, 3); ctx.stroke();
            break;
        case 'tree': {
            // shadow on ground
            ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x + s * .54, y + s * .88, s * .28, s * .1, 0, 0, Math.PI * 2); ctx.fill();
            // trunk
            const tg = ctx.createLinearGradient(x + s * .38, y, x + s * .62, y);
            tg.addColorStop(0, '#5d4037'); tg.addColorStop(0.5, '#8d6e63'); tg.addColorStop(1, '#5d4037');
            ctx.fillStyle = tg; rr(ctx, x + s * .4, y + s * .58, s * .2, s * .38, 3);
            // canopy layers
            shad(ctx, .3); ctx.fillStyle = C.treeDark; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .38, s * .4, 0, Math.PI * 2); ctx.fill();
            noShad(ctx);
            ctx.fillStyle = C.tree; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .34, s * .34, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.treeLight; ctx.beginPath(); ctx.arc(x + s * .38, y + s * .26, s * .2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(x + s * .35, y + s * .22, s * .09, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'bench':
            shad(ctx);
            ctx.fillStyle = C.bench; rr(ctx, x + s * .06, y + s * .34, s * .88, s * .22, 4);
            ctx.fillStyle = C.benchtop; rr(ctx, x + s * .06, y + s * .54, s * .88, s * .2, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, x + s * .06, y + s * .54, s * .5, s * .08, 4);
            noShad(ctx);
            [[.08, .74], [.76, .74]].forEach(([fx, fy]) => { ctx.fillStyle = C.bench; rr(ctx, x + fx * s, y + fy * s, s * .14, s * .22, 3); });
            break;
        case 'flower':
            C.flower.slice(0, 3).forEach((fc, i) => {
                const fx = x + [.3, .5, .7][i] * s, fy = y + [.52, .36, .62][i] * s;
                shad(ctx, .2); ctx.fillStyle = fc; ctx.beginPath(); ctx.arc(fx, fy, s * .15, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
                ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(fx - s * .04, fy - s * .05, s * .06, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx, fy, s * .04, 0, Math.PI * 2); ctx.fill();
            });
            break;
        case 'fountain': {
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x + s * .52, y + s * .54, s * .44, s * .14, 0, 0, Math.PI * 2); ctx.fill();
            shad(ctx); ctx.fillStyle = C.fountainRing; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .44, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            const fg = ctx.createRadialGradient(x + s * .5, y + s * .5, s * .1, x + s * .5, y + s * .5, s * .38);
            fg.addColorStop(0, '#64b5f6'); fg.addColorStop(1, '#29b6f6');
            ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .36, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
            [.14, .22, .3].forEach(r => { ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, r * s, 0, Math.PI * 2); ctx.stroke(); });
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .07, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .48, s * .03, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'lamp':
            ctx.fillStyle = '#455a64'; rr(ctx, x + s * .44, y + s * .24, s * .12, s * .62, 3);
            ctx.fillStyle = '#37474f'; rr(ctx, x + s * .28, y + s * .84, s * .44, s * .1, 3);
            // glow halo
            const lg = ctx.createRadialGradient(x + s * .5, y + s * .2, 0, x + s * .5, y + s * .2, s * .32);
            lg.addColorStop(0, 'rgba(255,249,196,0.7)'); lg.addColorStop(1, 'rgba(255,249,196,0)');
            ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .2, s * .32, 0, Math.PI * 2); ctx.fill();
            shad(ctx, .5); ctx.fillStyle = C.lampGlow; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .2, s * .2, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .18, s * .08, 0, Math.PI * 2); ctx.fill();
            break;
        case 'vending':
            shad(ctx); ctx.fillStyle = '#1565c0'; rr(ctx, x + s * .08, y + s * .04, s * .84, s * .9, 6); noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + s * .08, y + s * .04, s * .84, s * .25, 6);
            ctx.fillStyle = '#e3f2fd'; rr(ctx, x + s * .16, y + s * .12, s * .68, s * .52, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; rr(ctx, x + s * .18, y + s * .14, s * .3, s * .48, 3);
            ['#ef5350', '#43a047', '#ffd740'].forEach((vc, i) => {
                ctx.fillStyle = vc; ctx.beginPath(); ctx.arc(x + s * .5, y + (0.74 + i * .06) * s, s * .055, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(x + s * .46, y + (0.72 + i * .06) * s, s * .02, 0, Math.PI * 2); ctx.fill();
            });
            break;
        case 'sign':
            shad(ctx); ctx.fillStyle = '#e65100'; rr(ctx, x + s * .08, y + s * .12, s * .84, s * .52, 5); noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(ctx, x + s * .08, y + s * .12, s * .84, s * .15, 5);
            ctx.fillStyle = '#fff'; rr(ctx, x + s * .13, y + s * .18, s * .74, s * .38, 4);
            ctx.fillStyle = '#ff6d00'; rr(ctx, x + s * .44, y + s * .64, s * .12, s * .24, 3);
            ctx.fillStyle = '#795548'; rr(ctx, x + s * .26, y + s * .88, s * .48, s * .08, 2);
            break;
        case 'fridge':
            shad(ctx); ctx.fillStyle = '#cfd8dc'; rr(ctx, x + s * .1, y + s * .04, s * .8, s * .92, 5); noShad(ctx);
            ctx.fillStyle = '#eceff1'; rr(ctx, x + s * .12, y + s * .06, s * .76, s * .42, 4);
            ctx.fillStyle = '#b0bec5'; rr(ctx, x + s * .12, y + s * .52, s * .76, s * .4, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; rr(ctx, x + s * .14, y + s * .07, s * .35, s * .12, 3);
            ctx.fillStyle = '#90a4ae'; rr(ctx, x + s * .78, y + s * .2, s * .06, s * .14, 2);
            ctx.fillStyle = '#90a4ae'; rr(ctx, x + s * .78, y + s * .62, s * .06, s * .14, 2);
            break;
        case 'clock':
            ctx.fillStyle = '#5d4037'; rr(ctx, x + s * .42, y + s * .55, s * .16, s * .38, 3);
            shad(ctx); ctx.fillStyle = '#8d6e63'; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .4, s * .35, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            ctx.fillStyle = '#fff8e1'; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .4, s * .28, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x + s * .5, y + s * .4); ctx.lineTo(x + s * .5, y + s * .2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + s * .5, y + s * .4); ctx.lineTo(x + s * .65, y + s * .4); ctx.stroke();
            ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .4, s * .04, 0, Math.PI * 2); ctx.fill();
            break;
        case 'piano':
            shad(ctx); ctx.fillStyle = '#1a1a1a'; rr(ctx, x + s * .06, y + s * .1, s * .88, s * .8, 5); noShad(ctx);
            ctx.fillStyle = '#111'; rr(ctx, x + s * .08, y + s * .12, s * .84, s * .26, 4);
            ctx.fillStyle = '#f5f5f5'; rr(ctx, x + s * .1, y + s * .42, s * .8, s * .4, 3);
            for (let i = 0; i < 7; i++) { ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x + s * .1 + i * (s * .8 / 7), y + s * .42, 1, s * .4); }
            [0, 1, 3, 4, 5].forEach(i => { ctx.fillStyle = '#1a1a1a'; rr(ctx, x + s * (.15 + i * .1), y + s * .42, s * .06, s * .24, 2); });
            break;
        case 'toilet':
            shad(ctx); ctx.fillStyle = '#eceff1'; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .55, s * .3, s * .35, 0, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            ctx.fillStyle = '#e0e0e0'; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .55, s * .22, s * .26, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(144,202,249,0.3)'; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .58, s * .18, s * .2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#cfd8dc'; rr(ctx, x + s * .3, y + s * .08, s * .4, s * .32, 4);
            break;
        case 'mirror':
            shad(ctx); ctx.fillStyle = '#8d6e63'; rr(ctx, x + s * .15, y + s * .08, s * .7, s * .84, 6); noShad(ctx);
            const mg = ctx.createLinearGradient(x + s * .2, y + s * .12, x + s * .8, y + s * .86);
            mg.addColorStop(0, '#e3f2fd'); mg.addColorStop(.5, '#bbdefb'); mg.addColorStop(1, '#90caf9');
            ctx.fillStyle = mg; rr(ctx, x + s * .2, y + s * .12, s * .6, s * .76, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; rr(ctx, x + s * .22, y + s * .14, s * .25, s * .35, 3);
            break;
        case 'painting':
            shad(ctx); ctx.fillStyle = '#5d4037'; rr(ctx, x + s * .08, y + s * .1, s * .84, s * .7, 4); noShad(ctx);
            const pg = ctx.createLinearGradient(x, y + s * .14, x, y + s * .74);
            pg.addColorStop(0, '#42a5f5'); pg.addColorStop(.6, '#66bb6a'); pg.addColorStop(1, '#81c784');
            ctx.fillStyle = pg; rr(ctx, x + s * .12, y + s * .14, s * .76, s * .62, 3);
            ctx.fillStyle = '#fff9c4'; ctx.beginPath(); ctx.arc(x + s * .7, y + s * .28, s * .1, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#4caf50'; rr(ctx, x + s * .16, y + s * .5, s * .22, s * .24, 2);
            break;
        case 'fishbowl': {
            const fb = ctx.createRadialGradient(x + s * .45, y + s * .4, 0, x + s * .5, y + s * .5, s * .35);
            fb.addColorStop(0, 'rgba(144,202,249,0.6)'); fb.addColorStop(1, 'rgba(66,165,245,0.3)');
            shad(ctx, .2); ctx.fillStyle = 'rgba(200,230,255,0.5)'; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .36, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            ctx.fillStyle = fb; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .34, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff7043'; rr(ctx, x + s * .42, y + s * .44, s * .14, s * .1, 4);
            ctx.fillStyle = '#ff8a65'; rr(ctx, x + s * .54, y + s * .42, s * .08, s * .06, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(x + s * .38, y + s * .35, s * .08, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'cake':
            shad(ctx, .2); ctx.fillStyle = '#d7ccc8'; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .75, s * .35, s * .1, 0, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            ctx.fillStyle = '#fff3e0'; rr(ctx, x + s * .2, y + s * .38, s * .6, s * .38, 4);
            ctx.fillStyle = '#f48fb1'; rr(ctx, x + s * .2, y + s * .35, s * .6, s * .12, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; rr(ctx, x + s * .22, y + s * .36, s * .28, s * .06, 3);
            ctx.fillStyle = '#ef5350'; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .3, s * .06, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffd54f'; rr(ctx, x + s * .48, y + s * .2, s * .04, s * .1, 1);
            break;
        case 'mailbox':
            ctx.fillStyle = '#5d4037'; rr(ctx, x + s * .44, y + s * .45, s * .12, s * .5, 3);
            shad(ctx); ctx.fillStyle = '#1565c0'; rr(ctx, x + s * .2, y + s * .12, s * .6, s * .4, 5); noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(ctx, x + s * .2, y + s * .12, s * .6, s * .12, 5);
            ctx.fillStyle = '#0d47a1'; rr(ctx, x + s * .22, y + s * .28, s * .56, s * .06, 2);
            break;
        case 'streetlamp':
            ctx.fillStyle = '#455a64'; rr(ctx, x + s * .44, y + s * .2, s * .12, s * .76, 3);
            ctx.fillStyle = '#37474f'; rr(ctx, x + s * .3, y + s * .9, s * .4, s * .08, 3);
            {
                const sl = ctx.createRadialGradient(x + s * .5, y + s * .15, 0, x + s * .5, y + s * .15, s * .4);
                sl.addColorStop(0, 'rgba(255,249,196,0.5)'); sl.addColorStop(1, 'rgba(255,249,196,0)');
                ctx.fillStyle = sl; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .15, s * .4, 0, Math.PI * 2); ctx.fill();
            }
            shad(ctx, .5); ctx.fillStyle = '#fff9c4'; rr(ctx, x + s * .3, y + s * .06, s * .4, s * .18, 4); noShad(ctx);
            ctx.fillStyle = '#fff'; rr(ctx, x + s * .35, y + s * .08, s * .15, s * .08, 3);
            break;
        case 'trashcan':
            shad(ctx, .3); ctx.fillStyle = '#78909c'; rr(ctx, x + s * .2, y + s * .25, s * .6, s * .65, 5); noShad(ctx);
            ctx.fillStyle = '#90a4ae'; rr(ctx, x + s * .16, y + s * .2, s * .68, s * .12, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + s * .22, y + s * .3, s * .2, s * .5, 3);
            ctx.fillStyle = '#607d8b'; rr(ctx, x + s * .3, y + s * .22, s * .4, s * .04, 2);
            break;
        case 'well': {
            ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .8, s * .4, s * .12, 0, 0, Math.PI * 2); ctx.fill();
            shad(ctx); ctx.fillStyle = '#8d6e63'; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .55, s * .38, s * .38, 0, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            ctx.fillStyle = '#42a5f5'; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .5, s * .28, s * .28, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(x + s * .4, y + s * .42, s * .08, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#5d4037'; rr(ctx, x + s * .44, y + s * .08, s * .12, s * .5, 3);
            ctx.fillStyle = '#795548'; rr(ctx, x + s * .2, y + s * .06, s * .6, s * .08, 3);
            break;
        }
    }
    ctx.restore();
}

// ── Character Nanako (maid outfit, 4-direction animated) ────
export function drawCharacter(ctx, px, py, cs, status, dir = 'down') {
    const s = cs; ctx.save();
    const isMoving = status === 'moving';
    const t = isMoving ? (Date.now() / 180) : 0;
    const swing = isMoving ? Math.sin(t) : 0;
    const bob = isMoving ? Math.abs(Math.sin(t)) * s * .035 : 0;
    const py2 = py - bob;
    // Colors
    const hair = '#8d6e4c', hairDk = '#6d4e2c', skin = '#fce4c8', skinHi = '#fdebd8';
    const dress = '#3e2723', dressHi = '#5d4037', apron = '#fff', apronSh = '#e8e8e8';
    const ribbon = '#e8829a', bow = '#f48fb1', shoe = '#5d4037';

    // Ground shadow
    const sg = ctx.createRadialGradient(px + s * .5, py + s * .94, 0, px + s * .5, py + s * .94, s * .32);
    sg.addColorStop(0, 'rgba(0,0,0,0.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.beginPath();
    ctx.ellipse(px + s * .5, py + s * .93, s * .28 + Math.abs(swing) * s * .04, s * .075, 0, 0, Math.PI * 2); ctx.fill();

    if (dir === 'left' || dir === 'right') {
        ctx.save();
        if (dir === 'left') { ctx.translate(px + s, py2); ctx.scale(-1, 1); } else ctx.translate(px, py2);
        // rear leg
        ctx.fillStyle = dress; rr(ctx, s * .42 - swing * s * .08, s * .6 + Math.max(0, swing) * s * .05, s * .18, s * .28, 3);
        ctx.fillStyle = shoe; rr(ctx, s * .4 - swing * s * .08, s * .86 + Math.max(0, swing) * s * .05, s * .22, s * .1, 3);
        // rear arm
        ctx.fillStyle = dress; rr(ctx, s * .65, s * .38 + swing * s * .05, s * .12, s * .2, 4);
        ctx.fillStyle = skin; rr(ctx, s * .65, s * .56 + swing * s * .05, s * .1, s * .08, 3);
        // dress body
        shad(ctx, .3); ctx.fillStyle = dress; rr(ctx, s * .2, s * .36, s * .6, s * .3, s * .06); noShad(ctx);
        ctx.fillStyle = dressHi; rr(ctx, s * .2, s * .36, s * .6, s * .08, s * .06);
        // apron (side view = thin strip)
        ctx.fillStyle = apron; rr(ctx, s * .22, s * .4, s * .28, s * .26, 3);
        ctx.fillStyle = apronSh; rr(ctx, s * .22, s * .62, s * .28, s * .04, 2);
        // skirt flare
        ctx.fillStyle = dress; rr(ctx, s * .16, s * .58, s * .68, s * .1, 4);
        // front leg
        const flx = s * .4 + swing * s * .08, fly = s * .58 - Math.max(0, -swing) * s * .05;
        ctx.fillStyle = dress; rr(ctx, flx, fly, s * .2, s * .3, 3);
        ctx.fillStyle = shoe; rr(ctx, flx - s * .02, fly + s * .27, s * .24, s * .1, 3);
        // front arm
        ctx.fillStyle = dress; rr(ctx, s * .12, s * .37 - swing * s * .05, s * .12, s * .2, 4);
        ctx.fillStyle = skin; rr(ctx, s * .12, s * .55 - swing * s * .05, s * .1, s * .08, 3);
        // neck + head
        ctx.fillStyle = skin; rr(ctx, s * .38, s * .27, s * .14, s * .1, 3);
        shad(ctx, .2); ctx.fillStyle = skin; rr(ctx, s * .22, s * .05, s * .48, s * .26, s * .12); noShad(ctx);
        ctx.fillStyle = skinHi; rr(ctx, s * .24, s * .06, s * .44, s * .09, s * .1);
        // hair
        shad(ctx, .15); ctx.fillStyle = hair; rr(ctx, s * .2, s * .02, s * .52, s * .16, s * .1); noShad(ctx);
        ctx.fillStyle = hairDk; rr(ctx, s * .68, s * .04, s * .08, s * .26, 4); // side hair
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, s * .22, s * .03, s * .26, s * .06, 4);
        // maid headband (white ruffle)
        ctx.fillStyle = '#fff'; rr(ctx, s * .24, s * .01, s * .44, s * .06, 3);
        ctx.fillStyle = 'rgba(200,200,200,0.3)'; rr(ctx, s * .24, s * .05, s * .44, s * .02, 1);
        // ribbon on hair
        ctx.fillStyle = ribbon; rr(ctx, s * .66, s * .12, s * .1, s * .08, 3);
        ctx.fillStyle = ribbon; rr(ctx, s * .63, s * .17, s * .06, s * .1, 2);
        // bow at chest
        ctx.fillStyle = bow; rr(ctx, s * .32, s * .38, s * .12, s * .08, 3);
        // side eye
        ctx.fillStyle = '#fff'; rr(ctx, s * .54, s * .12, s * .1, s * .08, 2);
        ctx.fillStyle = '#5d3a1a'; ctx.beginPath(); ctx.arc(s * .62, s * .16, s * .035, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * .605, s * .145, s * .015, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,140,120,0.35)'; ctx.beginPath(); ctx.ellipse(s * .56, s * .2, s * .06, s * .035, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    } else {
        const isFront = (dir !== 'up');
        // legs
        const lx = px + s * .22 + swing * s * .06, rx = px + s * .52 - swing * s * .06;
        const lyOff = swing > 0 ? -swing * s * .04 : 0, ryOff = swing < 0 ? swing * s * .04 : 0;
        ctx.fillStyle = dress;
        rr(ctx, lx, py2 + s * .62, s * .2, s * .26, 3); rr(ctx, rx, py2 + s * .62, s * .2, s * .26, 3);
        ctx.fillStyle = shoe;
        rr(ctx, lx - s * .02, py2 + s * .86 + lyOff, s * .26, s * .1, 3); rr(ctx, rx - s * .02, py2 + s * .86 + ryOff, s * .26, s * .1, 3);
        // dress body
        shad(ctx, .3); ctx.fillStyle = dress; rr(ctx, px + s * .16, py2 + s * .36, s * .68, s * .3, s * .07); noShad(ctx);
        ctx.fillStyle = dressHi; rr(ctx, px + s * .16, py2 + s * .36, s * .68, s * .08, s * .07);
        // apron (front)
        if (isFront) {
            ctx.fillStyle = apron; rr(ctx, px + s * .24, py2 + s * .4, s * .52, s * .26, 4);
            ctx.fillStyle = apronSh; rr(ctx, px + s * .24, py2 + s * .62, s * .52, s * .04, 2);
            // apron strings
            ctx.fillStyle = apron; rr(ctx, px + s * .18, py2 + s * .4, s * .08, s * .04, 2);
            ctx.fillStyle = apron; rr(ctx, px + s * .74, py2 + s * .4, s * .08, s * .04, 2);
            // bow
            ctx.fillStyle = bow; rr(ctx, px + s * .38, py2 + s * .38, s * .24, s * .06, 3);
            ctx.fillStyle = bow;
            ctx.beginPath(); ctx.moveTo(px + s * .42, py2 + s * .41); ctx.lineTo(px + s * .36, py2 + s * .38);
            ctx.lineTo(px + s * .39, py2 + s * .44); ctx.fill();
            ctx.beginPath(); ctx.moveTo(px + s * .58, py2 + s * .41); ctx.lineTo(px + s * .64, py2 + s * .38);
            ctx.lineTo(px + s * .61, py2 + s * .44); ctx.fill();
        }
        // skirt flare
        ctx.fillStyle = dress; rr(ctx, px + s * .12, py2 + s * .58, s * .76, s * .1, 4);
        // arms
        ctx.fillStyle = dress;
        rr(ctx, px + s * .04 + swing * s * .04, py2 + s * .38, s * .14, s * .2, 4);
        rr(ctx, px + s * .82 - swing * s * .04, py2 + s * .38, s * .14, s * .2, 4);
        ctx.fillStyle = skin;
        rr(ctx, px + s * .06 + swing * s * .04, py2 + s * .56, s * .1, s * .07, 3);
        rr(ctx, px + s * .84 - swing * s * .04, py2 + s * .56, s * .1, s * .07, 3);
        // neck
        ctx.fillStyle = skin; rr(ctx, px + s * .42, py2 + s * .28, s * .16, s * .1, 3);
        // head
        shad(ctx, .2); ctx.fillStyle = skin; rr(ctx, px + s * .24, py2 + s * .06, s * .52, s * .26, s * .12); noShad(ctx);
        ctx.fillStyle = skinHi; rr(ctx, px + s * .26, py2 + s * .07, s * .48, s * .09, s * .1);
        // hair
        shad(ctx, .15); ctx.fillStyle = hair; rr(ctx, px + s * .22, py2 + s * .03, s * .56, s * .15, s * .1); noShad(ctx);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, px + s * .25, py2 + s * .04, s * .28, s * .06, 4);
        // side hair strands
        ctx.fillStyle = hairDk; rr(ctx, px + s * .22, py2 + s * .1, s * .08, s * .12, 3);
        ctx.fillStyle = hairDk; rr(ctx, px + s * .7, py2 + s * .1, s * .08, s * .12, 3);
        // maid headband
        ctx.fillStyle = '#fff'; rr(ctx, px + s * .26, py2 + s * .01, s * .48, s * .06, 3);
        ctx.fillStyle = 'rgba(200,200,200,0.3)'; rr(ctx, px + s * .26, py2 + s * .05, s * .48, s * .02, 1);
        // ribbons
        ctx.fillStyle = ribbon; rr(ctx, px + s * .2, py2 + s * .12, s * .08, s * .06, 3);
        ctx.fillStyle = ribbon; rr(ctx, px + s * .17, py2 + s * .16, s * .05, s * .08, 2);
        ctx.fillStyle = ribbon; rr(ctx, px + s * .72, py2 + s * .12, s * .08, s * .06, 3);
        ctx.fillStyle = ribbon; rr(ctx, px + s * .78, py2 + s * .16, s * .05, s * .08, 2);
        if (isFront) {
            // eyes
            ctx.fillStyle = '#fff'; rr(ctx, px + s * .33, py2 + s * .13, s * .1, s * .08, 2); rr(ctx, px + s * .55, py2 + s * .13, s * .1, s * .08, 2);
            ctx.fillStyle = '#5d3a1a';
            ctx.beginPath(); ctx.arc(px + s * .38, py2 + s * .17, s * .035, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(px + s * .6, py2 + s * .17, s * .035, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(px + s * .365, py2 + s * .155, s * .015, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(px + s * .585, py2 + s * .155, s * .015, 0, Math.PI * 2); ctx.fill();
            // blush
            ctx.fillStyle = 'rgba(255,140,120,0.35)';
            ctx.beginPath(); ctx.ellipse(px + s * .3, py2 + s * .2, s * .07, s * .04, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(px + s * .7, py2 + s * .2, s * .07, s * .04, 0, 0, Math.PI * 2); ctx.fill();
            // mouth
            ctx.strokeStyle = '#c2796a'; ctx.lineWidth = 1.5; ctx.beginPath();
            ctx.arc(px + s * .5, py2 + s * .22, s * .05, 0.2, Math.PI - .2); ctx.stroke();
        } else {
            // back view: more hair, apron bow
            ctx.fillStyle = hairDk; rr(ctx, px + s * .28, py2 + s * .1, s * .44, s * .14, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, px + s * .3, py2 + s * .12, s * .2, s * .05, 3);
            // back apron bow
            ctx.fillStyle = apron; rr(ctx, px + s * .34, py2 + s * .42, s * .32, s * .06, 3);
            ctx.fillStyle = bow; rr(ctx, px + s * .42, py2 + s * .4, s * .16, s * .1, 4);
        }
    }
    // Status ring
    if (status !== 'idle') {
        ctx.strokeStyle = status === 'moving' ? 'rgba(52,211,153,0.85)' : 'rgba(239,68,68,0.85)';
        ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px + s * .5, py + s * .5, s * .49, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = status === 'moving' ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)';
        ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(px + s * .5, py + s * .5, s * .49, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
}


// ── Scene furniture (精装修) ───────────────────────────────────
export const FURN = [
    // ═══ HOME BEDROOM (cols 3-9, rows 4-9) ═══
    // bed (2-wide) along north wall
    { t: 'bed2', c: 3, r: 4 }, { t: 'bed2', c: 4, r: 4 },
    // bedside lamps
    { t: 'lamp', c: 2, r: 4 }, { t: 'lamp', c: 5, r: 4 }, // virtual since walls, use col 3 area
    // wardrobe
    { t: 'wardrobe', c: 8, r: 4 }, { t: 'wardrobe', c: 9, r: 4 },
    // shelf / bookcase
    { t: 'shelf', c: 3, r: 8 }, { t: 'shelf', c: 4, r: 8 },
    // desk + chair
    { t: 'desk', c: 7, r: 6 }, { t: 'chair', c: 7, r: 7 },
    // bedside plant
    { t: 'plant', c: 9, r: 8 },
    // rug
    { t: 'rug2', c: 5, r: 6 }, { t: 'rug2', c: 6, r: 6 }, { t: 'rug2', c: 5, r: 7 }, { t: 'rug2', c: 6, r: 7 },
    // doormat
    { t: 'mat', c: 7, r: 12 },

    // ═══ HOME LIVING ROOM (cols 3-14, rows 4-12, right half) ═══
    // sofa set (L-shape)
    { t: 'sofa', c: 10, r: 5 }, { t: 'sofa', c: 11, r: 5 }, { t: 'sofa', c: 12, r: 5 },
    { t: 'sofa_corner', c: 13, r: 5 },
    { t: 'sofa', c: 13, r: 6 },
    // coffee table
    { t: 'table_round', c: 11, r: 7 }, { t: 'table_round', c: 12, r: 7 },
    // TV across from sofa
    { t: 'tv', c: 10, r: 4 }, { t: 'tv', c: 11, r: 4 },
    // shelf on east wall
    { t: 'shelf', c: 13, r: 8 }, { t: 'shelf', c: 13, r: 9 },
    // plant in corner
    { t: 'plant2', c: 13, r: 11 }, { t: 'plant', c: 10, r: 11 },
    // rug under seating
    { t: 'rug', c: 11, r: 6 }, { t: 'rug', c: 12, r: 6 },
    // lamp
    { t: 'lamp', c: 10, r: 10 },

    // ═══ HOME KITCHEN (cols 3-8, rows 10-12) ═══
    // counter along south wall
    { t: 'counter', c: 3, r: 12 }, { t: 'counter', c: 4, r: 12 }, { t: 'counter', c: 5, r: 12 },
    { t: 'stove', c: 6, r: 12 }, { t: 'counter_sink', c: 7, r: 12 },
    // dining table + chairs
    { t: 'table', c: 3, r: 10 }, { t: 'table', c: 4, r: 10 },
    { t: 'chair', c: 3, r: 9 }, { t: 'chair', c: 4, r: 9 }, { t: 'chair', c: 5, r: 9 },
    { t: 'chair', c: 3, r: 11 }, { t: 'chair', c: 5, r: 11 },
    // plant
    { t: 'plant2', c: 8, r: 10 },

    // ═══ BATH (cols 18-25, rows 4-9) ═══
    { t: 'bath', c: 18, r: 5 }, { t: 'bath', c: 19, r: 5 },
    { t: 'sink', c: 21, r: 4 }, { t: 'sink', c: 23, r: 4 },
    { t: 'counter_sink', c: 25, r: 4 },
    // bath mat
    { t: 'mat', c: 18, r: 7 }, { t: 'mat', c: 19, r: 7 },
    // plant
    { t: 'plant', c: 25, r: 8 }, { t: 'plant2', c: 25, r: 7 },

    // ═══ KITCHEN (cols 27-33, rows 4-12) ═══
    // counter + appliances along west wall
    { t: 'counter', c: 27, r: 4 }, { t: 'stove', c: 28, r: 4 }, { t: 'counter', c: 29, r: 4 },
    { t: 'counter', c: 30, r: 4 }, { t: 'counter', c: 31, r: 4 }, { t: 'counter', c: 32, r: 4 },
    { t: 'counter_sink', c: 33, r: 4 },
    // island / dining table
    { t: 'table', c: 28, r: 7 }, { t: 'table', c: 29, r: 7 }, { t: 'table', c: 30, r: 7 },
    { t: 'chair', c: 28, r: 6 }, { t: 'chair', c: 29, r: 6 }, { t: 'chair', c: 30, r: 6 }, { t: 'chair', c: 31, r: 6 },
    { t: 'chair', c: 28, r: 8 }, { t: 'chair', c: 30, r: 8 },
    // shelf on east wall
    { t: 'shelf', c: 33, r: 7 }, { t: 'shelf', c: 33, r: 8 },
    // barrel (storage)
    { t: 'barrel', c: 33, r: 11 }, { t: 'barrel', c: 32, r: 11 },
    // rug
    { t: 'rug', c: 29, r: 9 }, { t: 'rug', c: 30, r: 9 },
    // plant
    { t: 'plant', c: 33, r: 11 }, { t: 'plant2', c: 27, r: 11 },
    // mat at door
    { t: 'mat', c: 24, r: 12 },

    // ═══ PARK (cols 0-12, rows 17-24) ═══
    { t: 'tree', c: 1, r: 17 }, { t: 'tree', c: 4, r: 17 }, { t: 'tree', c: 7, r: 17 }, { t: 'tree', c: 10, r: 17 },
    { t: 'tree', c: 1, r: 23 }, { t: 'tree', c: 4, r: 24 }, { t: 'tree', c: 8, r: 24 }, { t: 'tree', c: 11, r: 23 },
    { t: 'tree', c: 0, r: 20 }, { t: 'tree', c: 12, r: 21 },
    { t: 'fountain', c: 5, r: 20 }, { t: 'fountain', c: 6, r: 20 },
    { t: 'bench', c: 3, r: 19 }, { t: 'bench', c: 8, r: 19 },
    { t: 'bench', c: 3, r: 22 }, { t: 'bench', c: 8, r: 22 },
    { t: 'flower', c: 1, r: 19 }, { t: 'flower', c: 10, r: 19 },
    { t: 'flower', c: 2, r: 22 }, { t: 'flower', c: 9, r: 22 },
    { t: 'flower', c: 4, r: 23 }, { t: 'flower', c: 7, r: 23 },
    { t: 'flower', c: 1, r: 21 }, { t: 'flower', c: 11, r: 21 },

    // ═══ MALL interior (cols 14-18, rows 18-23) ═══
    { t: 'shelf', c: 14, r: 18 }, { t: 'shelf', c: 15, r: 18 }, { t: 'shelf', c: 16, r: 18 },
    { t: 'shelf', c: 14, r: 20 }, { t: 'shelf', c: 15, r: 20 },
    { t: 'vending', c: 17, r: 18 }, { t: 'vending', c: 18, r: 18 },
    { t: 'barrel', c: 17, r: 20 }, { t: 'barrel', c: 18, r: 20 },
    { t: 'counter', c: 14, r: 22 }, { t: 'counter', c: 15, r: 22 }, { t: 'counter', c: 16, r: 22 },
    { t: 'plant', c: 18, r: 22 }, { t: 'sign', c: 14, r: 17 },

    // ═══ CITY HALL interior (cols 22-27, rows 18-23) ═══
    { t: 'desk', c: 22, r: 18 }, { t: 'desk', c: 24, r: 18 }, { t: 'desk', c: 26, r: 18 },
    { t: 'chair', c: 22, r: 19 }, { t: 'chair', c: 24, r: 19 }, { t: 'chair', c: 26, r: 19 },
    { t: 'bench', c: 22, r: 21 }, { t: 'bench', c: 22, r: 22 },
    { t: 'bench', c: 25, r: 21 }, { t: 'bench', c: 25, r: 22 },
    { t: 'plant', c: 27, r: 18 }, { t: 'plant2', c: 22, r: 23 },
    { t: 'table', c: 24, r: 22 }, { t: 'chair', c: 23, r: 22 }, { t: 'chair', c: 25, r: 22 },
    { t: 'sign', c: 24, r: 17 },

    // ═══ COFFEE SHOP interior (cols 31-35, rows 18-23) ═══
    // counter along back wall
    { t: 'counter', c: 31, r: 23 }, { t: 'counter', c: 32, r: 23 }, { t: 'counter', c: 33, r: 23 }, { t: 'counter', c: 34, r: 23 },
    // tables + chairs (3 tables)
    { t: 'table_round', c: 31, r: 19 }, { t: 'chair', c: 30, r: 19 }, { t: 'chair', c: 32, r: 19 }, { t: 'chair', c: 31, r: 20 },
    { t: 'table_round', c: 33, r: 19 }, { t: 'chair', c: 34, r: 19 }, { t: 'chair', c: 33, r: 20 },
    { t: 'table_round', c: 32, r: 21 }, { t: 'chair', c: 31, r: 21 }, { t: 'chair', c: 33, r: 21 }, { t: 'chair', c: 32, r: 22 },
    // plants
    { t: 'plant2', c: 35, r: 18 }, { t: 'plant', c: 35, r: 22 },
    { t: 'rug', c: 32, r: 20 }, { t: 'rug', c: 33, r: 20 },
    { t: 'sign', c: 32, r: 17 },

    // ═══ MARKET interior (cols 39-45, rows 18-23) ═══
    // stalls / barrels
    { t: 'barrel', c: 39, r: 18 }, { t: 'barrel', c: 41, r: 18 }, { t: 'barrel', c: 43, r: 18 }, { t: 'barrel', c: 45, r: 18 },
    { t: 'barrel', c: 40, r: 21 }, { t: 'barrel', c: 42, r: 21 }, { t: 'barrel', c: 44, r: 21 },
    { t: 'shelf', c: 39, r: 20 }, { t: 'shelf', c: 41, r: 20 }, { t: 'shelf', c: 43, r: 20 },
    { t: 'counter', c: 39, r: 22 }, { t: 'counter', c: 40, r: 22 }, { t: 'counter', c: 41, r: 22 },
    { t: 'counter', c: 43, r: 22 }, { t: 'counter', c: 44, r: 22 }, { t: 'counter', c: 45, r: 22 },
    { t: 'flower', c: 45, r: 20 }, { t: 'flower', c: 39, r: 23 }, { t: 'flower', c: 45, r: 23 },
    { t: 'plant', c: 45, r: 19 }, { t: 'sign', c: 40, r: 17 },
];

// Outdoor trees
export const TREES = [
    [0, 0], [3, 0], [7, 0], [12, 0], [17, 0], [22, 0], [27, 0], [32, 0], [37, 0], [42, 0], [47, 0],
    [0, 27], [4, 27], [9, 27], [14, 27], [19, 27], [24, 27], [29, 27], [34, 27], [39, 27], [44, 27], [47, 27],
    [0, 3], [0, 7], [0, 11], [47, 4], [47, 8], [47, 12],
    [35, 4], [36, 8], [35, 11], [36, 4], [35, 8],
];

// ── Get all built-in furniture in unified format ──────────────
export function getBuiltInFurniture() {
    const items = FURN.map(f => ({ t: f.t, c: f.c, r: f.r }));
    TREES.forEach(([c, r]) => items.push({ t: 'tree', c, r }));
    return items;
}

// ── Floor tile types for the editor palette ──────────────────
// walkable: true = 可行走, false = 不可行走 (墙壁)
export const FLOOR_TYPES = [
    { id: 'f_grass', label: '草地1', colors: [C.grass, C.grass], walkable: true },
    { id: 'f_grass2', label: '草地2', colors: [C.grassAlt, C.grassAlt], walkable: true },
    { id: 'f_road', label: '道路', colors: [C.road, C.road], isRoad: true, walkable: true },
    { id: 'f_sidewalk', label: '人行道', colors: [C.sidewalk, C.sidewalkEdge], walkable: true },
    { id: 'f_homewall', label: '房屋墙壁', colors: [C.homeWall, C.homeWall], walkable: false },
    { id: 'f_bedroom', label: '卧室地板', colors: [C.bedroomFloor, C.bedroomAlt], walkable: true },
    { id: 'f_living', label: '客厅地板', colors: [C.livingFloor, C.livingAlt], walkable: true },
    { id: 'f_kitchen', label: '厨房地板', colors: [C.kitchenFloor, C.kitchenAlt], walkable: true },
    { id: 'f_corridor', label: '走廊', colors: [C.corridor, C.corridor], walkable: true },
    { id: 'f_bathwall', label: '浴室墙壁', colors: [C.bathWall, C.bathWall], walkable: false },
    { id: 'f_bath', label: '浴室地板', colors: [C.bathFloor, C.bathAlt], walkable: true },
    { id: 'f_parkgrass', label: '公园草地1', colors: [C.parkGrass, C.parkGrass], walkable: true },
    { id: 'f_parkgrass2', label: '公园草地2', colors: [C.parkAlt, C.parkAlt], walkable: true },
    { id: 'f_parkpath', label: '公园小路', colors: [C.parkPath, C.parkPath], walkable: true },
    { id: 'f_mallwall', label: '商场墙壁', colors: [C.mallWall, C.mallWall], walkable: false },
    { id: 'f_mall', label: '商场地板', colors: [C.mallFloor, C.mallAlt], walkable: true },
    { id: 'f_citywall', label: '市政墙壁', colors: [C.cityWall, C.cityWall], walkable: false },
    { id: 'f_city', label: '市政地板', colors: [C.cityFloor, C.cityAlt], walkable: true },
    { id: 'f_cafewall', label: '咖啡墙壁', colors: [C.cafeWall, C.cafeWall], walkable: false },
    { id: 'f_cafe', label: '咖啡地板', colors: [C.cafeFloor, C.cafeAlt], walkable: true },
    { id: 'f_marketwall', label: '市集墙壁', colors: [C.marketWall, C.marketWall], walkable: false },
    { id: 'f_market', label: '市集地板', colors: [C.marketFloor, C.marketAlt], walkable: true },
    { id: 'f_water', label: '水面', colors: ['#2196f3', '#1e88e5'], isWater: true, walkable: false },
    { id: 'f_sand', label: '沙地', colors: ['#e8d5a0', '#dbc890'], walkable: true },
    { id: 'f_stone', label: '石板路', colors: ['#9e9e9e', '#8a8a8a'], walkable: true },
    { id: 'f_dirt', label: '泥地', colors: ['#8d6e4c', '#7d5e3c'], walkable: true },
    { id: 'f_empty', label: '空地(已擦除)', colors: ['#0d1117', '#0d1117'], walkable: true },
];

// Helper: lookup floor walkable
export function isFloorWalkable(floorId) {
    const ft = FLOOR_TYPES.find(f => f.id === floorId);
    return ft ? ft.walkable : true;
}

export function drawFloorTile(ctx, floorId, col, row, cs) {
    const ft = FLOOR_TYPES.find(f => f.id === floorId);
    if (!ft) return;
    const x = Math.floor(col * cs), y = Math.floor(row * cs);
    const w = Math.ceil(cs) + 1, h = Math.ceil(cs) + 1; // +1 to avoid gaps
    const useAlt = (col + row) % 2 === 1;
    const color = useAlt ? ft.colors[1] : ft.colors[0];
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    // Road: draw center dashed line
    if (ft.isRoad) {
        ctx.fillStyle = C.roadLine;
        ctx.fillRect(x + cs * .1, y + cs * .46, cs * .8, cs * .08);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(x, y, w, cs * .04);
        ctx.fillRect(x, y + cs - cs * .04, w, cs * .04);
    }
    // Water: animated shimmer
    if (ft.isWater) {
        const shimmer = 0.07 + Math.sin(Date.now() / 600 + col + row) * 0.04;
        ctx.fillStyle = `rgba(255,255,255,${shimmer})`;
        ctx.fillRect(x, y, w, h);
    }
    // Empty marker: hatched pattern
    if (floorId === 'f_empty') {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + cs - 3, y + cs - 3);
        ctx.moveTo(x + cs - 3, y + 3); ctx.lineTo(x + 3, y + cs - 3);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.font = `${Math.max(8, cs * 0.22)}px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText('∅', x + cs / 2, y + cs / 2);
    }
}

// ── Main draw ─────────────────────────────────────────────────
export function drawScene(ctx, W, H, zoom, offset, pois, cCol, cRow, cStatus, cLabel, hovered, cDir, customFurn, customFloors) {
    const cs = CELL * zoom, ox = offset.x, oy = offset.y;
    const gc = (c, r) => ({ x: Math.floor(ox + c * cs), y: Math.floor(oy + r * cs) });
    const fr = (c, r, w, h, col) => {
        const { x, y } = gc(c, r);
        const { x: x2, y: y2 } = gc(c + w, r + h);
        if (x2 < 0 || y2 < 0 || x > W || y > H) return;
        ctx.fillStyle = col; ctx.fillRect(x, y, x2 - x + 1, y2 - y + 1);
    };

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.sky; ctx.fillRect(0, 0, W, H);

    // ── Base grass ──
    fr(0, 0, COLS, ROWS, C.grass);
    for (let r = 0; r < ROWS; r += 2) for (let c = r % 2; c < COLS; c += 2) fr(c, r, 1, 1, C.grassAlt);

    // ── Sidewalks ──
    [2, 14, 16, 25].forEach(r => fr(0, r, COLS, 1, C.sidewalk));

    // ── Roads ──
    [15, 26].forEach(r => {
        fr(0, r, COLS, 1, C.road);
        ctx.fillStyle = C.roadLine;
        for (let c = 0; c < COLS; c += 2) { const { x, y } = gc(c, r); ctx.fillRect(x + cs * .1, y + cs * .46, cs * .8, cs * .08); }
        // edges
        const { y: yt } = gc(0, r); const { y: yb } = gc(0, r + 1);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(ox, yt, COLS * cs, cs * .04);
        ctx.fillRect(ox, yb - cs * .04, COLS * cs, cs * .04);
    });

    // ── Path col 16 (between home and bath) ──
    fr(16, 3, 1, 11, C.sidewalk);

    // ── Garden / grass between home and bath building ──
    for (let r = 3; r < 14; r++) {
        fr(35, r, 1, 1, C.sidewalk); // right corridor
    }

    // ── HOME exterior + interior rooms ──
    fr(2, 3, 14, 11, C.homeWall);
    // bedroom (west half of house)
    for (let r = 4; r < 13; r++) for (let c = 3; c < 10; c++) fr(c, r, 1, 1, (r + c) % 2 === 0 ? C.bedroomFloor : C.bedroomAlt);
    // living room (east half)
    for (let r = 4; r < 13; r++) for (let c = 10; c < 15; c++) fr(c, r, 1, 1, (r + c) % 2 === 0 ? C.livingFloor : C.livingAlt);
    // kitchen (bottom-west corner, same as bedroom floor but lighter)
    for (let r = 10; r < 13; r++) for (let c = 3; c < 9; c++) fr(c, r, 1, 1, (r + c) % 2 === 0 ? C.kitchenFloor : C.kitchenAlt);
    // corridor / divider line
    fr(9, 4, 1, 9, 'rgba(0,0,0,0.08)');
    fr(3, 10, 6, 1, 'rgba(0,0,0,0.08)');
    // door trim
    fr(7, 13, 1, 1, C.homeTrim);

    // ── BATH/KITCHEN exterior ──
    fr(17, 3, 18, 11, C.bathWall);
    // bath zone (west)
    for (let r = 4; r < 13; r++) for (let c = 18; c < 27; c++) fr(c, r, 1, 1, (r + c) % 2 === 0 ? C.bathFloor : C.bathAlt);
    // kitchen zone (east)
    for (let r = 4; r < 13; r++) for (let c = 27; c < 34; c++) fr(c, r, 1, 1, (r + c) % 2 === 0 ? C.kitchenFloor : C.kitchenAlt);
    // divider
    fr(26, 4, 1, 9, 'rgba(0,0,0,0.12)');
    // door trim
    fr(24, 13, 1, 1, C.bathTrim);

    // ── PARK ──
    for (let r = 17; r < 25; r++) for (let c = 0; c < 13; c++) fr(c, r, 1, 1, (r + c) % 2 === 0 ? C.parkGrass : C.parkAlt);
    fr(5, 17, 2, 8, C.parkPath);  // vertical path
    fr(0, 20, 13, 1, C.parkPath); // horizontal path

    // ── COMMERCIAL buildings ──
    const commercialDefs = [
        { x: 13, y: 17, w: 7, h: 8, floor: C.mallFloor, alt: C.mallAlt, wall: C.mallWall, trim: C.mallTrim || C.mallWall },
        { x: 21, y: 17, w: 8, h: 8, floor: C.cityFloor, alt: C.cityAlt, wall: C.cityWall, trim: C.cityWall },
        { x: 30, y: 17, w: 7, h: 8, floor: C.cafeFloor, alt: C.cafeAlt, wall: C.cafeWall, trim: C.cafeWall },
        { x: 38, y: 17, w: 9, h: 8, floor: C.marketFloor, alt: C.marketAlt, wall: C.marketWall, trim: C.marketWall },
    ];
    commercialDefs.forEach(d => {
        fr(d.x, d.y, d.w, d.h, d.wall);
        for (let r = d.y + 1; r < d.y + d.h - 1; r++) for (let c = d.x + 1; c < d.x + d.w - 1; c++) fr(c, r, 1, 1, (r + c) % 2 === 0 ? d.floor : d.alt);
    });

    // ── Hover highlight ──
    if (hovered) {
        const { x, y } = gc(hovered.col, hovered.row);
        ctx.strokeStyle = 'rgba(255,220,80,.9)'; ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2);
        ctx.fillStyle = 'rgba(255,220,80,.1)'; ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
    }
    // ── Custom (user-placed) floor tiles ──
    if (customFloors && customFloors.length) {
        customFloors.forEach(f => {
            const { x, y } = gc(f.c, f.r);
            if (x + cs < 0 || y + cs < 0 || x > W || y > H) return;
            // drawFloorTile uses col*cs, but we need offset. Use ctx.save/translate.
            ctx.save();
            ctx.translate(ox, oy);
            drawFloorTile(ctx, f.t, f.c, f.r, cs);
            ctx.restore();
        });
    }

    // ── All furniture (built-in + custom, all stored in customFurn) ──
    if (customFurn && customFurn.length) {
        customFurn.forEach(f => {
            const { x, y } = gc(f.c, f.r);
            if (x + cs < 0 || y + cs < 0 || x > W || y > H) return;
            drawFurniture(ctx, f.t, f.c, f.r, cs);
        });
    }

    // ── POI labels ──
    ctx.textBaseline = 'bottom';
    pois.forEach(p => {
        const { x, y } = gc(p.col, p.row);
        if (x > W + 200 || y > H + 40 || x + 300 < 0 || y + 40 < 0) return;
        const fs = Math.max(9, Math.min(13, zoom * 13));
        ctx.font = `bold ${fs}px sans-serif`;
        const tw = ctx.measureText(p.label).width + 10, bh = fs + 8;
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.beginPath(); ctx.roundRect(x + 2, y - bh + 2, tw + 2, bh + 2, 5); ctx.fill();
        ctx.fillStyle = p.color || '#d97706';
        ctx.beginPath(); ctx.roundRect(x, y - bh, tw, bh, 5); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillText(p.label, x + 5, y - 2);
    });

    // ── Character + bubble ──
    const { x: cx, y: cy } = gc(cCol, cRow);
    if (cx + cs > -cs && cy + cs > -cs && cx < W + cs && cy < H + cs) {
        drawCharacter(ctx, cx, cy, cs, cStatus, cDir);
        if (cLabel) {
            const fs2 = Math.max(8, Math.min(12, zoom * 11));
            ctx.font = `bold ${fs2}px sans-serif`;
            ctx.textBaseline = 'bottom';
            const tw2 = ctx.measureText(cLabel).width + 10, bh2 = fs2 + 8;
            const bx = cx + cs / 2 - tw2 / 2, by = cy - 5;
            ctx.fillStyle = 'rgba(0,0,0,.75)';
            ctx.beginPath(); ctx.roundRect(bx - 1, by - bh2 - 1, tw2 + 2, bh2 + 2, 6); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.roundRect(bx, by - bh2, tw2, bh2, 5); ctx.fill();
            ctx.fillStyle = '#1e293b'; ctx.fillText(cLabel, bx + 5, by - 2);
        }
    }
}
