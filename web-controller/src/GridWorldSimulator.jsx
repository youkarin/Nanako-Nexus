import React, { useRef, useEffect, useState, useCallback } from 'react';
import { loadPois, POI_KEY, findLocation } from './mapUtils';

// ════════════════════════════════════════════════════════════
//  NANAKO WORLD  v2 — 48×28 grid, fully furnished interiors
// ════════════════════════════════════════════════════════════
const COLS = 48, ROWS = 28, CELL = 48;

const C = {
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
function buildWalkGrid() {
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
const WALK_GRID = buildWalkGrid();

function findPath(sc, sr, ec, er) {
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

// ── Furniture renderer ────────────────────────────────────────
function drawFurniture(ctx, type, col, row, cs) {
    const x = col * cs, y = row * cs, s = cs;
    ctx.save();
    switch (type) {
        case 'bed':
            ctx.fillStyle = C.bedFrame; ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
            ctx.fillStyle = C.bedCover; ctx.fillRect(x + 4, y + s * .38, s - 8, s * .55);
            ctx.fillStyle = C.pillow; ctx.fillRect(x + 4, y + 5, s - 8, s * .3);
            break;
        case 'bed2': // double bed (2 pillows, different colour)
            ctx.fillStyle = C.bedFrame; ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
            ctx.fillStyle = C.bedCover2; ctx.fillRect(x + 4, y + s * .38, s - 8, s * .55);
            ctx.fillStyle = C.pillow; ctx.fillRect(x + 4, y + 5, (s - 12) / 2, s * .3);
            ctx.fillStyle = '#fce4ec'; ctx.fillRect(x + s / 2 + 2, y + 5, (s - 12) / 2, s * .3);
            break;
        case 'desk':
            ctx.fillStyle = C.desk; ctx.fillRect(x + 2, y + s * .3, s - 4, s * .55);
            ctx.fillStyle = C.deskScreen; ctx.fillRect(x + s * .15, y + 3, s * .65, s * .38);
            ctx.fillStyle = C.deskScreenOn; ctx.fillRect(x + s * .17, y + 5, s * .61, s * .32);
            ctx.fillStyle = '#90caf9'; ctx.fillRect(x + s * .2, y + 7, s * .5, s * .2);
            ctx.fillStyle = '#607d8b'; ctx.fillRect(x + s * .1, y + s * .7, s * .7, s * .18);
            break;
        case 'tv':
            // TV on stand
            ctx.fillStyle = '#37474f'; ctx.fillRect(x + s * .05, y + s * .5, s * .9, s * .12); // stand
            ctx.fillStyle = C.tv; ctx.fillRect(x + s * .08, y + s * .06, s * .84, s * .46);
            ctx.fillStyle = C.tvScreen; ctx.fillRect(x + s * .1, y + s * .08, s * .8, s * .4);
            ctx.fillStyle = '#1e88e5';  // content glow
            ctx.fillRect(x + s * .12, y + s * .1, s * .6, s * .28);
            break;
        case 'wardrobe':
            ctx.fillStyle = C.wardrobe; ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
            ctx.fillStyle = C.wardrobeDoor; ctx.fillRect(x + 3, y + 3, s * .44, s - 6);
            ctx.fillStyle = C.wardrobeDoor; ctx.fillRect(x + s * .52, y + 3, s * .44, s - 6);
            ctx.fillStyle = '#a1887f'; // handles
            ctx.beginPath(); ctx.arc(x + s * .44, y + s * .5, s * .05, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + s * .56, y + s * .5, s * .05, 0, Math.PI * 2); ctx.fill();
            break;
        case 'shelf':
            ctx.fillStyle = C.shelf; ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
            [0.1, 0.38, 0.65].forEach((fy, ri) => {
                C.book.slice(0, 4 + ri).forEach((bc, i) => {
                    const bw = (s - 10) / (4 + ri);
                    ctx.fillStyle = bc; ctx.fillRect(x + 4 + i * bw, y + fy * s, bw - 1, s * .24);
                });
            });
            break;
        case 'plant':
            ctx.fillStyle = C.pot; ctx.fillRect(x + s * .3, y + s * .62, s * .4, s * .32);
            ctx.fillStyle = C.plant; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .42, s * .33, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.plantDark; ctx.beginPath(); ctx.arc(x + s * .34, y + s * .36, s * .18, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.treeLight; ctx.beginPath(); ctx.arc(x + s * .64, y + s * .38, s * .14, 0, Math.PI * 2); ctx.fill();
            break;
        case 'plant2': // tall narrow plant
            ctx.fillStyle = C.pot; ctx.fillRect(x + s * .38, y + s * .7, s * .24, s * .26);
            ctx.fillStyle = C.plantDark; ctx.fillRect(x + s * .46, y + s * .35, s * .08, s * .38);
            ctx.fillStyle = C.plant; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .28, s * .25, 0, Math.PI * 2); ctx.fill();
            break;
        case 'table':
            ctx.fillStyle = C.table; ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
            ctx.fillStyle = C.tableTop; ctx.fillRect(x + 5, y + 5, s - 10, s * .35);
            break;
        case 'table_round':
            ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .38, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.tableTop; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .3, 0, Math.PI * 2); ctx.fill();
            break;
        case 'chair':
            ctx.fillStyle = C.chair; ctx.fillRect(x + s * .2, y + s * .08, s * .6, s * .35);
            ctx.fillStyle = C.chairSeat; ctx.fillRect(x + s * .15, y + s * .48, s * .7, s * .38);
            ctx.fillStyle = '#3e2723';
            [[.2, .86], [.65, .86]].forEach(([fx, fy]) => ctx.fillRect(x + fx * s, y + fy * s, s * .12, s * .1));
            break;
        case 'sofa':
            ctx.fillStyle = C.sofaDark; ctx.fillRect(x + 2, y + s * .1, s - 4, s - s * .1 - 2);
            ctx.fillStyle = C.sofa; ctx.fillRect(x + 4, y + s * .35, s - 8, s * .45);
            ctx.fillStyle = C.sofaCushion;
            ctx.fillRect(x + 6, y + s * .38, s * .36, s * .38);
            ctx.fillRect(x + s * .55, y + s * .38, s * .36, s * .38);
            break;
        case 'sofa_corner':
            ctx.fillStyle = C.sofaDark; ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
            ctx.fillStyle = C.couch2; ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
            break;
        case 'counter':
            ctx.fillStyle = C.counter; ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
            ctx.fillStyle = C.counterTop; ctx.fillRect(x + 2, y + 2, s - 4, s * .3);
            ctx.fillStyle = '#7c6040';
            ctx.fillRect(x + s * .1, y + s * .4, s * .25, s * .4); ctx.fillRect(x + s * .45, y + s * .4, s * .45, s * .4);
            break;
        case 'counter_sink':
            ctx.fillStyle = C.counter; ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
            ctx.fillStyle = C.counterTop; ctx.fillRect(x + 2, y + 2, s - 4, s * .3);
            ctx.fillStyle = C.sink; ctx.fillRect(x + s * .15, y + s * .38, s * .7, s * .45);
            ctx.fillStyle = '#607d8b'; ctx.fillRect(x + s * .42, y + s * .28, s * .16, s * .18);
            break;
        case 'bath':
            ctx.fillStyle = C.bath; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .5, s * .42, s * .42, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = C.bathEdge; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .42, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#5b8fa8'; ctx.fillRect(x + s * .38, y + s * .1, s * .25, s * .18);
            break;
        case 'sink':
            ctx.fillStyle = C.sink; ctx.fillRect(x + s * .1, y + s * .15, s * .8, s * .7);
            ctx.fillStyle = '#90caf9'; ctx.fillRect(x + s * .15, y + s * .25, s * .7, s * .5);
            ctx.fillStyle = '#607d8b'; ctx.fillRect(x + s * .42, y + s * .08, s * .16, s * .2);
            break;
        case 'stove':
            ctx.fillStyle = C.stove; ctx.fillRect(x + 3, y + 3, s - 6, s - 6);
            [[.25, .28], [.65, .28], [.25, .65], [.65, .65]].forEach(([fx, fy]) => {
                ctx.fillStyle = C.burner; ctx.beginPath(); ctx.arc(x + fx * s, y + fy * s, s * .12, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#546e7a'; ctx.beginPath(); ctx.arc(x + fx * s, y + fy * s, s * .07, 0, Math.PI * 2); ctx.fill();
            });
            break;
        case 'barrel':
            ctx.fillStyle = C.barrel; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .5, s * .35, s * .42, 0, 0, Math.PI * 2); ctx.fill();
            [.25, .5, .75].forEach(fy => {
                ctx.strokeStyle = C.barrelRing; ctx.lineWidth = 2; ctx.beginPath();
                ctx.ellipse(x + s * .5, y + fy * s, s * .35, s * .1, 0, 0, Math.PI * 2); ctx.stroke();
            });
            break;
        case 'rug':
            ctx.fillStyle = C.rug; ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
            ctx.strokeStyle = '#5c6bc0'; ctx.lineWidth = 1; ctx.strokeRect(x + 8, y + 8, s - 16, s - 16);
            break;
        case 'rug2':
            ctx.fillStyle = C.rug2; ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
            ctx.strokeStyle = '#e91e63'; ctx.lineWidth = 1; ctx.strokeRect(x + 8, y + 8, s - 16, s - 16);
            break;
        case 'mat':
            ctx.fillStyle = C.mat; ctx.fillRect(x + 3, y + s * .3, s - 6, s * .4);
            break;
        case 'tree':
            ctx.fillStyle = C.treeTrunk; ctx.fillRect(x + s * .4, y + s * .6, s * .2, s * .35);
            ctx.fillStyle = C.treeDark; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .38, s * .38, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.tree; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .35, s * .32, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.treeLight; ctx.beginPath(); ctx.arc(x + s * .38, y + s * .28, s * .16, 0, Math.PI * 2); ctx.fill();
            break;
        case 'bench':
            ctx.fillStyle = C.bench; ctx.fillRect(x + s * .08, y + s * .35, s * .84, s * .22);
            ctx.fillStyle = C.benchtop; ctx.fillRect(x + s * .08, y + s * .55, s * .84, s * .2);
            [[.1, .75], [.75, .75]].forEach(([fx, fy]) => { ctx.fillStyle = C.bench; ctx.fillRect(x + fx * s, y + fy * s, s * .12, s * .2); });
            break;
        case 'flower':
            C.flower.slice(0, 3).forEach((fc, i) => {
                ctx.fillStyle = fc; ctx.beginPath();
                ctx.arc(x + [.3, .5, .7][i] * s, y + [.5, .35, .6][i] * s, s * .14, 0, Math.PI * 2); ctx.fill();
            });
            break;
        case 'fountain':
            ctx.fillStyle = C.fountainRing; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .44, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.fountain; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .35, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#64b5f6'; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .1, 0, Math.PI * 2); ctx.fill();
            break;
        case 'lamp':
            ctx.fillStyle = C.lamp; ctx.fillRect(x + s * .46, y + s * .25, s * .08, s * .6);
            ctx.fillStyle = C.lampGlow; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .22, s * .18, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.lamp; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .22, s * .1, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#455a64'; ctx.fillRect(x + s * .3, y + s * .85, s * .4, s * .1);
            break;
        case 'vending':
            ctx.fillStyle = C.vend; ctx.fillRect(x + s * .1, y + s * .05, s * .8, s * .9);
            ctx.fillStyle = '#e3f2fd'; ctx.fillRect(x + s * .18, y + s * .12, s * .64, s * .55);
            ['#ef5350', '#43a047', '#ffd740'].forEach((vc, i) => {
                ctx.fillStyle = vc; ctx.beginPath(); ctx.arc(x + s * .5, y + (0.75 + i * .05) * s, s * .05, 0, Math.PI * 2); ctx.fill();
            });
            break;
        case 'sign':
            ctx.fillStyle = '#ef6c00'; ctx.fillRect(x + s * .1, y + s * .15, s * .8, s * .5);
            ctx.fillStyle = '#fff'; ctx.fillRect(x + s * .15, y + s * .2, s * .7, s * .38);
            ctx.fillStyle = '#ef6c00'; ctx.fillRect(x + s * .46, y + s * .65, s * .08, s * .25);
            ctx.fillStyle = '#795548'; ctx.fillRect(x + s * .3, y + s * .9, s * .4, s * .07);
            break;
    }
    ctx.restore();
}

// ── Character ─────────────────────────────────────────────────
function drawCharacter(ctx, px, py, cs, status) {
    const s = cs; ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(px + s * .5, py + s * .92, s * .28, s * .07, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3949ab'; ctx.fillRect(px + s * .22, py + s * .62, s * .22, s * .28);
    ctx.fillRect(px + s * .55, py + s * .62, s * .22, s * .28);
    ctx.fillStyle = '#212121'; ctx.fillRect(px + s * .18, py + s * .88, s * .26, s * .1);
    ctx.fillRect(px + s * .52, py + s * .88, s * .28, s * .1);
    ctx.fillStyle = status === 'moving' ? '#e91e63' : '#c2185b';
    ctx.beginPath(); ctx.roundRect(px + s * .18, py + s * .38, s * .64, s * .28, s * .06); ctx.fill();
    ctx.fillStyle = '#e91e63';
    ctx.fillRect(px + s * .05, py + s * .4, s * .14, s * .22);
    ctx.fillRect(px + s * .81, py + s * .4, s * .14, s * .22);
    ctx.fillStyle = '#ffcc80'; ctx.fillRect(px + s * .42, py + s * .3, s * .16, s * .1);
    ctx.beginPath(); ctx.roundRect(px + s * .25, py + s * .06, s * .5, s * .28, s * .12); ctx.fill();
    ctx.fillStyle = '#4e342e';
    ctx.beginPath(); ctx.roundRect(px + s * .24, py + s * .04, s * .52, s * .14, s * .08); ctx.fill();
    ctx.fillRect(px + s * .24, py + s * .08, s * .08, s * .14);
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(px + s * .35, py + s * .14, s * .08, s * .07);
    ctx.fillRect(px + s * .57, py + s * .14, s * .08, s * .07);
    if (status !== 'idle') {
        ctx.strokeStyle = status === 'moving' ? 'rgba(52,211,153,.9)' : 'rgba(239,68,68,.9)';
        ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px + s * .5, py + s * .5, s * .48, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
}

// ── Scene furniture (精装修) ───────────────────────────────────
const FURN = [
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
const TREES = [
    [0, 0], [3, 0], [7, 0], [12, 0], [17, 0], [22, 0], [27, 0], [32, 0], [37, 0], [42, 0], [47, 0],
    [0, 27], [4, 27], [9, 27], [14, 27], [19, 27], [24, 27], [29, 27], [34, 27], [39, 27], [44, 27], [47, 27],
    [0, 3], [0, 7], [0, 11], [47, 4], [47, 8], [47, 12],
    [35, 4], [36, 8], [35, 11], [36, 4], [35, 8],
];

// ── Main draw ─────────────────────────────────────────────────
function drawScene(ctx, W, H, zoom, offset, pois, cCol, cRow, cStatus, cLabel, hovered) {
    const cs = CELL * zoom, ox = offset.x, oy = offset.y;
    const gc = (c, r) => ({ x: Math.round(ox + c * cs), y: Math.round(oy + r * cs) });
    const fr = (c, r, w, h, col) => {
        const { x, y } = gc(c, r);
        if (x + w * cs < 0 || y + h * cs < 0 || x > W || y > H) return;
        ctx.fillStyle = col; ctx.fillRect(x, y, w * cs, h * cs);
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

    // ── Furniture ──
    FURN.forEach(f => {
        const { x, y } = gc(f.c, f.r);
        if (x + cs < 0 || y + cs < 0 || x > W || y > H) return;
        drawFurniture(ctx, f.t, f.c, f.r, cs);
    });

    // ── Outdoor trees ──
    TREES.forEach(([c, r]) => {
        const { x, y } = gc(c, r);
        if (x + cs < 0 || y + cs < 0 || x > W || y > H) return;
        drawFurniture(ctx, 'tree', c, r, cs);
    });

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
        drawCharacter(ctx, cx, cy, cs, cStatus);
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

// ═════════════════════════════════════════════════════════════
//  COMPONENT
// ═════════════════════════════════════════════════════════════
const CHAR_INIT = { col: 7, row: 14 };
const STEP_MS = 150;

export default function GridWorldSimulator() {
    const canvasRef = useRef(null), animRef = useRef(null);
    const isDragging = useRef(false), lastMouse = useRef({ x: 0, y: 0 });
    const charPosRef = useRef(CHAR_INIT), stepTimerRef = useRef(null);

    const [zoom, setZoom] = useState(0.65);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [hovered, setHovered] = useState(null);
    const [pois, setPois] = useState(loadPois);
    const [charPos, setCharPos] = useState(CHAR_INIT);
    const [charPath, setCharPath] = useState([]);
    const [charStatus, setCharStatus] = useState('idle');
    const [charLabel, setCharLabel] = useState(null);

    useEffect(() => { charPosRef.current = charPos; }, [charPos]);

    useEffect(() => {
        const onStorage = e => { if (e.key === POI_KEY || !e.key) setPois(loadPois()); };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    // Step engine
    useEffect(() => {
        if (!charPath.length) return;
        if (stepTimerRef.current) clearInterval(stepTimerRef.current);
        stepTimerRef.current = setInterval(() => {
            setCharPath(prev => {
                if (!prev.length) { clearInterval(stepTimerRef.current); setCharStatus('idle'); setCharLabel(null); return prev; }
                const [nc, nr] = prev[0];
                setCharPos({ col: nc, row: nr }); charPosRef.current = { col: nc, row: nr };
                const rest = prev.slice(1);
                if (!rest.length) {
                    clearInterval(stepTimerRef.current); setCharStatus('idle'); setCharLabel(null);
                    window.dispatchEvent(new CustomEvent('nanako:arrived', { detail: { pos: [nc, nr] } }));
                }
                return rest;
            });
        }, STEP_MS);
        return () => clearInterval(stepTimerRef.current);
    }, [charPath]);

    const handleMoveTo = useCallback((detail) => {
        let ec, er, label;
        if (detail.location) {
            const poi = findLocation(detail.location, pois);
            if (!poi) { window.dispatchEvent(new CustomEvent('nanako:blocked', { detail: { reason: 'unknown_location' } })); return; }
            ec = poi.col; er = poi.row; label = poi.label;
        } else if (Array.isArray(detail.target)) {
            [ec, er] = detail.target; label = `(${ec},${er})`;
        } else return;
        const { col: sc, row: sr } = charPosRef.current;
        const path = findPath(sc, sr, ec, er);
        if (!path) {
            setCharStatus('blocked');
            window.dispatchEvent(new CustomEvent('nanako:blocked', { detail: { reason: 'no_path' } }));
            setTimeout(() => setCharStatus('idle'), 1500); return;
        }
        const steps = path.slice(1); if (!steps.length) return;
        setCharLabel(label); setCharStatus('moving'); setCharPath(steps);
        window.dispatchEvent(new CustomEvent('nanako:moving', { detail: { target: [ec, er], label, path_length: steps.length } }));
    }, [pois]);

    useEffect(() => {
        const h = e => handleMoveTo(e.detail);
        window.addEventListener('nanako:move_to', h);
        return () => window.removeEventListener('nanako:move_to', h);
    }, [handleMoveTo]);

    // ── query_pos: 外部可查询当前坐标 ────────────────────────────────────────
    useEffect(() => {
        const respond = () => {
            const { col, row } = charPosRef.current;
            const currentPois = loadPois();
            // Find nearest named location (by Manhattan distance)
            let nearest = null, minDist = Infinity;
            currentPois.forEach(p => {
                const d = Math.abs(p.col - col) + Math.abs(p.row - row);
                if (d < minDist) { minDist = d; nearest = p; }
            });
            const detail = {
                col, row,
                location: nearest?.name || null,
                location_label: nearest?.label || null,
                distance_to_location: minDist,
            };
            window.dispatchEvent(new CustomEvent('nanako:position', { detail }));
        };
        window.addEventListener('nanako:query_pos', respond);
        // Also expose as a simple global function for console testing
        window.nanakoGetPos = () => { respond(); return charPosRef.current; };
        return () => {
            window.removeEventListener('nanako:query_pos', respond);
            delete window.nanakoGetPos;
        };
    }, []);

    const draw = useCallback(() => {
        const cv = canvasRef.current; if (!cv) return;
        drawScene(cv.getContext('2d'), cv.width, cv.height, zoom, offset, pois,
            charPosRef.current.col, charPosRef.current.row, charStatus, charLabel, hovered);
    }, [zoom, offset, pois, charStatus, charLabel, hovered]);

    useEffect(() => {
        const loop = () => { draw(); animRef.current = requestAnimationFrame(loop); };
        animRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animRef.current);
    }, [draw]);

    useEffect(() => {
        const cv = canvasRef.current; if (!cv) return;
        const resize = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
        resize(); const ro = new ResizeObserver(resize); ro.observe(cv);
        return () => ro.disconnect();
    }, []);

    const getRC = e => {
        const cv = canvasRef.current; if (!cv) return null;
        const r = cv.getBoundingClientRect(), cs = CELL * zoom;
        const col = Math.floor((e.clientX - r.left - offset.x) / cs);
        const row = Math.floor((e.clientY - r.top - offset.y) / cs);
        return (col >= 0 && col < COLS && row >= 0 && row < ROWS) ? { col, row } : null;
    };
    const onMouseMove = e => {
        setHovered(getRC(e));
        if (isDragging.current) {
            setOffset(o => ({ x: o.x + e.clientX - lastMouse.current.x, y: o.y + e.clientY - lastMouse.current.y }));
            lastMouse.current = { x: e.clientX, y: e.clientY };
        }
    };
    const onMouseDown = e => { isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; };
    const onMouseUp = () => isDragging.current = false;
    const onMouseLeave = () => { isDragging.current = false; setHovered(null); };
    const onWheel = e => { e.preventDefault(); setZoom(z => +(Math.max(0.3, Math.min(4, z + (e.deltaY < 0 ? .1 : -.1))).toFixed(2))); };
    const onClick = e => { if (!isDragging.current) { const rc = getRC(e); if (rc) handleMoveTo({ target: [rc.col, rc.row] }); } };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center font-sans pt-20 pb-6 px-4 select-none">
            <div className="w-full max-w-6xl mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent tracking-wide">🗺️ NANAKO WORLD MAP</h1>
                    <p className="text-slate-500 text-xs mt-0.5">{COLS}×{ROWS} · 精装修版 · 点击移动</p>
                </div>
                <div className="flex items-center gap-2">
                    {[['＋', .2], ['－', -.2]].map(([l, d]) => (
                        <button key={l} onClick={() => setZoom(z => +(Math.max(0.3, Math.min(4, z + d)).toFixed(2)))}
                            className="w-9 h-9 bg-slate-800 text-slate-200 border border-slate-700 rounded-xl font-bold text-lg hover:bg-slate-700 transition-colors">{l}</button>
                    ))}
                    <span className="text-slate-400 font-mono text-sm w-14 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => { setZoom(0.65); setOffset({ x: 0, y: 0 }); }}
                        className="px-3 h-9 bg-slate-700 text-slate-300 border border-slate-600 rounded-xl text-xs font-bold hover:bg-slate-600 transition-colors">重置</button>
                </div>
            </div>
            <div className="w-full max-w-6xl mb-3 flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="font-mono text-sm text-emerald-400">
                    {charStatus === 'moving' ? `🚶 前往 ${charLabel || '...'}`
                        : charStatus === 'blocked' ? '❌ 无法到达目标'
                            : hovered ? `[${hovered.col},${hovered.row}] · 点击移动 · 拖拽平移 · 滚轮缩放`
                                : '点击地图移动菜菜子 · 拖拽平移 · 滚轮缩放'}
                </span>
                <span className="ml-auto text-xs font-mono text-slate-500">
                    菜菜子 [{charPos.col},{charPos.row}]{charPath.length > 0 && <span className="text-emerald-500 ml-1">→{charPath.length}格</span>}
                </span>
            </div>
            <div className="w-full max-w-6xl border border-slate-700 rounded-2xl overflow-hidden shadow-2xl shadow-black/60" style={{ height: 620 }}>
                <canvas ref={canvasRef} className="w-full h-full block"
                    style={{ cursor: isDragging.current ? 'grabbing' : 'pointer' }}
                    onWheel={onWheel} onMouseMove={onMouseMove} onMouseDown={onMouseDown}
                    onMouseUp={onMouseUp} onMouseLeave={onMouseLeave} onClick={onClick} />
            </div>
            <p className="text-slate-700 text-[10px] mt-3">Pure canvas renderer · 精装修版 · 48×28</p>
        </div>
    );
}
